function hexEncode(hash) {
  return "0x" + Buffer.from(hash).toString("hex");
}

module.exports = hexEncode;
