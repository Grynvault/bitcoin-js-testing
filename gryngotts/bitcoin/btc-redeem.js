const bitcoin = require('bitcoinjs-lib');
const ECPairFactory = require('ecpair').default;
const tinysecp = require('tiny-secp256k1'); // Required for ecpair to work
require('dotenv').config();

const ECPair = ECPairFactory(tinysecp);

const network = bitcoin.networks.regtest;

// Replace with your WIF private key
const keyPair = ECPair.fromWIF(process.env.WIF_PRIV_KEY, network);

// Locking script (from your original code)
const script = bitcoin.script.compile([
  bitcoin.script.number.encode(400), // Block height
  bitcoin.opcodes.OP_CHECKLOCKTIMEVERIFY,
  bitcoin.opcodes.OP_DROP,
  keyPair.publicKey, // Use the public key from the key pair
  bitcoin.opcodes.OP_CHECKSIG,
]);

const sigHashType = bitcoin.Transaction.SIGHASH_ALL;

// Create a new transaction
const tx = new bitcoin.Transaction(); // Or TransactionBuilder for multiple inputs/outputs

// Replace with real previous transaction details
const prevTxId = Buffer.from('12579bd42c787f18bfe6d72e38cbacfdedddca05e68764ab918904f37d510d70', 'hex'); // Replace with real txid
const prevIndex = 0; // The output index in the previous transaction
const value = 100000; // Value in satoshis of the UTXO being spent

// Add the input
tx.addInput(prevTxId, prevIndex, 0xfffffffe); // Add input (sequence allows RBF or timelocks)

// Add the output
const recipient = 'bcrt1qmc5uqfp9ly2eslk2hwtm05rd9npluaflqmr3df'; // Replace with a valid regtest address

// Convert address to script before adding output
const outputScript = bitcoin.address.toOutputScript(recipient, network);
tx.addOutput(outputScript, 90000); // Now passing a proper script buffer

// Set locktime for the transaction
tx.locktime = 400;

// Generate the sighash for signing
const sighash = tx.hashForWitnessV0(
  0, // Input index
  script, // The locking script
  value, // Value of the UTXO being spent
  sigHashType
);

// Create the signature and convert to Buffer
const signature = bitcoin.script.signature.encode(
  Buffer.from(keyPair.sign(sighash)), // Convert Uint8Array to Buffer
  sigHashType
);

// Add the final unlocking script (redeem script)
tx.setInputScript(0, bitcoin.script.compile([signature]));

console.log('Signed Transaction (Hex):', tx.toHex());