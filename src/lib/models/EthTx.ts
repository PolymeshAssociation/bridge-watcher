import BN from "bn.js";
export class EthTx {
  constructor(
    public event_id: number,
    public ethAddress: string,
    public meshAddress: string,
    public tokens: BN,
    public txHash: string,
    public blockHash: string,
    public blockNumber: string
  ) {}
}
