const ENV = process.env;
const port = ENV.PORT || 3000;
const username = ENV.account || '';
const active = ENV.active || '';
const memoKey = ENV.memo || '';
const NODEDOMAIN = ENV.domain || ''
const bidRate = ENV.BIDRATE || 0
const engineCrank = ENV.startingHash || 'QmTMuxYSUZcbUb1dgExfQV2u7g6FAdBfdZx27ywMy9o6y9'
const clientURL = ENV.APIURL || 'https://api.steemit.com'

let config = {
    username,active,memoKey, NODEDOMAIN, bidRate, engineCrank, port, clientURL
};

module.exports = config;
