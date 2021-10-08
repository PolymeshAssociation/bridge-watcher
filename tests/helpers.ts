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
  2,
  "0x123",
  "5EBOB",
  new BN(100),
  "0xff",
  "0x456",
  "13"
);

const meshTx = new MeshTx("5E123", new BN(100), "0x01", 1, "TxHandled");
const badMeshTx = new MeshTx("5EVE", new BN(9999), "0xff", 2, "TxHandled");

export const rawMeshTx = {
  nonce: 1,
  value: new BN(100),
  mesh_address: "5E123",
  tx_hash: "0x01",
};

export const rawBadMeshTx = {
  nonce: 2,
  value: new BN(9999),
  mesh_address: "5EVE",
  tx_hash: "0xff",
};
export const ethMap: { [key: string]: Set<EthTx> } = {
  "0x01": new Set([ethTx]),
  "0xff": new Set([badEthTx]),
};
export const meshMap = {
  "0x01": new Set([meshTx]),
  "0xff": new Set([badMeshTx]),
};

export const ethScannerMock = {
  getTx: jest.fn().mockImplementation((txHash) => ethMap[txHash]),
  scanAll: jest.fn(),
  scan: jest.fn(),
  listEthTxs: jest.fn().mockReturnValue(ethMap),
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
  "[INVALID] Event Type: TxHandled  Mesh Address: 5EVE  Bridge Nonce: 2  Eth txHash: 0xff   Problems:  wrong amount: Polymesh: 9999, PolyLocker: 100, wrong polymesh address:    - Polymesh recipient: 5EVE    - PolyLocker intended: 5EBOB";
