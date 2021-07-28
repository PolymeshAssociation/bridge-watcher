import hexEncode from "./hexEncode";
import { validate } from "./validateTx";
import { Logger } from "winston";
import { IEthScanner } from "./EthScanner";
import { ApiPromise } from "@polkadot/api";
import { MeshTx } from "./models/MeshTx";
import BN from "bn.js";

export interface IMeshScanner {
  fetchAllTxs: () => Promise<{ [key: string]: MeshTx }>;
  getProposal: (multiSigAddr: string, proposalId: string) => Promise<any>;
  subscribe: (ethScanner: IEthScanner) => void;
}

export class MeshScanner implements IMeshScanner {
  constructor(private api: ApiPromise, private logger: Logger) {}

  async fetchAllTxs(): Promise<{ [key: string]: MeshTx }> {
    let meshTxs: { [key: string]: MeshTx } = {};
    this.logger.info("fetching all bridgeTx details. This might take a while.");
    const txs: any = await this.api.query.bridge.bridgeTxDetails.entries();
    for (const [key, tx] of txs) {
      const [meshAddress] = key.toHuman();
      const internalTx = {
        amount: tx.amount,
        tx_hash: hexEncode(tx.tx_hash),
        meshAddress,
      };
      const meshTx = new MeshTx(
        meshAddress,
        tx.amount,
        hexEncode(tx.tx_hash),
        tx.nonce
      );
      meshTxs[internalTx.tx_hash] = meshTx;
    }
    return meshTxs;
  }

  async getProposal(multiSigAddr: string, proposalId: string): Promise<any> {
    return await this.api.query.multiSig.proposals([multiSigAddr, proposalId]);
  }

  subscribe(ethScanner: IEthScanner) {
    this.api.query.system.events(
      makeMeshHandler(this, ethScanner, this.logger)
    );
  }
}

// subscribes to Polymesh events.
export function makeMeshHandler(
  meshScanner: IMeshScanner,
  ethScanner: IEthScanner,
  logger: Logger
) {
  return async (events: [any]) => {
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

async function handleBridgeTx(
  event: any,
  ethScanner: IEthScanner,
  logger: Logger
) {
  if (event.method === "TxsHandled") {
    handleTxsHandled(event, logger);
    return;
  }
  const [submitter, data] = event.data;
  if (Array.isArray(data)) {
    for (const d of data) {
      const tx = makeBridgeTx(d);
      if (tx) {
        const ethTx = await ethScanner.getTx(tx.txHash);
        validate(tx, ethTx, logger);
      }
    }
  } else {
    const tx = makeBridgeTx(data);
    if (tx) {
      const ethTx = await ethScanner.getTx(tx.txHash);
      validate(tx, ethTx, logger);
    }
  }
}

async function handleTxsHandled(event: any, logger: Logger) {
  const [txs] = event.data;
  for (const [nonce, error] of txs) {
    logger.info(`bridge tx handled, nonce: ${nonce.toHuman()}`);
  }
}

// A multisig proposal event only references the proposal.
async function handleMultsigTx(
  event: any,
  meshScanner: IMeshScanner,
  ethScanner: IEthScanner,
  logger: Logger
) {
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
  const proposalObj: any = proposal.toJSON();
  const args = proposalObj["args"];
  // A bridge tx proposal maybe a batch or individual style.
  if (Array.isArray(args["bridge_txs"])) {
    for (const data of args["bridge_txs"]) {
      const tx = makeBridgeTx(data);
      if (tx) {
        const ethTx = await ethScanner.getTx(tx.txHash);
        validate(tx, ethTx, logger);
      }
    }
  } else if (args["bridge_tx"]) {
    const tx = makeBridgeTx(args["bridge_tx"]);
    if (tx) {
      const ethTx = await ethScanner.getTx(tx.txHash);
      validate(tx, ethTx, logger);
    }
  } else {
    logger.info(`Received proposal that was not a bridge_tx`);
  }
}

// attempts to serialize data into MeshTx
function makeBridgeTx(meshTx: any): MeshTx {
  const amount = meshTx["value"]
    ? new BN(meshTx["value"])
    : new BN(meshTx["amount"]);
  const address = meshTx["mesh_address"] || meshTx["recipient"];
  const isMinting = meshTx["nonce"] && address && amount && meshTx["tx_hash"];

  if (isMinting) {
    return new MeshTx(
      meshTx["mesh_address"] || meshTx["recipient"],
      amount,
      hexEncode(meshTx["tx_hash"]),
      meshTx["nonce"]
    );
  } else {
    return null;
  }
}
