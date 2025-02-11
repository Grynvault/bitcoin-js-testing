require('dotenv').config();
const BitcoinCore = require('bitcoin-core');

const client = new BitcoinCore({
  network: 'regtest',
  username: process.env.RPC_USER,
  password: process.env.RPC_PASS,
  url: `http://${process.env.RPC_USER}:${process.env.RPC_PASS}@127.0.0.1:18443`
});

module.exports = client;