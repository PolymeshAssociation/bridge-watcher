# Bridge Watcher

This repository contains a reconciler script for the POLY to POLYX bridge.

EventScanner will scan the PolyLocker smart contract on the ethereum chain and store all the transactions it finds.

This is configurable with:

## Required Parameters

- POLYMESH_URL - The URL of a Polymesh node
- CONTRACT - The address of the PolyLocker contract
- START_BLOCK - The earliest block to scan from.
- ETH_URL - The URL of an ethereum node
- CONFIRMATIONS - The number of confirmations to consider a transaction finalized
- MNEMONIC - The mnemonic of the account that is able to freeze the bridge

## Optional Parameters

- TELEMETRY - The URL to report bridge-watcher heartbeats to
- USERNAME - The username for the bridge-watcher heartbeat URL
- PASSWORD - The password for the bridge-watcher heartbeat URL
- SLACK_HOOK - A slack hook to send message to when a bad transaction is detected

See `.env.sample` for example values

These can be set in the `.env` file or as normal ENV variables.

If using the docker image, you can use an env file to pass these variable in

```sh
  docker run -d --env-file .env --restart unless-stopped polymathnet/bridge-watcher
```

`main()` in `index.js` will subscribe to all Polymesh events and will validate the incoming `BridgeTx`. It will use the `tx_hash` to lookup the PolyLocker transaction, and compare the fields. If they differ it will log the discrepancy.

We may want to change this pattern and use the `tx_hash` to lookup the PolyLocker from the ETH_URL instead of creating a potentially large in memory data structure.

You can get the ETH_URL by creating an account at [Infura](https://infura.io/) and creating a ETH project.

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
