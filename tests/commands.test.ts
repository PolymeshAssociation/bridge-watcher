import {
  meshScannerMock,
  ethScannerMock,
  logger,
  expectedValidMsg,
  expectedErrorMsg,
} from "./helpers";
import {
  validateAllMeshTxs,
  validateEthTx,
  validateAllEthTxs,
} from "../src/lib/commands";

describe("bridge watcher commands", () => {
  afterEach(() => jest.clearAllMocks());

  test("mesh", async () => {
    await validateAllMeshTxs(meshScannerMock, ethScannerMock, logger);
    expect(logger.info).toHaveBeenCalledWith(expectedValidMsg);
    expect(logger.warn).toHaveBeenCalledWith(expectedErrorMsg);
  });

  test("eth", async () => {
    await validateAllEthTxs(meshScannerMock, ethScannerMock, logger);
    expect(logger.info).toHaveBeenCalledWith(expectedValidMsg);
    expect(logger.warn).toHaveBeenCalledWith(expectedErrorMsg);
  });

  test("tx with good transaction", async () => {
    await validateEthTx(meshScannerMock, ethScannerMock, logger, "0x01");
    expect(logger.info).toHaveBeenCalledWith(expectedValidMsg);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  test("tx with bad transaction", async () => {
    await validateEthTx(meshScannerMock, ethScannerMock, logger, "0xff");
    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(expectedErrorMsg);
  });
});
