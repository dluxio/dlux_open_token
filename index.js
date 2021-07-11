const config = require('./config');
const VERSION = 'v1.0.0b2'
exports.VERSION = VERSION

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

var NodeOps = [];
exports.GetNodeOps = function() { return NodeOps }
exports.newOps = function(array) { NodeOps = array }
exports.unshiftOp = function(op) { NodeOps.unshift(op) }
exports.pushOp = function(op) { NodeOps.push(op) }
exports.spliceOp = function(i) { NodeOps.splice(i, 1) }

const API = require('./routes/api');
const { getPathNum } = require("./getPathNum");
const HR = require('./processing_routes/index')
const { enforce } = require("./enforce");
exports.exit = exit;
const { tally } = require("./tally");
const { voter } = require("./voter");
const { report } = require("./report");
const { ipfsSaveState } = require("./ipfsSaveState");
const { waitup } = require("./waitup");
const { dao } = require("./dao");
const { release, recast } = require('./lil_ops')
const hiveState = require('./processor');
const { getPathObj } = require('./getPathObj');
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
var live_dex = {}, //for feedback, unused currently
    pa = []
var recents = []
    //HIVE API CODE

//Start Program Options   
//startWith('QmWCeBSjzeBC8Q9dDhF7ZcHxozgkv9d6XdwSMT7pVwytr5') //for testing and replaying
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
api.get('/api/historical_trades', API.historical_trades);
api.get('/api/historical_trades/:ticker_id', API.historical_trades);
api.get('/api/mirrors', API.mirrors);
api.get('/api/coin_detail', API.detail);
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
api.get('/pending', API.pending); // The transaction signer now can sign multiple actions per block and this is nearly always empty, still good for troubleshooting
// Some HIVE APi is wrapped here to support a stateless frontend built on the cheap with dreamweaver
// None of these functions are required for token functionality and should likely be removed from the community version
api.get('/api/:api_type/:api_call', API.hive_api);
api.get('/getwrap', API.getwrap);
api.get('/getauthorpic/:un', API.getpic);
api.get('/getblog/:un', API.getblog);

http.listen(config.port, function() {
    console.log(`${config.TOKEN} token API listening on port ${config.port}`);
});

//non-consensus node memory
var plasma = {
        consensus: '',
        pending: {},
        page: [],
        hashLastIBlock: 0
            //pagencz: []
    },
    jwt;
