const { validate } = require("./validateTx");

// Pulls all bridgeTxDetails and compares it to the corresponding PolyLocker event.
async function validateAllMeshTxs(meshScanner, ethScanner, logger) {
  await ethScanner.scanAll();
  const txs = await meshScanner.fetchAllTxs();
  for (const [txHash, tx] of Object.entries(txs)) {
    const ethTx = await ethScanner.getTx(txHash);
    validate(tx, ethTx, logger);
  }
}
exports.validateAllMeshTxs = validateAllMeshTxs;

// Validates a single PolyLocker transaction. This fetches all mesh transactions so can be somewhat slow.
async function validateEthTx(meshScanner, ethScanner, logger, txHash) {
  const ethTx = await ethScanner.getTx(txHash);
  if (!ethTx) {
    logger.warn(`PolyLocker tx not found with hash: ${txHash}`);
    return;
  }
  const bridgeTxs = await meshScanner.fetchAllTxs();
  const bridgeTx = bridgeTxs[ethTx.tx_hash];
  validate(bridgeTx, ethTx, logger);
}
exports.validateEthTx = validateEthTx;

// Gets all PolyLocker events and attempts to find the corresponding Polymesh events.
async function validateAllEthTxs(meshScanner, ethScanner, logger) {
  const [meshTxs] = await Promise.all([
    await meshScanner.fetchAllTxs(),
    await ethScanner.scan(),
  ]);
  for (const ethTx of ethScanner.listEthTxs()) {
    const meshTx = meshTxs[ethTx["tx_hash"]];
    if (!meshTx) {
      logger.warn(`Mesh Tx was not found by tx_hash: ${ethTx["tx_hash"]}`);
      continue;
    }
    validate(meshTx, ethTx, logger);
  }
}
exports.validateAllEthTxs = validateAllEthTxs;
