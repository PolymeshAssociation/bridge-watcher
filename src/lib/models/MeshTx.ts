import BN from "bn.js";
export class MeshTx {
  // TODO update to Mesh fields
  constructor(
    public meshAddress: string,
    public amount: BN,
    public txHash: string,
    public nonce: number,
    public type: string
  ) {}
}
