const config = require('./config');
const VERSION = 'v1.1.0b2'
exports.VERSION = VERSION
exports.exit = exit;
exports.processor = processor;
const hive = require('@hiveio/dhive');
var client = new hive.Client(config.clientURL);
exports.client = client

const args = require('minimist')(process.argv.slice(2));
const express = require('express');
const stringify = require('json-stable-stringify');
const IPFS = require('ipfs-api'); //ipfs-http-client doesn't work
const ipfs = new IPFS({
    host: config.ipfshost,
    port: 5001,
    protocol: 'https'
});
exports.ipfs = ipfs;
const rtrades = require('./rtrades');
var Pathwise = require('./pathwise');
var level = require('level');
const statestart = require('./state')
var store = new Pathwise(level('./db', { createIfEmpty: true }));
exports.store = store;

const cors = require('cors');
const { ChainTypes, makeBitMaskFilter, ops } = require('@hiveio/hive-js/lib/auth/serializer');
const op = ChainTypes.operations
const walletOperationsBitmask = makeBitMaskFilter([op.custom_json])
const hiveClient = require('@hiveio/hive-js');
const broadcastClient = require('@hiveio/hive-js');
broadcastClient.api.setOptions({ url: config.startURL });
hiveClient.api.setOptions({ url: config.clientURL });
console.log('Using APIURL: ', config.clientURL)
exports.hiveClient = hiveClient
//non-consensus node memory
var plasma = {
        consensus: '',
        pending: {},
        page: [],
        hashLastIBlock: 0,
        hashSecIBlock: 0
            //pagencz: []
    },
    jwt;
exports.plasma = plasma
var NodeOps = [];
//aare these used still?
exports.GetNodeOps = function() { return NodeOps }
exports.newOps = function(array) { NodeOps = array }
exports.unshiftOp = function(op) { NodeOps.unshift(op) }
exports.pushOp = function(op) { NodeOps.push(op) }
exports.spliceOp = function(i) { NodeOps.splice(i, 1) }
var status = {
    cleaner: [],
}
exports.status = status
let TXID = {
    store: function (msg, txid){
        try {
            status[txid.split(':')[1]] = msg
            status.cleaner.push(txid)
        } catch (e){console.log(e)}
    },
    clean: function (blocknum){
        TXID.blocknumber = blocknum
        try {
            if(status.cleaner.length){
                var again = false
                do {
                    if (parseInt(status.cleaner[0].split(':')[0]) <= blocknum - config.history){
                        delete status[status.cleaner[0].split(':')[1]]
                        status.cleaner.shift()
                        again = true
                    } else {
                        again = false
                    }
                } while (again)
            }
        } catch (e){console.log('Try Clean Status failed:', e)}
    },
    getBlockNum: function (){
        return TXID.blocknumber
    },
    blocknumber: 0,
    streaming: false,
    current: function(){TXID.streaming = true},
    reset: function(){TXID.streaming = false, TXID.blocknumber = 0, status = {
    cleaner: [],
}},
}
exports.TXID = TXID
const API = require('./routes/api');
const HR = require('./processing_routes/index')
const { enforce } = require("./enforce");
const { tally } = require("./tally");
const { voter } = require("./voter");
const { report, sig_submit } = require("./report");
const { ipfsSaveState } = require("./ipfsSaveState");
const { dao } = require("./dao");
const { recast } = require('./lil_ops')
const { Base64, NFT, Chron, release } = require('./helpers');
const hiveState = require('./processor');
const { getPathObj, getPathNum, getPathSome } = require('./getPathObj');
const { consolidate, sign, createAccount, updateAccount } = require('./msa')
const api = express()
var http = require('http').Server(api);
var escrow = false;
exports.escrow = escrow;
//const wif = hiveClient.auth.toWif(config.username, config.active, 'active')
var startingBlock = config.starting_block
    //var current
    //exports.current = current
const streamMode = args.mode || 'irreversible';
console.log("Streaming using mode", streamMode);
var processor;
exports.processor = processor
var live_dex = {}, //for feedback, unused currently
    pa = []
var recents = []
    //HIVE API CODE

//Start Program Options   
//startWith('QmZQSh3za4wG1skPtC7HaehKHLdP8Ya9VbQni1YHDaL3GU', true) //for testing and replaying 58859101
dynStart(config.leader)

