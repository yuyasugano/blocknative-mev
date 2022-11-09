require('dotenv').config();

const Web3 = require('web3');
const abis = require('./abis');
const { mainnet: addresses } = require('./addresses');

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

const HEX = '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39';
const WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';

const init = async () => {
    const networkId = await web3.eth.net.getId();
    const pairUniswap   = await uniswapFactory.methods.getPair(HEX, WETH).call();
    const pairSushiswap = await sushiswapFactory.methods.getPair(HEX, WETH).call();

    if (pairUniswap != undefined && pairSushiswap != undefined) {
        console.log(`
            pair addresses at Dexes
            ========================
            pairUniswap: ${pairUniswap}
            pairSushiswap: ${pairSushiswap}
        `);
    }
}

init();

