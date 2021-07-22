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
          handleBridgeTx(event, scanner);
          break;
        case "multisig":
          handleMultsigTx(event, scanner);
          break;
      }
    });
  });
};

function isMintingTx(bridgeTx) {
  return (
    bridgeTx["nonce"] &&
    bridgeTx["recipient"] &&
    bridgeTx["value"] &&
    bridgeTx["tx_hash"]
  );
}

async function handleBridgeTx(event, scanner) {
  console.log("processing bridge event", event.toJSON());
  // need to make sure it BridgeTxScheduled event
  const [submitter, bridgeTx, blockNumber] = event.data;
  if (isMintingTx(bridgeTx)) {
    const txHash = "0x" + Buffer.from(bridgeTx["tx_hash"]).toString("hex");

    const lockerTx = scanner.db.getEthTx(txHash);
    if (!lockerTx) {
      console.log("[INVALID] locker TXN was not found");
      return;
    }
    validateEvent(bridgeTx, lockerTx);
  } else {
    console.log("ignoring non minting bridge event");
  }
}

async function handleMultsigTx(event, scanner) {
  const [submitter, contractAddr, proposalId] = event.data;

  const proposal = await api.query.multiSig.proposals([
    contractAddr,
    proposalId,
  ]);
  if (!proposal) {
    console.error(
      `proposal at ${contractAddr} ID: ${proposalId} was not found `
    );
    return;
  }
  console.log("received proposal!");
  if (proposal["args"]["bridge_tx"]) {
    const bridgeTx = proposal["args"]["bridge_tx"];
    const lockerTx = scanner.getEthTx(bridgeTx["tx_hash"]);
    validateEvent(bridgeTx, lockerTx);
  } else {
    console.log(
      `Received proposal that was not a bridge_tx: ${proposal.toJSON()}`
    );
  }
}

function validateEvent(bridgeTx, lockerTx) {
  const differentAmount = bridgeTx.amount !== lockerTx.tokens,
    differentEthAddress = bridgeTx.eth_address !== lockerTx.eth_address,
    differentMeshAddress = bridgeTx.mesh_address !== lockerTx.mesh_address;

  if (differentAmount || differentEthAddress || differentMeshAddress) {
    console.log(
      `[INVALID] fields did not match Polylocker fields: ${bridgeTx.toJSON()}`
    ); // TODO add more description about this transaction
  } else {
    console.log("Detected valid bridge transaction");
  }
}

main();
