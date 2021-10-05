import { EthTx } from "../src/lib/models/EthTx";
import { MeshTx } from "../src/lib/models/MeshTx";
import { logger, slackMock } from "./helpers";

const { Validator } = require("../src/lib/validator");
const BN = require("bn.js");

const validator = new Validator(logger, slackMock);

describe("validateTx", () => {
  test("it should validate matching transactions", () => {
    const meshTx = new MeshTx(meshAddress, amount, txHash, 1, "Type");
    const errors = validator.validateTx(meshTx, ethTx);
    expect(errors).toHaveLength(0);
  });

  test("it should detect differing amounts", () => {
    const meshTx = new MeshTx(meshAddress, new BN(9999), txHash, 1, "Type");
    const errors = validator.validateTx(meshTx, ethTx);

    expect(errors).toHaveLength(1);
  });

  test("it should detect differing tx_hashes", () => {
    const meshTx = new MeshTx(meshAddress, amount, "0x999", 1, "Type");
    const errors = validator.validateTx(meshTx, ethTx);

    expect(errors).toHaveLength(1);
  });

  test("it should detect differing mesh_addresses", () => {
    const meshTx = new MeshTx("5EINVALID", amount, txHash, 1, "Type");
    const errors = validator.validateTx(meshTx, ethTx);

    expect(errors).toHaveLength(1);
  });
});

const amount = new BN(100000);
const txHash =
  "0x8ad01b54635d1d0194bbf319b92bd8e860816aef9481f55262e4b4a955fd4432";
const meshAddress = "5EefHQDzsvrEa8FdgGJheWLDrEzqDRhtEPqzLn525jbDtMUV";

const ethTx = new EthTx(
  "1",
  "0x123",
  meshAddress,
  amount,
  txHash,
  "0x123",
  "12"
);
