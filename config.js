const ENV = process.env;
const port = ENV.PORT || 3000;
const username = ENV.account || '';
const active = ENV.active || '';
const memoKey = ENV.memo || '';
const NODEDOMAIN = ENV.domain || ''
const bidRate = ENV.BIDRATE
const engineCrank = ENV.startingHash || ''
const clientURL = ENV.APIURL || 'https://api.steemit.com'

let config = {
    username,active,memoKey, NODEDOMAIN, bidRate, engineCrank, port, clientURL
};

module.exports = config;
