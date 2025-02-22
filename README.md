# @azguardwallet/client

[![GitHub License](https://img.shields.io/github/license/AzguardWallet/azguard-wallet-client)](https://github.com/AzguardWallet/azguard-wallet-client/blob/main/LICENSE)
[![NPM Version](https://img.shields.io/npm/v/@azguardwallet/client)](https://www.npmjs.com/package/@azguardwallet/client)
[![NPM Downloads](https://img.shields.io/npm/dt/@azguardwallet/client)](https://www.npmjs.com/package/@azguardwallet/client)

Simple client for interacting with the Azguard Wallet via inpage RPC, simplifying session management routine.
This library also includes wallet providers/adapters for various RPC specs.

## How to use AzguardClient

Install the package:

```shell
npm install @azguardwallet/client
```

Now let's see how to send a simple transaction with an authwit:

```js
import { AzguardClient } from '@azguardwallet/client';

// check if Azguard Wallet extension is installed
if (!AzguardClient.isAzguardInstalled()) {
    return;
}

// create a wallet client
const azguard = await AzguardClient.create();

// connect to the wallet
await azguard.connect(
    {
        name: "My Dapp"
    },
    [
        {
            chains: ["aztec:41337"],
            methods: ["send_transaction", "add_private_authwit", "call"],
        }
    ],
);

// send a transaction with private authwit
const [result] = await azguard.execute([
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
            }
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

That's pretty much it :)

You can find all available operation types here: https://github.com/AzguardWallet/azguard-wallet-types/blob/main/src/operation.ts

## How to use ShieldSwapAzguardProvider


Install the package:

```shell
npm install @azguardwallet/client
```

Now let's see how to send a simple transaction with an authwit:

```js
import { ShieldSwapAzguardProvider } from "@azguardwallet/client/providers";

// check if Azguard Wallet extension is installed
if (!ShieldSwapAzguardProvider.isAzguardInstalled()) {
    return;
}

// create a wallet provider
const wallet = await ShieldSwapAzguardProvider.create();

// connect to the wallet
const accounts = await wallet.request({
    method: "aztec_requestAccounts",
    params: []
});

// send a transaction with private authwit
const txHash = await wallet.request({
    method: "aztec_sendTransaction",
    params: [{
        from: accounts[0],
        calls: [
            {
                to: "0x1111...",
                selector: "0xcde5df49",
                args: [
                    "0x2222...",
                    "0x00...64",
                    "0x00...00",
                ],
            },
        ],
        authWitnesses: [
            {
                caller: "0x1111...",
                action: {
                    to: "0x2222...",
                    selector: "0x2a6e303d",
                    args: [
                        "0x3333...",
                        "0x1111...",
                        "0x00...64",
                        "0x00...00",
                        "0x00...7b",
                        "0x00...00",
                    ],
                }
            }
        ]
    }]
});

// print the tx hash
console.log(txHash);
```

That's pretty much it :)

You can find ShieldSwap's RPC spec here: https://github.com/olehmisar/aztec-wallet-sdk/blob/main/src/types.ts

## Support channels

If you have any questions, feel free to contact us in:
- Discord: https://discord.gg/SwBbwSXr
- Twitter: https://twitter.com/AzguardWallet

Cheers! 🍺