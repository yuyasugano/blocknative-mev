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

// Read amm-arbitrageur FlashBot contract with ethers.js, create an instance
// https://docs.ethers.io/v5/
// import { Contract, providers, Wallet } from "ethers";
// const FlashBot = new Contract(address, abi, signerOrProvider);

// Need ethers FlashbotsBundleProvider to create a bundle transaction
// import { FlashbotsBundleProvider } from "@flashbots/ethers-provider-bundle";
// const arbitrageSigningWallet = new Wallet(PRIVATE_KEY);
// const flashbotsRelaySigningWallet = new Wallet(FLASHBOTS_RELAY_SIGNING_KEY);

// const ETHEREUM_RPC_URL = process.env.ETHEREUM_RPC_URL || "http://127.0.0.1:8545"
// const provider = new providers.StaticJsonRpcProvider(ETHEREUM_RPC_URL);
// const flashbotsProvider = await FlashbotsBundleProvider.create(provider, flashbotsRelaySigningWallet);

// To construct the signed signature hash, need the rlp module
// const { encode } = require('rlp');

// can be rewritten with ethers.js
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
            tokenAddress1 = transaction.netBalanceChanges[d].balanceChanges[0].asset.contractAddress;
            tokenAddress0 = transaction.netBalanceChanges[d].balanceChanges[1].asset.contractAddress;

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

            let adjustment0;
            let adjustment1;
            if (tokenAddress0 != undefined && tokenAddress1 != undefined) {
                asset1 = transaction.netBalanceChanges[d].balanceChanges[0].asset.symbol;
                asset0 = transaction.netBalanceChanges[d].balanceChanges[1].asset.symbol;
                adjustment1 = transaction.netBalanceChanges[d].balanceChanges[0].delta;
                adjustment0 = transaction.netBalanceChanges[d].balanceChanges[1].delta.substring(1,);
                console.log(`Token ${asset0}: ${adjustment0}, Token ${asset1}: ${adjustment1}`);
                console.log(`Liquidity Pool exists at ${otherPairAddress}`); // liquidity pool address

                // ethers.js is required
                adjustment0 = ethers.utils.parseEther(ethers.utils.formatEther(adjustment0))._hex
                adjustment1 = ethers.utils.parseEther(ethers.utils.formatEther(adjustment1))._hex
            } else {
                continue
            }

            // pseudo code read from the blog below
            // https://www.blocknative.com/blog/mev-and-creating-a-basic-arbitrage-bot-on-ethereum-mainnet 
            profitHex = await FlashBot.getProfit(pairAddress, otherPairAddress, pairAddress, tokenAddress0, adjustment0, adjustment1);
            const gross = ethers.utils.formatEther(profitHex.toString(10).split(',')[0]);
            const gasLimit = 240000;
            const gasFee = Math.floor(ethers.utils.parseEther(gross)*.95/gasLimit);
            const gasCost = gasLimit*gasFee;
            const net = ethers.utils.parseEther(gross) - gasCost;

            let s1;
            if (transaction.type == 2) {
                params = [
                    '0x01',
                    transaction.nonce === 0 ? '0x' : ethers.utils.hexlify(transaction.nonce),
                    ethers.utils.parseEther(ethers.utils.formatEther(transaction.maxPriorityFeePerGas))._hex,
                    ethers.utils.parseEther(ethers.utils.formatEther(transaction.maxFeePerGas))._hex,
                    ethers.utils.hexlify(transaction.gas),
                    transaction.to,
                    transaction.value === '0' ? '0x' : ethers.utils.hexlify(transaction.value),
                    transaction.input,
                    [],
                    transaction.v === '0x0' ? '0x' : transaction.v,
                    transaction.r,
                    transaction.s
                ];
                s1 = '0x02'+encode(params).toString('hex');
            } else {
                params = [
                    transaction.nonce === 0 ? '0x' : ethers.utils.hexlify(transaction.nonce),
                    ethers.utils.parseEther(ethers.utils.formatEther(transaction.gasPrice))._hex,
                    ethers.utils.hexlify(transaction.gas),
                    transaction.to,
                    transaction.value === '0' ? '0x' : ethers.utils.hexlify(transaction.value),
                    transaction.input,
                    transaction.v,
                    transaction.r,
                    transaction.s
                ];
                s1 = '0x'+encode(params).toString('hex');
            }

            // use populateTransaction; https://docs.ethers.io/v5/api/contract/contract/
            // contract.populateTransaction.METHOD_NAME(...args [ , overrides ] )
            const s2 = await FlashBot.populateTransaction.flashArbitrage(
                pairAddress,
                otherPairAddress,
                pairAddress,
                tokenAddress0,
                ethers.utils.parseEther('0')._hex,
                ethers.utils.parseEhter('0')._hex
            );

            s2.gasPrice = ethers.utils.hexlify(gasFee);
            s2.gasLimit = ethers.utils.hexlify(500000);
            s2.nonce = await arbitrageSigningWallet.getTransactionCount(); // need a wallet instance
            // https://docs.ethers.io/v5/api/signer/#Wallet

            const signedTransactions = await flashbotsProvider.signBundle([
                {
                    signedTransaction: s1
                },
                {
                    signer: wallet,
                    transaction: s2
                }
            ]);

            const blockNumber = transaction.pendingBlockNumber + 1;

            const simulation = await flashbotsProvider.simulate(signedTransactions, blockNuber);
            if ('error' in simulation) {
                console.log(`Simulation Error: ${simulation.error.message}`);
            } else {
                if (simulation.firstRevert !== undefined) {
                    console.log(simulation.firstRevert.revert);
                } else {
                    const net2 = ethers.utils.parseEther(gross) - simulation.results[1].gasUsed*gasFee;
                    console.log(`Net: ${ethers.utils.formatEther(net2)} | Pair address: ${pairAddress} | TxHash: ${transaction.hash}`);
                    console.log(simulation);
                    if (net2 > 0) { // if this is still profitable
                        console.log(`Coinbase diff: ${simulation.coinbaseDiff}`);
                        const submittedBundle = await flashbotsProvider.sendRawBundle(signedTransactions, blockNumber);
                        const bundleResponse = await submittedBundle.wait();
                        console.log(bundleResponse);
                    }
                }
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

