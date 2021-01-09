const hive = require('@hiveio/dhive');
const hiveState = require('./processor');
const IPFS = require('ipfs-api'); //ipfs-http-client doesn't work
const args = require('minimist')(process.argv.slice(2));
const express = require('express');
const cors = require('cors');
const config = require('./config');
exports.config = config;
const stringify = require('json-stable-stringify');
const ipfs = new IPFS({
    host: config.ipfshost,
    port: 5001,
    protocol: 'https'
});
exports.ipfs = ipfs;
const hiveClient = require('@hiveio/hive-js');
hiveClient.api.setOptions({ url: config.clientURL });
exports.hiveClient = hiveClient
const rtrades = require('./rtrades');
var Pathwise = require('./pathwise');
var level = require('level');
const statestart = require('./state')
var store = new Pathwise(level('./db', { createIfEmpty: true }));
exports.store = store;
const API = require('./routes/api');
const VERSION = 'v0.9.0a'
exports.VERSION = VERSION
const api = express()
var http = require('http').Server(api);
var escrow = false;
exports.escrow = escrow;
//const wif = hiveClient.auth.toWif(config.username, config.active, 'active')
var startingBlock = config.starting_block
var current
exports.current = current
const streamMode = args.mode || 'irreversible'; //latest is probably good enough
console.log("Streaming using mode", streamMode);
var client = new hive.Client(config.clientURL);
exports.client = client
var processor;
const HR = require('./processing_routes/index')
exports.processor = processor;
var live_dex = {}, //for feedback, unused currently
    pa = []
var recents = []
    //HIVE API CODE
const { ChainTypes, makeBitMaskFilter, ops } = require('@hiveio/hive-js/lib/auth/serializer');
const { getPathNum } = require("./getPathNum");
const { getPathObj } = require("./getPathObj");
const { enforce } = require("./enforce");
const { tally } = require("./tally");
const { report } = require("./report");
const { ipfsSaveState } = require("./ipfsSaveState");
const { waitup } = require("./waitup");
const { dao } = require("./dao");
const { deleteObjs } = require("./deleteObjs");
const { reject } = require('async');
const { add, addCol, deletePointer, release, credit, nodeUpdate, hashThis, penalty, chronAssign, forceCancel } = require('./lil_ops')
const op = ChainTypes.operations
const walletOperationsBitmask = makeBitMaskFilter([
    op.custom_json
])

//Start Program Options   
startWith('QmZiAXu9xcn2vdhr482VnhLWtH7sbLmGts6ewLGD7yxaSY') //for testing and replaying
    //dynStart(config.leader)

// API defs
api.use(API.https_redirect);
api.use(cors())
api.get('/', API.root);
api.get('/stats', API.root);
api.get('/state', API.state); //Do not recommend having a state dump in a production API
api.get('/dex', API.dex);
api.get('/@:un', API.user);
api.get('/report/:un', API.report); // probably not needed
api.get('/markets', API.markets); //for finding node runner and tasks information
api.get('/posts/:author/:permlink', API.PostAuthorPermlink);
api.get('/posts', API.posts); //votable posts
api.get('/feed', API.feed); //all side-chain transaction in current day
api.get('/runners', API.runners); //list of accounts that determine consensus... will also be the multi-sig accounts
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

//Operations to sign    
var NodeOps = [];
exports.NodeOps = NodeOps;

function unshift(op) {
    NodeOps.unshift(op)
}

exports.unshift = unshift

