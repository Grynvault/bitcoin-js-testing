const bitcoin = require('bitcoinjs-lib');
const crypto = require('crypto');
const { lenderKey, borrowerKey, network } = require('./load-private-keys');
const { hashM } = require('./preimage-hash');
const timeX = 68590;

const p2shScript05 = bitcoin.payments.p2sh({
    redeem: {
        output: bitcoin.script.compile([
            bitcoin.opcodes.OP_IF,
                bitcoin.opcodes.OP_HASH256, Buffer.from(hashM, 'hex'), bitcoin.opcodes.OP_EQUALVERIFY,
                Buffer.from(lenderKey.publicKey), bitcoin.opcodes.OP_CHECKSIG,
            bitcoin.opcodes.OP_ELSE,
                Buffer.from(timeX.toString(16), 'hex'), bitcoin.opcodes.OP_CHECKLOCKTIMEVERIFY, bitcoin.opcodes.OP_DROP,
                Buffer.from(borrowerKey.publicKey), bitcoin.opcodes.OP_CHECKSIG,
            bitcoin.opcodes.OP_ENDIF
        ]),
        network
    }
});

console.log("P2SH Address (0.05 BTC HTLC):", p2shScript05.address);
console.log(p2shScript05.output);
console.log(p2shScript05.redeem.output);

module.exports = {
    p2shScript05
};