// API defs
api.use(API.https_redirect);
api.use(cors())
api.get('/', API.root);
api.get('/stats', API.root);
api.get('/coin', API.coin);
api.get('/state', API.state); //Do not recommend having a state dump in a production API
api.get('/dex', API.dex);
api.get('/api/tickers', API.tickers);
api.get('/api/orderbook', API.orderbook);
api.get('/api/orderbook/:ticker_id', API.orderbook);
api.get('/api/pairs', API.pairs);
api.get('/api/historical', API.historical_trades);
api.get('/api/historical/:ticker_id', API.historical_trades);
api.get('/api/recent/:ticker_id', API.chart);
api.get('/api/mirrors', API.mirrors);
api.get('/api/coin_detail', API.detail);
api.get('/api/nfts/:user', API.nfts);
api.get('/api/nft/:set/:item', API.item);
api.get('/api/sets', API.sets);
api.get('/api/set/:set', API.set);
api.get('/api/auctions', API.auctions);
api.get('/api/auctions/:set', API.auctions);
api.get('/api/mintauctions', API.mint_auctions);
api.get('/api/mintauctions/:set', API.mint_auctions);
api.get('/api/sales', API.sales);
api.get('/api/sales/:set', API.sales);
api.get('/api/mintsales', API.mint_sales);
api.get('/api/mintsales/:set', API.mint_sales);
api.get('/api/mintsupply', API.mint_supply);
api.get('/api/mintsupply/:set', API.mint_supply);
api.get('/api/pfp/:user', API.official);
api.get('/api/trades/:kind/:user', API.limbo);
api.get('/@:un', API.user);
api.get('/blog/@:un', API.blog);
api.get('/dapps/@:author', API.getAuthorPosts);
api.get('/dapps/@:author/:permlink', API.getPost);
api.get('/new', API.getNewPosts);
api.get('/trending', API.getTrendingPosts);
api.get('/promoted', API.getPromotedPosts);
api.get('/report/:un', API.report); // probably not needed
api.get('/markets', API.markets); //for finding node runner and tasks information
api.get('/posts/:author/:permlink', API.PostAuthorPermlink);
api.get('/posts', API.posts); //votable posts
api.get('/feed', API.feed); //all side-chain transaction in current day
api.get('/runners', API.runners); //list of accounts that determine consensus... will also be the multi-sig accounts
api.get('/queue', API.queue);
api.get('/api/protocol', API.protocol);
api.get('/api/status/:txid', API.status);
api.get('/pending', API.pending); // The transaction signer now can sign multiple actions per block and this is nearly always empty, still good for troubleshooting
// Some HIVE APi is wrapped here to support a stateless frontend built on the cheap with dreamweaver
// None of these functions are required for token functionality and should likely be removed from the community version
api.get('/api/:api_type/:api_call', API.hive_api);
api.get('/hapi/:api_type/:api_call', API.hive_api);
api.get('/getwrap', API.getwrap);
api.get('/getauthorpic/:un', API.getpic);
api.get('/getblog/:un', API.getblog);

http.listen(config.port, function() {
    console.log(`${config.TOKEN} token API listening on port ${config.port}`);
});
//grabs an API token for IPFS pinning of TOKEN posts
if (config.rta && config.rtp) {
    rtrades.handleLogin(config.rta, config.rtp)
}

