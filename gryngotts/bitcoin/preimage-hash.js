const crypto = require('crypto');
const bitcoin = require('bitcoinjs-lib');

// Generate Preimages
const preimageL = crypto.randomBytes(32);
const preimageM = crypto.randomBytes(32);

// Hash the Preimages
const hashL = bitcoin.crypto.sha256(preimageL).toString('hex');
const hashM = bitcoin.crypto.sha256(preimageM).toString('hex');

console.log("Preimage L:", preimageL.toString('hex'));
console.log("Hash L:", hashL);
console.log("Preimage M:", preimageM.toString('hex'));
console.log("Hash M:", hashM);

module.exports = {
    preimageL,
    preimageM,
    hashL,
    hashM
};