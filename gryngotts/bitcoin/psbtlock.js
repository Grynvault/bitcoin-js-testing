require('dotenv').config();
const bitcoin = require('bitcoinjs-lib');
const axios = require('axios');
const ECPairFactory = require('ecpair').ECPairFactory;
const ecc = require('tiny-secp256k1');

const ECPair = ECPairFactory(ecc);

// Use regtest network (change if needed)
const network = bitcoin.networks.regtest;

// Bitcoin Core Regtest RPC Configuration
const rpcUser = process.env.RPC_USER || 'bitcoin';
const rpcPass = process.env.RPC_PASS || 'secretpassword';
const rpcPort = process.env.RPC_PORT || 18443;
const rpcURL = `http://${rpcUser}:${rpcPass}@127.0.0.1:${rpcPort}`;

// Function to call Bitcoin Core RPC
async function callBitcoinRPC(method, params = []) {
  const response = await axios.post(
    rpcURL,
    {
      jsonrpc: "1.0",
      id: "curltest",
      method,
      params,
    },
    {
      auth: { username: rpcUser, password: rpcPass },
    }
  );
  return response.data.result;
}

// Function to decode and print a transaction's details
async function inspectTransaction(txid) {
  const rawTx = await callBitcoinRPC("getrawtransaction", [txid, true]);
  console.log("\n🔍 Transaction Details:");
  console.log("Inputs:", rawTx.vin.map(input => ({
    txid: input.txid,
    vout: input.vout,
    scriptSig: input.scriptSig
  })));
  console.log("Outputs:", rawTx.vout.map(output => ({
    value: output.value,
    type: output.scriptPubKey.type,
    address: output.scriptPubKey.address
  })));
  return rawTx;
}

