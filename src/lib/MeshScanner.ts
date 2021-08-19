import hexEncode from "./hexEncode";
import { Logger } from "winston";
import { ApiPromise, Keyring } from "@polkadot/api";
import { MeshTx } from "./models/MeshTx";
import { DispatchError } from "@polkadot/types/interfaces";

export interface IMeshScanner {
  fetchAllTxs: () => Promise<{ [key: string]: MeshTx }>;
  getProposal: (multiSigAddr: string, proposalId: string) => Promise<any>;
  subscribe: MeshEventHandler;
  freeze: () => Promise<void>;
}

export class MeshScanner implements IMeshScanner {
  constructor(
    private api: ApiPromise,
    private logger: Logger,
    private mnemonic: string
  ) {}

  async fetchAllTxs(): Promise<{ [key: string]: MeshTx }> {
    let meshTxs: { [key: string]: MeshTx } = {};
    this.logger.info("fetching all bridgeTx details. This might take a while.");
    const txs: any = await this.api.query.bridge.bridgeTxDetails.entries();
    for (const [key, tx] of txs) {
      const [meshAddress] = key.toHuman();
      const internalTx = {
        amount: tx.amount,
        tx_hash: hexEncode(tx.tx_hash),
        meshAddress,
      };
      const meshTx = new MeshTx(
        meshAddress,
        tx.amount,
        hexEncode(tx.tx_hash),
        tx.nonce
      );
      meshTxs[internalTx.tx_hash] = meshTx;
    }
    return meshTxs;
  }

  async getProposal(multiSigAddr: string, proposalId: string): Promise<any> {
    return await this.api.query.multiSig.proposals([multiSigAddr, proposalId]);
  }

  subscribe(eventHandler: MeshEventHandler) {
    this.api.query.system.events(eventHandler);
  }

  async freeze() {
    const keyring = new Keyring({ type: "sr25519" });
    const bob = keyring.addFromMnemonic(this.mnemonic);
    try {
      const freezeUnsub = await this.api.tx.bridge
        .freeze()
        .signAndSend(bob, ({ status, events }) => {
          if (status.isInBlock || status.isFinalized) {
            events
              // find/filter for failed events
              .filter(({ event }) =>
                this.api.events.system.ExtrinsicFailed.is(event)
              )
              .forEach(
                ({
                  event: {
                    data: [error],
                  },
                }) => {
                  // since we filtered for Extrinsic failed error should be a DispatchError
                  const castErr = error as DispatchError;
                  let errorMsg: string;
                  if (castErr.isModule) {
                    const decoded = this.api.registry.findMetaError(
                      castErr.asModule
                    );
                    const { docs, method, section } = decoded;
                    errorMsg = `${section}.${method}: ${docs.join(" ")}`;
                  } else {
                    errorMsg = error.toString();
                  }
                  this.logger.error(`could not freeze the bridge: ${errorMsg}`);
                }
              );
          }

          if (status.isFinalized) {
            freezeUnsub();
          }
        });
    } catch (err) {
      this.logger.error(`error freezing the bridge: ${err}`);
    }
  }
}