//starts block processor after memory has been loaded
function startApp() {
    processor = hiveState(client, hive, startingBlock, 10, config.prefix, streamMode, cycleAPI);
    processor.on('send', HR.send);
    processor.on('power_up', HR.power_up); // power up tokens for vote power in layer 2 token proof of brain
    processor.on('power_down', HR.power_down);
    processor.on('power_grant', HR.power_grant);
    processor.on('vote_content', HR.vote_content);
    processor.on('dex_sell', HR.dex_sell);
    processor.on('dex_clear', HR.dex_clear);
    processor.on('gov_down', HR.gov_down);
    processor.on('gov_up', HR.gov_up);
    processor.on('node_add', HR.node_add);
    processor.on('node_delete', HR.node_delete);
    processor.on('report', HR.report);
    processor.on('queueForDaily', HR.q4d)
    processor.on('nomention', HR.nomention)
    processor.on('ft_bid', HR.ft_bid)
    processor.on('ft_auction', HR.ft_auction)
    processor.on('ft_sell_cancel', HR.ft_sell_cancel)
    processor.on('ft_buy', HR.ft_buy)
    processor.on('ft_sell', HR.ft_sell)
    processor.on('ft_escrow_cancel', HR.ft_escrow_cancel)
    processor.on('ft_escrow_complete', HR.ft_escrow_complete)
    processor.on('ft_escrow', HR.ft_escrow)
    processor.on('fts_sell_h', HR.fts_sell_h)
    processor.on('fts_sell_hcancel', HR.fts_sell_hcancel)
    processor.on('nft_buy', HR.nft_buy)
    processor.on('nft_sell', HR.nft_sell)
    processor.on('nft_sell_cancel', HR.nft_sell_cancel)
    processor.on('ft_transfer', HR.ft_transfer)
    processor.on('ft_airdrop', HR.ft_airdrop)
    processor.on('nft_transfer', HR.nft_transfer)
    processor.on('nft_auction', HR.nft_auction)
    processor.on('nft_bid', HR.nft_bid)
    processor.on('nft_transfer_cancel', HR.nft_transfer_cancel)
    processor.on('nft_reserve_transfer', HR.nft_reserve_transfer)
    processor.on('nft_reserve_complete', HR.nft_reserve_complete)
    processor.on('nft_define', HR.nft_define)
    processor.on('nft_add_roy', HR.nft_add_roy)
    processor.on('nft_div', HR.nft_div)
    processor.on('nft_define_delete', HR.nft_define_delete)
    processor.on('nft_melt', HR.nft_delete)
    processor.on('nft_mint', HR.nft_mint)
    processor.on('nft_pfp', HR.nft_pfp)
    processor.onOperation('comment_options', HR.comment_options);
    processor.on('cjv', HR.cjv);
    processor.on('sig_submit', HR.sig_submit); //dlux is for putting executable programs into IPFS... this is for additional accounts to sign the code as non-malicious
    processor.on('cert', HR.cert); // json.cert is an open ended hope to interact with executable posts... unexplored
    processor.onOperation('vote', HR.vote) //layer 2 voting
    processor.onOperation('transfer', HR.transfer);
    processor.onOperation('delegate_vesting_shares', HR.delegate_vesting_shares);
    processor.onOperation('comment', HR.comment);
    //do things in cycles based on block time
    processor.onBlock(
        function(num, pc, prand, bh) {
            console.log(num)
            TXID.clean(num)
            return new Promise((resolve, reject) => {
                let Pchron = getPathSome(['chrono'],{
                    gte: "" + num - 1,
                    lte: "" + (num + 1)
                })
                let Pmss = getPathSome(['mss'],{
                    gte: "" + (num - 1000000),
                    lte: "" + (num - 100)
                }) //resign mss
                let Pmsa = getPathObj(['msa'])
                Promise.all([Pchron, Pmss, Pmsa]).then(mem => {
                    var a = mem[0],
                        mss = mem[1], //resign mss
                        msa = mem[2] //if length > 80... sign these
                    let chrops = {},
                        promises = [],
                        msa_keys = Object.keys(msa)
                        if(num % 100 !== 50){
                            if(msa_keys.length > 80){
                                promises.push(new Promise((res,rej)=>{
                                    sig_submit(consolidate(num, plasma, bh))
                                    .then(nodeOp => {
                                        res('SAT')
                                        NodeOps.unshift(nodeOp)
                                    })
                                    .catch(e => { rej(e) })
                                }))
                            }
                            for(var missed = 0; missed < mss.length; missed++){
                                if(mss[missed].split(':').length == 1){
                                    missed_num = mss[missed]
                                    promises.push(new Promise((res,rej)=>{
                                        sig_submit(sign(num, plasma, missed_num, bh))
                                        .then(nodeOp => {
                                            res('SAT')
                                            if(JSON.parse(nodeOp[1][1].json).sig){
                                                NodeOps.unshift(nodeOp)
                                            }
                                        })
                                        .catch(e => { rej(e) })
                                    })) 
                                    break;
                                }
                            }
                        }
                    for (var i in a) {
                        chrops[a[i]] = a[i]
                    }
                    var ints = 0
                   for (var i in chrops) {
                        ints++
                        let delKey = chrops[i]
                        store.getWith(['chrono', chrops[i]], {delKey, ints}, function(e, b, passed) {
                            switch (b.op) {
                                case 'mint':
                                    //{op:"mint", set:json.set, for: from}
                                    let setp = getPathObj(['sets', b.set]);
                                    promises.push(NFT.mintOp([setp], passed.delKey, num, b, `${passed.ints}${prand}`))
                                    break;
                                case 'ahe':
                                    let ahp = getPathObj(['ah', b.item]),
                                        setahp = ''
                                        if (b.item.split(':')[0] != 'Qm') setahp = getPathObj(['sets', b.item.split(':')[0]])
                                        else setahp = getPathObj(['sets', `Qm${b.item.split(':')[1]}`])
                                    promises.push(NFT.AHEOp([ahp, setahp], passed.delKey, num, b))
                                    break;
                                case 'ame':
                                    let amp = getPathObj(['am', b.item]),
                                        setamp = ''
                                        if (b.item.split(':')[0] != 'Qm') setamp = getPathObj(['sets', b.item.split(':')[0]])
                                        else setamp = getPathObj(['sets', `Qm${b.item.split(':')[1]}`])
                                    promises.push(NFT.AMEOp([amp, setamp], passed.delKey, num, b))
                                    break;
                                case 'div':
                                    let contract = getPathObj(['div', b.set]),
                                        set = getPathObj(['sets', b.set])
                                    promises.push(NFT.DividendOp([contract, set], passed.delKey, num, b))
                                    break;
                                case 'del_pend':
                                    store.batch([{ type: 'del', path: ['chrono', passed.delKey] }, { type: 'del', path: ['pend', `${b.author}/${b.permlink}`]}], [function() {}, function() { console.log('failure') }])
                                    break;
                                case 'ms_send':
                                    promises.push(recast(b.attempts, b.txid, num))
                                    store.batch([{ type: 'del', path: ['chrono', passed.delKey] }], [function() {}, function() { console.log('failure') }])
                                    break;
                                case 'expire':
                                    promises.push(release(b.from, b.txid, num))
                                    store.batch([{ type: 'del', path: ['chrono', passed.delKey] }], [function() {}, function() { console.log('failure') }])
                                    break;
                                case 'check':
                                    promises.push(enforce(b.agent, b.txid, { id: b.id, acc: b.acc }, num))
                                    store.batch([{ type: 'del', path: ['chrono', passed.delKey] }], [function() {}, function() { console.log('failure') }])
                                    break;
                                case 'denyA':
                                    promises.push(enforce(b.agent, b.txid, { id: b.id, acc: b.acc }, num))
                                    store.batch([{ type: 'del', path: ['chrono', passed.delKey] }], [function() {}, function() { console.log('failure') }])
                                    break;
                                case 'denyT':
                                    promises.push(enforce(b.agent, b.txid, { id: b.id, acc: b.acc }, num))
                                    store.batch([{ type: 'del', path: ['chrono', passed.delKey] }], [function() {}, function() { console.log('failure') }])
                                    break;
                                case 'gov_down': //needs work and testing
                                    let plb = getPathNum(['balances', b.by]),
                                        tgovp = getPathNum(['gov', 't']),
                                        govp = getPathNum(['gov', b.by])
                                    promises.push(Chron.govDownOp([plb, tgovp, govp], b.by, passed.delKey, num, passed.delKey.split(':')[1], b))
                                    break;
                                case 'power_down': //needs work and testing
                                    let lbp = getPathNum(['balances', b.by]),
                                        tpowp = getPathNum(['pow', 't']),
                                        powp = getPathNum(['pow', b.by])
                                    promises.push(Chron.powerDownOp([lbp, tpowp, powp], b.by, passed.delKey, num, passed.delKey.split(':')[1], b))
                                    break;
                                case 'post_reward':
                                    promises.push(Chron.postRewardOP(b, num, passed.delKey.split(':')[1], passed.delKey))
                                    break;
                                case 'post_vote':
                                    promises.push(Chron.postVoteOP(b, passed.delKey))
                                    break;
                                default:

                            }

                        })
                    }
                    if (num % 100 === 0 && processor.isStreaming()) {
                        client.database.getDynamicGlobalProperties()
                            .then(function(result) {
                                console.log('At block', num, 'with', result.head_block_number - num, `left until real-time. DAO in ${30240 - ((num - 20000) % 30240)} blocks`)
                            });
                    }
                    if (num % 100 === 50) {
                        setTimeout(function(a) {
                            if(plasma.hashLastIBlock == a || plasma.hashSecIBlock == a){
                                exit(plasma.hashLastIBlock)
                            }
                        }, 620000, plasma.hashLastIBlock)
                        promises.push(new Promise((res,rej)=>{
                            report(plasma, consolidate(num, plasma, bh))
                            .then(nodeOp => {
                                res('SAT')
                                if(processor.isStreaming())NodeOps.unshift(nodeOp)
                            })
                            .catch(e => { rej(e) })
                        }))
                    }
                    if ((num - 20003) % 30240 === 0) { //time for daily magic
                        promises.push(dao(num))
                    }
                    if (num % 100 === 0) {
                        promises.push(tally(num, plasma, processor.isStreaming()));
                    }
                    if ((num - 2) % 3000 === 0) {
                        promises.push(voter());
                    }
                    if (num % 100 === 1) {
                        store.get([], function(err, obj) {
                            const blockState = Buffer.from(stringify([num, obj]))
                            ipfsSaveState(num, blockState)
                                .then(pla => {
                                    plasma.hashSecIBlock = plasma.hashLastIBlock
                                    plasma.hashLastIBlock = pla.hashLastIBlock
                                    plasma.hashBlock = pla.hashBlock
                                })
                                .catch(e => { console.log(e) })

                        })
                    }
                    if (config.active && processor.isStreaming() ) {
                        store.get(['escrow', config.username], function(e, a) {
                            if (!e) {
                                for (b in a) {
                                    if (!plasma.pending[b]) {
                                        NodeOps.push([
                                            [0, 0],
                                            a[b]
                                        ]);
                                        plasma.pending[b] = true
                                    }
                                }
                                var ops = [],
                                    cjbool = false,
                                    votebool = false
                                signerloop: for (i = 0; i < NodeOps.length; i++) {
                                    if (NodeOps[i][0][1] == 0 && NodeOps[i][0][0] <= 100) {
                                        if (NodeOps[i][1][0] == 'custom_json' && JSON.parse(NodeOps[i][1][1].json).sig_block && num - 100 > JSON.parse(NodeOps[i][1][1].json).sig_block){
                                            NodeOps.splice(i, 1)
                                            continue signerloop
                                        }
                                        if (NodeOps[i][1][0] == 'custom_json' && !cjbool ) {
                                            ops.push(NodeOps[i][1])
                                            NodeOps[i][0][1] = 1
                                            cjbool = true
                                        } else if (NodeOps[i][1][0] == 'custom_json'){
                                            // don't send two jsons at once
                                        } else if (NodeOps[i][1][0] == 'vote' && !votebool){
                                            ops.push(NodeOps[i][1])
                                            NodeOps[i][0][1] = 1
                                            votebool = true
                                        } else if (NodeOps[i][1][0] == 'vote'){
                                            // don't send two votes at once
                                        } else { //need transaction limits here... how many votes or transfers can be done at once?
                                            ops.push(NodeOps[i][1])
                                            NodeOps[i][0][1] = 1
                                        }
                                    } else if (NodeOps[i][0][0] < 100) {
                                        NodeOps[i][0][0]++
                                    } else if (NodeOps[i][0][0] == 100) {
                                        NodeOps[i][0][0] = 0
                                    }
                                }
                                for (i = 0; i < NodeOps.length; i++) {
                                    if (NodeOps[i][0][2] == true) {
                                        NodeOps.splice(i, 1)
                                    }
                                }
                                if (ops.length) {
                                    console.log('attempting broadcast', ops)
                                    broadcastClient.broadcast.send({
                                        extensions: [],
                                        operations: ops
                                    }, [config.active], (err, result) => {
                                        if (err) {
                                            console.log(err) //push ops back in.
                                            for (q = 0; q < ops.length; q++) {
                                                if (NodeOps[q][0][1] == 1) {
                                                    NodeOps[q][0][1] = 3
                                                }
                                            }
                                        } else {
                                            console.log('Success! txid: ' + result.id)
                                            for (q = ops.length - 1; q > -1; q--) {
                                                if (NodeOps[q][0][0] = 1) {
                                                    NodeOps.splice(q, 1)
                                                }
                                            }
                                        }
                                    });
                                }
                            } else {
                                console.log(e)
                            }
                        })
                    }
                    if (promises.length) {
                        waitup(promises, pc, [resolve, reject])
                    } else {
                        resolve(pc)
                    }
                })
            })
        });
    processor.onStreamingStart(HR.onStreamingStart);
    processor.start();
    setTimeout(function(){
        API.start();
    }, 3000);
}

