class DB {
  constructor() {
    this.store = {
      polylocker: {},
      polymesh: {},
    };
  }

  insertEthTx(tx) {
    console.log(`inserting: ${tx.tx_hash}`);
    this.store.polylocker[tx.tx_hash] = tx;
  }
  getEthTx(id) {
    return this.store.polylocker[id];
  }
  insertPolyTx(tx) {
    this.store.polymesh[tx.id] = tx;
  }
  getPolyTx(id) {
    return this.store.polymesh[id];
  }
}

module.exports = DB;
