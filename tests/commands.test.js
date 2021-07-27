const BN = require("bn.js");
const {
  validateAllMeshTxs,
  validateEthTx,
  validateAllEthTxs,
} = require("../src/lib/commands");

const ethTx = {
  tx_hash: "0x123",
  tokens: new BN(100),
  mesh_address: "5E123",
};

const fakeEth = {
  tx_hash: "0xff",
  tokens: new BN(100),
  mesh_address: "5EBOB",
};

const meshTx = {
  nonce: 3,
  value: new BN(100),
  mesh_address: "5E123",
  tx_hash: "0x123",
};

const fakeMeshTx = {
  nonce: 4,
  value: new BN(9999),
  mesh_address: "5EVE",
  tx_hash: "0xff",
};
const ethMap = {
  "0x123": ethTx,
  "0xff": fakeEth,
};
const meshMap = {
  "0x123": meshTx,
  "0xff": fakeMeshTx,
};

const ethScanner = {
  getTx: jest.fn().mockImplementation((txHash) => ethMap[txHash]),
  scanAll: jest.fn(),
  scan: jest.fn(),
  listEthTxs: jest.fn().mockReturnValue([ethTx, fakeEth]),
};

const meshScanner = {
  fetchAllTxs: jest.fn().mockReturnValue(meshMap),
};

const logger = {
  info: jest.fn(),
  warn: jest.fn(),
};

const expectedValidMsg = "Valid transaction detected";
const expectedErrorMsg =
  "[INVALID] Mesh Address: 5EVE BridgeTx nonce: 4, eth tx_hash: 0xff. Problems: wrong amount: Polymesh: 9999, PolyLocker: 100,wrong polymesh address: Polymesh: 5EVE PolyLocker intended address: 5EBOB";
describe("bridge watcher commands", () => {
  afterEach(() => jest.clearAllMocks());

  test("watch", () => {});
  test("mesh", async () => {
    await validateAllMeshTxs(meshScanner, ethScanner, logger);
    expect(logger.info).toHaveBeenCalledWith(expectedValidMsg);
    expect(logger.warn).toHaveBeenCalledWith(expectedErrorMsg);
  });

  test("eth", async () => {
    await validateAllEthTxs(meshScanner, ethScanner, logger);
    expect(logger.info).toHaveBeenCalledWith(expectedValidMsg);
    expect(logger.warn).toHaveBeenCalledWith(expectedErrorMsg);
  });

  test("tx with good transaction", async () => {
    await validateEthTx(meshScanner, ethScanner, logger, "0x123");
    expect(logger.info).toHaveBeenCalledWith(expectedValidMsg);
  });

  test("tx with bad transaction", async () => {
    await validateEthTx(meshScanner, ethScanner, logger, "0xff");
    expect(logger.warn).toHaveBeenCalledWith(expectedErrorMsg);
  });
});
