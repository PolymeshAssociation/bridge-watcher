// this file provides test data + preconfigured mocks for tests.
const BN = require("bn.js");

const ethTx = {
  tx_hash: "0x01",
  tokens: new BN(100),
  mesh_address: "5E123",
};

const badEthTx = {
  tx_hash: "0xff",
  tokens: new BN(100),
  mesh_address: "5EBOB",
};

const meshTx = {
  nonce: 3,
  value: new BN(100),
  mesh_address: "5E123",
  tx_hash: "0x01",
};

const badMeshTx = {
  nonce: 4,
  value: new BN(9999),
  mesh_address: "5EVE",
  tx_hash: "0xff",
};
const ethMap = {
  "0x01": ethTx,
  "0xff": badEthTx,
};
const meshMap = {
  "0x01": meshTx,
  "0xff": badMeshTx,
};

const ethScanner = {
  getTx: jest.fn().mockImplementation((txHash) => ethMap[txHash]),
  scanAll: jest.fn(),
  scan: jest.fn(),
  listEthTxs: jest.fn().mockReturnValue([ethTx, badEthTx]),
};

const meshScanner = {
  fetchAllTxs: jest.fn().mockReturnValue(meshMap),
  subscribe: jest.fn(),
};

const logger = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

const expectedValidMsg = "Valid transaction detected";
const expectedErrorMsg =
  "[INVALID] Mesh Address: 5EVE BridgeTx nonce: 4, eth tx_hash: 0xff. Problems: wrong amount: Polymesh: 9999, PolyLocker: 100,wrong polymesh address: Polymesh: 5EVE PolyLocker intended address: 5EBOB";

module.exports = {
  ethTx,
  badEthTx,
  meshTx,
  badMeshTx,
  ethMap,
  meshMap,
  ethScanner,
  meshScanner,
  logger,
  expectedValidMsg,
  expectedErrorMsg,
};