exports.jwt = jwt;

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
    processor.on('dex_buy', HR.dex_buy);
    processor.on('dex_hive_sell', HR.dex_hive_sell);
    processor.on('dex_hbd_sell', HR.dex_hbd_sell);
    processor.on('dex_clear', HR.dex_clear)
    processor.onOperation('escrow_transfer', HR.escrow_transfer);
    processor.onOperation('escrow_approve', HR.escrow_approve);
    processor.onOperation('escrow_dispute', HR.escrow_dispute);
    processor.onOperation('escrow_release', HR.escrow_release);
    processor.on('gov_down', HR.gov_down);
    processor.on('gov_up', HR.gov_up);
    processor.on('node_add', HR.node_add); //node add and update
    processor.on('node_delete', HR.node_delete);
    processor.on('report', HR.report);
    processor.on('queueForDaily', HR.q4d)
    processor.on('nomention', HR.nomention)
    processor.onOperation('comment_options', HR.comment_options);
    processor.on('cjv', HR.cjv);
    processor.on('sig', HR.sig); //dlux is for putting executable programs into IPFS... this is for additional accounts to sign the code as non-malicious
    processor.on('cert', HR.cert); // json.cert is an open ended hope to interact with executable posts... unexplored
    processor.onOperation('vote', HR.vote) //layer 2 voting
    processor.onOperation('transfer', HR.transfer);
    processor.onOperation('delegate_vesting_shares', HR.delegate_vesting_shares);
    processor.onOperation('comment', HR.comment);
    //do things in cycles based on block time
    processor.onBlock(
        function(num, pc) {
            console.log(num)
            return new Promise((resolve, reject) => {
                //store.batch([{ type: 'put', path: ['stats', 'realtime'], data: num }], )
                store.someChildren(['chrono'], {
                    gte: "" + num,
                    lte: "" + (num + 1)
                }, function(e, a) {
                    if (e) { console.log('chrono err: ' + e) }
                    let chrops = {},
                        promises = []
                    for (var i in a) {
                        chrops[a[i]] = a[i]
                    }
                    let totalPromises = chrops.length


                    for (var i in chrops) {
                        let delKey = chrops[i]
                        store.get(['chrono', chrops[i]], function(e, b) {
                            switch (b.op) {
                                case 'del_pend':
                                    store.batch([{ type: 'del', path: ['chrono', delKey] }, { type: 'del', path: ['pend', `${b.author}/${b.permlink}`]}], [function() {}, function() { console.log('failure') }])
                                    break;
                                case 'ms_send':
                                    promises.push(recast(b.attempts, b.txid, num))
                                    store.batch([{ type: 'del', path: ['chrono', delKey] }], [function() {}, function() { console.log('failure') }])
                                    break;
                                case 'expire':
                                    promises.push(release(b.from, b.txid, num))
                                    store.batch([{ type: 'del', path: ['chrono', delKey] }], [function() {}, function() { console.log('failure') }])
                                    break;
                                case 'check':
                                    promises.push(enforce(b.agent, b.txid, { id: b.id, acc: b.acc }, num))
                                    store.batch([{ type: 'del', path: ['chrono', delKey] }], [function() {}, function() { console.log('failure') }])
                                    break;
                                case 'denyA':
                                    promises.push(enforce(b.agent, b.txid, { id: b.id, acc: b.acc }, num))
                                    store.batch([{ type: 'del', path: ['chrono', delKey] }], [function() {}, function() { console.log('failure') }])
                                    break;
                                case 'denyT':
                                    promises.push(enforce(b.agent, b.txid, { id: b.id, acc: b.acc }, num))
                                    store.batch([{ type: 'del', path: ['chrono', delKey] }], [function() {}, function() { console.log('failure') }])
                                    break;
                                case 'gov_down': //needs work and testing
                                    let plb = getPathNum(['balances', b.by]),
                                        tgovp = getPathNum(['gov', 't']),
                                        govp = getPathNum(['gov', b.by])
                                    promises.push(govDownOp([plb, tgovp, govp], b.by, delKey, num, delKey.split(':')[1], b))

                                    function govDownOp(promies, from, delkey, num, id, b) {
                                        return new Promise((resolve, reject) => {
                                            Promise.all(promies)
                                                .then(bals => {
                                                    let lbal = bals[0],
                                                        tgov = bals[1],
                                                        gbal = bals[2],
                                                        ops = []
                                                    if (gbal - b.amount < 0) {
                                                        b.amount = gbal
                                                    }
                                                    ops.push({ type: 'put', path: ['balances', from], data: lbal + b.amount })
                                                    ops.push({ type: 'put', path: ['gov', from], data: gbal - b.amount })
                                                    ops.push({ type: 'put', path: ['gov', 't'], data: tgov - b.amount })
                                                    ops.push({ type: 'put', path: ['feed', `${num}:vop_${id}`], data: `@${b.by}| ${parseFloat(b.amount/1000).toFixed(3)} ${config.TOKEN} withdrawn from governance.` })
                                                    ops.push({ type: 'del', path: ['chrono', delkey] })
                                                    ops.push({ type: 'del', path: ['govd', b.by, delkey] })
                                                    store.batch(ops, [resolve, reject])
                                                })
                                                .catch(e => { console.log(e) })
                                        })
                                    }
                                    break;
                                case 'power_down': //needs work and testing
                                    let lbp = getPathNum(['balances', b.by]),
                                        tpowp = getPathNum(['pow', 't']),
                                        powp = getPathNum(['pow', b.by])
                                    promises.push(powerDownOp([lbp, tpowp, powp], b.by, delKey, num, delKey.split(':')[1], b))

                                    function powerDownOp(promies, from, delkey, num, id, b) {
                                        return new Promise((resolve, reject) => {
                                            Promise.all(promies)
                                                .then(bals => {
                                                    let lbal = bals[0],
                                                        tpow = bals[1],
                                                        pbal = bals[2],
                                                        ops = []
                                                    if (pbal - b.amount < 0) {
                                                        b.amount = pbal
                                                    }
                                                    ops.push({ type: 'put', path: ['balances', from], data: lbal + b.amount })
                                                    ops.push({ type: 'put', path: ['pow', from], data: pbal - b.amount })
                                                    ops.push({ type: 'put', path: ['pow', 't'], data: tpow - b.amount })
                                                    ops.push({ type: 'put', path: ['feed', `${num}:vop_${id}`], data: `@${b.by}| powered down ${parseFloat(b.amount/1000).toFixed(3)} ${config.TOKEN}` })
                                                    ops.push({ type: 'del', path: ['chrono', delkey] })
                                                    ops.push({ type: 'del', path: ['powd', b.by, delkey] })
                                                    store.batch(ops, [resolve, reject])
                                                })
                                                .catch(e => { console.log(e) })
                                        })
                                    }
                                    break;
                                case 'post_reward':
                                    promises.push(postRewardOP(b, num, delKey.split(':')[1], delKey))

                                    function postRewardOP(l, num, id, delkey) {
                                        return new Promise((resolve, reject) => {
                                            store.get(['posts', `${l.author}/${l.permlink}`], function(e, b) {
                                                let ops = []
                                                let totals = {
                                                    totalWeight: 0,
                                                    linearWeight: 0
                                                }
                                                for (vote in b.votes) {
                                                    totals.totalWeight += b.votes[vote].v
                                                    linearWeight = parseInt(b.votes[vote].v * ((201600 - (b.votes[vote].b - b.block)) / 201600))
                                                    totals.linearWeight += linearWeight
                                                    b.votes[vote].w = linearWeight
                                                }
                                                let half = parseInt(totals.totalWeight / 2)
                                                totals.curationTotal = half
                                                totals.authorTotal = totals.totalWeight - half
                                                b.t = totals
                                                ops.push({
                                                    type: 'put',
                                                    path: ['pendingpayment', `${b.author}/${b.permlink}`],
                                                    data: b
                                                })
                                                ops.push({ type: 'del', path: ['chrono', delkey] })
                                                ops.push({ type: 'put', path: ['feed', `${num}:vop_${id}`], data: `@${b.author}| Post:${b.permlink} voting expired.` })
                                                ops.push({ type: 'del', path: ['posts', `${b.author}/${b.permlink}`] })
                                                store.batch(ops, [resolve, reject])
                                            })
                                        })
                                    }

                                    break;
                                case 'post_vote':
                                    promises.push(postVoteOP(b, delKey))

                                    function postVoteOP(l, delkey) {
                                        return new Promise((resolve, reject) => {
                                            store.get(['posts', `${l.author}/${l.permlink}`], function(e, b) {
                                                let ops = []
                                                let totalWeight = 0
                                                for (vote in b.votes) {
                                                    totalWeight += b.votes[vote].v
                                                }
                                                b.v = totalWeight
                                                if (b.v > 0) {
                                                    ops.push({
                                                        type: 'put',
                                                        path: ['pendingvote', `${l.author}/${l.permlink}`],
                                                        data: b
                                                    })
                                                }
                                                ops.push({ type: 'del', path: ['chrono', delkey] })
                                                store.batch(ops, [resolve, reject])
                                            })
                                        })
                                    }

                                    break;
                                default:

                            }

                        })
                    }
                    if (num % 100 === 0 && processor.isStreaming()) {
                        client.database.getDynamicGlobalProperties()
                            .then(function(result) {
                                console.log('At block', num, 'with', result.head_block_number - num, `left until real-time. DAO @ ${(num - 20000) % 30240}`)
                            });
                    }
                    if (num % 100 === 5 && processor.isStreaming()) {
                        //check(num) //not promised, read only
                    }
                    if (num % 100 === 50 && processor.isStreaming()) {
                        plasma.bh = processor.getBlockHeader()
                        report(plasma)
                            .then(nodeOp => {
                                //console.log(nodeOp)
                                NodeOps.unshift(nodeOp)
                            })
                            .catch(e => { console.log(e) })
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
                                    plasma.hashLastIBlock = pla.hashLastIBlock
                                    plasma.hashBlock = pla.hashBlock
                                })
                                .catch(e => { console.log(e) })

                        })
                    }
                    /*
                //rest is out of consensus
                for (var p = 0; p < pa.length; p++) { //automate some tasks... nearly positive this doesn't work
                    var r = eval(pa[p][1])
                    if (r) {
                        NodeOps.push([
                            [0, 0],
                            [pa[p][2], pa[p][3]]
                        ])
                    }
                }
                */
                    if (config.active && processor.isStreaming()) {
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
                                for (i = 0; i < NodeOps.length; i++) {
                                    if (NodeOps[i][0][1] == 0 && NodeOps[i][0][0] <= 100) {
                                        if (NodeOps[i][1][0] == 'custom_json' && !cjbool){
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
    exports.processor = processor;
}

function exit(consensus) {
    console.log(`Restarting with ${consensus}...`);
    processor.stop(function() {});
        if (consensus) {
            startWith(consensus)
        } else {
            dynStart(config.leader)
        }
}

function waitfor(promises_array) {
    return new Promise((resolve, reject) => {
        Promise.all(promises_array)
            .then(r => {
                for (i = 0; i < r.length; i++) {
                    console.log(r[i])
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
    let accountToQuery = account || config.username
    hiveClient.api.setOptions({ url: config.startURL });
    console.log('Starting URL: ', config.startURL)
    hiveClient.api.getAccountHistory(accountToQuery, -1, 100, ...walletOperationsBitmask, function(err, result) {
        if (err) {
            console.log(err)
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
                console.log(mostRecent)
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
function startWith(hash) {
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
                        if (!e) {
                            if (hash) {
                                var cleanState = data[1]
                                store.put([], cleanState, function(err) {
                                    if (err) {
                                        console.log(err)
                                    } else {
                                        store.get(['stats', 'lastBlock'], function(error, returns) {
                                            if (!error) {
                                                console.log(`State Check:  ${returns}\nAccount: ${config.username}\nKey: ${config.active.substr(0,3)}...`)
                                                var supply = 0
                                                var lbal = 0
                                                for (bal in cleanState.balances) {
                                                    supply += cleanState.balances[bal]
                                                    lbal += cleanState.balances[bal]
                                                }
                                                var gov = 0,
                                                    govt = 0
                                                var con = 0
                                                for (user in cleanState.contracts) {
                                                    for (contract in cleanState.contracts[user]) {
                                                        if (cleanState.contracts[user][contract].amount && !cleanState.contracts[user][contract].buyer && (cleanState.contracts[user][contract].type == 'ss' || cleanState.contracts[user][contract].type == 'ds')) {
                                                            supply += cleanState.contracts[user][contract].amount
                                                            con += cleanState.contracts[user][contract].amount
                                                        }
                                                    }
                                                }
                                                let coll = 0
                                                for (user in cleanState.col) {
                                                    supply += cleanState.col[user]
                                                    coll += cleanState.col[user]
                                                }
                                                try { govt = cleanState.gov.t - coll } catch (e) {}
                                                for (bal in cleanState.gov) {
                                                    if (bal != 't') {
                                                        supply += cleanState.gov[bal]
                                                        gov += cleanState.gov[bal]
                                                    }
                                                }
                                                var pow = 0,
                                                    powt = cleanState.pow.t
                                                for (bal in cleanState.pow) {
                                                    if (bal != 't') {
                                                        supply += cleanState.pow[bal]
                                                        pow += cleanState.pow[bal]
                                                    }
                                                }
                                                console.log(`supply check:state:${cleanState.stats.tokenSupply} vs check: ${supply}: ${cleanState.stats.tokenSupply - supply}`)
                                                if (cleanState.stats.tokenSupply != supply) {
                                                    console.log({ lbal, gov, govt, pow, powt, con })
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
                        } else { console.log(e) }
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
            if (e) { console.log(e) }
            store.put([], statestart, function(err) {
                if (err) {
                    console.log(err)
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