var rtradesToken = '' //for centralized IPFS pinning
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
    processor.on('vote_content', HR.vote_content);
    processor.on('dex_buy', HR.dex_buy);
    processor.on('dex_hive_sell', HR.dex_hive_sell);
    processor.on('dex_hbd_sell', HR.dex_hbd_sell);
    processor.on('dex_clear', HR.dex_clear)
    processor.onOperation('escrow_transfer', HR.escrow_transfer);
    processor.onOperation('escrow_approve', HR.escrow_approve);
    processor.onOperation('escrow_dispute', HR.escrow_dispute);
    processor.onOperation('escrow_release', HR.escrow_release);
    processor.on('node_add', HR.node_add); //node add and update
    processor.on('node_delete', HR.node_delete);
    processor.on('report', function(json, from, active, pc) {
        store.get(['markets', 'node', from], function(e, a) {
            if (!e) {
                var b = a
                if (from == b.self) {
                    b.report = json
                    delete b.report.timestamp
                    var ops = [
                        { type: 'put', path: ['markets', 'node', from], data: b },
                        { type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: `@${from}| Report processed` }
                    ]
                    store.batch(ops, pc)
                } else {
                    if (from === config.username) {
                        var op = { required_auth: json.required_auths, required_posting_auths: json.required_posting_auths, id: json.id, custom_json: json.custom_json }
                        var checker = ['custom_json', op]
                        if (plasma.pending[hashThis(JSON.stringify(checker))]) {
                            delete plasma.pending[hashThis(JSON.stringify(checker))]
                            for (i = 0; i < NodeOps.length; i++) {
                                if (NodeOps[i][1][0] == 'custom_json') { NodeOps.splice(i, 1); break; }
                            }
                        }
                        NodeOps.push([
                            [0, 0], op
                        ]);
                        console.log(json.transaction_id + '|' + json.block_num + `:This node posted a spurious report and in now attempting to register`)
                    } else if (from === config.username) {
                        console.log(json.transaction_id + '|' + json.block_num + `:This node has posted a spurious report\nPlease configure your DOAMAIN and BIDRATE env variables`)
                    } else {
                        console.log(json.transaction_id + '|' + json.block_num + `:@${from} has posted a spurious report`)
                    }
                }
            } else {
                pc[0](pc[2])
                console.log(e)
            }
        })
    });
    processor.on('queueForDaily', HR.q4d)
    processor.on('nomention', HR.nomention)
    processor.onOperation('comment_options', HR.comment_options);

    //since comment options can be changed the HIVE state needs to be asked
    //and consensused about post information... comment options for bennificiaries is not suffiecient alone
    processor.on('cjv', HR.cjv);
    processor.on('sig', HR.sig); //dlux is for putting executable programs into IPFS... this is for additional accounts to sign the code as non-malicious
    processor.on('cert', HR.cert); // json.cert is an open ended hope to interact with executable posts... unexplored
    processor.onOperation('vote', HR.vote) //layer 2 voting
    processor.onOperation('transfer', HR.transfer);
    processor.onOperation('delegate_vesting_shares', HR.delegate_vesting_shares);
    processor.onOperation('comment', HR.comment);
    //do things in cycles based on block time
    processor.onBlock(
        function(num, pc, isStreaming) {
            console.log(num)
            return new Promise((resolve, reject) => {
                current = num
                chronoProcess = true
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
                            console.log(b)
                            switch (b.op) {
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
                                case 'power_down': //needs work and testing
                                    let lbp = getPathNum(['balances', b.by]),
                                        tpowp = getPathNum(['pow', 't']),
                                        powp = getPathNum(['pow', b.by])
                                    promises.push(powerDownOp([lbp, tpowp, powp], b.by, delKey, num, chrops[i].split(':')[1], b))

                                    function powerDownOp(promies, from, delkey, num, id, b) {
                                        return new Promise((resolve, reject) => {
                                            Promise.all(promies)
                                                .then(bals => {
                                                    let lbal = bals[0],
                                                        tpow = bals[1],
                                                        pbal = bals[2],
                                                        ops = []
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
                                case 'post_reward': //needs work and/or testing
                                    promises.push(postRewardOP(b, num, chrops[i].split(':')[1], delKey))

                                    function postRewardOP(b, num, id, delkey) {
                                        return new Promise((resolve, reject) => {
                                            store.get(['posts', `${b.author}/${b.permlink}`], function(e, a) {
                                                let ops = []
                                                console.log(a)
                                                a.title = a.customJSON.p.d
                                                delete a.customJSON.p.d
                                                a.c = a.customJSON.p
                                                delete a.customJSON.p
                                                delete a.customJSON.s
                                                delete a.customJSON.pw
                                                delete a.customJSON.sw
                                                ops.push({
                                                    type: 'put',
                                                    path: ['br', `${b.author}/${b.permlink}`],
                                                    data: {
                                                        op: 'dao_content',
                                                        post: a
                                                    }
                                                })
                                                ops.push({ type: 'del', path: ['chrono', delkey] })
                                                ops.push({ type: 'put', path: ['feed', `${num}:vop_${id}`], data: `@${b.author}| Post:${b.permlink} voting expired.` })
                                                ops.push({ type: 'del', path: ['posts', `${b.author}/${b.permlink}`] })
                                                console.log(ops)
                                                store.batch(ops, [resolve, reject])
                                            })
                                        })
                                    }

                                    break;
                                default:

                            }

                        })
                    }
                    if (num % 100 === 0 && isStreaming) {
                        client.database.getDynamicGlobalProperties()
                            .then(function(result) {
                                console.log('At block', num, 'with', result.head_block_number - num, `left until real-time. DAO @ ${(num - 20000) % 30240}`)
                            });
                    }
                    if (num % 100 === 5 && isStreaming) {
                        //check(num) //not promised, read only
                    }
                    if (num % 100 === 50 && isStreaming) {
                        report(num, plasma)
                    }
                    if ((num - 20000) % 30240 === 0) { //time for daily magic
                        promises.push(dao(num))
                    }
                    if (num % 100 === 0) {
                        promises.push(tally(num, plasma, isStreaming));
                    }
                    if (num % 100 === 1) {
                        store.get([], function(err, obj) {
                            const blockState = Buffer.from(stringify([num, obj]))
                            ipfsSaveState(num, blockState)
                        })
                    }
                    if (promises.length) {
                        waitup(promises, pc, [resolve, reject])
                    } else {
                        resolve(pc)
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
                    if (config.active && isStreaming) {
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
                                var ops = []
                                for (i = 0; i < NodeOps.length; i++) {
                                    if (NodeOps[i][0][1] == 0 && NodeOps[i][0][0] <= 100) {
                                        ops.push(NodeOps[i][1])
                                        NodeOps[i][0][1] = 1
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
                                    hiveClient.broadcast.send({
                                        extensions: [],
                                        operations: ops
                                    }, [config.active], (err, result) => {
                                        if (err) {
                                            console.log(err)
                                            for (q = 0; q < ops.length; q++) {
                                                if (NodeOps[q][0][1] == 1) {
                                                    NodeOps[q][0][1] = 3
                                                }
                                            }
                                        } else {
                                            console.log(result)
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
                })
            })
        });
    processor.onStreamingStart(() => {
        console.log("At real time.");
        store.get(['markets', 'node', config.username], function(e, a) {
            if (!a.domain && config.NODEDOMAIN) {
                var op = ["custom_json", {
                    required_auths: [config.username],
                    required_posting_auths: [],
                    id: `${config.prefix}node_add`,
                    json: JSON.stringify({
                        domain: config.NODEDOMAIN,
                        bidRate: config.bidRate,
                        escrow: true
                    })
                }];
                unshift([
                    [0, 0], op
                ]);
            }
        });
    });
    processor.start();
}

function exit(consensus) {
    console.log(`Restarting with ${consensus}...`);
    processor.stop(function() {
        if (consensus) {
            startWith(consensus)
        } else {
            dynStart(config.leader)
        }
    });
}
exports.exit = exit;

exports.credit = credit;

exports.add = add;

exports.addCol = addCol;

exports.penalty = penalty;

exports.chronAssign = chronAssign;

function sortBuyArray(array, key) { //seek insert instead
    return array.sort(function(a, b) {
        return b[key] - a[key];
    });
}
exports.sortBuyArray = sortBuyArray;

function sortSellArray(array, key) { //seek insert instead
    return array.sort(function(a, b) {
        return a[key] - b[key];
    });
}

function allowedPrice(volume_weighted_price, rate) {
    volume_weighted_price_number = parseFloat(volume_weighted_price)
    rate_number = parseFloat(rate)
    if (rate_number > (volume_weighted_price_number * 0.8) && rate_number < (volume_weighted_price_number * 1.2)) {
        return true
    } else {
        return false
    }
}

exports.forceCancel = this.forceCancel
exports.deleteObjs = deleteObjs;
exports.deletePointer = deletePointer;
exports.nodeUpdate = nodeUpdate;

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
    client = new hive.Client(config.clientURL)
    exit(plasma.hashLastIBlock)
}

//pulls the latest activity of an account to find the last state put in by an account to dynamically start the node. 
//this will include other accounts that are in the node network and the consensus state will be found if this is the wrong chain
function dynStart(account) {
    let accountToQuery = account || config.username
    hiveClient.api.getAccountHistory(accountToQuery, -1, 100, ...walletOperationsBitmask, function(err, result) {
        if (err) {
            console.log(err)
            dynStart(config.leader)
        } else {

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
                                                for (bal in cleanState.balances) {
                                                    supply += cleanState.balances[bal]
                                                }
                                                for (user in cleanState.contracts) {
                                                    for (contract in cleanState.contracts[user]) {
                                                        if (cleanState.contracts[user][contract].amount) supply += cleanState.contracts[user][contract].amount
                                                    }
                                                }
                                                for (user in cleanState.col) {
                                                    supply += cleanState.col[user]
                                                }
                                                supply += cleanState.pow.t
                                                console.log(`supply check:state:${cleanState.stats.tokenSupply} vs check: ${supply}`)
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
                console.log(`${sh} failed to load, Replaying from genesis.\nYou may want to set the env var STARTHASH\nFind it at any token API such as ${config.mainAPI}`)
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