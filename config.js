const ENV = process.env;

const username = ENV.account || '';
const active = ENV.active || '';
const memoKey = ENV.memo || '';
const NODEDOMAIN = ENV.domain || ''

const rta = ENV.rta || ''
const rtp = ENV.rtp || ''

const bidRate = ENV.BIDRATE || 0
const port = ENV.PORT || 3000;
const clientURL = ENV.APIURL || 'https://api.steemit.com'


const engineCrank = ENV.startingHash || 'QmTFz2Az2zAmkcsQoPTShSAXeErWX7DYmhhyCPhbtULNXX'
const acm = ENV.account_creator || true //account creation market

let config = {
    username,active,memoKey, NODEDOMAIN, bidRate, engineCrank, port, clientURL, acm, rta, rtp
};

module.exports = config;
