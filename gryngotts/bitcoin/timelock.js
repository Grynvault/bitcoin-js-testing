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

async function main() {
    const amt = 0.95
    const amt2 = 0.05
    const amt3 = 0.1

    console.log("🔹 Generating timelock transaction...");

    // 1️⃣ Get Current Block Height
    const currentHeight = await callBitcoinRPC("getblockcount");
    const lockHeight = currentHeight + 10; // Lock for 10 more blocks
    console.log(`🔒 Locking funds until block height: ${lockHeight}`);

    // 2️⃣ Generate a New Keypair
    const keyPair = ECPair.makeRandom();
    const publicKey = keyPair.publicKey.toString('hex');
    const privateKey = keyPair.toWIF();
    console.log(`🔑 Public Key: ${publicKey}`);
    console.log(`🔑 Private Key (WIF): ${privateKey}`);

    // 3️⃣ Create a Time-Locked Script (CLTV)
    const redeemScript = bitcoin.payments.p2sh({
        redeem: bitcoin.payments.p2wsh({
            redeem: bitcoin.payments.p2wpkh({
                pubkey: keyPair.publicKey,
                network: bitcoin.networks.regtest
            }),
            network: bitcoin.networks.regtest
        }),
        network: bitcoin.networks.regtest
    });

    const scriptAddress = redeemScript.address;
    console.log(`📌 Time-Locked Address (P2SH): ${scriptAddress}`);

    // 4️⃣ Send Bitcoin to the Time-Locked Address
    console.log(`💰 Sending ${amt} BTC to the time-locked address...`);
    const txid = await callBitcoinRPC("sendtoaddress", [scriptAddress, amt]);
    console.log(`✅ Transaction ID: ${txid}`);

    // 5️⃣ Mine 1 Block to Confirm Transaction
    console.log("⛏️ Mining 1 block to confirm...");
    await callBitcoinRPC("generatetoaddress", [1,await callBitcoinRPC("getnewaddress")]);

    // 6️⃣ Try to Spend Before 10 Blocks (This Should Fail)
    console.log("🚫 Trying to spend before 10 blocks (should fail)...");
    try {
        await callBitcoinRPC("sendtoaddress", [await callBitcoinRPC("getnewaddress"), amt2]);
    } catch (err) {
        console.error("❌ Expected failure:", err.response.data.error.message);
    }

    // 7️⃣ Mine 10 Blocks to Unlock the Funds
    console.log("⛏️ Mining 10 more blocks to unlock funds...");
    await callBitcoinRPC("generatetoaddress", [10, await callBitcoinRPC("getnewaddress")]);

    // 8️⃣ Successfully Spend Bitcoin After Unlocking
    console.log("✅ Now spending the Bitcoin...");
    const spendTx = await callBitcoinRPC("sendtoaddress", [await callBitcoinRPC("getnewaddress"), amt3]);
    console.log(`💸 Spend TX ID: ${spendTx}`);
}

main().catch(console.error);
