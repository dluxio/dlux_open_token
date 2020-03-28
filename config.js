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
const clientURL = ENV.APIURL || 'https://anyx.io'


const engineCrank = ENV.startingHash || 'QmTwkiBz8jZGMQ7rTsSRrLUZVNNNoYZzjDg342gfLAFRRq'
const acm = ENV.account_creator || false //account creation market

let config = {
    username,active,memoKey, NODEDOMAIN, bidRate, engineCrank, port, clientURL, acm, rta, rtp,override
};

module.exports = config;