async function main() {
  // 1️⃣ Get current block height and set timelock (lockHeight = current + 10)
  const currentBlockHeight = await callBitcoinRPC("getblockcount");
  const lockHeight = currentBlockHeight + 10;
  console.log(`Current block height: ${currentBlockHeight}`);
  console.log(`Locking funds until block height: ${lockHeight}`);

  // 2️⃣ Generate a new key pair (for the CLTV script)
  const keyPair = ECPair.makeRandom({ network });
  const publicKey = keyPair.publicKey;
  console.log(`🔑 Public Key: ${publicKey.toString('hex')}`);
  console.log(`🔑 Private Key (WIF): ${keyPair.toWIF()}`);

  // 3️⃣ Create a Time-Locked Script (CLTV)
  // The redeem script: [lockHeight] OP_CHECKLOCKTIMEVERIFY OP_DROP [pubkey] OP_CHECKSIG
  const redeemScript = bitcoin.script.compile([
    bitcoin.script.number.encode(lockHeight),
    bitcoin.opcodes.OP_CHECKLOCKTIMEVERIFY,
    bitcoin.opcodes.OP_DROP,
    publicKey,
    bitcoin.opcodes.OP_CHECKSIG,
  ]);

  // Create a P2SH payment from the redeem script
  const p2sh = bitcoin.payments.p2sh({
    redeem: { output: redeemScript, network },
    network,
  });
  const scriptAddress = p2sh.address;
  console.log(`📌 Time-Locked Address (P2SH): ${scriptAddress}`);
  console.log(`Redeem script: ${p2sh.redeem.output.toString('hex')}`);
  console.log(`ScriptPubKey: ${p2sh.output.toString('hex')}`);

  // 4️⃣ Send BTC to the time-locked address
  const amountToSend = 0.95;
  console.log(`💰 Sending ${amountToSend} BTC to the time-locked address...`);
  const fundingTxid = await callBitcoinRPC("sendtoaddress", [scriptAddress, amountToSend]);
  console.log(`✅ Funding TXID: ${fundingTxid}`);

  console.log("\n📋 Funding Transaction Details:");
  const fundingTx = await inspectTransaction(fundingTxid);

  // 5️⃣ Mine 1 block to confirm funding transaction
  console.log("⛏️ Mining 1 block to confirm the funding transaction...");
  await callBitcoinRPC("generatetoaddress", [1, await callBitcoinRPC("getnewaddress")]);

  // 6️⃣ Try to spend before the timelock expires (should fail)
  console.log("\n🚫 Attempting to spend funds before timelock expiration (should fail)...");
  try {
    const psbtBefore = new bitcoin.Psbt({ network });
    // Retrieve raw funding transaction (full hex) for nonWitnessUtxo info
    const rawFundingTx = await callBitcoinRPC("getrawtransaction", [fundingTxid]);
    // We assume the funding P2SH output is at index 0. (Adjust if needed.)
    psbtBefore.addInput({
      hash: fundingTxid,
      index: 0,
      sequence: 0xfffffffe,
      nonWitnessUtxo: Buffer.from(rawFundingTx, 'hex'),
      redeemScript: redeemScript,
    });
    const destAddressBefore = await callBitcoinRPC("getnewaddress");
    psbtBefore.addOutput({
      address: destAddressBefore,
      value: 94000000, // subtract fee (example: 10,000 satoshis)
    });
    // Set the spending transaction's locktime lower than required (should trigger CLTV failure)
    // psbtBefore.setLocktime(lockHeight - 1);
    psbtBefore.signInput(0, keyPair);
    psbtBefore.finalizeAllInputs();
    const txBefore = psbtBefore.extractTransaction().toHex();
    console.log("Spending TX (before timelock):", txBefore);
    // Attempt to broadcast (this should fail)
    const txBeforeId = await callBitcoinRPC("sendrawtransaction", [txBefore]);
    console.log(`Spend TX ID (before timelock): ${txBeforeId}`);
  } catch (err) {
    console.error("Expected error when spending before lock expiration:", err.message);
  }

  // 7️⃣ Mine 10 more blocks to satisfy the timelock
  console.log("\n⛏️ Mining 10 more blocks to satisfy the timelock...");
  await callBitcoinRPC("generatetoaddress", [10, await callBitcoinRPC("getnewaddress")]);

  // 8️⃣ Now spend the funds (should succeed)
  console.log("\n✅ Now spending the funds after timelock expiration...");
//   try {
    const psbtAfter = new bitcoin.Psbt({ network });
    const rawFundingTx2 = await callBitcoinRPC("getrawtransaction", [fundingTxid]);
    // Decode funding transaction to find the correct output index for our P2SH
    const fundingTxDecoded = await callBitcoinRPC("decoderawtransaction", [rawFundingTx2]);
    const outputIndex = fundingTxDecoded.vout.findIndex(
      output => output.scriptPubKey.hex === p2sh.output.toString('hex')
    );
    if (outputIndex < 0) {
      throw new Error("Could not locate the P2SH output in the funding transaction.");
    }
    console.log("Found P2SH output at index:", outputIndex);

    // const psbt = new bitcoin.Psbt({ network });
 // Get the target output from the decoded funding transaction:
    const targetOutput = fundingTxDecoded.vout[outputIndex];

    psbtAfter.addInput({
    hash: fundingTxid,
    index: outputIndex,
    sequence: 0xfffffffe,
    nonWitnessUtxo: Buffer.from(rawFundingTx2, 'hex'), // full funding transaction
    redeemScript: p2sh.redeem.output, // provide the redeemScript for the P2SH
    });

  
  // Define your destination and fee details:
  const destinationAddress = 'bcrt1q4czac65a9alnawc36ulu3xcmfwajp6qdnzja7w'; // change as needed
  const fee = 1000000; // example fee in satoshis (0.01 BTC)
  const outputValue = 95000000;
  
  // Add the output:
  psbtAfter.addOutput({
    address: destinationAddress,
    value: outputValue,
  });
  
  // Sign the input:
  psbtAfter.signInput(0, keyPair);
  
  
  // Finalize all inputs. If you need to finalize a specific input manually, you can also do so.
  psbtAfter.finalizeAllInputs();
  
  // Extract the final transaction hex:
  const signedTxHex = psbtAfter.extractTransaction().toHex();
  
  // Print the signed transaction hex to console:
  console.log("=========================Signed transaction hex:");
  console.log(signedTxHex);

    // psbtAfter.addInput({
    //   hash: fundingTxid,
    //   index: outputIndex,
    //   sequence: 0xfffffffe,
    //   nonWitnessUtxo: Buffer.from(rawFundingTx2, 'hex'),
    //   redeemScript: p2sh.redeem.output, // same as redeemScript
    // });
    // const destAddressAfter = await callBitcoinRPC("getnewaddress");
    // psbtAfter.addOutput({
    //   address: destAddressAfter,
    //   value: 94000000,
    // });
    // // Set the spending transaction's locktime to at least lockHeight (to satisfy CLTV)
    // // psbtAfter.setLocktime(lockHeight);
    // psbtAfter.signInput(0, keyPair);
    // // Finalize the input with a custom finalizer that compiles the scriptSig
    // psbtAfter.finalizeInput(0, (inputIndex, input) => {
    //   const { partialSig } = input;
    //   if (!partialSig || partialSig.length === 0) {
    //     throw new Error("No partial signature found");
    //   }
    //   let sig = partialSig[0].signature;
    //   // Ensure the signature includes the SIGHASH_ALL flag (0x01)
    //   if (sig[sig.length - 1] !== bitcoin.Transaction.SIGHASH_ALL) {
    //     sig = Buffer.concat([sig, Buffer.from([bitcoin.Transaction.SIGHASH_ALL])]);
    //   }
    //   try {
    //     const compiled = bitcoin.script.compile([sig, p2sh.redeem.output]);
    //     console.log("Compiled scriptSig:", compiled.toString("hex"));
    //     return { scriptSig: compiled };
    //   } catch (err) {
    //     console.error("Error compiling scriptSig!");
    //     console.error("Signature:", sig.toString("hex"));
    //     console.error("Redeem output:", p2sh.redeem.output.toString("hex"));
    //     throw err;
    //   }
    // });
    const txAfter = psbtAfter.extractTransaction().toHex();
    console.log("Final signed transaction hex (after timelock):");
    console.log(txAfter);
    const txAfterId = await callBitcoinRPC("sendrawtransaction", [txAfter]);
    console.log(`Spend TX ID (after timelock): ${txAfterId}`);
    await inspectTransaction(txAfterId);
//   } 
//   catch (err) {
//     console.error("Error spending after timelock:", err.message);
//     if (err.response) {
//       console.error("RPC Error:", err.response.data);
//     }
//   }

  // Final block height verification
  const finalBlockHeight = await callBitcoinRPC("getblockcount");
  console.log(`\nFinal block height: ${finalBlockHeight}`);
  console.log(`Original lock height: ${lockHeight}`);
}

main().catch(console.error);
