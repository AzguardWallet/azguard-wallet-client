# @azguardwallet/client

[![GitHub License](https://img.shields.io/github/license/AzguardWallet/azguard-wallet-client)](https://github.com/AzguardWallet/azguard-wallet-client/blob/main/LICENSE)
[![NPM Version](https://img.shields.io/npm/v/@azguardwallet/client)](https://www.npmjs.com/package/@azguardwallet/client)
[![NPM Downloads](https://img.shields.io/npm/dt/@azguardwallet/client)](https://www.npmjs.com/package/@azguardwallet/client)

Simple client for interacting with the Azguard Wallet via inpage RPC, simplifying session management routine and events handling.

See Azguard RPC specification and available operation types here: https://github.com/AzguardWallet/azguard-wallet-types/blob/main/src/operation.ts

Install the package:

```shell
npm install @azguardwallet/client
```

## How to connect to Azguard wallet:

This example demonstrates a basic connection workflow:

```js
import { AzguardClient } from "@azguardwallet/client";

// check if the Azguard Wallet extension is installed
if (!await AzguardClient.isAzguardInstalled()) {
    // if not, then suggest the user to install it from Chrome Web Store
    // https://chromewebstore.google.com/detail/azguard-wallet/pliilpflcmabdiapdeihifihkbdfnbmn
    return;
}

// create a wallet client
const azguard = await AzguardClient.create();

// handle wallet disconnection, if needed
azguard.onDisconnected.addHandler(() => {
    console.log("Wallet disconnected");
})

// connect to the wallet if it's not connected yet
if (!azguard.connected) {
    await azguard.connect(
        {
            // provide the dapp metadata to be displayed to wallet user
            name: "My Dapp",
        },
        [
            {
                // specify one or more chains you want to connect to:
                // "aztec:11155111" - testnet,
                // "aztec:1337" - devnet,
                // "aztec:31337" - sandbox
                chains: ["aztec:11155111"],
                // specify a list of operations and actions your dapp is going to use
                methods: ["send_transaction", "add_private_authwit", "call"],
            },
        ],
    );
}
```

## How to send transaction

This is a simple example of how to send a transaction with private authwit:

```ts
// send a transaction with private authwit
const [ result ] = await azguard.execute([
    {
        kind: "send_transaction",
        account: azguard.accounts[0],
        actions: [
            {
                kind: "add_private_authwit",
                content: {
                    kind: "call",
                    caller: "0x1111...",
                    contract: "0x2222...",
                    method: "transfer_in_private",
                    args: [
                        "0x3333...",
                        "0x1111...",
                        100n,
                        123,
                    ],
                },
            },
            {
                kind: "call",
                contract: "0x1111...",
                method: "swap",
                args: [
                    "0x2222...",
                    100n,
                ],
            },
        ],
    }
])

// check the result status
if (result.status !== "ok") {
    throw new Error(result.error);
}

// print the tx hash
console.log(result.result);
```

## Simulating view functions

Another example, demonstrating how to read contract's data by simulating its view functions:

```ts
const account = azguard.accounts[0];
const address = account.split(":").at(-1);

const [ result ] = await azguard.execute([
    {
        kind: "simulate_views",
        account: account,
        calls: [
            {
                kind: "call",
                contract: "0x2ab7cf582347c8a2834e0faf98339372118275997e14c5a77054bb345362e878",
                method: "balance_of_public",
                args: [ address ],
            },
            {
                kind: "call",
                contract: "0x2ab7cf582347c8a2834e0faf98339372118275997e14c5a77054bb345362e878",
                method: "balance_of_private",
                args: [ address ],
            },
        ],
    },
])

if (result.status !== "ok") {
    throw new Error(result.error);
}

const publicBalance = (result.result as SimulateViewsResult).decoded[0];
const privateBalance = (result.result as SimulateViewsResult).decoded[1];
```

## Contracts registration

In Aztec in order to interact with a contract (simulate or execute its functions, generate proofs, etc.) you have to register it in the wallet beforehand.

So, if the contract you are going to interact with hasn't been registered in the wallet yet, you will need to add the `register_contract` operation to the beginning of the batch:

```ts
const [
    registerContractResult, 
    simulateViewsResult,
    sendTransactionResult
 ] = await azguard.execute([
    {
        kind: "register_contract",
        chain: yourChain,
        address: yourContractAddress,
        instance: yourContractInstance,
        artifact: yourContractArtifact,
    },
    {
        kind: "simulate_views",
        ...
    },
    {
        kind: "send_transaction",
        ...
    },
]);
```

Note, contract registration is only needed to be done once.

Also, you don't need to register protocol contracts (`0x0000..01` - `0x0000..06`), because they are registered out of the box.

## Disconnect the wallet

Once everything is done, you can disconnect the wallet:

```ts
await azguard.disconnect();
```

That's pretty much it :)

## Support channels

If you have any questions, feel free to contact us in:
- Telegram: https://t.me/azguardwallet
- Twitter: https://twitter.com/AzguardWallet

Cheers! 🍺