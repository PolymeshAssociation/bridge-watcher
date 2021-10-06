import { Logger } from "winston";
import { IEthScanner } from "./EthScanner";
import { IMeshScanner } from "./MeshScanner";
import { Validator } from "./Validator";

// Pulls all bridgeTxDetails and compares it to the corresponding PolyLocker event.
export async function validateAllMeshTxs(
  meshScanner: IMeshScanner,
  ethScanner: IEthScanner,
  validator: Validator,
  logger: Logger
) {
  await ethScanner.scanAll();
  const bridgeTxMap = await meshScanner.fetchAllTxs();
  for (const [txHash, bridgeTxs] of Object.entries(bridgeTxMap)) {
    logger.debug(`Checking ${txHash}`);
    const ethTxs = await ethScanner.getTx(txHash);
    validator.validateBridgeTxHash(bridgeTxs, ethTxs);
  }
}

// Validates a single PolyLocker transaction. This fetches all mesh transactions so can be somewhat slow.
export async function validateEthTx(
  meshScanner: IMeshScanner,
  ethScanner: IEthScanner,
  validator: Validator,
  logger: Logger,
  txHash: string
) {
  const ethTxs = await ethScanner.getTx(txHash);
  if (!ethTxs) {
    logger.warn(`PolyLocker tx not found with hash: ${txHash}`);
    return;
  }
  const bridgeTxs = await meshScanner.fetchAllTxs();
  validator.validateEthTxHash(bridgeTxs[txHash], ethTxs);
}

// Gets all PolyLocker events and attempts to find the corresponding Polymesh events.
export async function validateAllEthTxs(
  meshScanner: IMeshScanner,
  ethScanner: IEthScanner,
  validator: Validator,
  logger: Logger
) {
  await ethScanner.scanAll();
  const bridgeTxs = await meshScanner.fetchAllTxs();
  for (const [txHash, ethTxs] of Object.entries(ethScanner.listEthTxs())) {
    logger.debug(`Checking ${txHash}`);
    validator.validateEthTxHash(bridgeTxs[txHash], ethTxs);
  }
}
