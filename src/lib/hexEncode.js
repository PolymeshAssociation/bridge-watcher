function hexEncode(hash) {
  if (typeof hash !== "string") {
    return "0x" + Buffer.from(hash).toString("hex");
  } else {
    return hash;
  }
}

module.exports = hexEncode;
