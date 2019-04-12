const ENV = process.env;

const username = ENV.account || 'dlux-io';
const active = ENV.active || '';
const memoKey = ENV.memo || '';
const NODEDOMAIN = ENV.domain || 'http://dlux-token.herokuapp.com'
const override = ENV.override || false
const rta = ENV.rta || ''
const rtp = ENV.rtp || ''

const bidRate = ENV.BIDRATE || 2500
const port = ENV.PORT || 3000;
const clientURL = ENV.APIURL || 'https://api.steemit.com'


const engineCrank = ENV.startingHash || 'QmWRJdREoTxYyUreshW4MCuttvxZaP7RUSGzDxLtdxyhWK'
const acm = ENV.account_creator || false //account creation market

let config = {
    username,active,memoKey, NODEDOMAIN, bidRate, engineCrank, port, clientURL, acm, rta, rtp,override
};

module.exports = config;
