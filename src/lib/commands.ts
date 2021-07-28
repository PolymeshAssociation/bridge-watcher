import { Logger } from "winston";
import { IEthScanner } from "./EthScanner";
import { IMeshScanner } from "./MeshScanner";
import { validate } from "./validateTx";

// Pulls all bridgeTxDetails and compares it to the corresponding PolyLocker event.
export async function validateAllMeshTxs(
  meshScanner: IMeshScanner,
  ethScanner: IEthScanner,
  logger: Logger
) {
  await ethScanner.scanAll();
  const txs = await meshScanner.fetchAllTxs();
  for (const [txHash, tx] of Object.entries(txs)) {
    const ethTx = await ethScanner.getTx(txHash);
    validate(tx, ethTx, logger);
  }
}

// Validates a single PolyLocker transaction. This fetches all mesh transactions so can be somewhat slow.
export async function validateEthTx(
  meshScanner: IMeshScanner,
  ethScanner: IEthScanner,
  logger: Logger,
  txHash: string
) {
  const ethTx = await ethScanner.getTx(txHash);
  if (!ethTx) {
    logger.warn(`PolyLocker tx not found with hash: ${txHash}`);
    return;
  }
  const bridgeTxs = await meshScanner.fetchAllTxs();
  const bridgeTx = bridgeTxs[ethTx.txHash];
  validate(bridgeTx, ethTx, logger);
}

// Gets all PolyLocker events and attempts to find the corresponding Polymesh events.
export async function validateAllEthTxs(
  meshScanner: IMeshScanner,
  ethScanner: IEthScanner,
  logger: Logger
) {
  const meshTxs = await meshScanner.fetchAllTxs();
  await ethScanner.scanAll();
  for (const ethTx of ethScanner.listEthTxs()) {
    const meshTx = meshTxs[ethTx.txHash];
    if (!meshTx) {
      logger.warn(`Mesh Tx was not found by tx_hash: ${ethTx.txHash}`);
      continue;
    }
    validate(meshTx, ethTx, logger);
  }
}
