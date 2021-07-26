const fs = require("fs");
const path = require("path");
const execFileSync = require("child_process").execFileSync;
const winston = require("winston");

const { ApiPromise, WsProvider } = require("@polkadot/api");
const validateTx = require("./lib/validateTx");
const hexEncode = require("./lib/hexEncode");
const EthScanner = require("./lib/EthScanner");
const MeshScanner = require("./lib/MeshScanner");
const schemaPath = path.join(__dirname, "data", "polymesh_schema.json");
require("dotenv").config(); // Load .env file
const schemaUrl =
  "https://raw.githubusercontent.com/PolymathNetwork/Polymesh/alcyone/polymesh_schema.json";

const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({ format: winston.format.simple() }),
  ],
});

if (!fs.existsSync(schemaPath)) {
  logger.info("Downloading schema. Please wait.");
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
  const ethScanner = new EthScanner(web3URL, contractAddr, logger);

  const { types, rpc } = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
  const provider = new WsProvider(process.env.POLYMESH_URL);
  const api = await ApiPromise.create({
    provider,
    types,
    rpc,
  });
  const meshScanner = new MeshScanner(api, logger);

  switch (args[0]) {
    case "watch":
      meshScanner.subscribe(makeMeshHandler(meshScanner, ethScanner));
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
        logger.info("tx command needs the PolyLocker tx_hash passed");
      } else {
        await validateEthTx(meshScanner, ethScanner, txHash);
      }
      break;
    default:
      logger.info("Usage: yarn start [watch|mesh|eth]");
  }
  process.exit();
};

async function validateEthTx(meshScanner, ethScanner, txHash) {
  const ethTx = await ethScanner.getTx(txHash);
  if (!ethTx) {
    logger.warn(`PolyLocker tx not found with hash: ${txHash}`);
    return;
  }
  const bridgeTxs = await meshScanner.fetchAllTxs();
  const bridgeTx = bridgeTxs[ethTx.tx_hash];
  validate(bridgeTx, ethTx);
}

// subscribes to Polymesh events.
const bridgeMethods = ["bridgTx"];
function makeMeshHandler(meshScanner, ethScanner) {
  return async (events) => {
    logger.info(`received ${events.length} poly events`);
    for (const { event } of events) {
      switch (event.section) {
        case "bridge":
          handleBridgeTx(event, ethScanner);
          break;
        case "multiSig":
          handleMultsigTx(event, meshScanner, ethScanner);
          break;
      }
    }
  };
}

// Pulls all bridgeTxDetails and compares it to the corresponding PolyLocker event.
async function validateAllMeshTxs(meshScanner, ethScanner) {
  await ethScanner.scanAll();
  const txs = await meshScanner.fetchAllTxs();
  logger.info(`validating ${Object.keys(txs).length} mesh transactions`);
  for (const [txHash, tx] of Object.entries(txs)) {
    const ethTx = await ethScanner.getTx(txHash);
    validate(tx, ethTx);
  }
}

// Gets all PolyLocker events and attempts to find the corresponding Polymesh events.
async function validateAllEthTxs(meshScanner, ethScanner) {
  const meshTxs = await meshScanner.fetchAllTxs();
  await ethScanner.scan();
  for (const ethTx of ethScanner.listEthTxs()) {
    const meshTx = meshTxs[ethTx["tx_hash"]];
    if (!meshTx) {
      logger.warn(`Mesh Tx was not found by tx_hash: ${ethTx["tx_hash"]}`);
      continue;
    }
    validate(meshTx, ethTx);
  }
}

async function handleBridgeTx(event, ethScanner) {
  if (event.method === "TxsHandled") {
    handleTxsHandled(event);
    return;
  }
  const [submitter, bridgeTx] = event.data;
  if (Array.isArray(bridgeTx)) {
    for (const tx of bridgeTx) {
      if (isMintingTx(bridgeTx)) {
        const txHash = hexEncode(bridgeTx["tx_hash"]);
        const ethTx = await ethScanner.getTx(txHash);
        validate(bridgeTx, ethTx);
      }
    }
  } else if (isMintingTx(bridgeTx)) {
    const txHash = hexEncode(bridgeTx["tx_hash"]);
    const ethTx = await ethScanner.getTx(txHash);
    validate(bridgeTx, ethTx);
  }
}

async function handleTxsHandled(event) {
  const [txs] = event.data;
  for (const [nonce, error] of txs) {
    logger.info(`bridge tx handled, nonce: ${nonce.toHuman()}`);
  }
}

// A multisig proposal event only references the proposal.
async function handleMultsigTx(event, meshScanner, ethScanner) {
  if (event.method !== "ProposalAdded") return;
  const [submitter, contractAddr, proposalId] = event.data;

  const proposal = await meshScanner.getProposal(
    contractAddr.toJSON(),
    proposalId.toJSON()
  );
  if (!proposal) {
    logger.error(
      `proposal at ${contractAddr} ID: ${proposalId} was not found `
    );
    return;
  }
  const proposalObj = proposal.toJSON();
  const args = proposalObj["args"];
  if (Array.isArray(args["bridge_txs"])) {
    for (const bridgeTx of args["bridge_txs"]) {
      if (isMintingTx(bridgeTx)) {
        const ethTx = await ethScanner.getTx(bridgeTx["tx_hash"]);
        validate(bridgeTx, ethTx);
      }
    }
  } else if (args["bridge_tx"]) {
    const bridgeTx = args["bridge_tx"];
    const ethTx = await ethScanner.getTx(bridgeTx["tx_hash"]);
    validate(bridgeTx, ethTx);
  } else {
    logger.info(`Received proposal that was not a bridge_tx`);
  }
}

function validate(bridgeTx, ethTx) {
  const errors = validateTx(bridgeTx, ethTx);
  let meshAddress = bridgeTx
    ? bridgeTx["recipient"] || bridgeTx["mesh_address"]
    : "unknown";
  const bridgeNonce = bridgeTx ? bridgeTx["nonce"] : undefined;
  const txHash = ethTx ? ethTx["tx_hash"] : "unknown";
  const details = `Mesh Address: ${meshAddress} ${
    bridgeNonce ? "BridgeTx nonce: " + bridgeNonce + ", " : ""
  }eth tx_hash: ${txHash}`;
  if (errors.length > 0) {
    logger.warn(`[INVALID] ${details}. Problems: ${errors}`);
  } else {
    logger.info("Valid transaction detected");
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
  logger.error(`exiting ${error}`);
  process.exit(-1);
});
