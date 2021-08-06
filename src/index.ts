import fs from "fs";
import path from "path";
const execFileSync = require("child_process").execFileSync;
import winston from "winston";
import { Command } from "commander";
const program = new Command();

import {
  validateAllMeshTxs,
  validateAllEthTxs,
  validateEthTx,
} from "./lib/commands";
import { ApiPromise, WsProvider } from "@polkadot/api";
import { EthScanner } from "./lib/EthScanner";
import { MeshScanner } from "./lib/MeshScanner";
const schemaPath = path.join(__dirname, "data", "polymesh_schema.json");
require("dotenv").config(); // Load .env file
const schemaUrl =
  "https://raw.githubusercontent.com/PolymathNetwork/Polymesh/alcyone/polymesh_schema.json";

const logger = winston.createLogger({
  level: "debug",
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({ format: winston.format.simple() }),
  ],
});

if (!fs.existsSync(schemaPath)) {
  logger.info("Downloading schema. Please wait.");
  execFileSync("curl", [
    "--create-dirs",
    "-s",
    "-L",
    schemaUrl,
    "--output",
    schemaPath,
  ]);
}

const main = async () => {
  let ethScanner: EthScanner, meshScanner: MeshScanner;
  let setup = async () => {
    const opts = program.opts();
    ethScanner = new EthScanner(opts.ethURL, opts.contract, logger);

    const { types, rpc } = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
    const provider = new WsProvider(opts.polymeshURL);
    const api = await ApiPromise.create({
      provider,
      types,
      rpc,
    });
    meshScanner = new MeshScanner(api, logger);
  };
  program.version("0.0.1");
  program.requiredOption(
    "-c, --contract <address>",
    "address of the PolyLocker contract. Overrides the env variable $CONTRACT",
    process.env.CONTRACT
  );
  program.requiredOption(
    "-p, --polymeshURL <URL>",
    "Web socket url for a polymesh node. Overrides env variable $POLYMESH_URL",
    process.env.POLYMESH_URL
  );
  program.requiredOption(
    "-s, --startBlock <number>",
    "Specifies ethereum block to start scanning from the PolyLocker contract. Overrides env variable $START_BLOCK",
    process.env.START_BLOCK
  );
  program.requiredOption(
    "-w, --ethURL <URL>",
    "Specifies url for an Ethereum node. Overrides env var $ETH_URL",
    process.env.ETH_URL
  );

  program
    .command("watch")
    .description(
      "subscribes to polymesh events and checks for bridgeTx and proposals for bridgeTx"
    )
    .action(async () => {
      await setup();
      meshScanner.subscribe(ethScanner);
    });
  program
    .command("eth")
    .description(
      "reads all PolyLocker transactions and  verifies there is an existing bridgeTx for each"
    )
    .action(async () => {
      await setup();
      await validateAllEthTxs(meshScanner, ethScanner, logger);
      process.exit();
    });
  program
    .command("mesh")
    .description(
      "reads all bridgeTx and verifies them against PolyLocker transactions"
    )
    .action(async () => {
      await setup();
      await validateAllMeshTxs(meshScanner, ethScanner, logger);
      process.exit();
    });
  program
    .command("tx")
    .argument("<txHash>", "transaction hash")
    .action(async (txHash) => {
      await setup();
      await validateEthTx(meshScanner, ethScanner, logger, txHash);
      process.exit();
    });
  await program.parseAsync();
  return;
};

main();
