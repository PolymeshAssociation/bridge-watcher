const validateTx = require("../src/lib/validateTx");
const BN = require("bn.js");

describe("validateTx", () => {
  test("it should validate matching transactions", () => {
    const meshTx = makeMeshTx(),
      ethTx = makeEthTx(),
      errors = validateTx(meshTx, ethTx);
    expect(errors).toHaveLength(0);
  });

  test("it should detect differing amounts", () => {
    const meshTx = makeMeshTx({ amount: new BN(99999) }),
      ethTx = makeEthTx();
    errors = validateTx(meshTx, ethTx);

    expect(errors).toHaveLength(1);
  });

  test("it should detect differing tx_hashes", () => {
    const meshTx = makeMeshTx({
        tx_hash:
          "0xaaaaaa54635d1d0194bbf319b92bd8e860816aef9481f55262e4b4a955fd1111",
      }),
      ethTx = makeEthTx();
    errors = validateTx(meshTx, ethTx);

    expect(errors).toHaveLength(1);
  });

  test("it should detect differing mesh_addresses", () => {
    const meshTx = makeMeshTx({
        mesh_address: "5EefzzzzsvrEa8FdgGJheWLDrEzqDRhtEPqzLn525jbDtQOR",
      }),
      ethTx = makeEthTx();
    errors = validateTx(meshTx, ethTx);

    expect(errors).toHaveLength(1);
  });
});

const amount = new BN(100000);
const tx_hash =
  "0x8ad01b54635d1d0194bbf319b92bd8e860816aef9481f55262e4b4a955fd4432";
const mesh_address = "5EefHQDzsvrEa8FdgGJheWLDrEzqDRhtEPqzLn525jbDtMUV";

function makeMeshTx(params = {}) {
  return Object.assign(
    {
      amount,
      tx_hash,
      mesh_address,
    },
    params
  );
}

function makeEthTx(params = {}) {
  return Object.assign(
    {
      tokens: amount,
      tx_hash,
      mesh_address,
    },
    params
  );
}
