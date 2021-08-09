import hexEncode from "./hexEncode";
import { Logger } from "winston";
import { ApiPromise } from "@polkadot/api";
import { MeshTx } from "./models/MeshTx";

export interface IMeshScanner {
  fetchAllTxs: () => Promise<{ [key: string]: MeshTx }>;
  getProposal: (multiSigAddr: string, proposalId: string) => Promise<any>;
  subscribe: MeshEventHandler;
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

  subscribe(eventHandler: MeshEventHandler) {
    this.api.query.system.events(eventHandler);
  }
}
