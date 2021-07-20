const { ApiPromise, WsProvider } = require("@polkadot/api");
const fs = require("fs");
const path = require("path");
const execFileSync = require("child_process").execFileSync;

const Web3 = require("web3");
const PolyLocker = require("./contracts/PolyLocker");
const EventScanner = require("./lib/EventScanner");
const schemaPath = path.join(__dirname, "data", "polymesh_schema.json");
require("dotenv").config(); // Load .env file
const schemaUrl =
  "https://raw.githubusercontent.com/PolymathNetwork/Polymesh/alcyone/polymesh_schema.json";

if (!fs.existsSync(schemaPath)) {
  console.log("Downloading schema. Please wait.");
  execFileSync("curl", [
    "--create-dirs",
    "-s",
    "-L",
    schemaUrl,
    "--output",
    schemaPath,
  ]);
}

const main = async () => {
  const scanner = new EventScanner();
  await scanner.scan();

  const { types, rpc } = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
  const provider = new WsProvider(process.env.POLYMESH_URL);
  const api = await ApiPromise.create({
    provider,
    types,
    rpc,
  });

  api.query.system.events(async (events) => {
    console.log(`received ${events.length} poly events`);
    await scanner.scan(); // Fetch txs so we are up to date.
    events.forEach(async (record) => {
      const { event } = record;
      switch (event.section) {
        case "bridge":
          handleBridgeTx(event);
          break;
        case "multisig":
          handleMultsigTx(event);
          break;
      }
    });
  });
};

function handleBridgeTx(event) {
  console.log("processing bridge event");
  const [submitter, bridgeTx, blockNumber] = event.data;
  const txHash = "0x" + Buffer.from(bridgeTx["tx_hash"]).toString("hex");

  const lockerTx = scanner.db.getEthTx(txHash);
  if (!lockerTx) {
    console.log("locker TXN was not found");
    return;
  }
  validateEvent(bridgeTx, lockerTx);
}

function handleMultsigTx(event) {
  console.log("[TODO] handling multisig event");
  // TODO
  // perform proposal look up to make bridgeTx object
  // fetch lockerTx
  // validate
}

function validateEvent(bridgeTx, lockerTx) {
  const differentAmount = bridgeTx.amount !== lockerTx.tokens, // check BN or decimal conversion?
    differentEthAddress = bridgeTx.eth_address !== lockerTx.eth_address,
    differentMeshAddress = bridgeTx.mesh_address !== lockerTx.mesh_address;

  if (differentAmount || differentEthAddress || differentMeshAddress) {
    console.log("INVALID TXN DETECTED!");
  }
}

main();
