import { Logger } from "winston";
import { EthTx } from "./models/EthTx";
import { MeshTx } from "./models/MeshTx";
import { ISlack } from "./Slack";

export class Validator {
  constructor(
    private logger: Logger,
    private slack: ISlack,
    private disableSlack: boolean = false
  ) {}

  public validate(bridgeTx: MeshTx, ethTx: EthTx) {
    const errors = this.validateTx(bridgeTx, ethTx);
    if (errors.length > 0) {
      const message = this.createMessage(bridgeTx, ethTx);
      this.logger.warn(`[INVALID] ${message}. Problems: ${errors}`);
      this.postToSlack("Invalid bridgeTx detected\n" + message);
    } else {
      this.logger.info("Valid transaction detected");
    }
  }

  public validateTx(meshTx: MeshTx, ethTx: EthTx) {
    let errors = [];
    // we should at least have either meshTx or ethTx
    if (!meshTx) {
      errors.push(
        `Mesh transaction was not found for PolyLock transaction: ${ethTx.txHash}`
      );
      return errors;
    }
    if (!ethTx) {
      errors.push(
        `PolyLocker transaction was not found by tx_hash: ${meshTx.txHash}`
      );
      return errors;
    }
    const meshAmt = meshTx.amount;
    if (meshAmt.toString() !== ethTx.tokens.toString()) {
      errors.push(
        `wrong amount: Polymesh: ${meshAmt.toString()}, PolyLocker: ${ethTx.tokens.toString()}`
      );
    }

    if (meshTx.txHash != ethTx.txHash) {
      errors.push(
        `wrong hash: Polymesh: ${meshTx.txHash}, PolyLocker: ${ethTx.txHash}`
      );
    }

    const meshAddress = meshTx.meshAddress;
    if (meshAddress !== ethTx.meshAddress) {
      errors.push(
        `wrong polymesh address: Polymesh: ${meshAddress} PolyLocker intended address: ${ethTx.meshAddress}`
      );
    }
    return errors;
  }

  private createMessage(bridgeTx: MeshTx, ethTx: EthTx) {
    const meshAddress = bridgeTx ? bridgeTx.meshAddress : "unknown";
    const bridgeNonce = bridgeTx ? bridgeTx.nonce : "unknown";
    const txHash = ethTx ? ethTx.txHash : "unknown";
    return `Mesh Address: ${meshAddress} ${
      bridgeNonce ? "BridgeTx nonce: " + bridgeNonce + ", " : ""
    }eth tx_hash: ${txHash}`;
  }

  private postToSlack(message: string) {
    if (this.disableSlack) return;
    this.slack.post(message);
  }
}
