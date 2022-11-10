# Blocknative MEV Test
 
A test application interacting with Blocknative web socket in Javascript and monitor `pending-simulation` transactions in mempool. 

To know details about `pending-simulation`: visit https://www.blocknative.com/simulation-platform 
  
## Disclaimer
This repo is not either an investment advice or a recommendation or solicitation to buy or sell any investment and should not be used in the evaluation of the merits of making any investment decision. It should not be relied upon for accounting, legal or tax advice or investment recommendations. The contents reflected herein are subject to change without being updated. This article was written for informational and educational purpose only.
 
## Links
 
 * https://www.blocknative.com/
 * https://www.blocknative.com/simulation-platform
 * https://docs.blocknative.com/mempool-explorer#simulated-events
 * https://docs.blocknative.com/notify-sdk#initialize-the-library
 * https://www.blocknative.com/blog/flashbots
 
## Infrastructure
  
There is no single mempool because of blockchain peer to peer network nature. Blocknative provides an API to monitor their global mempool consists of (i) operating the global network of nodes, (ii) running nodes in a variety of configurations, (iii) maintaining unique peering relationships, and (iv) running custom node telemetry extensions. 

In addition to mempool API, Blocknative also provides pending simulation transactions, smart contract transactions that contain internal transactions, through their Ethereum Simulation Platform. We will get insights of pending transactions how the net balance changes for each associated address in the detected internal transactions.
 
 * https://docs.blocknative.com/notify-sdk#simulation-platform-over-websockets 
  
## Environment Variables
 
```
DAPPID=<your dapp id>
ETH_MAINNET_HTTPS=https://mainnet.infura.io/v3/<your infura key>
```
 
## Setup
 
1. Rename `.env.template` to `.env` and fill out required information
2. Install the required packages and run index.js
```sh
npm install
node index.js
```
  
## License
 
This library is licensed under the MIT License. 
