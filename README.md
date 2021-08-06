# Bridge Watcher

This repository contains a reconciler script for the POLY to POLYX bridge.

EventScanner will scan the PolyLocker smart contract on the ethereum chain and store all the transactions it finds.
This is configurable with:

- POLYLOCKER_ADDR (The address of the PolyLocker contract e.g. `0x9791be69F613D372E09EbA611d25157A5512c5c8`)
- WEB3_URL (The address of the ETH node e.g. wss://kovan.infura.io/ws/v3/{PROJECT_ID})
- START_BLOCK (What block to start scanning from.)
- CONFIRMATIONS (How many confirmations should it take to be considered finalized)

These can be set in the `.env` file or as normal ENV variables.

`main()` in `index.js` will subscribe to all Polymesh events and will validate the incoming `BridgeTx`. It will use the `tx_hash` to lookup the PolyLocker transaction, and compare the fields. If they differ it will log the discrepancy.

We may want to change this pattern and use the `tx_hash` to lookup the PolyLocker from the WEB3_URL instead of creating a potentially large in memory data structure.

You can get a WEB3_URL by creating an account at [Infura](https://infura.io/) and creating a ETH project.

## Logging

If an invalid transaction is found the log line will beging with `[INVALID]`. This may happen if a Polymesh transaction does not have a corresponding PolyLocker transaction, vice versa, or their paramaters differ. For now extra information is logged to STDOUT, but a `| grep INVALID` will find only the invalid log lines.

## Getting started

1. `cp .env.sample .env`
1. `yarn`

The app should now be ready to be ran with:
`yarn start`

Which will print a help menu. There are four commands that can be invoked like

- `yarn start watch` subscribed to Polymesh events and will verify them against the PolyLocker contract
- `yarn start eth` Will scan all PolyLocker transactions and attempt to find the corresponding Bridge event
- `yarn start mesh` Will scan all BridgeTx and attempt to find a matching PolyLocker transactions.
- `yarn start tx <hash>` Attempts to find the PolyLocker transaction and verify it against BridgeTx.

## Testing variables

There are multiple testing networks and PolyLocker contracts. Here are some testnet / contract pairs.

Kovan -> Alcyone:

```
POLYMESH_URL=wss://alcyone-rpc.polymesh.live
CONTRACT=0x636ed3919906F6B1abe54cAEB2497067C4fC9bA7
START_BLOCK=20331467
```

Kovan -> PME:

```
POLYMESH_URL=wss://pme.polymath.network/
CONTRACT=0x9791be69F613D372E09EbA611d25157A5512c5c8
START_BLOCK=18830739
```

### TODOs

- Add support batchBridgeTx
- Add tests
