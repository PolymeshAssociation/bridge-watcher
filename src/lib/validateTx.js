function validateTx(meshTx, ethTx) {
  let errors = [];
  // we should have one or the other at least
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
      `wrong amount. Polymesh: ${meshAmt.toString()}, PolyLocker: ${ethTx.tokens.toString()}`
    );
  }

  if (meshTx.tx_hash != ethTx.tx_hash) {
    errors.push(
      `wrong hash. Polymesh: ${meshTx.tx_hash}, PolyLocker: ${ethTx.tx_hash}`
    );
  }

  if (meshTx.mesh_address !== ethTx.mesh_address) {
    errors.push(
      `wrong polymesh address. Polymesh: ${
        meshTx["mesh_address"] || meshTx["recipient"]
      } PolyLocker intended address: ${ethTx["mesh_address"]}`
    );
  }
  return errors;
}

module.exports = validateTx;
