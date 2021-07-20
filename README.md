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

### TODO

Events from `multisig` still need to be handled

## Getting started

1. `cp .env.sample .env`
1. `yarn`

The app should now be ready to be ran with:
`yarn start`
