const ENV = process.env;

const username = ENV.account || 'dlux-io';
const active = ENV.active || '';
const memoKey = ENV.memo || '';
const NODEDOMAIN = ENV.domain || 'http://dlux-token.herokuapp.com'
const acm = ENV.account_creator || false //account creation market
const mirror = ENV.mirror || false //makes identical posts, votes and IPFS pins as the leader account
const port = ENV.PORT || 3000;
// testing configs
const override = ENV.override || 0 //testing purposes 
const engineCrank = ENV.startingHash || 'QmTwkiBz8jZGMQ7rTsSRrLUZVNNNoYZzjDg342gfLAFRRq' //testing purposes

// third party configs
const rta = ENV.rta || '' //rtrades account : IPFS pinning interface
const rtp = ENV.rtp || '' //rtrades password : IPFS pinning interface

var ipfshost = ENV.ipfshost || 'ipfs.infura.io' //IPFS upload/download provider provider

//node market config > 2500 is 25% inflation to node operators, this is currently not used
const bidRate = ENV.BIDRATE || 2500 //

//HIVE CONFIGS
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

//TOKEN CONFIGS!
const starting_block = 41372401; //from what block does your token start
const prefix = 'dlux_' //Community token name for Custom Json IDs
const TOKEN = 'DLUX' //Token name
const tag = 'dlux' //
const jsonTokenName = 'dlux' //what customJSON in Escrows and sends is looking for
const leader = 'dlux-io' //Default account to pull state from, will post token 
const ben = 'dlux-io' //Account where comment benifits trigger token action
const delegation = 'dlux-io' //
const mainAPI = 'token.dlux.io' //leaders API probably
const mainFE = 'dlux.io' //frontend for content
const mainIPFS = 'a.ipfs.dlux.io' //IPFS service

//Aditionally on your branch, look closely at dao, this is where tokenomics happen and custom status posts are made

let config = {
    username,
    active,
    memoKey,
    NODEDOMAIN,
    mirror,
    bidRate,
    engineCrank,
    port,
    clientURL,
    clients,
    acm,
    rta,
    rtp,
    override,
    ipfshost,
    starting_block,
    prefix,
    leader,
    ben,
    delegation,
    TOKEN,
    tag,
    mainAPI,
    jsonTokenName,
    mainFE,
    mainIPFS
};

module.exports = config;