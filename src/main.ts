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
import '@polkadot/api-augment';

import { EthScanner } from "./lib/EthScanner";
import { MeshScanner } from "./lib/MeshScanner";
import { Slack } from "./lib/Slack";
import { Validator } from "./lib/Validator";
import { Subscriber } from "./lib/Subscriber";
const schemaPath = path.join(__dirname, "data", "polymesh_schema.json");
require("dotenv").config(); // Load .env file
const schemaUrl =
  "https://schema.polymesh.live/testnet/";

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
  let ethScanner: EthScanner,
    meshScanner: MeshScanner,
    validator: Validator,
    subscriber: Subscriber;
  let setup = async () => {
    const opts = program.opts();
    const slack = new Slack(opts.slackHook, opts.username, logger);
    ethScanner = new EthScanner(
      opts.ethURL,
      opts.contract,
      logger,
      slack,
      opts.startBlock || 1
    );
    const watcherMode = !!(program.args[0] === "watch");
    const { types, rpc } = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
    const provider = new WsProvider(opts.polymeshURL);
    const api = await ApiPromise.create({
      provider,
      types,
      rpc,
    });
    meshScanner = new MeshScanner(api, logger, opts.mnemonic);
    validator = new Validator(logger, slack, meshScanner, watcherMode);
    subscriber = new Subscriber(
      meshScanner,
      ethScanner,
      validator,
      logger,
      opts.telemetry,
      opts.username,
      opts.password
    );
    logger.info("[STARTUP] Bridge Watcher is starting up");
    if (watcherMode) {
      slack.post("Bridge Watcher is starting up");
    }
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
    "-w, --ethURL <URL>",
    "Specifies url for an Ethereum node. Overrides env var $ETH_URL",
    process.env.ETH_URL
  );
  program.requiredOption(
    "-m --mnemonic <string>",
    "Mnemonic for the bridge freezer admin account. Overrides env variable $MNEMONIC",
    process.env.MNEMONIC
  );
  program.option(
    "-s, --startBlock <number>",
    "Specifies ethereum block to start scanning from the PolyLocker contract. Overrides env variable $START_BLOCK",
    process.env.START_BLOCK
  );
  program.option(
    "-h --slackHook <URL>",
    "Slack webhook to post alerts to. Overrides env variable $SLACK_HOOK",
    process.env.SLACK_HOOK
  );
  program.option(
    "-u --username <string>",
    "Username for telemetry. Overrides env variable $USERNAME",
    process.env.USERNAME
  );
  program.option(
    "-p --password <string>",
    "Password for telemetry. Overrides env variable $PASSWORD",
    process.env.PASSWORD
  );
  program.option(
    "-t --telemetry <URL>",
    "URL for telemetry. Overrides env variable $TELEMETRY",
    process.env.TELEMETRY
  );

  program
    .command("watch")
    .description(
      "subscribes to polymesh events and checks for bridgeTx and proposals for bridgeTx"
    )
    .action(async () => {
      await setup();
      meshScanner.subscribe(subscriber.eventHandler);
      meshScanner.beat(subscriber.blockHandler);
    });
  program
    .command("eth")
    .description(
      "reads all PolyLocker transactions and  verifies there is an existing bridgeTx for each"
    )
    .action(async () => {
      await setup();
      await validateAllEthTxs(meshScanner, ethScanner, validator, logger);
      process.exit();
    });
  program
    .command("mesh")
    .description(
      "reads all bridgeTx and verifies them against PolyLocker transactions"
    )
    .action(async () => {
      await setup();
      await validateAllMeshTxs(meshScanner, ethScanner, validator, logger);
      process.exit();
    });
  program
    .command("tx")
    .argument("<txHash>", "transaction hash")
    .action(async (txHash) => {
      await setup();
      await validateEthTx(meshScanner, ethScanner, validator, logger, txHash);
      process.exit();
    });
  await program.parseAsync();
  return;
};

const shutdownMsg = (signal: string) =>
  `[SHUTDOWN] Bridge Watcher is shutting down (Received: ${signal})`;

process.on("SIGINT", () => {
  logger.info(shutdownMsg("SIGINT"));
  process.exit(0);
});

process.on("SIGTERM", () => {
  logger.info(shutdownMsg("SIGTERM"));
  process.exit(0);
});

process.on("exit", (code: number) => {
  logger.info(shutdownMsg(`Exit code: ${code.toString()}`));
});

main().catch((err) => {
  logger.error(shutdownMsg(err));
  process.exit(1);
});
