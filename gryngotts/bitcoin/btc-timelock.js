const bitcoin = require('bitcoinjs-lib');

// Replace with your public key
const pubkey = '00146242815571c0070d590988e45a3b2d9ea5eb1386';
const script = bitcoin.script.compile([
  bitcoin.script.number.encode(400),  // Block height
  bitcoin.opcodes.OP_CHECKLOCKTIMEVERIFY,
  bitcoin.opcodes.OP_DROP,
  Buffer.from(pubkey, 'hex'),
  bitcoin.opcodes.OP_CHECKSIG,
]);

console.log('Hex Script:', script.toString('hex'));