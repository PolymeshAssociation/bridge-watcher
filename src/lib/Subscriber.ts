import { Logger } from "winston";
import { IEthScanner } from "./EthScanner";
import hexEncode from "./hexEncode";
import { IMeshScanner } from "./MeshScanner";
import { MeshTx } from "./models/MeshTx";
import { Validator } from "./Validator";
import BN from "bn.js";

// subscribes to Polymesh events.
export class Subscriber {
  constructor(
    private meshScanner: IMeshScanner,
    private ethScanner: IEthScanner,
    private validator: Validator,
    private logger: Logger
  ) {}

  get eventHandler(): MeshEventHandler {
    return async (events: [any]) => {
      this.logger.debug(`received ${events.length} poly events`);
      for (const { event } of events) {
        switch (event.section) {
          case "bridge":
            await this.handleBridgeTx(event);
            break;
          case "multiSig":
            await this.handleMultsigTx(event);
            break;
        }
      }
    };
  }

  async handleBridgeTx(event: any) {
    if (event.method === "TxsHandled") {
      this.handleTxsHandled(event);
      return;
    }
    const [submitter, data] = event.data;
    if (Array.isArray(data)) {
      for (const d of data) {
        const tx = this.makeBridgeTx(d, event.method);
        if (tx) {
          const ethTx = await this.ethScanner.getTx(tx.txHash);
          this.validator.validate(tx, ethTx);
        }
      }
    } else {
      const tx = this.makeBridgeTx(data, event.method);
      if (tx) {
        const ethTx = await this.ethScanner.getTx(tx.txHash);
        this.validator.validate(tx, ethTx);
      }
    }
  }

  async handleTxsHandled(event: any) {
    const [txs] = event.data;
    for (const [nonce, error] of txs) {
      this.logger.info(`bridge tx handled, nonce: ${nonce.toHuman()}`);
    }
  }

  // A multisig proposal event only references the proposal so we need to fetch the data from the chain
  async handleMultsigTx(event: any) {
    if (event.method !== "ProposalAdded") return;
    const [submitter, contractAddr, proposalId] = event.data;
    const proposal = await this.meshScanner.getProposal(
      contractAddr.toJSON(),
      proposalId.toJSON()
    );
    if (!proposal) {
      this.logger.error(
        `proposal at ${contractAddr} ID: ${proposalId} was not found `
      );
      return;
    }
    const proposalObj: any = proposal.toJSON();
    const args = proposalObj["args"];
    // A bridge tx proposal maybe a batch or individual style.
    if (Array.isArray(args["bridge_txs"])) {
      for (const data of args["bridge_txs"]) {
        const tx = this.makeBridgeTx(data, event.method);
        if (tx) {
          const ethTx = await this.ethScanner.getTx(tx.txHash);
          this.validator.validate(tx, ethTx);
        }
      }
    } else if (args["bridge_tx"]) {
      const tx = this.makeBridgeTx(args["bridge_tx"], event.method);
      if (tx) {
        const ethTx = await this.ethScanner.getTx(tx.txHash);
        this.validator.validate(tx, ethTx);
      }
    } else {
      this.logger.info(`Received proposal that was not a bridge_tx`);
    }
  }

  // attempts to serialize data into MeshTx
  makeBridgeTx(meshTx: any, method: string): MeshTx {
    if (!meshTx) return null;
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
        meshTx["nonce"],
        method
      );
    } else {
      return null;
    }
  }
}
