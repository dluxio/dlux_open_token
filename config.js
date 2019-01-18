const ENV = process.env;

const username = ENV.account || '';
const active = ENV.active || '';
const memoKey = ENV.memo || '';
const NODEDOMAIN = ENV.domain || ''

const bidRate = ENV.BIDRATE || 0
const port = ENV.PORT || 3000;
const clientURL = ENV.APIURL || 'https://api.steemit.com'


const engineCrank = ENV.startingHash || ''

let config = {
    username,active,memoKey, NODEDOMAIN, bidRate, engineCrank, port, clientURL
};

module.exports = config;
