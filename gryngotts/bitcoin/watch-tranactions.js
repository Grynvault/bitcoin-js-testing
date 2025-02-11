const client = require('./bitcoin-client');

async function watchTransactions() {
    console.log('🔄 Monitoring transactions...');
    let lastBlock = null;
    let recentTransactions = []; // Store only the last 30 transactions

    setInterval(async () => {
        try {
            const txData = await client.listSinceBlock(lastBlock);
            
            if (txData && txData.transactions.length > 0) {
                // Add new transactions to the list
                recentTransactions = [...recentTransactions, ...txData.transactions];

                // Remove duplicates by filtering unique TXIDs
                recentTransactions = recentTransactions.filter((tx, index, self) =>
                    index === self.findIndex(t => t.txid === tx.txid)
                );

                // Sort transactions by time (oldest first, newest last)
                recentTransactions.sort((a, b) => a.time - b.time);

                // Keep only the last 30 transactions
                if (recentTransactions.length > 30) {
                    recentTransactions = recentTransactions.slice(-30);
                }

                console.clear(); // Keep output clean
                console.log(`🔔 Recent Transactions (Last 30) [Sorted by Time]:\n`);

                // Display transactions in a simple, readable format
                recentTransactions.forEach((tx, index) => {
                    console.log(`🔹 [${index + 1}] TXID: ${tx.txid}`);
                    console.log(`   ➡ Amount: ${tx.amount} BTC`);
                    console.log(`   📅 Time: ${new Date(tx.time * 1000).toLocaleString()}`);
                    console.log(`   🔄 Confirmations: ${tx.confirmations}`);
                    console.log('-------------------------------------------------');
                });

                // Update last known block
                lastBlock = txData.lastblock;
            }
        } catch (error) {
            console.error('❌ Error fetching transactions:', error);
        }
    }, 5000); // Poll every 5 seconds
}

watchTransactions();
