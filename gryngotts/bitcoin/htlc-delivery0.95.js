const bitcoin = require('bitcoinjs-lib');
const crypto = require('crypto');
const { lenderKey, borrowerKey, network } = require('./load-private-keys');
const { hashL, hashM } = require('./preimage-hash');

const p2shScript95 = bitcoin.payments.p2sh({
    redeem: {
        output: bitcoin.script.compile([
            bitcoin.opcodes.OP_IF,
            bitcoin.opcodes.OP_HASH256, Buffer.from(hashL, 'hex'), bitcoin.opcodes.OP_EQUALVERIFY,
            Buffer.from(lenderKey.publicKey), bitcoin.opcodes.OP_CHECKSIG,
            bitcoin.opcodes.OP_ELSE,
            bitcoin.opcodes.OP_HASH256, Buffer.from(hashM, 'hex'), bitcoin.opcodes.OP_EQUALVERIFY,
            Buffer.from(borrowerKey.publicKey), bitcoin.opcodes.OP_CHECKSIG,
            bitcoin.opcodes.OP_ENDIF
        ]),
        network
    }
});

console.log("P2SH Address (0.95 BTC HTLC):", p2shScript95.address);
