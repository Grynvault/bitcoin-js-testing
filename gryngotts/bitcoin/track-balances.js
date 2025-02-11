const Client = require('bitcoin-core');
const client = new Client({ 
    network: 'regtest',
    port: 18443,  // Explicitly set regtest port
    username: 'bitcoin', // From bitcoin.conf
    password: 'secretpassword'  // From bitcoin.conf
});

async function getBalances() {
  try {
    const balance = await client.getBalance();
    console.log(`🔹 Wallet Balance: ${balance} BTC`);

    const transactions = await client.listTransactions();
    console.log('📜 Recent Transactions:', transactions);
  } catch (error) {
    console.error('❌ Error fetching balances:', error);
  }
}

getBalances();
