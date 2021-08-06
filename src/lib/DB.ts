import { Logger } from "winston";
import { EthTx } from "./models/EthTx";
import fs from "fs";
import path from "path";
import BN from "bn.js";
export default class DB {
  private path: string;
  private store: {
    polylocker: { [key: string]: EthTx };
    startingBlock: number;
  };
  // saves contracts transactions to disk to save scanning time
  constructor(private contractAddr: string, private logger: Logger) {
    const parentDir = path.resolve(__dirname, "..");
    this.path = path.join(
      parentDir,
      "../../data",
      `${contractAddr}.store.json`
    );
    this.load();
    if (!this.store) {
      this.store = {
        polylocker: {},
        startingBlock: 0,
      };
    }
  }

  insertEthTx(tx: EthTx) {
    this.store.polylocker[tx.txHash] = tx;
  }
  getEthTx(id: string) {
    return this.store.polylocker[id];
  }
  listEthTxs(): EthTx[] {
    return Object.values(this.store.polylocker);
  }
  get startBlock(): number {
    return this.store.startingBlock;
  }
  set startBlock(startBlock: number) {
    this.store.startingBlock = startBlock;
  }
  save() {
    fs.writeFileSync(this.path, JSON.stringify(this.store));
  }
  load() {
    if (fs.existsSync(this.path)) {
      const data = fs.readFileSync(this.path, "utf8");
      if (data === "") return;
      this.store = JSON.parse(data);
      for (let entry in this.store.polylocker) {
        this.store.polylocker[entry].tokens = new BN(
          this.store.polylocker[entry].tokens,
          16
        );
      }
      this.logger.info(`loaded store from ${this.path}`);
    }
  }
}
