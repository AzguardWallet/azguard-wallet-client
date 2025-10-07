import type {
    AzguardRpcClient,
    CaipAccount,
    DappMetadata,
    DappPermissions,
    DappSession,
    Operation,
    OperationResult,
    WalletInfo,
} from "@azguardwallet/types";
import { EventHandlers, IEventHandlers } from "./event-handlers";
import { isCompatible } from "./version";

/** Simple client for interaction with the Azguard Wallet via inpage RPC */
export class AzguardClient {
    /** Indicates whether the wallet is connected or not */
    public get connected(): boolean {
        return !!this.#session;
    }

    /** List of approved account addresses */
    public get accounts(): CaipAccount[] {
        return this.#session?.accounts ?? [];
    }

    /** List of approved permissions */
    public get permissions(): DappPermissions[] {
        return this.#session?.permissions ?? [];
    }

    /** Event handlers invoked when the wallet is connected */
    public get onConnected(): IEventHandlers<void> {
        return this.#onConnected;
    }

    /** Event handlers invoked when the wallet is disconnected */
    public get onDisconnected(): IEventHandlers<void> {
        return this.#onDisconnected;
    }

    /** Event handlers invoked when the wallet user changes approved accounts */
    public get onAccountsChanged(): IEventHandlers<CaipAccount[]> {
        return this.#onAccountsChanged;
    }

    /** Event handlers invoked when the wallet user changes approved permissions */
    public get onPermissionsChanged(): IEventHandlers<DappPermissions[]> {
        return this.#onPermissionsChanged;
    }

    readonly #scope: string;
    readonly #onConnected: EventHandlers<void> = new EventHandlers();
    readonly #onDisconnected: EventHandlers<void> = new EventHandlers();
    readonly #onAccountsChanged: EventHandlers<CaipAccount[]> = new EventHandlers();
    readonly #onPermissionsChanged: EventHandlers<DappPermissions[]> = new EventHandlers();

    #rpc?: AzguardRpcClient;
    #session?: DappSession;

    private constructor(scope: string) {
        this.#scope = scope;
    }