function exit(consensus) {
    console.log(`Restarting with ${consensus}...`);

    processor.stop(function() {});
        if (consensus) {
            startWith(consensus, true)
        } else {
            dynStart(config.leader)
        }
}

function waitfor(promises_array) {
    return new Promise((resolve, reject) => {
        Promise.all(promises_array)
            .then(r => {
                for (i = 0; i < r.length; i++) {
                    if (r[i].consensus) {
                        plasma.consensus = r[1].consensus
                    }
                }
                resolve(1)
            })
            .catch(e => { reject(e) })
    })
}
exports.waitfor = waitfor;

//hopefully handling the HIVE garbage APIs
function cycleAPI() {
    var c = 0
    for (i of config.clients) {
        if (config.clientURL == config.clients[i]) {
            c = i
            break;
        }
    }
    if (c == config.clients.length - 1) {
        c = -1
    }
    config.clientURL = config.clients[c + 1]
    console.log('Using APIURL: ', config.clientURL)
    client = new hive.Client(config.clientURL)
    exit(plasma.hashLastIBlock)
}

//pulls the latest activity of an account to find the last state put in by an account to dynamically start the node. 
//this will include other accounts that are in the node network and the consensus state will be found if this is the wrong chain
function dynStart(account) {
    API.start()
    let accountToQuery = account || config.username
    hiveClient.api.setOptions({ url: config.startURL });
    console.log('Starting URL: ', config.startURL)
    hiveClient.api.getAccountHistory(accountToQuery, -1, 100, ...walletOperationsBitmask, function(err, result) {
        if (err) {
            console.log('errr', err)
            dynStart(config.leader)
        } else {
            hiveClient.api.setOptions({ url: config.clientURL });
            let ebus = result.filter(tx => tx[1].op[1].id === `${config.prefix}report`)
            for (i = ebus.length - 1; i >= 0; i--) {
                if (JSON.parse(ebus[i][1].op[1].json).hash && parseInt(JSON.parse(ebus[i][1].op[1].json).block) > parseInt(config.override)) {
                    recents.push(JSON.parse(ebus[i][1].op[1].json).hash)
                }
            }
            if (recents.length) {
                const mostRecent = recents.shift()
                console.log({mostRecent})
                if (recents.length === 0) {
                    startWith(config.engineCrank)
                } else {
                    startWith(mostRecent)
                }
            } else {
                startWith(config.engineCrank)
                console.log('I did it')
            }
        }
    });
}


