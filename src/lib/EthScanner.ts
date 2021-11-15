import { Logger } from "winston";

import Web3 from "web3";

const PolyLocker = require("../../../contracts/PolyLocker");
import DB from "./DB";
import { EthTx } from "./models/EthTx";
import { ISlack } from "./Slack";
import BN from "bn.js";

export interface IEthScanner {
  getTx: (txHash: string) => Promise<Set<EthTx>>;
  listEthTxs: () => { [key: string]: Set<EthTx> };
  scanAll: () => Promise<void>;
}

export class EthScanner implements IEthScanner {
  private polyLocker;
  private windowSize: number;
  private db: DB;
  private web3: Web3;
  private startBlock: number;
  private latestBlock: number;
  constructor(web3URL: string, contractAddr: string, private logger: Logger, private slack: ISlack) {
    this.db = new DB(contractAddr, logger);
    this.web3 = new Web3(web3URL);
    this.polyLocker = new this.web3.eth.Contract(PolyLocker.abi, contractAddr);
    this.windowSize = 5000; // make env? larger window means faster scan, but risks to big response
    this.startBlock = this.db.startBlock || parseInt(process.env.START_BLOCK);
  }

  // get single PolyLocker event by transaction hash. Checks if the tx is cached otherwise attempts to fetch it
  async getTx(txHash: string): Promise<Set<EthTx>> {
    let tx = this.getStoredTx(txHash);
    if (tx) {
      return tx;
    }
    const result = await this.web3.eth.getTransaction(txHash).catch((err) => {
      var msg = `Could not connect to web3 provider - exiting process (${err})`;
      this.logger.error(msg);
      this.slack.post(msg);
      process.exit(1);
    });
    if (!result) {
      var msg = `result was not found by txHash: ${txHash}`;
      this.logger.error(msg);
      this.slack.post(msg);
      return null;
    }
    const ethEvents = await this.polyLocker.getPastEvents("PolyLocked", {
      fromBlock: result.blockNumber,
      toBlock: result.blockNumber,
    });
    let ethTxs: Set<EthTx> = new Set<EthTx>();
    ethEvents.forEach((event: any) => {
      const ethTx = this.parseLog(event);
      if (ethTx) {
        this.db.insertEthTx(ethTx);
      }
      ethTxs.add(ethTx);
    });
    return ethTxs;
  }

  private getStoredTx(txHash: string): Set<EthTx> {
    return this.db.getEthTx(txHash);
  }

  listEthTxs(): { [key: string]: Set<EthTx> } {
    return this.db.listEthTxs();
  }

  // scans until latest block
  async scanAll() {
    this.latestBlock = await this.getCurrentBlock();
    const saveInterval = 25;
    let i = 0;
    this.logger.info("scanning all starting this may take a while");
    const confirmations = parseInt(process.env.CONFIRMATIONS) || 3;
    while (this.startBlock + confirmations < this.latestBlock) {
      i++;
      await this.scan();
      this.db.startBlock = this.startBlock;
      if (i % saveInterval === 0) {
        this.db.save();
      }
    }
    this.db.save();
  }

  /**
   * Start with last successful state and construct the next block window to scan.
   * @returns {Promise<void>}
   */
  async scan(): Promise<void> {
    let startingBlock = this.startBlock;
    try {
      let confirmations = parseInt(process.env.CONFIRMATIONS) || 3;
      if (!this.latestBlock) {
        this.latestBlock = await this.getCurrentBlock();
      }
      let window = EthScanner.nextWindow(
        startingBlock,
        this.windowSize,
        confirmations,
        this.latestBlock
      );
      this.logger.info(`scanning blocks from: ${window.from} to: ${window.to}`);
      await this.scanBetween(window.from, window.to);
      this.startBlock = window.to;
    } catch (err) {
      this.logger.error(err, "Scanning failure");
      throw err;
    }
  }

  /**
   * Watch for events between `fromBlock` and `toBlock`
   */
  private async scanBetween(fromBlock: number, toBlock: number) {
    let self = this;
    let logs;
    try {
      logs = await this.polyLocker.getPastEvents("PolyLocked", {
        fromBlock: fromBlock,
        toBlock: toBlock,
      });
    } catch (err) {
      self.logger.error(`Unable to query events, error: ${err}`);
      throw err;
    }
    return await Promise.all(
      logs.map(async (log) => {
        const event = self.parseLog(log);
        self.db.insertEthTx(event);
        return event;
      })
    );
  }

  /**
   * Parses a log object into PolyLocked event.
   * @param log
   */
  private parseLog(log: any): EthTx {
    if (!log || !log.returnValues || log.returnValues.length === 0) {
      return null;
    }

    let rt = log.returnValues;
    return new EthTx(
      rt._id,
      rt._holder,
      rt._meshAddress,
      new BN(rt._polymeshBalance),
      log.transactionHash,
      log.blockHash,
      log.blockNumber
    );
  }

  /**
   * Get latest block number
   * @returns {Promise<number>}
   */
  private async getCurrentBlock(): Promise<number> {
    return await this.web3.eth.getBlockNumber();
  }

  /**
   * Calculate next window to scan. Last block to read must be at
   * least `confirmations` blocks away from latest block.
   *
   *                                           confirmations
   *                                                 +
   *                                                 |
   *  from block          to block                   |       latest block
   *      +                   +                      |             +
   *      +-------------------+----------------------v-------------+
   *      +    window size    +                                    +
   */
  private static nextWindow(
    fromBlock: number,
    windowSize: number,
    confirmations: number,
    latestBlock: number
  ) {
    let toBlock = fromBlock + windowSize - 1;

    if (toBlock > latestBlock - confirmations) {
      toBlock = latestBlock - confirmations;
    }

    if (toBlock <= fromBlock) {
      toBlock = fromBlock;
    }

    return {
      from: fromBlock,
      to: toBlock,
    };
  }
}
