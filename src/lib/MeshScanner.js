const hexEncode = require("./hexEncode");
const { validate } = require("./validateTx");

class MeshScanner {
  constructor(api, logger) {
    this.api = api;
    this.logger = logger;
  }

  async fetchAllTxs() {
    let meshTxs = {};
    this.logger.info("fetching all bridgeTx details. This might take a while.");
    const txs = await this.api.query.bridge.bridgeTxDetails.entries();
    for (const [key, tx] of txs) {
      const [mesh_address] = key.toHuman();
      const internalTx = {
        amount: tx.amount,
        tx_hash: hexEncode(tx.tx_hash),
        mesh_address,
      };
      meshTxs[internalTx.tx_hash] = internalTx;
    }
    return meshTxs;
  }

  async getProposal(multiSigAddr, proposalId) {
    return await this.api.query.multiSig.proposals([multiSigAddr, proposalId]);
  }

  subscribe(ethScanner) {
    this.api.query.system.events(
      makeMeshHandler(this, ethScanner, this.logger)
    );
  }
}

// subscribes to Polymesh events.
function makeMeshHandler(meshScanner, ethScanner, logger) {
  return async (events) => {
    logger.debug(`received ${events.length} poly events`);
    for (const { event } of events) {
      switch (event.section) {
        case "bridge":
          await handleBridgeTx(event, ethScanner, logger);
          break;
        case "multiSig":
          await handleMultsigTx(event, meshScanner, ethScanner, logger);
          break;
      }
    }
  };
}

async function handleBridgeTx(event, ethScanner, logger) {
  if (event.method === "TxsHandled") {
    handleTxsHandled(event, logger);
    return;
  }
  const [submitter, data] = event.data;
  if (Array.isArray(data)) {
    for (const tx of data) {
      if (isMintingTx(tx)) {
        const txHash = hexEncode(tx["tx_hash"]);
        const ethTx = await ethScanner.getTx(txHash);
        validate(tx, ethTx, logger);
      }
    }
  } else if (isMintingTx(data)) {
    const txHash = hexEncode(data["tx_hash"]);
    const ethTx = await ethScanner.getTx(txHash);
    validate(data, ethTx, logger);
  }
}

async function handleTxsHandled(event, logger) {
  const [txs] = event.data;
  for (const [nonce, error] of txs) {
    logger.info(`bridge tx handled, nonce: ${nonce.toHuman()}`);
  }
}

// A multisig proposal event only references the proposal.
async function handleMultsigTx(event, meshScanner, ethScanner, logger) {
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
        validate(bridgeTx, ethTx, logger);
      }
    }
  } else if (args["bridge_tx"]) {
    const bridgeTx = args["bridge_tx"];
    const ethTx = await ethScanner.getTx(bridgeTx["tx_hash"]);
    validate(bridgeTx, ethTx, logger);
  } else {
    logger.info(`Received proposal that was not a bridge_tx`);
  }
}

function isMintingTx(meshTx) {
  return (
    meshTx["nonce"] &&
    (meshTx["mesh_address"] || meshTx["recipient"]) &&
    meshTx["value"] &&
    meshTx["tx_hash"]
  );
}

exports.MeshScanner = MeshScanner;
exports.makeMeshHandler = makeMeshHandler;
