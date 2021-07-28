import {
  meshScanner,
  ethScanner,
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
    await validateEthTx(meshScanner, ethScanner, logger, "0x01");
    expect(logger.info).toHaveBeenCalledWith(expectedValidMsg);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  test("tx with bad transaction", async () => {
    await validateEthTx(meshScanner, ethScanner, logger, "0xff");
    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(expectedErrorMsg);
  });
});
