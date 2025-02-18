require('dotenv').config();
const bitcoin = require('bitcoinjs-lib');
const axios = require('axios');
const ECPairFactory = require('ecpair').ECPairFactory;
const ecc = require('tiny-secp256k1'); // Required for key generation

const ECPair = ECPairFactory(ecc); // Create key pair generator


// Bitcoin Core Regtest RPC Configuration
const rpcUser = process.env.RPC_USER || 'bitcoin';
const rpcPass = process.env.RPC_PASS || 'secretpassword';
const rpcPort = process.env.RPC_PORT || 18443;
const rpcURL = `http://${rpcUser}:${rpcPass}@127.0.0.1:${rpcPort}`;

// Function to Call Bitcoin Core RPC
async function callBitcoinRPC(method, params = []) {
    const response = await axios.post(rpcURL, {
        jsonrpc: "1.0",
        id: "curltest",
        method,
        params
    }, {
        auth: { username: rpcUser, password: rpcPass }
    });
    return response.data.result;
}

// Add this function to decode transactions
async function inspectTransaction(txid) {
    const rawTx = await callBitcoinRPC("getrawtransaction", [txid, true]);
    console.log("\n🔍 Transaction Details:");
    console.log("\n🔍 Fist Transaction RAW:", rawTx);
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
    const amt = 0.95
    const amt2 = 0.05
    const amt3 = 0.1

    console.log("🔹 Generating timelock transaction...");

    // 1️⃣ Get Current Block Height
    const currentBlockHeight = await callBitcoinRPC("getblockcount");
    const lockHeight = currentBlockHeight + 10; // Lock for 10 more blocks
    console.log(`Current block height: ${currentBlockHeight}`)
    console.log(`🔒 Locking funds until block height: ${lockHeight}`);

    // 2️⃣ Generate a New Keypair
    const keyPair = ECPair.makeRandom();
    const publicKey = keyPair.publicKey.toString('hex');
    const privateKey = keyPair.toWIF();
    console.log(`🔑 Public Key: ${publicKey}`);
    console.log(`🔑 Private Key (WIF): ${privateKey}`);

    // 3️⃣ Create a Time-Locked Script (CLTV)
    const redeemScript = bitcoin.script.compile([
        bitcoin.script.number.encode(lockHeight),
        bitcoin.opcodes.OP_CHECKLOCKTIMEVERIFY,
        bitcoin.opcodes.OP_DROP,
        keyPair.publicKey,
        bitcoin.opcodes.OP_CHECKSIG
    ]);

    // Create P2SH payment
    const p2sh = bitcoin.payments.p2sh({
        redeem: {
            output: redeemScript,
            network: bitcoin.networks.regtest
        },
        network: bitcoin.networks.regtest
    });

    const scriptAddress = p2sh.address;
    console.log(`📌 Time-Locked Address (P2SH): ${scriptAddress}`);

    console.log('P2SH address:', p2sh.address);
    console.log('Redeem script:', p2sh.redeem.output.toString('hex'));
    console.log('ScriptPubKey:', p2sh.output.toString('hex'));

    // 4️⃣ Send Bitcoin to the Time-Locked Address
    console.log(`💰 Sending ${amt} BTC to the time-locked address...`);
    const txid = await callBitcoinRPC("sendtoaddress", [scriptAddress, amt]);
    console.log(`✅ Transaction ID: ${txid}`);

    // After funding transaction
    console.log("\n📋 Funding Transaction Details:");
    await inspectTransaction(txid);

    // 5️⃣ Mine 1 Block to Confirm Transaction
    console.log("⛏️ Mining 1 block to confirm...");
    await callBitcoinRPC("generatetoaddress", [1,await callBitcoinRPC("getnewaddress")]);

    // 6️⃣ Try to Spend Before 10 Blocks (This Should Fail)
    console.log("🚫 Trying to spend before 10 blocks (should fail)...");
    try {
        const destAddress = await callBitcoinRPC("getnewaddress");
        const psbt = new bitcoin.Psbt({ network: bitcoin.networks.regtest });
        
        const rawTx1 = await callBitcoinRPC("getrawtransaction", [txid]);
        console.log("Raw 1 block transaction:", rawTx1);

        const decodedTx = await callBitcoinRPC("decoderawtransaction", [rawTx1]);
        // console.log("Decoded transaction:", JSON.stringify(decodedTx, null, 2));

        // console.log("ScriptPubKey from output:", decodedTx.vout[0].scriptPubKey.hex);
        console.log("Our P2SH output:", p2sh.output.toString('hex'));
        
        // psbt.addInput({
        //     hash: txid,
        //     index: 1,  // The output index from funding tx (check the funding tx output index)
        //     sequence: 0xfffffffe,
        //     nonWitnessUtxo: Buffer.from(rawTx, 'hex'),
        //     redeemScript: redeemScript  // Use the original redeemScript
        // });

        // psbt.addOutput({
        //     address: destAddress,
        //     value: Math.floor(0.95 * 100000000 - 10000) // 0.95 BTC - fee
        // });

        // psbt.setLocktime(lockHeight);

        psbt.addInput({
            hash: txid,
            index: 0,  // correct UTXO index
            sequence: 0xfffffffe,
            nonWitnessUtxo: Buffer.from(rawTx1, 'hex'),
            redeemScript: redeemScript  // using your original redeemScript
          });
          
          // Add output and set locktime as before
          psbt.addOutput({
            address: destAddress,
            value: 94990000
          });
          
          // Here, if you want the transaction to be invalid (because locktime is too low),
          // you could intentionally set it below the required CLTV value:
        //   psbt.setLocktime(lockHeight - 1);
        
        psbt.signInput(0, keyPair);

        //========================================================================
        psbt.finalizeInput(0, (inputIndex, input) => {
            const signature = input.partialSig[0].signature;
            // console.log('partial sig1: ', psbt.data.inputs[0].partialSig);
            const publicKey = input.partialSig[0].pubkey;
            return {
                scriptSig: bitcoin.script.compile([
                    signature,
                    // publicKey,
                    redeemScript  // Use the original redeemScript
                ])
            };
        });
        //========================================================================

        const spendTx = psbt.extractTransaction().toHex();
        const spendTxId = await callBitcoinRPC("sendrawtransaction", [spendTx]);
        console.log(`💸 Spend TX ID: ${spendTxId}`);
        await inspectTransaction(spendTxId);
    } catch (err) {
        console.error("❌ Error:", err.message);
    }

    // 7️⃣ Mine 10 Blocks to Unlock the Funds
    console.log("\n⛏️ Mining 10 more blocks to unlock funds...");
    // await callBitcoinRPC("generatetoaddress", [10, await callBitcoinRPC("getnewaddress")]);
    
    // 8️⃣ Successfully Spend Bitcoin After Unlocking
    console.log("\n✅ Now spending the Bitcoin...");
    try {
        const destAddress = await callBitcoinRPC("getnewaddress");
        const psbt = new bitcoin.Psbt({ network: bitcoin.networks.regtest });
        
        const rawTx2 = await callBitcoinRPC("getrawtransaction", [txid]);
        console.log("Raw 10 block transaction:", rawTx2);
        
        const decodedTx = await callBitcoinRPC("decoderawtransaction", [rawTx2]);
        // console.log("Decoded transaction:", JSON.stringify(decodedTx, null, 2));
        
        // Verify the script matches
        console.log("ScriptPubKey from output:", decodedTx.vout[0].scriptPubKey.hex);
        console.log("Our P2SH output:", p2sh.output.toString('hex'));
        
        // // Find the correct output index
        // const outputIndex = decodedTx.vout.findIndex(
        //     output => output.scriptPubKey.address === p2sh.address
        // );
        // console.log("Found at output index:", outputIndex);
        
        // psbt.addInput({
        //     hash: txid,
        //     index: outputIndex,  // Use the found index
        //     sequence: 0xfffffffe,
        //     nonWitnessUtxo: Buffer.from(rawTx, 'hex'),
        //     redeemScript: p2sh.redeem.output
        // });

        // psbt.addOutput({
        //     address: destAddress,
        //     value: 94990000 // 0.95 BTC - fee
        // });

        // psbt.setLocktime(lockHeight);
        
        // psbt.signInput(0, keyPair);
        
        // //========================================================================
        // psbt.finalizeInput(0, (inputIndex, input) => {
        //     const signature = input.partialSig[0].signature;
        //     const publicKey = input.partialSig[0].pubkey;
        //     return {
        //         scriptSig: bitcoin.script.compile([
        //             signature,
        //             publicKey,
        //             p2sh.redeem.output
        //         ])
        //     };
        // });
        // //========================================================================

        // const spendTx = psbt.extractTransaction().toHex();
        // console.log('Final transaction hex:', spendTx);

        // Find the correct output index (should be 0 in your case)
        const outputIndex = decodedTx.vout.findIndex(
            output => output.scriptPubKey.address === p2sh.address
        );
        console.log("Found at output index:", outputIndex);
        
        // Add input using the correct index and redeemScript from p2sh
        psbt.addInput({
            hash: txid,
            index: outputIndex, 
            sequence: 0xfffffffe,
            nonWitnessUtxo: Buffer.from(rawTx2, 'hex'),
            redeemScript: p2sh.redeem.output
        });
        
        // Add output (destination)
        psbt.addOutput({
            address: destAddress,
            value: 94990000 // 0.95 BTC minus fee (in satoshis)
        });
        
        // Set locktime to the required value (at least lockHeight)
        // psbt.setLocktime(lockHeight+1);
        
        // Sign the input
        psbt.signInput(0, keyPair);
        
        // Finalize input using the correct redeemScript
        // psbt.finalizeInput(0, (inputIndex, input) => {
        //     const signature = input.partialSig[0].signature;
        //     console.log('partial sig2: ',psbt.data.inputs[0].partialSig);

        //     const publicKey = input.partialSig[0].pubkey;
        //     return {
        //     scriptSig: bitcoin.script.compile([
        //         signature,
        //         // publicKey,
        //         p2sh.redeem.output
        //     ])
        //     };
        // });

        psbt.finalizeInput(0, (inputIndex, input) => {
            const { partialSig } = input;
            if (!partialSig || partialSig.length === 0) {
              throw new Error("No partial signature found");
            }
            let sig = partialSig[0].signature;
            // console.log('partial sig2: ', psbt.data.inputs[0].partialSig);
            // Check if the sighash flag is missing (it should end with 0x01 for SIGHASH_ALL)
            if (sig[sig.length - 1] !== bitcoin.Transaction.SIGHASH_ALL) {
              sig = Buffer.concat([sig, Buffer.from([bitcoin.Transaction.SIGHASH_ALL])]);
            }
            console.log('here')
            // return {
            //   scriptSig: bitcoin.script.compile([
            //     sig,
            //     p2sh.redeem.output
            //   ])
            // };
            try {
                const compiled = bitcoin.script.compile([sig, p2sh.redeem.output]);
                console.log("Compiled scriptSig:", compiled.toString("hex"));
                return { scriptSig: compiled };
              } catch (err) {
                console.error("Error compiling scriptSig!");
                console.error("Signature:", sig.toString("hex"));
                console.error("Redeem output:", p2sh.redeem.output.toString("hex"));
                throw err;
              }
              
          });
          
        
        const spendTx = psbt.extractTransaction().toHex();
        console.log('there2')
        // console.log('Final transaction hex:', spendTx);
        
        const spendTxId = await callBitcoinRPC("sendrawtransaction", [spendTx]);
        // console.log(`💸 Spend TX ID: ${spendTxId}`);
        await inspectTransaction(spendTxId);
        console.log('there3')
    } catch (err) {
        console.error("❌ Error:", err);
        if (err.response) {
            console.error("RPC Error:", err.response.data);
        }
    }

    // Get current block height to verify timelock was respected
    const currentHeight = await callBitcoinRPC("getblockcount");
    console.log(`\n📊 Current Block Height: ${currentHeight}`);
    console.log(`🔒 Original Lock Height: ${lockHeight}`);
}

main().catch(console.error);
