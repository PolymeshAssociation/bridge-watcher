const hexEncode = require("./hexEncode");

class MeshScanner {
  constructor(api) {
    this.api = api;
  }

  async fetchAllTxs() {
    let meshTxs = {};
    console.log("fetching all bridgeTx details. This might take a while.");
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

  subscribe(callback) {
    this.api.query.system.events(callback);
  }
}

module.exports = MeshScanner;
