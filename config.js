const ENV = process.env;

const username = ENV.account || 'dlux-io';
const active = ENV.active || '';
const memoKey = ENV.memo || '';
const NODEDOMAIN = ENV.domain || 'http://dlux-token.herokuapp.com'
const override = ENV.override || 0
const rta = ENV.rta || ''
const rtp = ENV.rtp || ''

const bidRate = ENV.BIDRATE || 2500
const port = ENV.PORT || 3000;
var clientURL = ENV.APIURL || 'https://api.hive.blog'
const clients = [
    'https://api.hive.blog',
    'https://anyx.io',
    'https://api.hivekings.com',
    'https://api.openhive.network',
    'https://rpc.ausbit.dev',
    'https://hive.roelandp.nl',
    'https://api.c0ff33a.uk',
    'https://api.deathwing.me',
    'https://hive-api.arcange.eu',
    'https://fin.hive.3speak.co',
    'https://hived.emre.sh',
    'https://techcoderx.com',
    'https://rpc.ecency.com',
    'https://hived.privex.io',
    'https://api.pharesim.me'
]
const engineCrank = ENV.startingHash || 'QmTwkiBz8jZGMQ7rTsSRrLUZVNNNoYZzjDg342gfLAFRRq'
const acm = ENV.account_creator || false //account creation market

let config = {
    username,
    active,
    memoKey,
    NODEDOMAIN,
    bidRate,
    engineCrank,
    port,
    clientURL,
    clients,
    acm,
    rta,
    rtp,
    override
};

module.exports = config;