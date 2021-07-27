function validateTx(meshTx, ethTx) {
  let errors = [];
  // we should at least have either meshTx or ethTx
  if (!meshTx) {
    errors.push(
      `Mesh transaction was not found for PolyLock transaction: ${ethTx.tx_hash}`
    );
    return errors;
  }
  if (!ethTx) {
    errors.push(
      `PolyLocker transaction was not found by tx_hash: ${meshTx.tx_hash}`
    );
    return errors;
  }
  const meshAmt = meshTx.value || meshTx.amount;
  if (meshAmt.toString() !== ethTx.tokens.toString()) {
    errors.push(
      `wrong amount: Polymesh: ${meshAmt.toString()}, PolyLocker: ${ethTx.tokens.toString()}`
    );
  }

  if (meshTx.tx_hash != ethTx.tx_hash) {
    errors.push(
      `wrong hash: Polymesh: ${meshTx.tx_hash}, PolyLocker: ${ethTx.tx_hash}`
    );
  }

  if (meshTx.mesh_address !== ethTx.mesh_address) {
    errors.push(
      `wrong polymesh address: Polymesh: ${
        meshTx["mesh_address"] || meshTx["recipient"]
      } PolyLocker intended address: ${ethTx["mesh_address"]}`
    );
  }
  return errors;
}

function validate(bridgeTx, ethTx, logger) {
  const errors = validateTx(bridgeTx, ethTx);
  if (errors.length > 0) {
    const details = formDetails(bridgeTx, ethTx);
    logger.warn(`[INVALID] ${details}. Problems: ${errors}`);
  } else {
    logger.info("Valid transaction detected");
  }
}

function formDetails(bridgeTx, ethTx) {
  const meshAddress = bridgeTx
    ? bridgeTx["recipient"] || bridgeTx["mesh_address"]
    : "unknown";
  const bridgeNonce = bridgeTx ? bridgeTx["nonce"] : undefined;
  const txHash = ethTx ? ethTx["tx_hash"] : "unknown";
  return `Mesh Address: ${meshAddress} ${
    bridgeNonce ? "BridgeTx nonce: " + bridgeNonce + ", " : ""
  }eth tx_hash: ${txHash}`;
}

exports.validateTx = validateTx;
exports.validate = validate;
