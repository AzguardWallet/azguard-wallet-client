import {
    Action,
    AddPrivateAuthwitAction,
    DappMetadata,
    DappPermissions,
    EncodedCallAction,
    FailedResult,
    OkResult,
    SendTransactionResult,
    SimulateViewsResult,
} from "@azguardwallet/types";
import { AzguardClient } from "../../client";
import {
    Eip1193Provider,
    RpcRequest,
    RpcRequestMap,
    SerializedFunctionCall,
    TypedEip1193Provider,
} from "./types";

/** Azguard Wallet provider compatible with ShieldSwap's RPC spec */
export class ShieldSwapAzguardProvider implements Eip1193Provider, TypedEip1193Provider {
    #azguard: AzguardClient;

    private constructor(azguard: AzguardClient) {
        this.#azguard = azguard;
        this.#azguard.onAccountsChanged.addHandler(this.#accountsChanged);
        this.#azguard.onDisconnected.addHandler(this.#accountsChanged);
    }

    #aztec_requestAccounts = async (): Promise<string[]> => {
        const dappMetadata: DappMetadata = {
            name: window.location.host,
        };
        const requiredPermissions: DappPermissions[] = [];
        const optionalPermissions: DappPermissions[] = [
            {
                chains: [
                    "aztec:1337",   // devnet
                    "aztec:31337",  // local sandbox
                    "aztec:41337",  // azguard's shared sandbox
                ],
                methods: [
                    "send_transaction",
                    "simulate_views",
                    "encoded_call",
                    "add_private_authwit",
                ],
            },
        ];
        await this.#azguard.connect(dappMetadata, requiredPermissions, optionalPermissions);
        return this.#aztec_accounts();
    };

    #aztec_accounts = async (): Promise<string[]> => {
        return this.#azguard.accounts.map((x) => x.split(":").at(-1)!);
    };

    #aztec_sendTransaction = async (request: {
        from: string;
        calls: SerializedFunctionCall[];
        authWitnesses: {
            caller: string;
            action: SerializedFunctionCall;
        }[];
    }): Promise<string> => {
        const account = this.#azguard.accounts.find((x) => x.endsWith(request.from));
        if (!account) {
            throw new Error("Unauthorized account");
        }

        const actions: Action[] = [];

        actions.push(...request.authWitnesses.map((x) => ({
            kind: "add_private_authwit",
            content: {
                kind: "encoded_call",
                caller: x.caller,
                to: x.action.to,
                selector: x.action.selector,
                args: x.action.args,
            },
        } as AddPrivateAuthwitAction)));

        actions.push(...request.calls.map((x) => ({
            kind: "encoded_call",
            to: x.to,
            selector: x.selector,
            args: x.args,
        } as EncodedCallAction)));

        const [result] = await this.#azguard.execute([{ kind: "send_transaction", account, actions }]);
        if (result.status !== "ok") {
            throw new Error(`Operation failed: ${(result as FailedResult)?.error}`);
        }

        return (result as OkResult<SendTransactionResult>).result;
    };

    #aztec_call = async (request: {
        from: string;
        calls: SerializedFunctionCall[];
    }): Promise<string[][]> => {
        const account = this.#azguard.accounts.find((x) => x.endsWith(request.from));
        if (!account) {
            throw new Error("Unauthorized account");
        }

        const calls: EncodedCallAction[] = request.calls.map((x) => ({
            kind: "encoded_call",
            to: x.to,
            selector: x.selector,
            args: x.args,
        }));

        const [result] = await this.#azguard.execute([{ kind: "simulate_views", account, calls }]);
        if (result.status !== "ok") {
            throw new Error(`Simulation failed: ${(result as FailedResult)?.error}`);
        }

        return (result as OkResult<SimulateViewsResult>).result.encoded;
    };

    #wallet_watchAssets = async (): Promise<void> => {
        // noop
    };

    #accountsChanged = async () => {
        // TODO: emit RpcEventsMap.accountsChanged(await this.#aztec_accounts())
    };

    /**
     * Sends a request to the wallet
     * @param request Request to send
     * @returns Response received from the wallet
     */
    public request<M extends keyof RpcRequestMap>(
        request: RpcRequest<M>,
    ): Promise<ReturnType<RpcRequestMap[M]>> {
        const methods: {
            [K in keyof RpcRequestMap]: (
                ...args: Parameters<RpcRequestMap[K]>
            ) => Promise<ReturnType<RpcRequestMap[K]>>;
        } = {
            aztec_requestAccounts: this.#aztec_requestAccounts,
            aztec_accounts: this.#aztec_accounts,
            aztec_sendTransaction: this.#aztec_sendTransaction,
            aztec_call: this.#aztec_call,
            wallet_watchAssets: this.#wallet_watchAssets,
        };
        if (!(request.method in methods)) {
            throw new Error("Unsupported method");
        }
        return methods[request.method](...request.params);
    }

    /**
     * Creates Azguard Wallet provider compatible with ShieldSwap's RPC spec
     * @returns ShieldSwapAzguardProvider instance
     */
    public static async create(): Promise<ShieldSwapAzguardProvider> {
        return new ShieldSwapAzguardProvider(await AzguardClient.create());
    }

    /**
     * Checks if the Azguard Wallet extension is installed, by observing the `window.azguard` object
     */
    public static isAzguardInstalled() {
        return AzguardClient.isAzguardInstalled();
    }

    /**
     * Checks if the Azguard Wallet extension is installed, by observing the `window.azguard` object,
     * and also checks if the wallet and client versions are compatible (if not, the client may not work properly)
     */
    public static isAzguardInstalledAndCompatible() {
        return AzguardClient.isAzguardInstalledAndCompatible();
    }
}
