const fs = require("fs");
const path = require("path");
const execFileSync = require("child_process").execFileSync;

const { ApiPromise, WsProvider } = require("@polkadot/api");
const validateTx = require("./lib/validateTx");
const hexEncode = require("./lib/hexEncode");
const EthScanner = require("./lib/EthScanner");
const MeshScanner = require("./lib/MeshScanner");
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
  const args = process.argv.slice(2);

  const web3URL = process.env.WEB3_URL;
  const contractAddr = process.env.POLYLOCKER_ADDR;
  const ethScanner = new EthScanner(web3URL, contractAddr);

  const { types, rpc } = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
  const provider = new WsProvider(process.env.POLYMESH_URL);
  const api = await ApiPromise.create({
    provider,
    types,
    rpc,
  });
  const meshScanner = new MeshScanner(api);

  switch (args[0]) {
    case "watch":
      meshScanner.subscribe(makeMeshHandler(ethScanner));
      return; // don't fallthorugh to process.exit()
    case "mesh":
      await validateAllMeshTxs(meshScanner, ethScanner);
      break;
    case "eth":
      await validateAllEthTxs(meshScanner, ethScanner);
      break;
    case "tx":
      const txHash = args[1];
      if (!txHash) {
        console.log("tx command needs the PolyLocker tx_hash passed");
      } else {
        await validateEthTx(meshScanner, ethScanner, txHash);
      }
      break;
    default:
      console.log("Usage: yarn start [watch|mesh|eth]");
  }
  process.exit();
};

async function validateEthTx(meshScanner, ethScanner, txHash) {
  const ethTx = await ethScanner.getTx(txHash);
  const bridgeTxs = await meshScanner.fetchAllTxs();
  const bridgeTx = bridgeTxs[ethTx.tx_hash];
  if (!bridgeTx) {
    console.log("bridgeTx not found");
  } else {
    validate(bridgeTx, ethTx);
  }
}

// subscribes to Polymesh events.
function makeMeshHandler(ethScanner) {
  return async (events) => {
    console.log(`received ${events.length} poly events`);
    for (const { event } of events) {
      switch (event.section) {
        case "bridge":
          if (event.method == "bridgeTx") handleBridgeTx(event, ethScanner);
          break;
        case "multisig":
          if (event.method == "Proposed") handleMultsigTx(event, ethScanner);
          break;
      }
    }
  };
}

// Pulls all bridgeTxDetails and compares it to the corresponding PolyLocker event.
async function validateAllMeshTxs(meshScanner, ethScanner) {
  await ethScanner.scanAll();
  const txs = await meshScanner.fetchAllTxs();
  console.log(`validating ${txs.length} mesh transactions`);
  for (const [txHash, tx] of Object.entries(txs)) {
    const ethTx = await ethScanner.getTx(txHash);
    if (!ethTx) {
      console.log("ethTx not found with hash", txHash);
    } else {
      validate(tx, ethTx);
    }
  }
}

// Gets all PolyLocker events and attempts to find the corresponding Polymesh events.
async function validateAllEthTxs(meshScanner, ethScanner) {
  const meshTxs = await meshScanner.fetchAllTxs();
  await ethScanner.scan();
  for (const ethTx of ethScanner.listEthTxs()) {
    const meshTx = meshTxs[ethTx["tx_hash"]];
    if (!meshTx) {
      console.log(`Mesh Tx was not found by tx_hash: ${ethTx["tx_hash"]}`);
      continue;
    }
    validate(meshTx, ethTx);
  }
}

async function handleBridgeTx(event, ethScanner) {
  // TODO: check for array of bridgeTx?
  const [submitter, bridgeTx, blockNumber] = event.data;
  if (isMintingTx(bridgeTx)) {
    const txHash = make(bridgeTx["tx_hash"]);

    const ethTx = await ethScanner.getTx(txHash);
    if (!ethTx) {
      console.log("[INVALID] PolyLocker TXN was not found");
      return;
    }
    validate(bridgeTx, ethTx);
  }
}

// A multisig proposal event only references the proposal.
async function handleMultsigTx(event, ethScanner) {
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
  if (proposal["args"]["bridge_tx"]) {
    const bridgeTx = proposal["args"]["bridge_tx"];
    const ethTx = await ethScanner.getTx(bridgeTx["tx_hash"]);
    if (!ethTx) {
      console.log("could not find eth tx by hash: ", bridgeTx["tx_hash"]);
      return;
    }
    validate(bridgeTx, ethTx);
  } else {
    console.log(
      `Received proposal that was not a bridge_tx: ${proposal.toJSON()}`
    );
  }
}

function validate(bridgeTx, ethTx) {
  const errors = validateTx(bridgeTx, ethTx);
  if (errors.length > 0) {
    console.log(`[INVALID] ${errors}`);
  } else {
    console.log("Valid transaction detected");
  }
}

function isMintingTx(meshTx) {
  return (
    meshTx["nonce"] &&
    meshTx["recipient"] &&
    meshTx["value"] &&
    meshTx["tx_hash"]
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(-1);
});
