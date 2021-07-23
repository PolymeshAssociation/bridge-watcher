function validateTx(meshTx, ethTx) {
  let errors = [];
  if (meshTx.amount.toString() !== ethTx.tokens.toString()) {
    errors.push(
      `different amounts. Polymesh amount: ${meshTx.amount.toString()}, PolyLocker amount: ${ethTx.tokens.toString()}`
    );
  }

  if (meshTx.tx_hash != ethTx.tx_hash) {
    errors.push(
      `differnt tx_hash. Polymesh hash: ${meshTx.tx_hash}, PolyLocker hash: ${ethTx.tx_hash}`
    );
  }

  if (meshTx.mesh_address !== ethTx.mesh_address) {
    errors.push(
      `differnt mesh_addresses. Polymesh mesh_address: ${meshTx["mesh_address"]} PolyLocker addr: ${ethTx["mesh_address"]}`
    );
  }
  return errors;
}

module.exports = validateTx;
