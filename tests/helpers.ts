// this file provides test data + preconfigured mocks for tests.
import BN from "bn.js";
import { EthTx } from "../src/lib/models/EthTx";
import { MeshTx } from "../src/lib/models/MeshTx";
export const ethTx = new EthTx(
  1,
  "0x123",
  "5E123",
  new BN(100),
  "0x01",
  "0x456",
  "12"
);

export const badEthTx = new EthTx(
  1,
  "0x123",
  "5EBOB",
  new BN(100),
  "0xff",
  "0x456",
  "13"
);

const meshTx = new MeshTx("5E123", new BN(100), "0x01", 3, "Type");
const badMeshTx = new MeshTx("5EVE", new BN(9999), "0xff", 4, "Type");

export const rawMeshTx = {
  nonce: 3,
  value: new BN(100),
  mesh_address: "5E123",
  tx_hash: "0x01",
};

export const rawBadMeshTx = {
  nonce: 4,
  value: new BN(9999),
  mesh_address: "5EVE",
  tx_hash: "0xff",
};
export const ethMap: { [key: string]: EthTx } = {
  "0x01": ethTx,
  "0xff": badEthTx,
};
export const meshMap = {
  "0x01": meshTx,
  "0xff": badMeshTx,
};

export const ethScannerMock = {
  getTx: jest.fn().mockImplementation((txHash) => ethMap[txHash]),
  scanAll: jest.fn(),
  scan: jest.fn(),
  listEthTxs: jest.fn().mockReturnValue([ethTx, badEthTx]),
};

export const meshScannerMock = {
  fetchAllTxs: jest.fn().mockReturnValue(meshMap),
  subscribe: jest.fn(),
  getProposal: jest.fn(),
  freeze: jest.fn(),
  logger: jest.fn(),
};

export const slackMock = {
  post: jest.fn(),
};

const winstonMock = {
  format: {
    printf: jest.fn(),
    timestamp: jest.fn(),
    simple: jest.fn(),
    colorize: jest.fn(),
    combine: jest.fn(),
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn(),
  },
  createLogger: jest.fn().mockImplementation(function (creationOpts) {
    return {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
  }),
};
export const logger = winstonMock.createLogger();

export const expectedValidMsg = "Valid transaction detected: Eth txHash: 0x01";
export const expectedErrorMsg =
  "[INVALID] Mesh Address: 5EVE BridgeTx nonce: 4, eth tx_hash: 0xff. Problems: wrong amount: Polymesh: 9999, PolyLocker: 100,wrong polymesh address: Polymesh: 5EVE PolyLocker intended address: 5EBOB";
