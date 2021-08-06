import { makeMeshHandler } from "../src/lib/MeshScanner";
import { Slack } from "../src/lib/Slack";
import { slackMock } from "./helpers";

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
  constructor(private value: Object) {}
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
  data: ["0x6000", rawMeshTx],
};

const invalidEvent = {
  section: "bridge",
  data: ["0x6000", rawBadMeshTx],
};

const handler = makeMeshHandler(
  meshScannerMock,
  ethScannerMock,
  logger,
  slackMock as unknown as Slack
);
describe("handleEvent", () => {
  afterEach(() => jest.clearAllMocks());

  describe("bridgeTx", () => {
    test("with valid event", async () => {
      await handler([{ event: validEvent }]);
      expect(logger.warn).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(expectedValidMsg);
      expect(slackMock.post).not.toHaveBeenCalled();
    });
    test("with invalid event", async () => {
      await handler([{ event: invalidEvent }]);
      expect(logger.warn).toHaveBeenCalledWith(expectedErrorMsg);
      expect(logger.info).not.toHaveBeenCalled();
      expect(slackMock.post).toHaveBeenCalled();
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
    expect(logger.warn).toHaveBeenCalledWith(expectedErrorMsg);
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
      expect(logger.warn).toHaveBeenCalledWith(expectedErrorMsg);
    });
  });
});
