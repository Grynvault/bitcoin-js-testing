const client = require('./bitcoin-client');

async function sendBitcoin() {
  try {
    // Generate a new address
    const newAddress = await client.getNewAddress();
    console.log(`📌 New Address: ${newAddress}`);

    // Send 1 BTC to the new address
    const txId = await client.sendToAddress(newAddress, 0.105);
    console.log(`✅ Sent 1 BTC, TX ID: ${txId}`);

    // Track transaction details
    const txDetails = await client.getTransaction(txId);
    console.log('📜 Transaction Details:', txDetails);
  } catch (error) {
    console.error('❌ Error sending Bitcoin:', error);
  }
}

sendBitcoin();
