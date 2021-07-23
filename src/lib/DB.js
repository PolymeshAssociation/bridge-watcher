const fs = require("fs");
const path = require("path");
const BN = require("bn.js");
class DB {
  // saves contracts transactions to disk to save scanning time
  constructor(contractAddr) {
    const parentDir = path.resolve(__dirname, "..");
    this.path = path.join(parentDir, "data", `${contractAddr}.store.json`);
    this.load();
    if (!this.store) {
      this.store = {
        polylocker: {},
        startingBlock: 0,
      };
    }
    this.contractAddr = contractAddr;
  }

  insertEthTx(tx) {
    this.store.polylocker[tx.tx_hash] = tx;
  }
  getEthTx(id) {
    return this.store.polylocker[id];
  }
  listEthTxs() {
    return Object.values(this.store.polylocker);
  }
  insertPolyTx(tx) {
    this.store.polymesh[tx.id] = tx;
  }
  getPolyTx(id) {
    return this.store.polymesh[id];
  }
  save() {
    fs.writeFile(this.path, JSON.stringify(this.store), (err) => {
      if (err) {
        console.error("could not save db", err);
      }
    });
  }
  load() {
    if (fs.existsSync(this.path)) {
      const data = fs.readFileSync(this.path);
      if (data.toString() === "") return;
      this.store = JSON.parse(data);
      for (let entry in this.store.polylocker) {
        this.store.polylocker[entry].tokens = new BN(
          this.store.polylocker[entry].tokens,
          16
        );
      }
      console.log(`loaded store from ${this.path}`);
    }
  }
}

module.exports = DB;
