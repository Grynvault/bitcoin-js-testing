const bitcoin = require('bitcoinjs-lib');
const { borrowerKey, network } = require('./load-private-keys');
const { p2shScript05 } = require('./htlc-guarantee0.05');
const { preimageM } = require('./preimage-hash');
const Client = require('bitcoin-core');
const bitcoinClient = require('./bitcoin-client');

const psbt = new bitcoin.Psbt({ network });

const prevTxId = 'c501713ede87637ff23329a29e48c1ffe4d6376d1bef71f6cc7f6041d062db82';
const txidBuffer = Buffer.from(prevTxId, 'hex').reverse();

console.log('Original txid:', prevTxId);
console.log('As buffer:', txidBuffer);

const client = new Client({ network: 'regtest' /* other config */ });

const prevTxHex = client.getRawTransaction(prevTxId);

const utxo05 = {
    txId: txidBuffer,
    vout: 0, // UTXO output index
    value: 95000000 // 0.95 BTC in satoshis
};

// Add your input
psbt.addInput({
    hash: txidBuffer,
    index: utxo05.vout,
    nonWitnessUtxo: Buffer.from(prevTxHex, 'hex'),  // Complete raw transaction
    redeemScript: p2shScript05.redeem.output
});

// Convert the Uint8Array to a Buffer
const pubkeyBuffer = Buffer.from(borrowerKey.publicKey);

// Create a P2PKH address from the public key
const { address } = bitcoin.payments.p2pkh({
    pubkey: pubkeyBuffer,
    network
});

// Borrower spends the UTXO using preimageM
psbt.addOutput({
    address: address,  // Make sure this is a valid address
    value: 94000000, // Deduct fees
});

// Redeem script with preimageM
const redeemScript = p2shScript05.redeem.output;
const signature = psbt.signInput(0, borrowerKey);

psbt.setInputScript(0, bitcoin.script.compile([
    signature,
    Buffer.from(preimageM),
    redeemScript
]));

// Sign and finalize
psbt.finalizeAllInputs();

// Get the hex
const txHex = psbt.extractTransaction().toHex();
console.log("Raw Transaction:", txHex);

// Broadcast
axios.post("https://blockstream.info/testnet/api/tx", txHex)
    .then(res => console.log("Broadcast Success:", res.data))
    .catch(err => console.error("Broadcast Error:", err.response.data));

// const prevTxHex = await bitcoinClient.getRawTransaction(prevTxId);
