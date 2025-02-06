const BIP32Factory = require('bip32').default;
const tinysecp = require('tiny-secp256k1');
const bitcoin = require('bitcoinjs-lib');
require('dotenv').config();
// Create the BIP32 instance
const bip32 = BIP32Factory(tinysecp);

// Replace with your tprv (Testnet private key)
const tprv = process.env.TESTNET_PRIV_KEY;

// Create a root node from the tprv
const root = bip32.fromBase58(tprv, bitcoin.networks.testnet);

// Derive the child private key at a specific path
const path = "m/84'/1'/0'/0/0"; // Adjust as per your wallet
const child = root.derivePath(path);

// Print the derived private key in WIF format
console.log("Derived Private Key (WIF):", child.toWIF());
