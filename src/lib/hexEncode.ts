export default function hexEncode(hash: any) {
  if (typeof hash !== "string") {
    return "0x" + Buffer.from(hash).toString("hex");
  } else {
    return hash;
  }
}
