require('dotenv').config();
const ENV = process.env;

const username = ENV.account || 'disregardfiat';
const active = ENV.active || '';
const memoKey = ENV.memo || '';
const hookurl = ENV.discordwebhook || '';
const NODEDOMAIN = ENV.domain || 'http://dlux-token.herokuapp.com' //where your API lives
const acm = ENV.account_creator || false //account creation market ... use your accounts HP to claim account tokens
const mirror = ENV.mirror || false //makes identical posts, votes and IPFS pins as the leader account
const port = ENV.PORT || 3001;
const pintoken = ENV.pintoken || ''
const pinurl = ENV.pinurl || '';
const status = ENV.status || true
const dbcs = ENV.DATABASE_URL || '';
const history = ENV.history || 3600

// testing configs for replays
const override = ENV.override || 59021400 //will use standard restarts after this blocknumber
const engineCrank = ENV.startingHash || '' //but this state will be inserted before

// third party configs
const rta = ENV.rta || '' //rtrades account : IPFS pinning interface
const rtp = ENV.rtp || '' //rtrades password : IPFS pinning interface

var ipfshost = ENV.ipfshost || 'ipfs.infura.io' //IPFS upload/download provider provider

//node market config > 2500 is 25% inflation to node operators, this is currently not used
const bidRate = ENV.BIDRATE || 2500 //

//HIVE CONFIGS
var startURL = ENV.STARTURL || "https://api.hive.blog/"
var clientURL = ENV.APIURL || "https://api.hive.blog/"
const clients = ENV.clients || [
    "https://api.deathwing.me/",
        //"https://rpc.ecency.com/",
        "https://hived.emre.sh/",
        //"https://rpc.ausbit.dev/",
        "https://api.hive.blog/"
]

//!!!!!!! -- THESE ARE COMMUNITY CONSTANTS -- !!!!!!!!!//
//TOKEN CONFIGS -- ALL COMMUNITY RUNNERS NEED THESE SAME VALUES
const starting_block = 49988008; //from what block does your token start
const prefix = 'dlux_' //Community token name for Custom Json IDs
const TOKEN = 'DLUX' //Token name
const precision = 3 //precision of token
const tag = 'dlux' //the fe.com/<tag>/@<leader>/<permlink>
const jsonTokenName = 'dlux' //what customJSON in Escrows and sends is looking for
const leader = 'dlux-io' //Default account to pull state from, will post token 
const ben = 'dlux-io' //Account where comment benifits trigger token action
const delegation = 'dlux-io' //account people can delegate to for rewards
const delegationWeight = 1000 //when to trigger community rewards with bens
const msaccount = 'dac.escrow' //account controlled by community leaders
const mainAPI = 'token.dlux.io' //leaders API probably
const mainFE = 'dlux.io' //frontend for content
const mainIPFS = 'a.ipfs.dlux.io' //IPFS service
const mainICO = 'robotolux' //Account collecting ICO HIVE
const footer = `\n[Find us on Discord](https://discord.gg/Beeb38j)`

//Aditionally on your branch, look closely at dao, this is where tokenomics happen and custom status posts are made

let config = {
    username,
    active,
    memoKey,
    NODEDOMAIN,
    hookurl,
    status,
    history,
    dbcs,
    mirror,
    bidRate,
    engineCrank,
    port,
    pintoken,
    pinurl,
    clientURL,
    startURL,
    clients,
    acm,
    rta,
    rtp,
    override,
    ipfshost,
    starting_block,
    prefix,
    leader,
    msaccount,
    ben,
    delegation,
    delegationWeight,
    TOKEN,
    precision,
    tag,
    mainAPI,
    jsonTokenName,
    mainFE,
    mainIPFS,
    mainICO,
    footer
};

module.exports = config;