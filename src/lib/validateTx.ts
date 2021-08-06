import { Logger } from "winston";
import { EthTx } from "./models/EthTx";
import { MeshTx } from "./models/MeshTx";
import { Slack } from "./Slack";

export function validateTx(meshTx: MeshTx, ethTx: EthTx) {
  let errors = [];
  // we should at least have either meshTx or ethTx
  if (!meshTx) {
    errors.push(
      `Mesh transaction was not found for PolyLock transaction: ${ethTx.txHash}`
    );
    return errors;
  }
  if (!ethTx) {
    errors.push(
      `PolyLocker transaction was not found by tx_hash: ${meshTx.txHash}`
    );
    return errors;
  }
  const meshAmt = meshTx.amount;
  if (meshAmt.toString() !== ethTx.tokens.toString()) {
    errors.push(
      `wrong amount: Polymesh: ${meshAmt.toString()}, PolyLocker: ${ethTx.tokens.toString()}`
    );
  }

  if (meshTx.txHash != ethTx.txHash) {
    errors.push(
      `wrong hash: Polymesh: ${meshTx.txHash}, PolyLocker: ${ethTx.txHash}`
    );
  }

  const meshAddress = meshTx.meshAddress;
  if (meshAddress !== ethTx.meshAddress) {
    errors.push(
      `wrong polymesh address: Polymesh: ${meshAddress} PolyLocker intended address: ${ethTx.meshAddress}`
    );
  }
  return errors;
}

export function validate(
  bridgeTx: MeshTx,
  ethTx: EthTx,
  logger: Logger,
  slack: Slack = null // optional so we dont post to slack for non subscriber commands
) {
  const errors = validateTx(bridgeTx, ethTx);
  if (errors.length > 0) {
    const details = formDetails(bridgeTx, ethTx);
    logger.warn(`[INVALID] ${details}. Problems: ${errors}`);
    if (slack) {
      slack.post("Invalid bridgeTx detected\n" + details);
    }
  } else {
    logger.info("Valid transaction detected");
  }
}

function formDetails(bridgeTx: MeshTx, ethTx: EthTx) {
  const meshAddress = bridgeTx ? bridgeTx.meshAddress : "unknown";
  const bridgeNonce = bridgeTx ? bridgeTx.nonce : "unknown";
  const txHash = ethTx ? ethTx.txHash : "unknown";
  return `Mesh Address: ${meshAddress} ${
    bridgeNonce ? "BridgeTx nonce: " + bridgeNonce + ", " : ""
  }eth tx_hash: ${txHash}`;
}