//pulls state from IPFS, loads it into memory, starts the block processor
function startWith(hash, second) {
    console.log(`${hash} inserted`)
    if (hash) {
        console.log(`Attempting to start from IPFS save state ${hash}`);
        ipfs.cat(hash, (err, file) => {
            if (!err) {
                var data = JSON.parse(file);
                startingBlock = data[0]
                if (!startingBlock) {
                    startWith(sh)
                } else {
                    plasma.hashBlock = data[0]
                    plasma.hashLastIBlock = hash
                    store.del([], function(e) {
                        if (!e && (second || data[0] > API.RAM.head - 325)) {
                            if (hash) {
                                var cleanState = data[1]
                                cleanState.runners.disregardfiat = true
                                cleanState.runners.markegiles = true
                                cleanState.runners['dlux-io'] = true
                                store.put([], cleanState, function(err) {
                                    if (err) {
                                        console.log('errr',err)
                                    } else {
                                        store.get(['stats', 'lastBlock'], function(error, returns) {
                                            if (!error) {
                                                console.log(`State Check:  ${returns}\nAccount: ${config.username}\nKey: ${config.active.substr(0,3)}...`)
                                                let info = API.coincheck(cleanState)
                                                console.log('check', info.check)
                                                if (cleanState.stats.tokenSupply != info.supply) {
                                                    console.log('check',info.info)
                                                }
                                            }
                                        })
                                        startApp()
                                    }
                                })
                            } else {
                                store.put([], data[1], function(err) {
                                    if (err) { console.log(err) } else {
                                        store.get(['balances', 'ra'], function(error, returns) {
                                            if (!error) {
                                                console.log('there' + returns)
                                            }
                                        })
                                        startApp()
                                    }
                                })
                            }
                        } else if(!second) {
                            var promises = []
                            for( var runner in data[1].runners) {
                                    promises.push(new Promise((resolve, reject) => {
                                        console.log('runner', runner)
                                        hiveClient.api.getAccountHistory(runner, -1, 100, ...walletOperationsBitmask, function(err, result) {
                                            var recents = {block:0}
                                            if (err) {
                                                console.log('error in retrieval')
                                                resolve({hash:null,block:null})
                                            } else {
                                                //hiveClient.api.setOptions({ url: config.clientURL });
                                                let ebus = result.filter(tx => tx[1].op[1].id === `${config.prefix}report`)
                                                for (i = ebus.length - 1; i >= 0; i--) {
                                                    if (JSON.parse(ebus[i][1].op[1].json).hash) {
                                                        if(recents.block < JSON.parse(ebus[i][1].op[1].json).block){
                                                            recents = {
                                                                hash: JSON.parse(ebus[i][1].op[1].json).hash,
                                                                block: parseInt(JSON.parse(ebus[i][1].op[1].json).block)}
                                                        }
                                                        else {
                                                            recents[0] = {hash: JSON.parse(ebus[i][1].op[1].json).hash,
                                                            block: parseInt(JSON.parse(ebus[i][1].op[1].json).block)
                                                            }
                                                        }
                                                    }
                                                }
                                                if (recents.block) {
                                                    resolve(recents)
                                                } else {
                                                    console.log('error in processing')
                                                    resolve({hash:null,block:null})
                                                }
                                            }
                                        });
                                    }))
                                }
                            Promise.all(promises).then(values =>{
                                var newest = 0, votes = {}, blocks = {}
                                for(var acc in values){
                                    if(values[acc].block >= newest && !votes[values[acc].hash]){
                                        newest = values[acc].block
                                        votes[values[acc].hash] = 1
                                        blocks[values[acc].hash] = values[acc].block
                                    } else if(values[acc].block >= newest && votes[values[acc].hash]){
                                        votes[values[acc].hash]++
                                    }
                                }
                                var tally = 0, winner = null
                                for(hash in votes){
                                    if(votes[hash] >= tally && blocks[values[acc].hash] == newest){
                                        tally = votes[hash]
                                        var winner = hash
                                    }
                                }
                                if(winner)startWith(winner, true)
                                else startWith(hash, true)
                                        return
                            })
                        }
                    })
                }
            } else {
                startWith(config.engineCrank)
                console.log(`${hash} failed to load, Replaying from genesis.\nYou may want to set the env var STARTHASH\nFind it at any token API such as ${config.mainAPI}`)
            }
        });
    } else {
        startingBlock = config.starting_block
        store.del([], function(e) {
            if (e) { console.log({e}) }
            store.put([], statestart, function(err) {
                if (err) {
                    console.log({err})
                } else {
                    store.get(['stats', 'hashLastIBlock'], function(error, returns) {
                        if (!error) {
                            console.log(`State Check:  ${returns}\nAccount: ${config.username}\nKey: ${config.active.substr(0,3)}...`)
                        }
                    })
                    startApp()
                }
            })
        })
    }
}

function waitup(promises_array, promise_chain_array, resolve_reject) {
    Promise.all(promises_array)
        .then(r => {
            for(var i = 0; i < r.length; i++) {
                if(r[i].sig){plasma.sig ={
                    sig: r[i].sig,
                    block: r[i].block
                }}
            }
            resolve_reject[0](promise_chain_array);
        })
        .catch(e => { resolve_reject[1](e); });
}