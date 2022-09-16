import { ApiPromise, Keyring } from "@polkadot/api";
import { Logger } from "winston";
import { IMeshScanner } from "./MeshScanner";
import { EthTx } from "./models/EthTx";
import { MeshTx } from "./models/MeshTx";
import { ISlack } from "./Slack";

export class Validator {
  constructor(
    private logger: Logger,
    private slack: ISlack,
    private meshScanner: IMeshScanner,
    // watcherMode enables posting to Slack + freezing the bridge when invalid transaction are encountered.
    // should be true only when watching current transactions.
    private watcherMode: boolean = false
  ) {}

  public validateBridgeTxHash(bridgeTxs: Set<MeshTx>, ethTxs: Set<EthTx>) {
    bridgeTxs.forEach((bridgeTx) => {
      let found: boolean = false;
      if (ethTxs) {
        ethTxs.forEach((ethTx) => {
          if (bridgeTx.nonce == ethTx.event_id) {
            found = true;
            this.validate(bridgeTx, ethTx);
          }
        });
      }
      if (!found) {
        this.validate(bridgeTx, undefined);
      }
    });
  }

  public validateEthTxHash(bridgeTxs: Set<MeshTx>, ethTxs: Set<EthTx>) {
    ethTxs.forEach((ethTx) => {
      let found: boolean = false;
      if (bridgeTxs) {
        bridgeTxs.forEach((bridgeTx) => {
          if (bridgeTx.nonce == ethTx.event_id) {
            found = true;
            this.validate(bridgeTx, ethTx);
          }
        });
      }
      if (!found) {
        this.validate(undefined, ethTx);
      }
    });
  }

  public validate(bridgeTx: MeshTx, ethTx: EthTx) {
    const errors = this.validateTx(bridgeTx, ethTx);
    if (errors.length > 0) {
      const message = `${this.createMessageBase(
        bridgeTx,
        ethTx
      )} \n*Problems*: ${errors}`;
      if (this.watcherMode) {
        this.logger.info("Error found in watch mode - posting to slack");
        this.postToSlack("*Invalid bridgeTx detected!* \n\n" + message);
        this.logger.info("Error found in watch mode - freezing");
        this.meshScanner.freeze();
      }
      // strip out slack formatting characters for the log line
      const rawMsg = message.replace(/\n/g, " ").replace(/\*/g, "");
      this.logger.warn(`[INVALID] ${rawMsg}`);
    } else {
      this.logger.info(
        `Valid transaction detected: Eth txHash: ${ethTx.txHash}`
      );
    }
  }

  private validateTx(meshTx: MeshTx, ethTx: EthTx) {
    let errors = [];
    // we should at least have either meshTx or ethTx
    if (!meshTx) {
      errors.push(
        `\nMesh transaction was not found for PolyLocker transaction: ${ethTx.txHash}`
      );
      return errors;
    }
    if (!ethTx) {
      errors.push(
        `\nPolyLocker transaction was not found by txHash: ${meshTx.txHash}`
      );
      return errors;
    }
    const meshAmt = meshTx.amount;
    if (meshAmt.toString() !== ethTx.tokens.toString()) {
      errors.push(
        `\nwrong amount: Polymesh: ${meshAmt.toString()}, PolyLocker: ${ethTx.tokens.toString()}`
      );
    }

    if (meshTx.txHash != ethTx.txHash) {
      errors.push(
        `\nwrong hash: Polymesh: ${meshTx.txHash}, PolyLocker: ${ethTx.txHash}`
      );
    }

    const meshAddress = meshTx.meshAddress.toString();
    if (meshAddress !== ethTx.meshAddress) {
      errors.push(
        `\nwrong polymesh address: \n  - Polymesh recipient: ${meshAddress} \n  - PolyLocker intended: ${ethTx.meshAddress}`
      );
    }
    return errors;
  }

  private createMessageBase(bridgeTx: MeshTx, ethTx: EthTx) {
    //TODO: Create message that is appropriate if either bridgeTx or ethTx is null
    const type = bridgeTx ? bridgeTx.type : "unknown";
    const meshAddress = bridgeTx ? bridgeTx.meshAddress : "unknown";
    const bridgeNonce = bridgeTx ? bridgeTx.nonce : "unknown";
    const txHash = ethTx ? ethTx.txHash : "unknown";
    return `*Event Type*: ${type} \n*Mesh Address*: ${meshAddress}\n *Bridge Nonce*: ${bridgeNonce} \n*Eth txHash*: ${txHash}\n`;
  }

  private postToSlack(message: string) {
    this.slack.post(message);
  }
}
