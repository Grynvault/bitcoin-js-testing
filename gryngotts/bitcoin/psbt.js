const bitcoin = require('bitcoinjs-lib');
const ECPairFactory = require('ecpair').ECPairFactory;
const ecc = require('tiny-secp256k1');
const ECPair = ECPairFactory(ecc);

// Use the regtest network (or change to bitcoin.networks.testnet/mainnet as needed)
const network = bitcoin.networks.regtest;

// Replace with your actual funding UTXO details:
const fundingTxid = '9a0a784eb981e376b01904342801eb21795aaef62ed3e548d216be4c834fc06f';
const vout = 0;
const utxoValue = 95000000; // in satoshis (0.95 BTC)
const utxoScript = '0014ae05dc6a9d2f7f3ebb11d73fc89b1b4bbb20e80d'; // witnessPubKeyHash for the UTXO

// Create a key pair (or load your own)
const keyPair = ECPair.makeRandom({ network });
console.log('Using public key:', keyPair.publicKey.toString('hex'));

// Create a new PSBT
const psbt = new bitcoin.Psbt({ network });

// Add the input with witnessUtxo info (important for SegWit)
psbt.addInput({
  hash: fundingTxid,
  index: vout,
  sequence: 0xfffffffe, // less than 0xffffffff to enable locktime if needed
  witnessUtxo: {
    script: Buffer.from(utxoScript, 'hex'),
    value: utxoValue,
  }
});

// Define your destination and fee details:
const destinationAddress = 'bcrt1q4czac65a9alnawc36ulu3xcmfwajp6qdnzja7w'; // change as needed
const fee = 1000000; // example fee in satoshis (0.01 BTC)
const outputValue = utxoValue - fee;

// Add the output:
psbt.addOutput({
  address: destinationAddress,
  value: outputValue,
});

// Sign the input:
psbt.signInput(0, keyPair);

// Finalize all inputs. If you need to finalize a specific input manually, you can also do so.
psbt.finalizeAllInputs();

// Extract the final transaction hex:
const signedTxHex = psbt.extractTransaction().toHex();

// Print the signed transaction hex to console:
console.log("Signed transaction hex:");
console.log(signedTxHex);
