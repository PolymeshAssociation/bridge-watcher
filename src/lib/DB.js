class DB {
  constructor() {
    this.store = {
      polylocker: {},
      polymesh: {},
    };
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
}

module.exports = DB;
