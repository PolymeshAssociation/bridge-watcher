const Web3 = require("web3"),
  BN = Web3.utils.BN;

const logger = require("./logger");
const PolyLocker = require("../contracts/PolyLocker");
const DB = require("./DB");

/**
 * Scans for `PolyLocked` events and writes to database
 */
class EventScanner {
  constructor() {
    this.db = new DB();
    this.web3 = new Web3(process.env.WEB3_URL || "ws://localhost:8545", {
      clientConfig: {
        keepalive: true,
        keepaliveInterval: 60000,
      },
      reconnect: {
        auto: true,
        delay: 3000, // ms
        maxAttempts: 10,
        onTimeout: false,
      },
    });
    this.polyLocker = new this.web3.eth.Contract(
      PolyLocker.abi,
      process.env.POLYLOCKER_ADDR
    );
    this.windowSize = 99999999; // hack to scan til latest TODO: cleanup
    this.startBlock = new BN(process.env.START_BLOCK).toNumber();
  }

  /**
   * Start with last successful state and construct the next block window to scan.
   * @returns {Promise<void>}
   */
  async scan() {
    let startingBlock = this.startBlock;

    try {
      let confirmations = process.env.CONFIRMATIONS;
      let latestBlock = await this.getCurrentBlock();
      let window = EventScanner.nextWindow(
        startingBlock,
        this.windowSize,
        confirmations,
        latestBlock
      );
      logger.debug(window, "Scanning");
      await this.scanBetween(window.from, window.to);
      this.startBlock = latestBlock;
    } catch (err) {
      logger.error(err, "Scanning failure");
      throw err;
    }
  }

  /**
   * Watch for events between `fromBlock` and `toBlock`
   */
  async scanBetween(fromBlock, toBlock) {
    let self = this;
    let logs;
    try {
      logs = await this.polyLocker.getPastEvents("PolyLocked", {
        fromBlock: fromBlock,
        toBlock: toBlock,
      });
    } catch (err) {
      logger.fatal(err, "Unable to query events");
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
  parseLog(log) {
    if (!log || !log.returnValues || log.returnValues.length === 0) {
      return null;
    }

    let rt = log.returnValues;
    let event = {
      event_id: rt._id,
      eth_address: rt._holder,
      mesh_address: rt._meshAddress,
      tokens: new BN(rt._polymeshBalance),
      tx_hash: log.transactionHash,
      block_hash: log.blockHash,
      block_number: log.blockNumber,
    };

    return event;
  }

  /**
   * Get latest block number
   * @returns {Promise<void>}
   */
  async getCurrentBlock() {
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
  static nextWindow(fromBlock, windowSize, confirmations, latestBlock) {
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

module.exports = EventScanner;
