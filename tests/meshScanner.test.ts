const {
  rawMeshTx,
  rawBadMeshTx,
  meshScanner,
  ethScanner,
  expectedValidMsg,
  expectedErrorMsg,
  logger,
} = require("./helpers");
import { makeMeshHandler } from "../src/lib/MeshScanner";

class MockCodec {
  constructor(private value: Object) {}
  toJSON() {
    return this.value;
  }
}

meshScanner.getProposal = jest
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

const handler = makeMeshHandler(meshScanner, ethScanner, logger);
describe("handleEvent", () => {
  afterEach(() => jest.clearAllMocks());

  describe("bridgeTx", () => {
    test("with valid event", async () => {
      await handler([{ event: validEvent }]);
      expect(logger.warn).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(expectedValidMsg);
    });
    test("with invalid event", async () => {
      await handler([{ event: invalidEvent }]);
      expect(logger.warn).toHaveBeenCalledWith(expectedErrorMsg);
      expect(logger.info).not.toHaveBeenCalled();
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
      expect(meshScanner.getProposal).toHaveBeenCalledWith("0x9456", "23");
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
      expect(meshScanner.getProposal).toHaveBeenCalledWith("0x9456", "24");
      expect(logger.info).toHaveBeenCalledWith(expectedValidMsg);
      expect(logger.warn).toHaveBeenCalledWith(expectedErrorMsg);
    });
  });
});
