require('dotenv').config();

const Web3 = require('web3');
const abis = require('./abis');
const { mainnet: addresses } = require('./addresses');

// For Node < v13 / CommonJS environments
const BlocknativeSDK = require('bnc-sdk');
const WebSocket = require('ws');
const configuration = require('./config/configuration').configuration;
const sdkSetup = require('./config/sdk-setup.js');

const web3 = new Web3(
    new Web3.providers.HttpProvider(process.env.ETH_MAINNET_HTTPS)
);

const uniswapFactory = new web3.eth.Contract(
    abis.ammFactory.factory,
    addresses.uniswap.factory
);
const uniswapRouter = new web3.eth.Contract(
    abis.ammRouter.router,
    addresses.uniswap.router
);

const sushiswapFactory = new web3.eth.Contract(
    abis.ammFactory.factory,
    addresses.sushiswap.factory
);
const sushiswapRouter = new web3.eth.Contract(
    abis.ammRouter.router,
    addresses.sushiswap.router
);

// function to handle all transaction events
async function handleTransactionEvent(raw_transaction) {

    // pending-simulation transactions only with pendingBlockNumber and counterparty information
    let transaction = raw_transaction.transaction;
    console.log(`Transaction pending block at ${transaction.pendingBlockNumber}: counter party is ${transaction.counterparty}`);

    try {
        for (d = 0; d < transaction.netBalanceChanges.length; d++) {
            // iterate netBalanceChanges address with index
            console.log(`Index: ${d}, Address: ${transaction.netBalanceChanges[d].address}`);
            // console.log('netBalanceChange:', transaction.netBalanceChanges[d].balanceChanges);
            if (transaction.netBalanceChanges[d].balanceChanges.length !== 2
              || transaction.netBalanceChanges[d].address === transaction.from
              || transaction.netBalanceChanges[d].address === transaction.to)
              { continue }
            // assume the address is one of liquidity pool addresses
            pairAddress = transaction.netBalanceChanges[d].address;
            tokenAddress0 = transaction.netBalanceChanges[d].balanceChanges[0].asset.contractAddress;
            tokenAddress1 = transaction.netBalanceChanges[d].balanceChanges[1].asset.contractAddress;

            let otherPairAddress; // other DEX side liquidity pool address
            if (transaction.watchedAddress == addresses.uniswap.router) {
                otherPairAddress = await sushiswapFactory.methods.getPair(tokenAddress0, tokenAddress1).call();
                if (otherPairAddress == undefined || otherPairAddress == '0x0000000000000000000000000000000000000000') {
                    continue
                }
            } else if (transaction.watchedAddress == addresses.sushiswap.router) {
                otherPairAddress = await uniswapFactory.methods.getPair(tokenAddress0, tokenAddress1).call();
                if (otherPairAddress == undefined || otherPairAddress == '0x0000000000000000000000000000000000000000') {
                    continue
                }
            }

            if (tokenAddress0 != undefined && tokenAddress1 != undefined) {
                asset0 = transaction.netBalanceChanges[d].balanceChanges[0].asset.symbol;
                asset1 = transaction.netBalanceChanges[d].balanceChanges[1].asset.symbol;
                tokenChange0 = transaction.netBalanceChanges[d].balanceChanges[0].delta;
                tokenChange1 = transaction.netBalanceChanges[d].balanceChanges[1].delta;
                console.log(`Token ${asset0}: ${tokenChange0}, Token ${asset1}: ${tokenChange1}`);
                console.log(`Liquidity Pool exists at ${otherPairAddress}`); // liquidity pool address
            }
        }
    } catch (e) {
        console.log('Something went wrong:', e.message);
        return;
    }
}

// initialize the SDK
const blocknative = new BlocknativeSDK({
    // ...other initialization options
    dappId: process.env.DAPPID,
    networkId: 1,
    system: 'ethereum',
    name: 'blocknative-mev',
    transactionHandlers: [handleTransactionEvent],
    ws: WebSocket, // only necessary in server environments
    onerror: (error) => { console.log(error) } // optional, use to catch errors
});

// setup the configuration with the SDK
sdkSetup.sdkSetup(blocknative, configuration);