    /**
     * Connects to the wallet
     * @param dappMetadata Dapp metadata
     * @param requiredPermissions List of required permissions the wallet user must approve
     * @param optionalPermissions List of optional permissions the wallet user may approve
     */
    public async connect(
        dappMetadata: DappMetadata,
        requiredPermissions: DappPermissions[],
        optionalPermissions?: DappPermissions[],
    ): Promise<void> {
        if (!this.#rpc) {
            throw new Error("Azguard Wallet is not installed");
        }
        this.#session = await this.#rpc.request("connect", {
            dappMetadata,
            requiredPermissions,
            optionalPermissions,
        });
        localStorage.setItem(`azguard:session:${this.#scope}`, this.#session.id);
        this.#onConnected.dispatch();
    }

    /**
     * Disconnects from the wallet
     */
    public async disconnect(): Promise<void> {
        if (!this.#session) {
            return;
        }
        await this.#rpc!.request("close_session", this.#session.id);
    }

    /**
     * Executes a batch of operations.
     * If one of the operations fails, all the subsequent operations are skipped.
     * @param operations Batch of operations to execute
     * @returns Array of results corresponding to the array of operations
     */
    public async execute(operations: Operation[]): Promise<OperationResult[]> {
        if (!this.#rpc) {
            throw new Error("Azguard Wallet is not installed");
        }
        if (!this.#session) {
            throw new Error("Azguard Wallet is not connected");
        }
        return await this.#rpc.request("execute", { sessionId: this.#session.id, operations });
    }

    /**
     * Requests information about the wallet
     * @returns Wallet info
     */
    public async getWalletInfo(): Promise<WalletInfo> {
        if (!this.#rpc) {
            throw new Error("Azguard Wallet is not installed");
        }
        return await this.#rpc.request("get_wallet_info");
    }

    readonly #onSessionUpdated = (session: DappSession) => {
        const permissionsChanged =
            this.permissions.length !== session.permissions.length ||
            this.permissions.some(
                (p, i) =>
                    (p.chains?.length ?? 0) !== (session.permissions[i].chains?.length ?? 0) ||
                    p.chains?.some((c, j) => c !== session.permissions[i].chains![j]) ||
                    (p.methods?.length ?? 0) !== (session.permissions[i].methods?.length ?? 0) ||
                    p.methods?.some((m, j) => m !== session.permissions[i].methods![j]) ||
                    (p.events?.length ?? 0) !== (session.permissions[i].events?.length ?? 0) ||
                    p.events?.some((e, j) => e !== session.permissions[i].events![j]),
            );
        const accountsChanged =
            this.accounts.length !== session.accounts.length ||
            this.accounts.some((a, i) => a !== session.accounts[i]);
        this.#session = session;
        if (permissionsChanged) {
            this.#onPermissionsChanged.dispatch(this.permissions);
        }
        if (accountsChanged) {
            this.#onAccountsChanged.dispatch(this.accounts);
        }
    };

    readonly #onSessionClosed = () => {
        this.#onDisconnected.dispatch();
        this.#session = undefined;
        localStorage.removeItem(`azguard:session:${this.#scope}`);
    };

    async #init(timeout: number): Promise<AzguardClient> {
        const azguard = await AzguardClient.getAzguardObject(timeout);
        if (azguard !== undefined) {
            if (!isCompatible(azguard.version)) {
                console.warn("Client version is not compatible with the wallet version");
            }

            const client = azguard.createClient();
            client.on("session_updated", this.#onSessionUpdated);
            client.on("session_closed", this.#onSessionClosed);

            const sessionId = localStorage.getItem(`azguard:session:${this.#scope}`);
            const session = sessionId
                ? (await client.request("get_session", sessionId)) ?? undefined
                : undefined;

            this.#rpc = client;
            this.#session = session;
        }
        return this;
    }

    /**
     * Creates Azguard client
     * @param scope Session scope (you can create multiple clients with different scopes to have parallel sessions with the wallet)
     * @param timeout Timeout in ms for the `window.azguard` object lookup
     * @returns AzguardClient instance
     */
    public static create(scope?: string, timeout: number = 300): Promise<AzguardClient> {
        return new AzguardClient(scope ?? "default").#init(timeout);
    }

    /**
     * Returns the `window.azguard` object or `undefined` if it doesn't exist.
     * Since content scripts load asynchronously, the `window.azguard` object may appear with some delay,
     * therefore this method does multiple retries with the specified `timeout`.
     * @param timeout Lookup timeout in ms
     */
    public static getAzguardObject(
        timeout: number = 300,
    ): Promise<{ version: string; createClient: () => AzguardRpcClient } | undefined> {
        return new Promise((resolve) => {
            let rest = timeout;
            const id = setInterval(() => {
                rest -= 10;
                if (window.azguard) {
                    clearInterval(id);
                    resolve(window.azguard);
                } else if (rest <= 0) {
                    clearInterval(id);
                    resolve(undefined);
                }
            }, 10);
        });
    }

    /**
     * Checks if the Azguard Wallet extension is installed, by observing the `window.azguard` object.
     * Since content scripts load asynchronously, the `window.azguard` object may appear with some delay,
     * therefore this method does multiple retries with the specified `timeout`.
     * @param timeout Lookup timeout in ms
     */
    public static async isAzguardInstalled(timeout: number = 300): Promise<boolean> {
        const azguard = await AzguardClient.getAzguardObject(timeout);
        return azguard !== undefined;
    }

    /**
     * Checks if the Azguard Wallet extension is installed, by observing the `window.azguard` object,
     * and also checks if the wallet and client versions are compatible (if not, the client may not work properly).
     * Since content scripts load asynchronously, the `window.azguard` object may appear with some delay,
     * therefore this method does multiple retries with the specified `timeout`.
     * @param timeout Lookup timeout in ms
     */
    public static async isAzguardInstalledAndCompatible(timeout = 300): Promise<boolean> {
        const azguard = await AzguardClient.getAzguardObject(timeout);
        return azguard !== undefined && isCompatible(azguard.version);
    }
}
