require('dotenv').config();
const BIP32Factory = require('bip32').default;
const bitcoin = require('bitcoinjs-lib');
const ECPairFactory = require('ecpair').default;
const tinysecp = require('tiny-secp256k1'); // Required for ecpair to work
const bip32 = BIP32Factory(tinysecp);
// const axios = require('axios')

const network = bitcoin.networks.testnet; // Use testnet for testing
const ECPair = ECPairFactory(tinysecp);

// Load private keys from .env
const tprv = process.env.LENDER_PRIVATE_KEY;
// Create a root node from the tprv
const root = bip32.fromBase58(tprv, bitcoin.networks.testnet);
const path = "m/84'/1'/0'/0/0";
const lenderWIF = root.derivePath(path).toWIF();
const lenderKey = ECPair.fromWIF(lenderWIF, network);  // Convert WIF to ECPair
const borrowerKey = ECPair.fromWIF(process.env.BORROWER_PRIVATE_KEY, network);

console.log("Lender Public Key:", lenderKey.publicKey.toString('hex'));
console.log("Borrower Public Key:", borrowerKey.publicKey.toString('hex'));

// Export the keys and network
module.exports = {
    lenderKey,
    borrowerKey,
    network
};
