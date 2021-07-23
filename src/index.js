const { ApiPromise, WsProvider } = require("@polkadot/api");
const fs = require("fs");
const path = require("path");
const execFileSync = require("child_process").execFileSync;

const EthScanner = require("./lib/EthScanner");
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

  const scanner = new EthScanner();

  const { types, rpc } = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
  const provider = new WsProvider(process.env.POLYMESH_URL);
  const api = await ApiPromise.create({
    provider,
    types,
    rpc,
  });

  switch (args[0]) {
    case "watch":
      subscribe(api, scanner);
      break;
    case "mesh":
      validateAllMeshTxs(api, scanner);
      break;
    case "eth":
      validateAllEthTxs(api, scanner);
      break;
    default:
      console.log("Usage: yarn start [watch|mesh|eth]");
      process.exit();
  }
};

// subscribes to Polymesh events.
async function subscribe(api, scanner) {
  api.query.system.events(async (events) => {
    console.log(`received ${events.length} poly events`);
    for (const { event } of events) {
      switch (event.section) {
        case "bridge":
          if (event.method == "bridgeTx") handleBridgeTx(event, scanner);
          break;
        case "multisig":
          if (event.method == "Proposed") handleMultsigTx(event, scanner);
          break;
      }
    }
  });
}

// Pulls all bridgeTxDetails and compares it to the corresponding PolyLocker event.
async function validateAllMeshTxs(api, scanner) {
  const txs = await api.query.bridge.bridgeTxDetails.entries();
  for (const [key, tx] of txs) {
    const [meshAddress] = key.toHuman();
    tx["mesh_address"] = meshAddress; // put the recipient address back into the event
    const txHash = hexEncode(tx["tx_hash"]);
    const ethTx = await scanner.getTx(txHash);
    if (!ethTx) {
      console.log("ethTx not found with hash", txHash);
    } else {
      validateTx(tx, ethTx);
    }
  }
}

// Gets all PolyLocker events and attempts to find the corresponding Polymesh events.
async function validateAllEthTxs(api, scanner) {
  let meshTxs = {};
  const txs = await api.query.bridge.bridgeTxDetails.entries();
  for (const [key, tx] of txs) {
    const [meshAddress] = key.toHuman();
    tx["mesh_address"] = meshAddress;
    tx["tx_hash"] = hexEncode(tx["tx_hash"]);
    meshTxs[tx["tx_hash"]] = tx;
  }
  await scanner.scan();
  for (const ethTx of scanner.listEthTxs()) {
    const meshTx = meshTxs[ethTx["tx_hash"]];
    if (!meshTx) {
      console.log(`Mesh Tx was not found by tx_hash: ${ethTx["tx_hash"]}`);
      continue;
    }
    validateTx(meshTx, ethTx);
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

function hexEncode(hash) {
  return "0x" + Buffer.from(hash).toString("hex");
}

async function handleBridgeTx(event, scanner) {
  // TODO: check for array of bridgeTx?
  const [submitter, bridgeTx, blockNumber] = event.data;
  if (isMintingTx(bridgeTx)) {
    const txHash = make(bridgeTx["tx_hash"]);

    const ethTx = await scanner.getTx(txHash);
    if (!ethTx) {
      console.log("[INVALID] locker TXN was not found");
      return;
    }
    validateTx(bridgeTx, ethTx);
  } else {
    console.log("ignoring non minting bridge event");
  }
}

// A multisig proposal event only references the proposal.
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
  if (proposal["args"]["bridge_tx"]) {
    const bridgeTx = proposal["args"]["bridge_tx"];
    const ethTx = await scanner.getTx(bridgeTx["tx_hash"]);
    if (!ethTx) {
      console.log("could not find eth tx by hash: ", bridgeTx["tx_hash"]);
      return;
    }
    validateTx(bridgeTx, ethTx);
  } else {
    console.log(
      `Received proposal that was not a bridge_tx: ${proposal.toJSON()}`
    );
  }
}

function validateTx(meshTx, ethTx) {
  // POLY has 4 more 0s
  let errors = [];
  if (!meshTx.amount.eq(ethTx.tokens)) {
    errors.push(
      `different amounts. Polymesh amount: ${meshTx.amount.toString()}, PolyLocker amount: ${ethTx.tokens.toString()}`
    );
  }

  if (meshTx.tx_hash != ethTx.tx_hash) {
    errors.push(
      `differnt tx_hash. Polymesh hash: ${meshTx.tx_hash}, PolyLocker hash: ${ethTx.tx_hash}`
    );
  }

  // seems like no eth_address in details when querying historical meshTx events
  // if (meshTx["eth_address"] != ethTx["eth_address"]) {
  //   errors.push(
  //     `different addresses. Polymesh eth_addr: ${meshTx["eth_address"]} PolyLocker addr: ${ethTx["eth_address"]}`
  //   );
  // }
  if (meshTx.mesh_address !== ethTx.mesh_address) {
    errors.push(
      `differnt mesh_addresses. Polymesh mesh_address: ${meshTx["mesh_address"]} PolyLocker addr: ${ethTx["mesh_address"]}`
    );
  }

  if (errors.length > 0) {
    console.log("[INVALID TXN]. Errors:", errors);
  } else {
    console.log("Valid tx detected.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(-1);
});
