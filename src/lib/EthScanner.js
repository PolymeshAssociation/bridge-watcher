const Web3 = require("web3"),
  BN = Web3.utils.BN;

const PolyLocker = require("../contracts/PolyLocker");
const DB = require("./DB");

class EthScanner {
  constructor(web3URL, contractAddr, logger) {
    this.logger = logger;
    this.db = new DB(contractAddr, logger);
    this.web3 = new Web3(web3URL, {
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
    this.windowSize = 5000; // make env? larger window means faster scan, but risks to big response
    this.startBlock =
      this.db.store.startingBlock || new BN(process.env.START_BLOCK).toNumber();
  }

  // get single PolyLocker event by transaction hash. Checks if the tx is cached otherwise attempts to fetch it
  async getTx(txHash) {
    let tx = this.getStoredTx(txHash);
    if (tx) {
      return tx;
    }
    const result = await this.web3.eth.getTransaction(txHash);

    const ethEvents = await this.polyLocker.getPastEvents("PolyLocked", {
      fromBlock: result.blockNumber,
      toBlock: result.blockNumber,
    });
    const log = ethEvents.find((e) => e.transactionHash === txHash);
    const event = this.parseLog(log);
    if (event) {
      this.db.insertEthTx(event);
    }
    return event;
  }

  getStoredTx(txHash) {
    return this.db.store.polylocker[txHash];
  }

  listEthTxs() {
    return this.db.listEthTxs();
  }

  // scans until latest block
  async scanAll() {
    this.latestBlock = await this.getCurrentBlock();
    const saveInterval = 25;
    let i = 0;
    this.logger.info("scanning all starting this may take a while");
    while (this.startBlock < this.latestBlock) {
      i++;
      this.logger.info(
        `Scanning starting at: ${this.startBlock} latest: ${this.latestBlock}`
      );
      await this.scan();
      if (i % saveInterval === 0) {
        this.db.store.startingBlock = this.startBlock;
        this.db.save();
      }
    }
    this.db.save();
  }

  /**
   * Start with last successful state and construct the next block window to scan.
   * @returns {Promise<void>}
   */
  async scan() {
    let startingBlock = this.startBlock;
    try {
      let confirmations = process.env.CONFIRMATIONS;
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
  async scanBetween(fromBlock, toBlock) {
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

module.exports = EthScanner;
