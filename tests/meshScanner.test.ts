import { Subscriber } from "../src/lib/Subscriber";
import { slackMock } from "./helpers";
import { Validator } from "../src/lib/Validator";

const {
  rawMeshTx,
  rawBadMeshTx,
  meshScannerMock,
  ethScannerMock,
  expectedValidMsg,
  expectedErrorMsg,
  logger,
} = require("./helpers");
class MockCodec {
  constructor(private value: unknown) {}
  toJSON() {
    return this.value;
  }
}

meshScannerMock.getProposal = jest
  .fn()
  .mockImplementation((contractId, proposalId) => {
    if (proposalId === "23") {
      return new MockCodec({
        args: {
          bridge_tx: { ...rawMeshTx },
        },
      });
    } else if (proposalId === "24") {
      return new MockCodec({
        args: {
          bridge_txs: [rawMeshTx, rawBadMeshTx],
        },
      });
    }
  });

const validEvent = {
  section: "bridge",
  method: "TxHandled",
  data: ["0x6000", rawMeshTx],
};

const invalidEvent = {
  section: "bridge",
  method: "TxHandled",
  data: ["0x6000", rawBadMeshTx],
};

const validator = new Validator(logger, slackMock, meshScannerMock, true);

const subscriber = new Subscriber(
  meshScannerMock,
  ethScannerMock,
  validator,
  logger
);

const handler = subscriber.eventHandler;

describe("handleEvent", () => {
  afterEach(() => jest.clearAllMocks());

  describe("bridgeTx", () => {
    test("with valid event", async () => {
      await handler([{ event: validEvent }]);
      expect(logger.warn).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(expectedValidMsg);
      expect(slackMock.post).not.toHaveBeenCalled();
      expect(meshScannerMock.freeze).not.toHaveBeenCalled();
    });
    test("with invalid event", async () => {
      await handler([{ event: invalidEvent }]);
      const expecteErr =
        "[INVALID] Event Type: TxHandled  Mesh Address: 5EVE  Bridge Nonce: 4  Eth txHash: 0xff   Problems:  wrong amount: Polymesh: 9999, PolyLocker: 100, wrong polymesh address:    - Polymesh recipient: 5EVE    - PolyLocker intended: 5EBOB";
      expect(logger.warn).toHaveBeenCalledWith(expecteErr);
      expect(logger.info).not.toHaveBeenCalled();
      expect(slackMock.post).toHaveBeenCalled();
      expect(meshScannerMock.freeze).toHaveBeenCalled();
    });
  });

  test("batchProposeBridgeTx", async () => {
    await handler([
      {
        event: {
          section: "bridge",
          method: "batchProposeBridgeTx",
          data: ["0x6000", [rawMeshTx, rawBadMeshTx]],
        },
      },
    ]);
    expect(logger.info).toHaveBeenCalledWith(expectedValidMsg);
    const expectedErr =
      "[INVALID] Event Type: batchProposeBridgeTx  Mesh Address: 5EVE  Bridge Nonce: 4  Eth txHash: 0xff   Problems:  wrong amount: Polymesh: 9999, PolyLocker: 100, wrong polymesh address:    - Polymesh recipient: 5EVE    - PolyLocker intended: 5EBOB";
    expect(logger.warn).toHaveBeenCalledWith(expectedErr);
  });

  describe("proposalAdded", () => {
    test("with bridge_tx proposed", async () => {
      await handler([
        {
          event: {
            section: "multiSig",
            method: "ProposalAdded",
            data: ["0x6000", new MockCodec("0x9456"), new MockCodec("23")],
          },
        },
      ]);
      expect(meshScannerMock.getProposal).toHaveBeenCalledWith("0x9456", "23");
      expect(logger.info).toHaveBeenCalledWith(expectedValidMsg);
    });

    test("with bridge_txs proposed", async () => {
      await handler([
        {
          event: {
            section: "multiSig",
            method: "ProposalAdded",
            data: ["0x6000", new MockCodec("0x9456"), new MockCodec("24")],
          },
        },
      ]);
      expect(meshScannerMock.getProposal).toHaveBeenCalledWith("0x9456", "24");
      expect(logger.info).toHaveBeenCalledWith(expectedValidMsg);
      const expectedErr =
        "[INVALID] Event Type: ProposalAdded  Mesh Address: 5EVE  Bridge Nonce: 4  Eth txHash: 0xff   Problems:  wrong amount: Polymesh: 9999, PolyLocker: 100, wrong polymesh address:    - Polymesh recipient: 5EVE    - PolyLocker intended: 5EBOB";
      expect(logger.warn).toHaveBeenCalledWith(expectedErr);
    });
  });
});
