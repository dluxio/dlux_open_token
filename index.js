const steem = require('dsteem');
const steemState = require('./processor');
const steemTransact = require('steem-transact');
const readline = require('readline');
const safeEval = require('safe-eval');
const IPFS = require('ipfs-api');
var aesjs = require('aes-js');
const ipfs = new IPFS({
    host: 'ipfs.infura.io',
    port: 5001,
    protocol: 'https'
});
const args = require('minimist')(process.argv.slice(2));
const express = require('express')
const cors = require('cors')
const steemClient = require('steem')
const fs = require('fs');
const XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest
const config = require('./config');
const rtrades = require('./rtrades');
var state = require('./state');
//const RSS = require('rss-generator');
// Attempts to get the hash of that state file.

const crypto = require('crypto')
const bs58 = require('bs58')
const hashFunction = Buffer.from('12', 'hex')

function hashThis(data) {
    const digest = crypto.createHash('sha256').update(data).digest()
    const digestSize = Buffer.from(digest.byteLength.toString(16), 'hex')
    const combined = Buffer.concat([hashFunction, digestSize, digest])
    const multihash = bs58.encode(combined)
    return multihash.toString()
}
const testing = true
const VERSION = 'v0.0.3a'
const api = express()
var http = require('http').Server(api);
//const io = require('socket.io')(http)
var escrow = false
var broadcast = 1
const wif = steemClient.auth.toWif(config.username, config.active, 'active')
const resteemAccount = 'dlux-io';
var startingBlock = 32026001;
var current, dsteem, testString

const prefix = 'dluxT_';
const streamMode = args.mode || 'irreversible';
console.log("Streaming using mode", streamMode);
var client = new steem.Client(config.clientURL);
var processor;

var pa = []

const Unixfs = require('ipfs-unixfs')
const {
    DAGNode
} = require('ipld-dag-pb')

function hashThis2(datum) {
    const data = Buffer.from(datum, 'ascii')
    const unixFs = new Unixfs('file', data)
    DAGNode.create(unixFs.marshal(), (err, dagNode) => {
        if (err) {
            return console.error(err)
        }
        console.log(hashThis2(JSON.stringify(dagNode)))
        return hashThis2(JSON.stringify(dagNode)) // Qmf412jQZiuVUtdgnB36FXFX7xg5V6KEbSJ4dpQuhkLyfD
    })
}
// Read line for CLI access
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Cycle through good public IPFS gateways
var cycle = 0

function cycleipfs(num) {
    //ipfs = new IPFS({ host: state.gateways[num], port: 5001, protocol: 'https' });
}

if (config.active && config.NODEDOMAIN) {
    escrow = true
    dsteem = new steem.Client('https://api.steemit.com')
}
var https_redirect = function(req, res, next) {
    if (process.env.NODE_ENV === 'production') {
        if (req.headers['x-forwarded-proto'] != 'https') {
            return res.redirect('https://' + req.headers.host + req.url);
        } else {
            return next();
        }
    } else {
        return next();
    }
};

api.use(https_redirect);
api.use(cors())
api.get('/', (req, res, next) => {
    res.setHeader('Content-Type', 'application/json')
    res.send(JSON.stringify({
        stats: state.stats,
        node: config.username,
        VERSION,
        realtime: current
    }, null, 3))
});
api.get('/@:un', (req, res, next) => {
    let un = req.params.un
    var bal, pb, lp, lb, contracts
    try {
        bal = state.balances[un] || 0
    } catch (e) {
        bal = 0
    }
    try {
        pb = state.pow[un] || 0
    } catch (e) {
        pb = 0
    }
    try {
        lp = state.pow.n[un] || 0
    } catch (e) {
        lp = 0
    }
    try {
      contracts = state.contracts[un]
    } catch (e){
      contracts = {}
    }
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({
        balance: bal,
        poweredUp: pb,
        powerBeared: lp,
        contracts
    }, null, 3))
});
api.get('/stats', (req, res, next) => {
    var totalLiquid = 0,
        totalPower = state.pow.t,
        totalNFT = 0
    for (var bal in state.balances) {
        totalLiquid += state.balances[bal]
    }
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({
        stats: state.stats,
        totalLiquid,
        totalPower,
        totalNFT,
        totalcheck: (totalLiquid + totalPower + totalNFT),
        node: config.username,
        VERSION,
        realtime: current
    }, null, 3))
});
api.get('/state', (req, res, next) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({
        state: state,
        node: config.username,
        VERSION,
        realtime: current
    }, null, 3))
});
api.get('/pending', (req, res, next) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(NodeOps, null, 3))
});
api.get('/runners', (req, res, next) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({
        stats: state.runners,
        node: config.username,
        VERSION,
        realtime: current
    }, null, 3))
});
api.get('/feed', (req, res, next) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({
        feed: state.feed,
        node: config.username,
        VERSION,
        realtime: current
    }, null, 3))
});
api.get('/markets', (req, res, next) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({
        markets: state.markets,
        stats: state.stats,
        node: config.username,
        VERSION,
        realtime: current
    }, null, 3))
});
api.get('/dex', (req, res, next) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({
        markets: state.dex,
        queue: state.queue,
        node: config.username,
        VERSION,
        realtime: current
    }, null, 3))
});
api.get('/priv/list/:un', (req, res, next) => {
    let un = req.params.un
    res.setHeader('Content-Type', 'application/json');
    var lists = Utils.getAllContent(un)
    lists.then(function(list) {
        res.send(JSON.stringify({
            list,
            access_level: Utils.accessLevel(un),
            node: config.username,
            VERSION,
            realtime: current
        }, null, 3))
    });
});
api.get('/report/:un', (req, res, next) => {
    let un = req.params.un
    let report = state.markets.node[un].report || ''
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({
        [un]: report,
        node: config.username,
        hash: state.stats.hashLastIBlock,
        VERSION,
        realtime: current
    }, null, 3))
});
api.get('/private/:un/:pl', (req, res, next) => {
    let un = req.params.un
    let pl = req.params.pl
    res.setHeader('Content-Type', 'application/json');
    Utils.getContent(pl, un).then(value => {
        Utils.sealer(value.body, un).then(enc => {
            value.body = enc
            res.send(JSON.stringify({
                [pl]: value,
                node: config.username,
                VERSION,
                realtime: current
            }, null, 3))
        })
    });
});
//api.listen(port, () => console.log(`DLUX token API listening on port ${port}!\nAvailible commands:\n/@username =>Balance\n/stats\n/markets`))
http.listen(config.port, function() {
    console.log(`DLUX token API listening on port ${config.port}`);
});
var utils = {
    chronoSort: function() {
        state.chrono.sort(function(a, b) {
            return a.block - b.block
        });
    },
    cleaner: function(num, prune) {
        for (var node in state.markets.node) {
            if (state.markets.node[node].report.block < num - prune || 28800) {
                if (state.markets.node[node].report.stash && state.markets.node[node].report.stash.length < 255 && typeof state.markets.node[node].report.stash.length === 'string') {
                    var temp = {
                        stash: state.markets.node[node].report.stash,
                        hash: state.markets.node[node].report.hash
                    }
                    delete state.markets.node[node].report
                    state.markets.node[node].report = temp
                } else {
                    delete state.markets.node[node].report
                }
            }
        }
    },
    agentCycler: function() {
        var x = state.queue.shift();
        state.queue.push(x);
        return x
    },
    cleanExeq: function(id) {
        for (var i = 0; i < state.exeq.length; i++) {
            if (state.exeq[i][1] == id) {
                state.exeq.splice(i, 1)
                i--;
            }
        }
    }
}

var plasma = {},
    jwt
var NodeOps = []
var rtradesToken = ''
const transactor = steemTransact(client, steem, prefix);
var selector = 'dlux-io'
if (config.username == selector) {
    selector = `https://dlux-token-markegiles.herokuapp.com/`
} else {
  selector = `https://token.dlux.io/markets`
}
if (config.rta && config.rtp) {
    rtrades.handleLogin(config.rta, config.rtp)
}
if (config.engineCrank){
  startWith(config.engineCrank)
} else {
fetch(selector)
  .then(function(response) {
    return response.json();
  })
  .then(function(myJson) {
      if(myJson.markets.node[config.username]){
        if (myJson.markets.node[config.username].report.stash){
          ipfs.cat(myJson.markets.node[config.username].report.stash, (err, file) => {
            if (!err){
              var data = JSON.parse(file);
              Private = data;
              console.log(`Starting from ${myJson.markets.node[config.username].report.hash}\nPrivate encrypted data recovered`)
              startWith(myJson.markets.node[config.username].report.hash)
            } else {
              console.log(`Lost Stash... Abandoning and starting from ${myJson.stats.hashLastIBlock}`) //maybe a recovery fall thru?
              startWith(myJson.markets.node[config.username].report.hash);
            }
          });
        } else {
          console.log(`No Private data found\nStarting from ${myJson.markets.node[config.username].report.hash}`)
          startWith(myJson.stats.hashLastIBlock)//myJson.stats.hashLastIBlock);
        }
      } else {
        console.log(`Starting from ${myJson.markets.node['dlux-io'].report}`)
        startWith(myJson.stats.hashLastIBlock);
      }
  }).catch(error => {console.log(error, `\nStarting 'startingHash': ${config.engineCrank}`);startWith(config.engineCrank);});
}
function startWith(sh) {
    if (sh) {
        console.log(`Attempting to start from IPFS save state ${sh}`);
        ipfs.cat(sh, (err, file) => {
            if (!err) {
                var data = JSON.parse(file);
                startingBlock = data[0]
                plasma.hashBlock = data[0]
                plasma.hashLastIBlock = sh
                state = data[1];
                startApp();
            } else {
                startWith(config.engineCrank)
                console.log(`${sh} failed to load, Replaying from genesis.\nYou may want to set the env var STARTHASH\nFind it at any token API such as token.dlux.io`)
            }
        });
    } else {
        startApp()
    }
}


function startApp() {
    processor = steemState(client, steem, startingBlock, 10, prefix, streamMode);

    processor.on('send', function(json, from, active) {
        //check json.memo to contracts for resolution
        if (json.memo && active) {
            for (var i = 0; i < state.listeners.length; i++) {
                if (json.memo == state.listeners[i][0]) {
                    if (state.contracts[state.listeners[i][1]] && state.contracts[state.listeners[i][1]].listener[0] && state.contracts[state.listeners[i][1]].listener[0][2] == json.to && state.contracts[state.listeners[i][1]].listener[0][3] == json.amount) {
                        //set up contract execution
                    }
                }
            }
        }
        if (json.to && typeof json.to == 'string' && typeof json.amount == 'number' && (json.amount | 0) === json.amount && json.amount >= 0 && state.balances[from] && state.balances[from] >= json.amount && active) {

            if (state.balances[json.to] === undefined) {
                state.balances[json.to] = 0;
            }
            if (json.to == config.username && Private.models.length > 0) {
                for (var i = 0; i < Private.models.length; i++) {
                    if (json.amount == Private.models[i][2] && json.tier == Private.models[i][1]) {
                        Utils.assignLevel(from, json.tier, json.block_num + Private.models[i][0])
                        break;
                    }
                }
            }
            state.balances[json.to] += json.amount;
            state.balances[from] -= json.amount;
            state.feed.unshift(json.transaction_id + '|' + json.block_num + `:Send occurred from @${from} to @${json.to} of ${parseFloat(json.amount/1000).toFixed(3)}DLUX`)
        } else {
            state.feed.unshift(json.transaction_id + '|' + json.block_num + `:Invalid send operation from @${from}`)
        }
    });

    /* Custom node software */
    processor.on(config.username, function(json, from, active) { //redesign for private stash
        if (from == config.username) {
            switch (json.exe) {
                case 'schedule':
                    pa.push([
                        json.id,
                        json.blockrule,
                        json.op,
                        json.params
                    ])
                    break;
                case 'cancel':
                    for (var i = 0; i < pa.length; i++) {
                        if (json.id == pa[i][0]) {
                            pa.splice(i, 1)
                            break;
                        }
                    }
                    break;
                default:

            }

        }
    });

    // power up tokens
    processor.on('power_up', function(json, from, active) {
        var amount = parseInt(json.amount)
        if (typeof amount == 'number' && amount >= 0 && state.balances[from] && state.balances[from] >= amount && active) {
            if (state.pow[from] === undefined) {
                state.pow[from] = amount;
                state.pow.t += amount
                state.balances[from] -= amount
            } else {
                state.pow[from] += amount;
                state.pow.t += amount
                state.balances[from] -= amount
            }
            state.feed.unshift(json.transaction_id + '|' + json.block_num + `:Power up occurred by @${from} of ${parseFloat(json.amount/1000).toFixed(3)} DLUX`)
        } else {
            state.feed.unshift(json.transaction_id + '|' + json.block_num + `:Invalid power up operation from @${from}`)
        }
    });

    // power down tokens
    processor.on('power_down', function(json, from, active) {
        var amount = parseInt(json.amount)
        if (typeof amount == 'number' && amount >= 0 && state.pow[from] && state.pow[from] >= amount && active) {
            var odd = parseInt(amount % 13),
                weekly = parseInt(amount / 13)
            for (var i = 0; i < 13; i++) {
                if (i == 12) {
                    weekly += odd
                }
                state.chrono.push({
                    block: parseInt(json.block_num + (200000 * (i + 1))),
                    op: 'power_down',
                    amount: weekly,
                    by: from
                }) //fix current!!!
            }
            utils.chronoSort()
            state.feed.unshift(json.transaction_id + '|' + json.block_num + `:Power down occurred by @${from} of ${parseFloat(amount/1000).toFixed(3)} DLUX`)
        } else {
            state.feed.unshift(json.transaction_id + '|' + json.block_num + `:Invalid power up operation from @${from}`)
        }
    });

    // vote on content
    processor.on('vote_content', function(json, from, active) {
        if (state.pow[from] >= 1) {
            for (var i = 0; i < state.posts.length; i++) {
                if (state.posts[i].author === json.author && state.posts[i].permlink === json.permlink) {
                    if (!state.rolling[from]) {
                        state.rolling[from] = (state.pow.n[from] || 0) + state.pow[from] * 10
                    }
                    if (json.weight > 0 && json.weight < 10001) {
                        state.posts[i].totalWeight += parseInt(json.weight * state.rolling[from] / 100000)
                        state.posts[i].voters.push({
                            from: from,
                            weight: parseInt(10000 * state.rolling[from] / 100000)
                        })
                        state.feed.unshift(json.transaction_id + '|' + json.block_num + `:${from} voted for @${state.posts[i].author}/${state.posts[i].permlink}`)
                        state.rolling[from] -= parseInt(json.weight * state.rolling[from] / 100000)
                    } else {
                        state.posts[i].totalWeight += parseInt(10000 * state.rolling[from] / 100000)
                        state.posts[i].voters.push({
                            from: from,
                            weight: parseInt(10000 * state.rolling[from] / 100000)
                        })
                        state.feed.unshift(json.transaction_id + '|' + json.block_num + `:${from} voted for @${state.posts[i].author}/${state.posts[i].permlink}`)
                        state.rolling[from] -= parseInt(10000 * state.rolling[from] / 100000)
                    }
                } else {
                    state.feed.unshift(json.transaction_id + '|' + json.block_num + `:@${from} tried to vote for an unknown post`)
                }
            }
        } else {
            state.feed.unshift(json.transaction_id + '|' + json.block_num + `:@${from} doesn't have the dlux power to vote`)
        }
    });


    //create nft
    processor.on('create_nft', function(json, from, active) {
        var self = 'DLUX' + hashThis(from + json.block_num),
            error = '',
            actions = [0] //fix current with block num

        var nft = {
            self,
            block: json.block_num, //fix current with blocknum
            creator: from,
            bearers: [from],
            owners: [{
                [from]: 1
            }],
            owns: [],
            bal: 0,
            pow: 0,
            fee: 0,
            deposits: {},
            auths: { //planned, nft
                //'*':[2,3],//'*' anyone,'s' authedArray, 'specific', 'a' agent, 'b' bearer, 'c' creator
                //'a':[0,1,2,3,4,6,7,8,9],//permissions 1 continue, 2 deposit, 3 complex deposit, 4 withdraw, 5 withdraw pow
                //'c':[5],//6 release table 0, 7 release table 1, 8 transfer, 9 change to assets, 10 change of expiration
                //'b':[0,4],//
            }, //0 destroy?
            authed: ['user'],
            pubKey: '', //private key on physical item. sumbitter hashes private key to their steem name, easy to verify at network level
            weight: 1, //for multisig authed change on expires?? A always requires 2 if distributed
            behavior: -1, // -1 fail to depositors, -(2 + n) release to [n]table, 0 custom, 1 auction, 2 simple equity deposit, 3 simple bet(code 0/1), 4 key purchase, 5 ad, 6 quest
            rule: '', //SP bearer inst // equity loan / auction with raffle / fair bet / 6 quest rule: [['keyPub','code',[0,1,2,'preReq'],[dlux, asset > asset n],complete, 'clue'],...]
            memo: '',
            icon: '', //ipfs address
            withdraw: [],
            withdrawPow: {},
            withdrawAsset: [],
            incrementer: 0,
            stack: [],
            votes: [],
            icon: '',
            api: '',
            ipfsItem: '',
            benifactors: [
                [{
                    u: from,
                    d: json.nft.bal || 0
                }],
                []
            ],
            assetBenifactors: [
                [],
                []
            ],
            lastExecutor: [from, json.block_num],
            listener: [], // to set up custom pulls from steem stream, for instance json sm gifts
            matures: json.block_num,
            expires: json.block_num + 100000,
        }
        if (json.nft.pow) {
            if (state.pow[from]) {
                if (state.pow[from] > json.nft.pow) {
                    actions.append(2)
                } else {
                    error += ':Insufficient POW to create NFT:'
                }
            } else {
                error += ':Insufficient POW to create NFT:'
            }
        }
        nft.pow = json.nft.pow || 0
        if (json.nft.bal) {
            if (state.balances[from]) {
                if (state.balances[from] > json.nft.pow) {
                    actions.append(1)
                    nft.deposits = {
                        [from]: json.nft.bal
                    }
                } else {
                    error += ':Insufficient DLUX to create NFT:'
                }
            } else {
                error += ':Insufficient DLUX to create NFT:'
            }
        }
        nft.bal = json.nft.bal || 0
        if (json.nft.pool) {
            if (state.balances[from]) {
                if (state.balances[from] > json.nft.pool + nft.bal) {
                    actions.append(1)
                    if (json.nft.fee > 0 && json.nft.fee < 25) {
                        nft.fee = json.nft.fee
                    } else {
                        if (json.nft.behavior > 1) {
                            nft.fee = 0
                        } else {
                            nft.fee = 1
                        }
                    }
                } else {
                    error += ':Insufficient DLUX to create NFT:'
                }
            } else {
                error += ':Insufficient DLUX to create NFT:'
            }
        }
        nft.fee = json.nft.fee || 0
        if (!nft.fee) {
            error += ':Insuffiecient Fee:'
        }
        if (json.nft.behavior >= 0 && json.nft.behavior < 7) { //cases for contracts
            nft.behavior = json.nft.behavior
        }
        if (nft.behavior == -1) {
            error += 'Contract Behavior not Understood'
        }
        if (json.nft.authed) {
            nft.authed = json.nft.authed
        }
        if (typeof json.nft.weight === 'number' && json.nft.weight <= nft.authed.length && json.nft.weight >= 0) {
            nft.authed = json.nft.authed
        } else {
            nft.weight = 1
        }
        if (nft.behavior == 0) {
            nft.rule = json.nft.rule
        }
        nft.memo = json.nft.memo || ''
        nft.icon = json.nft.icon || ''
        nft.stack = json.nft.stack || []
        //nft.listener = json.nft.listener || []
        if (json.nft.expires > json.block_num) {
            nft.expires = json.nft.expires
        } else {
            error += ':NFT Expires in past:'
        }
        if (json.nft.matures && json.nft.matures < json.nft.expires) {
            nft.matures = json.nft.matures
        }
        if (!error) {
            if (actions.indexOf(1) >= 0) {
                state.balances[from] -= nft.bal + nft.pool
                nft.deposits[from] = nft.bal
            }
            if (actions.indexOf(2) >= 0) {
                state.pow[from] -= nft.pow
                if (state.pow.n[from] === undefined) {
                    state.pow.n[from] = 0
                }
                state.pow.n[from] += nft.pow
            }
            state.contracts[self] = nft
            if (state.nft[from] === undefined) {
                state.nft[from] = [nft.self]
            } else {
                state.nft[from].push(nft.self)
            }
            state.feed.unshift(json.transaction_id + '|' + json.block_num +`:${self} created with ${nft.bal} DLUX and ${nft.pow} DLUX POW\n${self} has a ${nft.behavior} behavior`)
        } else {
            state.feed.unshift(json.transaction_id + '|' + json.block_num +`:@${self}ERROR->${error}`)
        }
    });


    processor.on('transfer_nft', function(json, from, active) { //json.to valid contract or random name json.nftid valid contract beared
        var bearer = '',
            error = '',
            to = '',
            i = 0,
            c = 0
        if (state.contracts[json.nftid]) {
            bearer = state.contracts[json.nftid].bearers[-1]
        }
        if (json.to.charAt(0) == 'D') {
            if (json.to == state.contracts[json.to].self) {
                to = json.to;
                c = 1
            }
        } else {
            to = json.to
        }
        if (!bearer) {
            error += ' Reciepient Contract not found'
        }
        if (bearer != from) {
            error += ' NFT Transfer not authorized.'
        }
        if (!to) {
            error += ' Recipient Contract not Found.'
        }
        if (!error) {
            for (; i < state.nft[from].length; i++) {
                if (state.nft[from][i] == json.nftid) {
                    state.nft[from].splice(i, 1)
                    break;
                }
            }
            if (!c) {
                if (state.nft[to] === undefined) {
                    state.nft[to] = [json.nftid]
                } else {
                    state.nft[to].push(json.nftid)
                }
            } else {
                //run nft as asset thru nft process
            }
            state.contracts[json.nftid].bearers.push(json.to)
            if (state.contracts[json.nftid].pow > 0) {
                state.pow.n[state.contracts[json.nftid].bearers[-2]] -= state.contracts[json.nftid].pow
                if (state.pow.n[json.to] === undefined) {
                    state.pow.n[json.to] = 0
                }
                state.pow.n[json.to] += state.contracts[json.nftid].pow
                state.pow.n[from] -= state.contracts[json.nftid].pow
            }
        } else {
            console.log(error)
        }
    });

    processor.on('custom_cms_' + config.username + '_add', function(json, from, active) { //json.to valid contract or random name json.nftid valid contract beared
        if (from == config.username) {
            Utils.addContent(json.content)
        }
    });

    processor.on('custom_cms_' + config.username + '_set_level', function(json, from, active) { //json.to valid contract or random name json.nftid valid contract beared
        if (from == config.username) {
            Utils.setContentLevel(json.content, json.level)
        }
    });

    processor.on('custom_cms_' + config.username + '_delete', function(json, from, active) { //json.to valid contract or random name json.nftid valid contract beared
        if (from == config.username) {
            Utils.deleteContent(json.content)
        }
    });

    processor.on('custom_cms_' + config.username + '_tier_add', function(json, from, active) { //json.to valid contract or random name json.nftid valid contract beared
        if (from == config.username) {
            Utils.addAccessLevel()
        }
    });

    processor.on('custom_cms_' + config.username + '_tier_delete', function(json, from, active) { //json.to valid contract or random name json.nftid valid contract beared
        if (from == config.username) {
            Utils.removeAccessLevel(json.tier)
        }
    });

    processor.on('custom_cms_' + config.username + '_model_add', function(json, from, active) { //json.to valid contract or random name json.nftid valid contract beared
        if (from == config.username) {
            Utils.addModel(json.num, json.tier, json.dlux)
        }
    });

    processor.on('custom_cms_' + config.username + '_model_delete', function(json, from, active) { //json.to valid contract or random name json.nftid valid contract beared
        if (from == config.username) {
            Utils.deleteModel(json.num, json.tier, json.dlux)
        }
    });

    processor.on('custom_cms_' + config.username + '_add_user', function(json, from, active) { //json.to valid contract or random name json.nftid valid contract beared
        if (from == config.username) {
            Utils.assignLevel(json.name, json.tier, json.expires)
        }
    });

    processor.on('custom_cms_' + config.username + '_ban_user', function(json, from, active) { //json.to valid contract or random name json.nftid valid contract beared
        if (from == config.username) {
            Utils.ban(json.name)
        }
    });

    processor.on('custom_cms_' + config.username + '_unban_user', function(json, from, active) { //json.to valid contract or random name json.nftid valid contract beared
        if (from == config.username) {
            Utils.unban(json.name)
        }
    });

    processor.on('delete_nft', function(json, from, active) {
        var e = 1
        if (json.nftid && typeof json.nftid === 'string' && state.contracts[from]) {
            for (var i = 0; i < state.contracts[from].length; i++) {
                if (state.contracts[from][i][0] == json.nftid) {
                    state.contracts[from].splice(i, 1)
                    console.log(json.transaction_id + '|' + json.block_num + `:${from} deleted an NFT`)
                    e = 0
                    break;
                }
            }
        }
        if (e) {
            state.feed.unshift(json.transaction_id + '|' + json.block_num +`:${from} tried to delete an NFT that wasn't theirs`)
        }
    });

    processor.on('nft_op', function(json, from, active) {
        var i, j, auth = false,
            ex = ''
        for (i = 0; i < state.exeq.length; i++) {
            if (state.exeq[i][1] == json.nftid) {
                if (from == state.exeq[i][0]) {
                    state.exeq.splice(i, 1)
                    auth = true
                }
                ex = json.nftid

                break;
            }
        } //check to see if agent elected
        if (auth && ex) {
            for (j = 0; j < state.exes.length; j++) {
                if (state.exes[j].id == json.nftid) {
                    state.exes[j].op.push([json.proposal, json.completed, json.runtime])
                    auth = 'updated'
                    break;
                }
                if (auth == 'updated' && state.exes[j].op.length == 2) {
                    if (state.exes[j].op[0].proposal == state.exes[j].op[1].proposal) {
                        state.contracts[json.nftid] = json.proposal
                        state.exes.splice(j, 1)
                        utils.cleanExeq(json.nftid)
                        console.log(json.transaction_id + '|' + json.block_num + `:${json.nftid} updated`)
                    }
                } else if (auth == 'updated' && state.exes[j].op.length == 3) {
                    if (state.exes[j].op[0].proposal == state.exes[j].op[2].proposal) {
                        state.contracts[json.nftid] = json.proposal
                        state.exes.splice(j, 1)
                        utils.cleanExeq(json.nftid)
                        console.log(json.transaction_id + '|' + json.block_num + `:${json.nftid} updated`)
                    } else if (state.exes[j].op[1].proposal == state.exes[j].op[2].proposal) {
                        state.contracts[json.nftid] = json.proposal
                        state.exes.splice(j, 1)
                        utils.cleanExeq(json.nftid)
                        console.log(json.transaction_id + '|' + json.block_num + `:${json.nftid} updated`)
                    }
                }
            }
        } else if (ex) {
            if (state.exes[j].op[0].proposal == json.proposal && current > 50 + state.exes[j].b) {
                state.contracts[json.nftid] = json.proposal
                state.exes.splice(j, 1)
                utils.cleanExeq(json.nftid)
                console.log(json.transaction_id + '|' + json.block_num + `:${json.nftid} updated`)
            } else if (state.exes[j].op[1].proposal == json.proposal && current > 50 + state.exes[j].b) {
                state.contracts[json.nftid] = json.proposal
                state.exes.splice(j, 1)
                utils.cleanExeq(json.nftid)
                console.log(json.transaction_id + '|' + json.block_num + `:${json.nftid} updated`)
            } else if (state.exes[j].op[2].proposal == json.proposal && current > 50 + state.exes[j].b) {
                state.contracts[json.nftid] = json.proposal
                state.exes.splice(j, 1)
                utils.cleanExeq(json.nftid)
                console.log(json.transaction_id + '|' + json.block_num + `:${json.nftid} updated`)
            }
        }
    });


    //dex transactions
    processor.on('dex_buy', function(json, from, active) {
        var found = ''
        try {
            if (state.contracts[json.for][json.contract].sbd) {
                for (var i = 0; i < state.dex.sbd.buyOrders.length; i++) {
                    if (state.dex.sbd.buyOrders[i].txid == json.contract) {
                        found = state.dex.sbd.buyOrders[i];
                        break;
                    }
                }
                //delete state.contracts[json.to][json.contract]
            } else {
                for (var i = 0; i < state.dex.steem.buyOrders.length; i++) {
                    if (state.dex.steem.buyOrders[i].txid == json.contract) {
                        found = state.dex.steem.buyOrders[i];
                        break;
                    }
                }
                //delete state.contracts[json.to][json.contract] leave for transaction verification
            }
        } catch (e) {console.log(e)}
        console.log({found})
        if (found && active) {
            if (state.balances[from] >= found.amount) {
                if (state.balances[found.auths[0][1][1].to] > found.amount) {
                    state.balances[found.auths[0][1][1].to] -= found.amount
                    state.contracts[found.from][json.contract].escrow = found.amount
                    state.feed.unshift(json.transaction_id + '|' + json.block_num +`:@${from} sold ${parseFloat(state.contracts[found.from][json.contract].amount).toFixed(3)} DLUX to @${found.from} via DEX`)
                    state.balances[from] -= found.amount
                    state.balances[found.from] += found.amount
                    state.contracts[found.from][json.contract].buyer = from
                    state.escrow.push(state.contracts[found.from][json.contract].auths.shift())
                    console.log(state.escrow)
                    if (found.steem) {
                      state.feed.unshift(json.transaction_id + '|' + json.block_num+`:@${from} purchased ${parseFloat(found.steem/1000).toFixed(3)} STEEM with ${parseFloat(found.amount/1000).toFixed(3)} DLUX via DEX`)
                      var comp = state.dex.steem.tick, dir
                      state.dex.steem.tick = state.contracts[json.for][json.contract].rate
                      if (comp < state.dex.steem.tick){dir='up'}
                      else if (comp == found.rate){dir='-'}
                      else {dir='down'}
                      state.dex.steem.his.unshift({
                        rate:state.contracts[json.for][json.contract].rate,
                        block:json.block_num,
                        amount:state.contracts[json.for][json.contract].amount,
                        dir
                      })
                        state.contracts[found.from][json.contract].auths.push([found.auths[0][1][1].to,
                            [
                                "transfer",
                                {
                                    "from": found.auths[0][1][1].to,
                                    "to": from,
                                    "amount": (found.steem / 1000).toFixed(3) + ' STEEM',
                                    "memo": `${json.contract} by ${found.from} purchased with ${found.amount} DLUX`
                                }
                            ]
                        ])
                    } else if (found.sbd) {
                      state.feed.unshift(json.transaction_id + '|' + json.block_num+`:@${from} purchased ${parseFloat(found.sbd/1000).toFixed(3)} SBD via DEX`)
                      var comp = state.dex.sbd.tick, dir
                      state.dex.sbd.tick = state.contracts[json.for][json.contract].rate
                      if (comp < state.dex.sbd.tick){dir='up'}
                      else if (comp == state.dex.sbd.tick){dir='-'}
                      else {dir='down'}
                      state.dex.sbd.his.unshift({
                        rate:state.dex.sbd.tick,
                        block:json.block_num,
                        amount:state.contracts[json.for][json.contract].amount,
                        dir
                      })
                        state.contracts[found.from][json.contract].auths.push([found.auths[0][1][1].to,
                            [
                                "transfer",
                                {
                                    "from": found.auths[0][1][1].to,
                                    "to": from,
                                    "amount": (found.sbd / 1000).toFixed(3) + ' SBD',
                                    "memo": `${json.contract} by ${found.from} fulfilled with ${found.amount} DLUX`
                                }
                            ]
                        ])
                    }
                    if (found.sbd) {
                        for (var i = 0; i < state.dex.sbd.buyOrders.length; i++) {
                            if (state.dex.sbd.buyOrders[i].txid == json.contract) {
                                state.dex.sbd.buyOrders.splice(i, 1);
                                break;
                            }
                        }
                        //delete state.contracts[json.to][json.contract]
                    } else {
                        for (var i = 0; i < state.dex.steem.buyOrders.length; i++) {
                            if (state.dex.steem.buyOrders[i].txid == json.contract) {
                                state.dex.steem.buyOrders.splice(i, 1);
                                break;
                            }
                        }
                        //delete state.contracts[json.to][json.contract] leave for transaction verification
                    }
                }
            } else {
                state.feed.unshift(json.transaction_id + '|' + json.block_num+`:@${from} has insuficient liquidity to purchase ${found.txid}`)
                //state.escrow.push(found.reject[0])
            }
        }
    });

    processor.on('dex_steem_sell', function(json, from, active) {
        var buyAmount = parseInt(json.steem)
        if (json.dlux <= state.balances[from] && typeof buyAmount == 'number' && active) {
            var txid = 'DLUX' + hashThis(from + current)
            state.dex.steem.sellOrders.push({
                txid,
                from: from,
                steem: buyAmount,
                sbd: 0,
                amount: parseInt(json.dlux),
                rate: parseFloat((buyAmount)/(json.dlux)).toFixed(6),
                block: current,
                partial: json.partial || true
            })
            state.balances[from] -= json.dlux
            if (state.contracts[from]) {
                //arrange transfer to agent instead
                state.contracts[from][txid] = state.dex.steem.sellOrders[state.dex.steem.sellOrders.length - 1]
            } else {
                state.contracts[from] = {
                    [txid]: state.dex.steem.sellOrders[state.dex.steem.sellOrders.length - 1]
                }
            }
            sortSellArray(state.dex.steem.sellOrders, 'rate')
            state.feed.unshift(json.transaction_id + '|' + json.block_num+`:@${from} has placed order ${txid} to sell ${parseFloat(json.dlux/1000).toFixed(3)} for ${parseFloat(json.steem/1000).toFixed(3)} STEEM`)
        } else {
            state.feed.unshift(json.transaction_id + '|' + json.block_num+`:@${from} tried to place an order to sell ${parseFloat(json.dlux/1000).toFixed(3)} for ${parseFloat(json.steem/1000).toFixed(3)} STEEM`)
        }
    });

    processor.on('dex_sbd_sell', function(json, from, active) {
        var buyAmount = parseInt(json.sbd)
        if (json.dlux <= state.balances[from] && typeof buyAmount == 'number' && active) {
            var txid = 'DLUX' + hashThis(from + current)
            state.dex.sbd.sellOrders.push({
                txid,
                from: from,
                steem: 0,
                sbd: buyAmount,
                amount: json.dlux,
                rate: parseFloat((buyAmount)/(json.dlux)).toFixed(6),
                block: current,
                partial: json.partial || true
            })
            state.balances[from] -= json.dlux
            if (state.contracts[from]) {
                state.contracts[from][txid] = state.dex.sbd.sellOrders[state.dex.sbd.sellOrders.length - 1]
            } else {
                state.contracts[from] = {
                    [txid]: state.dex.sbd.sellOrders[state.dex.sbd.sellOrders.length - 1]
                }
            }
            sortSellArray(state.dex.sbd.sellOrders, 'rate')
            state.feed.unshift(json.transaction_id + '|' + json.block_num+`:@${from} has placed order ${txid} to sell ${parseFloat(json.dlux/1000).toFixed(3)} for ${parseFloat(json.sbd/1000).toFixed(3)} SBD`)
        } else {
            state.feed.unshift(json.transaction_id + '|' + json.block_num+`:@${from} tried to place an order to sell ${parseFloat(json.dlux/1000).toFixed(3)} for ${parseFloat(json.sbd/1000).toFixed(3)} SBD`)
        }
    });

    processor.on('dex_clear', function(json, from, active) {
      try{
        if(state.contracts[from][json.txid] && active){
          release(json.txid)
          state.feed.unshift(json.transaction_id + '|' + json.block_num+`:@${from} canceled ${json.txid}`)
        }
      } catch(e){
        console.log(e)
      }
  })
  processor.on('queueForDaily', function(json, from, active) {
    if(from = 'dlux-io' && json.text && json.title){
      state.postQueue.push({text:json.text,title:json.title})
    }
})

processor.on('nomention', function(json, from, active) {
  for(i=0;i<state.delegations.length;i++){
    if(state.delegations[i].delegator == from){
      if(json.mention == false){
        state.nomention[from]=true
      } else if(json.mention==true){
        delete state.nomention[from]
      }
      break;
    }
  }
  if(!state.nomention[from] && !json.mention){
    if(state.markets.node[from]){
      state.nomention[from]=true
    }
  } else if (state.nomention[from] && json.mention){
    if(state.markets.node[from]){
      delete state.nomention[from]
    }
  }
})

    processor.onOperation('escrow_transfer', function(json) { //grab posts to reward
        var op, dextx, contract, isAgent, isDAgent, dextx, meta, done=0
        try {
            dextx = JSON.parse(json.json_meta).dextx
            meta = JSON.parse(json.json_meta).contract
            seller = JSON.parse(json.json_meta).for
            contract = state.contracts[seller][meta]
        } catch (e) {}
        try {isAgent = state.markets.node[json.agent]} catch (e) {}
        try {isDAgent = state.markets.node[json.to]} catch (e) {}
        if (contract && isAgent && isDAgent) { //{txid, from: from, buying: buyAmount, amount: json.dlux, [json.dlux]:buyAmount, rate:parseFloat((json.dlux)/(buyAmount)).toFixed(6), block:current, partial: json.partial || true
          const now = new Date()
          const until = now.setHours(now.getHours() + 1)
          const check = Date.parse(json.ratification_deadline)
            if (contract.steem == parseInt(parseFloat(json.steem_amount)*1000) && contract.sbd == parseInt(parseFloat(json.sbd_amount)*1000) && check > until) {
                if(state.balances[json.to] >= contract.amount){
                  done = 1
                  state.balances[json.to] -= contract.amount
                  state.balances[json.from] += contract.amount
                  var samount
                  if (contract.steem) {
                    samount = `${parseFloat(contract.steem/1000).toFixed(3)} STEEM`
                      for (var i = 0; i < state.dex.steem.sellOrders.length; i++) {
                          if (state.dex.steem.sellOrders[i].txid == contract.txid) {
                              var comp = state.dex.steem.tick, dir
                              state.dex.steem.tick = contract.rate
                              if (comp < contract.rate){dir='up'}
                              else if (comp == contract.rate){dir='flat'}
                              else {dir='down'}
                              state.dex.steem.his.unshift({
                                rate:contract.rate,
                                block:json.block_num,
                                amount:contract.amount,
                                dir
                              })
                              state.dex.steem.sellOrders.splice(i, 1)
                              break;
                          }
                      }
                  } else {
                      samount = `${parseFloat(contract.sbd/1000).toFixed(3)} SBD`
                      for (var i = 0; i < state.dex.sbd.sellOrders.length; i++) {
                          if (state.dex.sbd.sellOrders[i].txid == contract.txid) {
                              var comp = state.dex.sbd.tick,dir
                              state.dex.sbd.tick = contract.rate
                              if (comp < contract.rate){dir='up'}
                              else if (comp == contract.rate){dir='flat'}
                              else {dir='down'}
                              state.dex.sbd.his.unshift({
                                rate:contract.rate,
                                block:json.block_num,
                                amount:contract.amount,
                                dir
                              })
                              state.dex.sbd.sellOrders.splice(i, 1)
                              break;
                          }
                      }
                  }
                  state.feed.unshift(json.transaction_id + '|' + json.block_num+`:@${json.from} is bought ${meta}: ${parseFloat(contract.amount/1000).toFixed(3)} for ${samount}`)
                  state.escrow.push([json.to,[
                      "escrow_approve",
                      {
                          "from": json.from,
                          "to": json.to,
                          "agent": json.agent,
                          "who": json.to,
                          "escrow_id": json.escrow_id,
                          "approve": true
                      }
                  ]
                ])
                state.escrow.push([json.agent,
                    [
                        "escrow_approve",
                        {
                            "from": json.from,
                            "to": json.to,
                            "agent": json.agent,
                            "who": json.agent,
                            "escrow_id": json.escrow_id,
                            "approve": true
                        }
                    ]
                ])
                state.contracts[seller][meta].buyer = json.from
                state.contracts[seller][meta].auths = [
                  [json.to,
                      [
                          "escrow_dispute",
                          {
                              "from": json.from,
                              "to": json.to,
                              "agent": json.agent,
                              "who": json.to,
                              "escrow_id": json.escrow_id
                          }
                      ]
                  ],
                  [json.agent,
                      [
                          "escrow_release",
                          {
                              "from": json.from,
                              "to": json.to,
                              "agent": json.agent,
                              "who": json.agent,
                              "reciever": json.to,
                              "escrow_id": json.escrow_id,
                              "sbd_amount": {
                                "amount": parseInt(parseFloat(json.sbd_amount)*1000).toFixed(0),
                                "precision": 3,
                                "nai": "@@000000013"
                              },
                              "steem_amount": {
                                "amount": parseInt(parseFloat(json.steem_amount)*1000).toFixed(0),
                                "precision": 3,
                                "nai": "@@000000021"
                              }
                          }
                      ]
                  ],[json.to,
                      [
                          "transfer",
                          {
                              "from": json.to,
                              "to": json.from,
                              "amount": samount,
                              "memo": `${meta} by ${seller} fulfilled with ${parseFloat(contract.amount/1000).toFixed(3)} DLUX`
                          }
                      ]
                  ]
                ]
            }
          }
          if(!done){
            state.escrow.push([json.to,[
                "escrow_approve",
                {
                    "from": json.from,
                    "to": json.to,
                    "agent": json.agent,
                    "who": json.to,
                    "escrow_id": json.escrow_id,
                    "approve": false
                }
            ]
          ])
          state.escrow.push([json.agent,
              [
                  "escrow_approve",
                  {
                      "from": json.from,
                      "to": json.to,
                      "agent": json.agent,
                      "who": json.agent,
                      "escrow_id": json.escrow_id,
                      "approve": false
                  }
              ]
          ])
          }
        }  else if (isAgent && isDAgent && dextx) { //two escrow agents to fascilitate open ended transfer with out estblishing steem/sbd bank //expiration times??
        var txid = 'DLUX' + hashThis(`${json.from}${json.block_num}`)
        if(state.balances[json.to] > dextx.dlux && typeof dextx.dlux === 'number' && dextx.dlux > 0){
          state.escrow.push([json.agent,
              [
                  "escrow_approve",
                  {
                      "from": json.from,
                      "to": json.to,
                      "agent": json.agent,
                      "who": json.agent,
                      "escrow_id": json.escrow_id,
                      "approve": true
                  }
              ]
          ])
        state.escrow.push([json.to,
            [
                "escrow_approve",
                {
                    "from": json.from,
                    "to": json.to,
                    "agent": json.agent,
                    "who": json.to,
                    "escrow_id": json.escrow_id,
                    "approve": true
                }
            ]
        ])
          var auths = [
            [json.to,
                [
                    "escrow_dispute",
                    {
                        "from": json.from,
                        "to": json.to,
                        "agent": json.agent,
                        "who": json.to,
                        "escrow_id": json.escrow_id
                    }
                ]
            ],
            [json.agent,
                [
                    "escrow_release",
                    {
                        "from": json.from,
                        "to": json.to,
                        "agent": json.agent,
                        "who": json.agent,
                        "reciever": json.to,
                        "escrow_id": json.escrow_id,
                        "sbd_amount": json.sbd_amount,
                        "steem_amount": json.steem_amount
                    }
                ]
            ]
        ]
        var reject = [json.to,
            [
                "escrow_release",
                {
                    "from": json.from,
                    "to": json.to,
                    "agent": json.agent,
                    "who": json.to,
                    "escrow_id": json.escrow_id,
                    "sbd_amount": json.sbd_amount,
                    "steem_amount": json.steem_amount
                }
            ]
        ]
        if (parseFloat(json.steem_amount) > 0) {
            state.feed.unshift(json.transaction_id + '|' + json.block_num + `:@${json.from} signed a ${parseFloat(json.steem_amount).toFixed(3)} STEEM buy order for ${parseFloat(dextx.dlux).toFixed(3)} DLUX:${txid}`)
            state.dex.steem.buyOrders.push({
                txid,
                from: json.from,
                steem: parseInt(parseFloat(json.steem_amount)*1000),
                sbd: 0,
                amount: dextx.dlux,
                rate: parseFloat(parseInt(parseFloat(json.steem_amount)*1000)/dextx.dlux).toFixed(6),
                block: json.block_num,
                escrow_id: json.escrow_id,
                agent: json.agent,
                fee: json.fee.amount,
                partial: false,
                auths,
                reject
              })
            if (state.contracts[json.from]) {
                state.contracts[json.from][txid] = {
                    txid,
                    from: json.from,
                    steem: parseInt(parseFloat(json.steem_amount)*1000),
                    sbd: 0,
                    amount: dextx.dlux,
                    rate: parseFloat(parseInt(parseFloat(json.steem_amount)*1000)/dextx.dlux).toFixed(6),
                    block: json.block_num,
                    escrow_id: json.escrow_id,
                    agent: json.agent,
                    fee: json.fee.amount,
                    partial: false,
                    auths,
                    reject
                }
            } else {
                state.contracts[json.from] = {
                  [txid]:{
                    txid,
                    from: json.from,
                    steem: parseInt(parseFloat(json.steem_amount)*1000),
                    sbd: 0,
                    amount: dextx.dlux,
                    rate: parseFloat(parseInt(parseFloat(json.steem_amount)*1000)/dextx.dlux).toFixed(6),
                    block: json.block_num,
                    escrow_id: json.escrow_id,
                    agent: json.agent,
                    fee: json.fee.amount,
                    partial: false,
                    auths,
                    reject
                }
              }
            }
        } else if (parseFloat(json.sbd_amount) > 0) {
            state.feed.unshift(json.transaction_id + '|' + json.block_num + `:@${json.from} signed a ${parseFloat(json.sbd_amount).toFixed(3)} STEEM buy order for ${parseFloat(dextx.dlux).toFixed(3)} DLUX:${txid}`)
            state.dex.sbd.buyOrders.push({
                txid,
                from: json.from,
                steem: 0,
                sbd: parseInt(parseFloat(json.sbd_amount)*1000),
                amount: dextx.dlux,
                rate: parseFloat(parseInt(parseFloat(json.sbd_amount)*1000)/dextx.dlux).toFixed(6),
                block: json.block_num,
                escrow_id: json.escrow_id,
                agent: json.agent,
                fee: json.fee.amount,
                partial: false,
                auths,
                reject
            })
            if (state.contracts[json.from]) {
                state.contracts[json.from][txid] = {
                    txid,
                    from: json.from,
                    steem: 0,
                    sbd: parseInt(parseFloat(json.sbd_amount)*1000),
                    amount: dextx.dlux,
                    rate: parseFloat(parseInt(parseFloat(json.sbd_amount)*1000)/dextx.dlux).toFixed(6),
                    block: json.block_num,
                    escrow_id: json.escrow_id,
                    agent: json.agent,
                    fee: json.fee.amount,
                    partial: false,
                    auths,
                    reject
                }
            } else {
                state.contracts[json.from] = {
                    [txid]: {
                        txid,
                        from: json.from,
                        steem: 0,
                        sbd: parseInt(parseFloat(json.sbd_amount)*1000),
                        amount: dextx.dlux,
                        rate: parseFloat(parseInt(parseFloat(json.sbd_amount)*1000)/dextx.dlux).toFixed(6),
                        block: json.block_num,
                        escrow_id: json.escrow_id,
                        agent: json.agent,
                        fee: json.fee.amount,
                        partial: false,
                        auths,
                        reject
                    }
                }
            }
          }
        } else {
          state.feed.unshift(json.transaction_id + '|' + json.block_num + `:@${json.from} improperly attempted to use the escrow network. Attempting escrow deny.`)
                state.escrow.push([json.agent,
                    [
                        "escrow_approve",
                        {
                            "from": json.from,
                            "to": json.to,
                            "agent": json.agent,
                            "who": json.agent,
                            "escrow_id": json.escrow_id,
                            "approve": false //reject non coded
                        }
                    ]
                ])
        }
    } else if (isAgent) {
      state.feed.unshift(json.transaction_id + '|' + json.block_num + `:@${json.from} improperly attempted to use the escrow network. Attempting escrow deny.`)
            state.escrow.push([json.agent,
                [
                    "escrow_approve",
                    {
                        "from": json.from,
                        "to": json.to,
                        "agent": json.agent,
                        "who": json.agent,
                        "escrow_id": json.escrow_id,
                        "approve": false //reject non coded
                    }
                ]
            ])
        }
    });

    processor.onOperation('escrow_approve', function(json) {
        var found = 0
        for (var i = 0; i < state.escrow.length; i++) {
            if (state.escrow[i][0] == json.who && state.escrow[i][1][1].escrow_id == json.escrow_id && state.escrow[i][1][1].approve == json.approve) {
              state.feed.unshift(json.transaction_id + '|' + json.block_num +`:@${json.who} approved escrow for ${json.from}`)
                state.escrow.splice(i, 1)
                found = 1
                if(found){
                  for(var i in state.contracts[json.from]){
                    if(state.contracts[json.from][i].escrow_id == json.escrow_id){found = i;break;}
                  }
                }
                if(found && found != 1){
                  if(state.contracts[json.from][found].buyer){
                    state.escrow.push(state.contracts[json.from][found].shift())
                  }
                }
                state.feed.unshift(json.transaction_id + '|' + json.block_num + `:@${json.who} approved escrow.`)
                state.markets.node[json.who].wins++

                break;
            }
        }
    });
    processor.onOperation('escrow_dispute', function(json) {
        var found = -1
        for (var i = 0; i < state.escrow.length; i++) {
            if (state.escrow[i][0] == json.who && state.escrow[i][1][1].escrow_id == json.escrow_id) {
                state.escrow.splice(i, 1)
                state.markets.node[json.who].wins++
                for(var i in state.contracts[json.from]){
                  if(state.contracts[json.from][i].escrow_id == json.escrow_id && state.contracts[json.from][i].buyer){
                    state.escrow.push(state.contracts[json.from][i].auths.shift())
                    state.feed.unshift(json.transaction_id + '|' + json.block_num + `:@${json.who} authorized ${json.agent} for ${i}`)
                    break;
                  }
                }
                break;
            }
        }
    });

    processor.onOperation('escrow_release', function(json) {
        var found = 0, owner = ''
        for (var i = 0; i < state.escrow.length; i++) {
            if (state.escrow[i][0] == json.who && state.escrow[i][1][1].escrow_id == json.escrow_id) {
                for(var txid in state.contracts[json.to]){
                  if(state.contracts[json.to][txid].escrow_id = json.escrow_id){
                    owner = json.to
                    found = txid
                    break;
                  }
                }
                if (!owner){
                  for(var txid in state.contracts[json.from]){
                    if(state.contracts[json.from][txid].escrow_id = json.escrow_id){
                      owner = json.from
                      found = txid
                      break;
                    }
                  }
                }
                state.feed.unshift(json.transaction_id + '|' + json.block_num + `:@${json.who} released funds for @${owner}/${found}`)
                state.escrow.splice(i, 1)
                state.escrow.push(state.contracts[owner][found].auths.shift())
                state.markets.node[json.who].wins++
                found = 1
                break;
        }
      }
    });

    processor.on('node_add', function(json, from, active) {
        if (json.domain && typeof json.domain === 'string') {
            var z = false
            if (json.escrow == true) {
                z = true
            }
            var int = parseInt(json.bidRate) || 0
            if (int < 1) {
                int = 1000
            }
            if (int > 1000) {
                int = 1000
            }
            var t = parseInt(json.marketingRate) || 0
            if (t < 1) {
                int = 2000
            }
            if (t > 2000) {
                int = 2000
            }
            if (state.markets.node[from]) {
                state.markets.node[from].domain = json.domain
                state.markets.node[from].bidRate = int
                state.markets.node[from].escrow = z
                state.markets.node[from].marketingRate = t
            } else {
                state.markets.node[from] = {
                    domain: json.domain,
                    self: from,
                    bidRate: int,
                    marketingRate: t,
                    attempts: 0,
                    yays: 0,
                    wins: 0,
                    contracts: 0,
                    escrows: 0,
                    lastGood: 0,
                    report: {},
                    escrow: z
                }
            }
            state.feed.unshift(json.transaction_id + '|' + json.block_num + `:@${from} has bid the steem-state node ${json.domain} at ${json.bidRate}`)
        } else {
            state.feed.unshift(json.transaction_id + '|' + json.block_num + `:@${from} sent and invalid steem-state node operation`)
        }
    });

    processor.on('node_delete', function(json, from, active) {
      if(active){
        state.markets.node[from].escrow = false
        var found = NaN
        for (var i = 0; i < state.queue.length; i++) {
            if (state.queue[i] == from) {
                found = i
                break;
            }
        }
        if (found >= 0) {
            state.queue.splice(found, 1)
        }
        try {delete state.markets.node[from].domain} catch(e){console.log(`deleting ${from}'s node and got: `+ e)}
        try {delete state.markets.node[from].bidRate} catch(e){console.log(`deleting ${from}'s node and got: `+ e)}
        try {delete state.markets.node[from].marketingRate} catch(e){console.log(`deleting ${from}'s node and got: `+ e)}
        try {state.markets.node[from].escrow = false} catch(e){console.log(`deleting ${from}'s node and got: `+ e)}
        try {delete state.runners[from]} catch(e){console.log(`deleting ${from}'s node and got: `+ e)}
        state.feed.unshift(json.transaction_id + '|' + json.block_num + `:@${from} has signed off their dlux node`)
      }
    });

    processor.on('set_delegation_reward', function(json, from) {
        if (from == 'dlux-io' && typeof json.rate === 'number' && json.rate < 2001 && json.rate >= 0) {
            state.stats.delegationRate = json.rate
            state.feed.unshift(json.transaction_id + '|' + json.block_num + `:@dlux-io has updated their delegation reward rate to ${parseFloat(json.rate/10000).tofixed(4)}`)
        }
    });

    /* - Not happy with these
      processor.on('set_resteem_reward', function(json, from) {
        if (from == 'dlux-io' && typeof json.reward === 'number' && json.reward < 10001 && json.reward >= 0) {
          state.stats.resteemRewad = json.reward
        }
        console.log(json.transaction_id + '|' + json.block_num + `:@dlux-io has updated their delegation reward rate`)
      });

      processor.on('expire_post', function(json, from) {
        if (from == 'dlux-io' && typeof json.permlink === 'string') {
          state.expired.push(json.permlink)
        }
        console.log(json.transaction_id + '|' + json.block_num + `:@dlux-io has expired rewards on ${json.permlink}`)
      });
    */
    processor.on('report', function(json, from, active) {
        var cfrom, domain, found = NaN
        try {
            cfrom = state.markets.node[from].self
            domain = state.markets.node[from].domain
        } catch (err) {
            console.log(err)
        }
        if (from === cfrom && domain) {
            state.markets.node[from].report = json
            for (var i = 0; i < state.queue.length; i++) {
                if (state.queue[i] == from) {
                    found = i
                    break;
                }
            }
            if (found >= 0) {
                state.queue.unshift(state.queue.splice(found, 1)[0])
            } else {
                state.queue.push(from)
            }
            state.feed.unshift(json.transaction_id + '|' + json.block_num + `:@${from} - report has been processed`)
        } else {
            if (from === config.username && config.NODEDOMAIN) {
                console.log(json.transaction_id + '|' + json.block_num + `:This node posted a spurious report and in now attempting to register`)
                transactor.json(config.username, config.active, 'node_add', {
                    domain: config.NODEDOMAIN,
                    bidRate: config.bidRate,
                    escrow
                }, function(err, result) {
                    if (err) {
                        console.error(err);
                    }
                })
            } else if (from === config.username) {
                console.log(json.transaction_id + '|' + json.block_num + `:This node has posted a spurious report\nPlease configure your DOAMAIN and BIDRATE env variables`)
            } else {
                console.log(json.transaction_id + '|' + json.block_num + `:@${from} has posted a spurious report`)
            }
        }
    });
    /*
      processor.onNoPrefix('follow', function(json, from) {  // Follow id includes both follow and resteem.
        if(json[0] === 'reblog') {
          if(json[1].author === resteemAccount && state.balances[from] !== undefined && state.balances[from] > 0) {
            var valid = 1
            for (var i = 0; i < state.expired.length;i++){
              if(json.permlink == state.expired[i]){valid=0;break;}
            }
            if(valid && state.balances.rm > state.stats.resteemReward){
              state.balances[from] += state.stats.resteemReward;
              state.balances.rm -= state.stats.resteemReward;
              console.log(current + `:Resteem reward of ${state.stats.resteemReward} given to ${from}`);
            }
          }
        }
      });
    */

    processor.onOperation('comment_options', function(json, from) { //grab posts to reward
        try {
            var filter = json.extensions[0][1].beneficiaries
        } catch (e) {
            return;
        }
        for (var i = 0; i < filter.length; i++) {
            if (filter[i].account == 'dlux-io' && filter[i].weight > 999) {
                state.posts.push({
                    block: json.block_num,
                    author: json.author,
                    permlink: json.permlink,
                    title: json.title,
                    totalWeight: 1,
                    voters:[]
                })
                state.chrono.push({
                    block: parseInt(json.block_num + 300000),
                    op: 'post_reward',
                    author: json.author,
                    permlink: json.permlink
                })
                utils.chronoSort()
                if(config.username=='dlux-io'){
                client.database.call('get_content', [json.author, json.permlink]).then(result => {
                    var bytes = rtrades.checkNpin(JSON.parse(result.json_metadata).assets)
                    bytes.then(function(values) {

                    })
                });
                }
                state.feed.unshift(json.transaction_id + '|' + json.block_num + `:@${json.author}/${json.permlink} added to dlux rewardable content`)
            }
        }
    });
    processor.onOperation('vote', function(json) {
      if(json.voter == 'dlux-io'){
        for(var i = 0;i<state.escrow.length;i++){
          if(json.permlink == state.escrow[i][1][1].permlink && json.author == state.escrow[i][1][1].author){
            state.escrow.splice(i,1)
          }
        }
      }
    })

    processor.onOperation('transfer', function(json) { //ICO calculate
        /* for sending to NFTs - not gonna happen this way
        var contract = ''
        if(json.memo.substr(0,6) == 'DLUXQm') {
          var txid = json.memo.split(' ')[0]
          if(state.contracts[json.to][txid]){
            for (var i = 0;i < state.escrow.length;i++){
              if (state.escrow[i][0] == json.from && state.escrow[i][1][1].from == json.from && state.escrow[i][1][1].to == json.to){
                 if (state.contracts[json.to][txid].steem){
                   if (parseInt(parseFloat(json.amount)*1000) == state.contracts[json.to][txid].steem){
                     state.balances[json.from] += state.contracts[json.to][txid].escrow
                     delete state.contracts[json.to][txid]
                     state.escrow.splice(i,1)
                   }
                 } else if (state.contracts[json.to][txid].sbd) {
                   if (parseInt(parseFloat(json.amount)*1000) == state.contracts[json.to][txid].sbd){
                     state.balances[json.from] += state.contracts[json.to][txid].escrow
                     delete state.contracts[json.to][txid]
                     state.escrow.splice(i,1)
                   }
                 }
              }
            }
          }
        }
        */
        var found = 0
        for (var i = 0; i < state.escrow.length; i++) {
            if (state.escrow[i][0] == json.from && state.escrow[i][1][1].to == json.to && state.escrow[i][1][1].steem_amount == json.steem_amount && state.escrow[i][1][1].sbd_amount == json.sbd_amount) {
                state.feed.unshift(json.transaction_id + '|' + json.block_num+`:@${json.from} sent @${json.to} ${json.steem_amount}/${json.sbd_amount} for ${json.memo.split(' ')[0]}`)
                var escrow = state.escrow.splice(i, 1)
                found = 1
                const addr = escrow[0][1][1].memo.split(' ')[0]
                const seller = escrow[0][1][1].memo.split(' ')[2]
                state.balances[seller] = parseInt(state.contracts[seller][addr].escrow) + parseInt(state.balances[seller])
                state.contracts[seller][addr] = ''
                delete state.contracts[seller][addr]
                state.markets.node[json.from].wins++
                /*
                state.pending.push([json.to,
                    [
                        "escrow_approve",
                        {
                            "from": json.from,
                            "to": json.to,
                            "agent": json.agent,
                            "who": json.to,
                            "escrow_id": json.escrow_id,
                            "approve": true
                        }
                    ],
                json.block_num])
                */
                break;
            }
        }
        if (json.to == 'robotolux' && json.amount.split(' ')[1] == 'STEEM') {
            if (!state.balances[json.from]) state.balances[json.from] = 0
            const amount = parseInt(parseFloat(json.amount) * 1000)
            var purchase
            if (!state.stats.outOnBlock) {
                purchase = parseInt(amount / state.stats.icoPrice * 1000)
                if (purchase < state.balances.ri) {
                    state.balances.ri -= purchase
                    state.balances[json.from] += purchase
                    state.feed.unshift(json.transaction_id + '|' + json.block_num + `:@${json.from} bought ${parseFloat(purchase/1000).toFixed(3)} DLUX with ${parseFloat(amount/1000).toFixed(3)} STEEM`)
                } else {
                    state.balances[json.from] = state.balances.ri
                    const left = purchase - state.balances.ri
                    state.ico.push({
                        [json.from]: (parseInt(amount * left / purchase))
                    })
                    state.stats.outOnBlock = current
                    state.feed.unshift(json.transaction_id + '|' + json.block_num + `:@${json.from} bought ALL ${parseFloat(parseInt(purchase - left)).toFixed(3)} DLUX with ${parseFloat(parseInt(amount)/1000).toFixed(3)} STEEM. And bid in the over-auction`)
                }
            } else {
                state.ico.push({
                    [json.from]: (amount)
                })
                state.feed.unshift(json.transaction_id + '|' + json.block_num + `:@${json.from} bid in DLUX auction with ${parseFloat(amount/1000).toFixed(3)}`)
            }
        }
    });

    processor.onOperation('delegate_vesting_shares', function(json, from) { //grab posts to reward
        const vests = parseInt(parseFloat(json.vesting_shares) * 1000000)
        if (json.delegatee == 'dlux-io' && vests) {
            for (var i = 0; i < state.delegations.length; i++) {
                if (state.delegations[i].delegator == json.delegator) {
                    state.delegations.splice(i, 1)
                    break;
                }
            }
            state.delegations.push({
                delegator: json.delegator,
                vests
            })
            state.feed.unshift(json.transaction_id + '|' + json.block_num + `:@${json.delegator} has delegated ${vests} vests to @dlux-io`)
        } else if (json.delegatee == 'dlux-io' && !vests) {
            for (var i = 0; i < state.delegations.length; i++) {
                if (state.delegations[i].delegator == json.delegator) {
                    state.delegations.splice(i, 1)
                    break;
                }
            }
            state.feed.unshift(json.transaction_id + '|' + json.block_num + `:@${json.delegator} has removed delegation to @dlux-io`)
        }
    });

    processor.onOperation('account_update', function(json, from) { //grab posts to reward
        Utils.upKey(json.account, json.memo_key)
    });
    processor.onOperation('comment', function(json, from) { //grab posts to reward
        if(json.author == 'dlux-io'){
          for (var i =0;i<state.escrow.length;i++){
            if(state.escrow[i][0] == 'dlux-io'){
              if (state.escrow[i][1][1].permlink == json.permlink && state.escrow[i][1][0] == 'comment'){
                state.escrow.splice(i,1)
              }
            }
          }
        }
    });

    processor.onBlock(function(num, block) {
        current = num

        //* // virtual ops
        chronoProcess = true
        while (chronoProcess) {
            if (state.chrono[0] && state.chrono[0].block == num) {
                switch (state.chrono[0].op) {
                    case 'power_down':
                        state.balances[state.chrono[0].by] += state.chrono[0].amount
                        state.pow[state.chrono[0].by] -= state.chrono[0].amount
                        state.pow.t -= state.chrono[0].amount
                        console.log(current + `:${state.chrono[0].by} powered down ${state.chrono[0].amount} DLUX`)
                        state.chrono.shift();
                        break;
                    case 'post_reward':
                        var post = state.posts.shift(),
                            w = 0
                        for (var node in post.voters) {
                            w += post.voters[node].weight
                        }
                        state.br.push({
                            op: 'dao_content',
                            post,
                            totalWeight: w
                        })
                        console.log(current + `:${post.author}/${post.permlink} voting expired and queued for payout`)
                        state.chrono.shift();
                        break;
                    default:

                }
            } else {
                chronoProcess = false
            }
        }
        //*
        if (num % 100 === 0 && !processor.isStreaming()) {
            client.database.getDynamicGlobalProperties().then(function(result) {
                console.log('At block', num, 'with', result.head_block_number - num, `left until real-time. DAO @ ${(num - 20000) % 30240}`)
            });
        }
        if (num % 100 === 5 && processor.isStreaming()) {
            check(num);
        }
        if (num % 100 === 50 && processor.isStreaming()) {
            report(num);
            broadcast = 2
        }
        if ((num - 20000) % 30240 === 0 && num > 27417440) { //time for daily magic
            dao(num);
            clean(num);
        }
        if (num % 100 === 0 && processor.isStreaming()) {
            client.database.getAccounts([config.username]).then(function(result) {
                var account = result[0]

            });
        }
        if (num % 100 === 0) {
            tally(num);
        }
        if (num % 100 === 1) {
          const blockState = Buffer.from(JSON.stringify([num, state]))
          ipfsSaveState(num, blockState)
        }
        for (var p = 0; p < pa.length; p++) { //automate some tasks
            var r = eval(pa[p][1])
            if (r) {
                NodeOps.push([
                    [0, 0], pa[p][2],
                    [pa[p][2], pa[p][3]]
                ])
            }
        }
        //*
        if (config.active && processor.isStreaming()) {
            var found = -1
            if (broadcast) {
                broadcast--
            }
            while (!broadcast) {
                if(processor.getCurrentBlockNumber()%20==0){for (var i = 0; i < state.escrow.length; i++) {
                    if (state.escrow[i][0] == config.username) {
                        for (var j = 0; j < NodeOps.length; j++) {
                            if (NodeOps[j][2] == state.escrow[i][1][1]) {
                                found = j
                            }
                        }
                        if (found == -1) {
                            NodeOps.push([
                                [0, 0], state.escrow[i][1][0], state.escrow[i][1][1]
                            ]);
                        }
                        break;
                    }
                }}
                for (var i = 0; i < state.exeq.length; i++) {
                    if (state.exeq[i][0] == config.username) {
                        var chunk = null,
                            op = null;
                        for (var j = 0; j < state.exes.length; j++) {
                            if (state.exes[j].id = state.exeq[i][1]) {
                                chunk = state.exes[j]
                                break;
                            }
                        }
                        if (chunk) {
                            op = runCustomNFT(chunk.n, chunk.e, chunk.b, chunk.d, chunk.a, chunk.c, chunk, k)
                            NodeOps.push([
                                [0, 0], `nft_op`, chunk.id, op[0], op[2], op[1]
                            ])
                        }
                        break;
                    }
                }
                var task = -1
                if (NodeOps.length > 0) {
                    for (var i = 0; i < NodeOps.length; i++) {
                        if (NodeOps[i][0][0] == 0 && task == -1) {
                            task = i
                            NodeOps[i][0][0] = 75
                        } else if (NodeOps[i][0][0] != 0) {
                            NodeOps[i][0][0]--
                        }
                    }
                }
                if (task >= 0) {
                    switch (NodeOps[task][1]) {
                        case 'comment':
                          steemClient.broadcast.comment(
                              config.active,
                              NodeOps[task][2].parent_author,
                              NodeOps[task][2].parent_permlink,
                              NodeOps[task][2].author,
                              NodeOps[task][2].permlink,
                              NodeOps[task][2].title,
                              NodeOps[task][2].body,
                              NodeOps[task][2].json_metadata,
                              function(err, result) {
                                  if (err) {
                                      console.error(err)
                                      noi(task)
                                      broadcast = 1
                                  } else {
                                      console.log(`#Broadcast comment ${result} for ${NodeOps[task][2][1]}`)
                                      NodeOps.splice(task, 1)
                                  }
                              })
                          break;
                        case 'escrow_transfer':
                            steemClient.broadcast.escrowTransfer(
                                config.active,
                                NodeOps[task][2][1].from,
                                NodeOps[task][2][1].to,
                                NodeOps[task][2][1].agent,
                                NodeOps[task][2][1].escrow_id,
                                NodeOps[task][2][1].sbd_amount,
                                NodeOps[task][2][1].steem_amount,
                                NodeOps[task][2][1].fee,
                                NodeOps[task][2][1].ratification_deadline,
                                NodeOps[task][2][1].escrow_expiration,
                                NodeOps[task][2][1].json_meta,
                                function(err, result) {
                                    if (err) {
                                        console.error(err)
                                        noi(task)
                                        broadcast = 1
                                    } else {
                                        console.log(`#Broadcast ${result} for ${NodeOps[task][2][1].json_meta.contract} @ block ${result.block_num}`)
                                        NodeOps.splice(task, 1)
                                    }
                                })
                            break;
                          case 'escrow_release':
                                steemClient.broadcast.escrowRelease(
                                    config.active,
                                    NodeOps[task][2].from,
                                    NodeOps[task][2].to,
                                    NodeOps[task][2].agent,
                                    NodeOps[task][2].who,
                                    NodeOps[task][2].from,
                                    NodeOps[task][2].escrow_id,
                                    NodeOps[task][2].sbd_amount,
                                    NodeOps[task][2].steem_amount,
                                    function(err, result) {
                                        if (err) {
                                            console.error('#broadcast err:'+err)
                                            noi(task)
                                            broadcast = 1
                                        } else {
                                            console.log(`#Broadcast ${result} for ${NodeOps[task][2][1].json_meta.contract} @ block ${result.block_num}`)
                                            NodeOps.splice(task, 1)
                                        }
                                    })
                                break;
                        case 'escrow_approve':
                            console.log('trying to sign', NodeOps[task][2])
                            steemClient.broadcast.escrowApprove(
                                config.active,
                                NodeOps[task][2].from,
                                NodeOps[task][2].to,
                                NodeOps[task][2].agent,
                                NodeOps[task][2].who,
                                NodeOps[task][2].escrow_id,
                                NodeOps[task][2].approve,
                                function(err, result) {
                                    if (err) {
                                        console.error(err)
                                        broadcast = 1
                                        noi(task)
                                    } else {
                                        console.log(`#Broadcast ${result} for ${NodeOps[task][2]} @ block ${result.block_num}`)
                                        NodeOps.splice(task, 1)
                                    }
                                })
                            break;
                          case 'escrow_dispute':
                                console.log('trying to sign', NodeOps[task][2])
                                steemClient.broadcast.escrowDispute(
                                  config.active,
                                  NodeOps[task][2].from,
                                  NodeOps[task][2].to,
                                  NodeOps[task][2].agent,
                                  NodeOps[task][2].who,
                                  NodeOps[task][2].escrow_id,
                                  function(err, result) {
                                    if (err) {
                                        console.error(err);
                                        noi(task)
                                    } else {
                                        NodeOps.splice(task, 1)
                                    }
                                  }
                                  );
                                break;
                        case 'send':
                            transactor.json(config.username, config.active, 'send', {
                                to: NodeOps[task][2].to,
                                amount: NodeOps[task][2].amount,
                                memo: NodeOps[task][2].memo,
                                tier: NodeOps[task][2].tier
                            }, function(err, result) {
                                if (err) {
                                    console.error(err);
                                    noi(task)
                                } else {
                                    NodeOps.splice(task, 1)
                                }
                            })
                            break;
                        case 'transfer':
                            steemClient.broadcast.transfer(
                                config.active,
                                NodeOps[task][2].from,
                                NodeOps[task][2].to,
                                NodeOps[task][2].amount,
                                NodeOps[task][2].memo,
                                function(err, result) {
                                    if (err) {
                                        console.error(err);
                                        noi(task)
                                    } else {
                                        NodeOps.splice(task, 1)
                                    }
                                });
                            break;
                        case 'nft_op':
                            transactor.json(config.username, config.active, 'nft_op', {
                                nft: NodeOps[task][2],
                                completed: NodeOps[task][3],
                                runtime: NodeOps[task][4],
                                proposal: NodeOps[task][5]
                            }, function(err, result) {
                                if (err) {
                                    noi(task)
                                    console.error(err);
                                } else {
                                    NodeOps.splice(task, 1)
                                    broadcast = 1
                                }
                            })
                            break;
                          case 'lots':
                            steemClient.broadcast.sendOperations(
                                NodeOps[task][2],
                                wif,
                                function(err, result) {
                                    if (err) {
                                        console.error(err);
                                        noi(task)
                                    } else {
                                        NodeOps.splice(task, 1)
                                    }
                                });
                            break;
                        case 'claim_account':
                            steemClient.broadcast.sendOperations(
                                [
                                    "claim_account",
                                    {
                                      "creator": config.username,
                                      "fee": "0.000 STEEM",
                                      "extensions": []
                                    }
                                ], wif,
                                function(err, result) {
                                    if (err) {
                                        console.error(err);
                                        noi(task)
                                    } else {
                                        NodeOps.splice(task, 1)
                                    }
                                });
                            break;
                        case 'create_claimed_account':
                            steemClient.broadcast.sendOperations(
                                [
                                    "create_claimed_account",
                                    {
                                        "creator": config.username,
                                        "new_account_name": NodeOps[task][2].un,
                                        "owner": {
                                            "weight_threshold": 1,
                                            "account_auths": [],
                                            "key_auths": [
                                                [NodeOps[task][2].po, 1]
                                            ],
                                        },
                                        "active": {
                                            "weight_threshold": 1,
                                            "account_auths": [],
                                            "key_auths": [
                                                [NodeOps[task][2].pa, 1]
                                            ],
                                        },
                                        "posting": {
                                            "weight_threshold": 1,
                                            "account_auths": [],
                                            "key_auths": [
                                                [NodeOps[task][2].pp, 1]
                                            ],
                                        },
                                        "memo_key": NodeOps[task][2].pm,
                                        "json_metadata": "",
                                        "extensions": []
                                    }
                                ], wif,
                                function(err, result) {
                                    if (err) {
                                        console.error(err);
                                        noi(task)
                                    } else {
                                        NodeOps.splice(task, 1)
                                    }
                                });
                            break;
                        default:

                    }
                }
                if (broadcast == 0) {
                    broadcast = 1
                }
            }
        }
        //*/
    });

    processor.onStreamingStart(function() {
        console.log("At real time.")
        if (state.markets.node[config.username]) {
            if (!state.markets.node[config.username].domain && config.NODEDOMAIN) {
                transactor.json(config.username, config.active, 'node_add', {
                    domain: config.NODEDOMAIN,
                    bidRate: config.bidRate,
                    escrow
                }, function(err, result) {
                    if (err) {
                        console.error(err);
                    }
                })
            }
        }
    });

    processor.start();

    rl.on('line', function(data) {
        var split = data.split(' ');

        if (split[0] === 'balance') {
            var user = split[1];
            var balance = state.balances[user];
            if (balance === undefined) {
                balance = 0;
            }
            console.log(user, 'has', balance, 'tokens')
        } else if (split[0] === 'sign-off') {
            transactor.json(config.username, config.active, `node_delete`, {}, function(err, result) {
                if (err) {
                    console.error(err);
                } else {
                    broadcast = 2
                    console.log(`Signing off...`)
                }
            })
        } else if (split[0] === 'send') {
            console.log('Sending tokens...')
            var to = split[1];

            var amount = parseInt(split[2]);
            broadcast = 2
            transactor.json(config.username, config.active, 'send', {
                to: to,
                amount: amount
            }, function(err, result) {
                if (err) {
                    console.error(err);
                }
            })
        } //*
        else if (split[0] === 'dex-place-ask') { //dex-place-ask 1000(dlux) 100(type) steem(/sbd | type)
            console.log('Creating DEX Contract...')
            var dlux = split[1],
                amount = split[2],
                type = 'steem',
                partial = false;
            if (split[3] == 'sbd') {
                type = 'sbd'
            }
            broadcast = 2
            transactor.json(config.username, config.active, `dex_${type}_sell`, {
                dlux,
                [type]: amount,
                partial
            }, function(err, result) {
                if (err) {
                    console.error(err);
                }
            })
        } else if (split[0] === 'dex-buy-ask') { //dex-buy-ask DLUXQmxxxx 1-10000(assumes 10000 /full if blank) you can go over and buy contracts of better rates and have the remainder returned to your account
            console.log('Creating Escrow tx...')
            var txid = split[1],
                addr = '',
                receiver = '',
                amount, type
            //amount is steem by millisteems 1000 = 1.000 steem
            for (var i = 0; i < state.dex.steem.sellOrders.length; i++) {
                if (state.dex.steem.sellOrders[i].txid == txid) {
                    console.log(state.dex.steem.sellOrders[i].txid)
                    addr = state.dex.steem.sellOrders[i]
                    reciever = state.dex.steem.sellOrders[i].from
                    type = ' STEEM'
                }
            }
            if (!addr) {
                type = ' SBD'
                for (var i = 0; i < state.dex.sbd.sellOrders.length; i++) {
                    if (state.dex.sbd.sellOrders[i].txid == txid) {
                        console.log(state.dex.sbd.sellOrders[i].txid)
                        addr = state.dex.sbd.sellOrders[i]
                        reciever = state.dex.sbd.sellOrders[i].from
                    }
                }
            }
            if (addr) {
                var escrowTimer = {}
                var agents = []
                var i = 0
                for (var agent in state.queue) {
                    if (i == 3) {
                        break
                    }
                    agents.push(state.queue[agent])
                    i++;
                }
                if (agents[0] != config.username && agents[0] != addr.from) {
                    agents.push(agents[0])
                } else if (agents[1] != config.username && agents[1] != addr.from) {
                    agents.push(agents[1])
                } else {
                    agents.push(agents[2])
                }
                let now = new Date();
                escrowTimer.ratifyIn = now.setHours(now.getHours() + 720);
                escrowTimer.ratifyUTC = new Date(escrowTimer.ratifyIn);
                escrowTimer.ratifyString = escrowTimer.ratifyUTC.toISOString().slice(0, -5);
                escrowTimer.expiryIn = now.setDate(now.getDate() + 1440);
                escrowTimer.expiryUTC = new Date(escrowTimer.expiryIn);
                escrowTimer.expiryString = escrowTimer.expiryUTC.toISOString().slice(0, -5);
                var eidi = txid
                if (type == ' STEEM') {
                    steemAmount = (addr.steem / 1000).toFixed(3) + type
                    sbdAmount = '0.000 SBD'
                } else if (type == ' SBD') {
                    sbdAmount = (addr.sbd / 1000).toFixed(3) + type
                    steemAmount = '0.000 STEEM'
                }
                let eid = processor.getCurrentBlockNumber() //escrow_id from DLUXQmxxxx<this
                let params = {
                    from: config.username,
                    to: addr.from,
                    sbd_amount: sbdAmount,
                    steem_amount: steemAmount,
                    escrow_id: eid,
                    agent: agents[3],
                    fee: '0.000 STEEM',
                    ratification_deadline: escrowTimer.ratifyString,
                    escrow_expiration: escrowTimer.expiryString,
                    json_meta: JSON.stringify({
                        contract: txid
                    })
                }
                console.log(params)
                NodeOps.push([
                    [0, 0], 'escrow_transfer', ['escrow_transfer', params]
                ]);
            }
        } else if (split[0] === 'dex-place-bid') { //dex-place-bid 1000(dlux) 100(type) steem(/sbd | type)
            console.log('Placing bid...')
            var dlux = parseInt(split[1]),
                amount = parseInt(split[2]),
                type = split[3] || 'steem',
                steemAmount, sbdAmount
            //amount is steem by millisteems 1000 = 1.000 steem
            if (type == 'sbd') {
                type = ' SBD'
            } else {
                type = ' STEEM'
            }
            if (type == ' STEEM') {
                steemAmount = (amount / 1000).toFixed(3) + type
                sbdAmount = '0.000 SBD'
            } else if (type == ' SBD') {
                sbdAmount = (amount / 1000).toFixed(3) + type
                steemAmount = '0.000 STEEM'
            }
            if (dlux > 0 && typeof dlux == 'number' && amount > 0 && typeof amount == 'number') {
                var escrowTimer = {}
                var agents = []
                var i = 0
                for (var agent in state.queue) {
                    if (agents.length == 1) {
                        break;
                    }
                    if (state.balances[state.queue[agent]] > dlux && state.queue[agent] != config.username) {
                        agents.push(state.queue[agent])
                    }
                }
                for (var agent in state.queue) {
                    if (agents.length == 2) {
                        break
                    }
                    if (state.queue[agent] != agents[0] && state.queue[agent] != config.username) {
                        agents.push(state.queue[agent])
                    }
                }
                let now = new Date();
                escrowTimer.ratifyIn = now.setHours(now.getHours() + 72);
                escrowTimer.ratifyUTC = new Date(escrowTimer.ratifyIn);
                escrowTimer.ratifyString = escrowTimer.ratifyUTC.toISOString().slice(0, -5);
                escrowTimer.expiryIn = now.setDate(now.getDate() + 5);
                escrowTimer.expiryUTC = new Date(escrowTimer.expiryIn);
                escrowTimer.expiryString = escrowTimer.expiryUTC.toISOString().slice(0, -5);
                var eidi = txid
                var formatter = amount / 1000
                formatter = formatter.toFixed(3)
                let eid =  processor.getCurrentBlockNumber()
                let params = {
                    from: config.username,
                    to: agents[0],
                    sbd_amount: sbdAmount,
                    steem_amount: steemAmount,
                    escrow_id: eid,
                    agent: agents[1],
                    fee: '0.000 STEEM',
                    ratification_deadline: escrowTimer.ratifyString,
                    escrow_expiration: escrowTimer.expiryString,
                    json_meta: JSON.stringify({
                        dextx: {
                            dlux
                        }
                    })
                }
                console.log(params)
                NodeOps.push([
                    [0, 0], 'escrow_transfer', ['escrow_transfer', params]
                ]);
            }
        } else if (split[0] === 'dex-buy-bid') { //dex-buy-bid DLUXQmxxxx
            var txid = split[1],
                type = '',
                addr = '',
                reciever = ''
            console.log(`Buying ${txid}`)
            for (var i = 0; i < state.dex.steem.buyOrders.length; i++) {
                if (state.dex.steem.buyOrders[i].txid == txid) {
                    console.log(state.dex.steem.buyOrders[i].txid)
                    addr = state.dex.steem.buyOrders[i]
                    reciever = state.dex.steem.buyOrders[i].from
                    type = ' STEEM'
                }
            }
            if (!addr) {
                type = ' SBD'
                for (var i = 0; i < state.dex.sbd.buyOrders.length; i++) {
                    if (state.dex.sbd.buyOrders[i].txid == txid) {
                        console.log(state.dex.sbd.buyOrders[i].txid)
                        addr = state.dex.sbd.buyOrders[i]
                        reciever = state.dex.sbd.buyOrders[i].from
                    }
                }
            }
            if (addr) {
                broadcast = 2
                transactor.json(config.username, config.active, `dex_buy`, {
                    contract: txid,
                    to: addr.from,

                }, function(err, result) {
                    if (err) {
                        console.error(err);
                    }
                })
            }
        } else if (split[0] === 'power-up') {
            console.log('Sending Power Up request...')
            var amount = parseInt(split[1])
            broadcast = 2
            transactor.json(config.username, config.active, `power_up`, {
                amount
            }, function(err, result) {
                if (err) {
                    console.error(err);
                }
            })
        } else if (split[0] === 'power-down') {
            console.log('Scheduling Power Down...')
            var amount = split[1]
            broadcast = 2
            transactor.json(config.username, config.active, `power_down`, {
                amount
            }, function(err, result) {
                if (err) {
                    console.error(err);
                }
            })
        } else if (split[0] === 'ban') {
            var name = split[1]
            transactor.json(config.username, config.active, 'custom_cms_' + config.username + '_ban_user', {
                name
            }, function(err, result) {
                if (err) {
                    console.error(err);
                }
            })
        } else if (split[0] === 'unban') {
            var name = split[1]
            transactor.json(config.username, config.active, 'custom_cms_' + config.username + '_unban_user', {
                name
            }, function(err, result) {
                if (err) {
                    console.error(err);
                }
            })
        } else if (split[0] === 'add-user') {
            let name = split[1],
                tier = split[2],
                expires = split[3]
            transactor.json(config.username, config.active, 'custom_cms_' + config.username + '_add_user', {
                name,
                tier,
                expires
            }, function(err, result) {
                if (err) {
                    console.error(err);
                }
            })
        } else if (split[0] === 'add-model') {
            let num = split[1],
                tier = split[2],
                dlux = split[3]
            transactor.json(config.username, config.active, 'custom_cms_' + config.username + '_model_add', {
                num,
                tier,
                dlux
            }, function(err, result) {
                if (err) {
                    console.error(err);
                }
            })
        } else if (split[0] === 'delete-model') {
            let num = split[1],
                tier = split[2],
                dlux = split[3]
            transactor.json(config.username, config.active, 'custom_cms_' + config.username + '_model_delete', {
                num,
                tier,
                dlux
            }, function(err, result) {
                if (err) {
                    console.error(err);
                }
            })
        } else if (split[0] === 'add-tier') {
            transactor.json(config.username, config.active, 'custom_cms_' + config.username + '_tier_add', {}, function(err, result) {
                if (err) {
                    console.error(err);
                }
            })
        } else if (split[0] === 'delete-tier') {
            let tier = split[1]
            transactor.json(config.username, config.active, 'custom_cms_' + config.username + '_tier_delete', {
                tier
            }, function(err, result) {
                if (err) {
                    console.error(err);
                }
            })
        } else if (split[0] === 'delete') {
            let content = split[1]
            transactor.json(config.username, config.active, 'custom_cms_' + config.username + '_delete', {
                content
            }, function(err, result) {
                if (err) {
                    console.error(err);
                }
            })
        } else if (split[0] === 'set-level') {
            let content = split[1],
                level = split[2]
            transactor.json(config.username, config.active, 'custom_cms_' + config.username + '_set_level', {
                content,
                level
            }, function(err, result) {
                if (err) {
                    console.error(err);
                }
            })
        } else if (split[0] === 'add') {
            let file = split[1]
            var json = fs.readFileSync(`./${file}`, 'utf8');
            var temp = JSON.parse(json);
            if (temp.self && temp.level && temp.title && temp.body && config.memoKey) {
                var content = {
                    self: temp.self,
                    level: temp.level,
                    title: temp.title,
                    body: temp.body
                }
                if (content.level > 0) {
                    content.body = Utils.sealer(content.body, config.username)
                }
                transactor.json(config.username, config.active, 'custom_cms_' + config.username + '_add', {
                    content
                }, function(err, result) {
                    if (err) {
                        console.error(err);
                    }
                })
            }
        } //*/
        else if (split[0] === 'exit') {
            //announce offline
            exit();
        } else if (split[0] === 'state') {
            console.log(JSON.stringify(state, null, 2));
        } else {
            console.log("Invalid command.");
        }
    });
}

function check() { //do this maybe cycle 5, gives 15 secs to be streaming behind
    plasma.markets = {
        nodes: {},
        ipfss: {},
        relays: {}
    }
    for (var account in state.markets.node) {
        var self = state.markets.node[account].self
        plasma.markets.nodes[self] = {
            self: self,
            agreement: false,
        }
        if (state.markets.node[self].domain && state.markets.node[self].domain != config.NODEDOMAIN) {
            var domain = state.markets.node[self].domain
            if (domain.slice(-1) == '/') {
                domain = domain.substring(0, domain.length - 1)
            }
            fetch(`${domain}/stats`)
                .then(function(response) {
                    //console.log(response)
                    return response.json();
                })
                .then(function(myJson) {
                    if (state.stats.hashLastIBlock === myJson.stats.hashLastIBlock) {
                        plasma.markets.nodes[myJson.node].agreement = true
                    }
                });
        }
    }
}

function tally(num) { //tally state before save and next report
    var tally = {
        agreements: {
            runners: {},
            tally: {},
            votes: 0
        },
        election: {},
        winner: {},
        results: []
    }
    for (var node in state.runners) { //find out who is in the runners group
        tally.agreements.runners[node] = state.markets.node[node] //move the state data to tally to process
        tally.agreements.tally[node] = {
            self: node,
            hash: state.markets.node[node].report.hash,
            votes: 0
        } //build a dataset to count
    }
    for (var node in tally.agreements.runners) {
        for (var subnode in tally.agreements.runners[node].report.agreements) {
            if(tally.agreements.tally[subnode]){
              if (tally.agreements.tally[subnode].hash == tally.agreements.tally[node].hash) {
                tally.agreements.tally[subnode].votes++
                console.log(tally.agreements.tally[subnode])
              }
            }
        }
        tally.agreements.votes++
    }
    var l = 0
    var consensus
    for (var node in state.runners) {
        l++
        if (tally.agreements.tally[node].votes / tally.agreements.votes >= 2 / 3 && state.markets.node[node].report.block > num -100) {
            consensus = tally.agreements.runners[node].report.hash
        } else if (l > 1 && state.markets.node[node].report.block > num -100) {
            delete state.runners[node]
            console.log('uh-oh:' + node + ' scored ' + tally.agreements.tally[node].votes + '/' + tally.agreements.votes)
        } else if (l == 1 && state.markets.node[node].report.block > num -100) {
            if(state.markets.node[node].report.block > num -100)consensus=state.markets.node[node].report.hash
        }
        if(consensus === undefined){
          for(var node in state.runners){
            if(state.markets.node[node].report.block > num - 100){consensus=state.markets.node[node].report.hash}
            else{}
            break;
          }
        }
    }
    console.log('Consensus: '+consensus)
    state.stats.lastBlock = state.stats.hashLastIBlock
    if(consensus)state.stats.hashLastIBlock = consensus
    for (var node in state.markets.node) {
        state.markets.node[node].attempts++
        if (state.markets.node[node].report.hash == state.stats.hashLastIBlock) {
            state.markets.node[node].yays++
            state.markets.node[node].lastGood = num
        }
    }
    if (l < 20) {
        for (var node in state.markets.node) {
            tally.election[node] = state.markets.node[node]
        }
        tally.results = []
        for (var node in state.runners) {
            delete tally.election[node]
        }
        for (var node in tally.election) {
            if (tally.election[node].report.hash !== state.stats.hashLastIBlock && state.stats.hashLastIBlock) {
                delete tally.election[node]
            }
        }
        var t = 0
        for (var node in tally.election) {
            t++
            tally.results.push([node, parseInt(((tally.election[node].yays / tally.election[node].attempts) * tally.election[node].attempts))])
        }
        if (t) {
            tally.results.sort(function(a, b) {
                return a[1] - b[1];
            })
            tally.winner = tally.results.pop()
            state.runners[tally.winner[0]] = {
                self: state.markets.node[tally.winner[0]].self,
                domain: state.markets.node[tally.winner[0]].domain
            }
        }
    }
    for (var node in state.runners) {
        state.markets.node[node].wins++
    }
    //count agreements and make the runners list, update market rate for node services
    if (num > 30900000) {
        var mint = parseInt(state.stats.tokenSupply / state.stats.interestRate)
        state.stats.tokenSupply += mint
        state.balances.ra += mint
    }
    if (consensus && consensus != plasma.hashLastIBlock && processor.isStreaming()) {
        exit(consensus)
        var errors = ['failed Consensus']
        if (VERSION != state.markets.node[node].report.version) {
            console.log(current + `:Abandoning ${plasma.hashLastIBlock} because ${errors[0]}`)
        }
        const blockState = Buffer.from(JSON.stringify([num, state]))
        plasma.hashBlock = ''
        plasma.hashLastIBlock = ''
        console.log(current + `:Abandoning ${plasma.hashLastIBlock} because ${errors[0]}`)
        /*var abd = asyncIpfsSaveState(num, blockState)
        abd.then(function(value) {
            transactor.json(config.username, config.active, 'error_CF', {
                errors: JSON.stringify(errors),
                reject: value
            }, function(err, result) {
                if (err) {
                    console.error(err, `\nMost likely your 'active' and 'account' variables are not set!`);
                    startWith(consensus)
                } else {
                    console.log(current + `: Published error report and attempting to restart from consensus ${consensus}`)
                    startWith(consensus)
                }
            })
        });
        */
    }
}
function clean(num){
    for (var i = state.feed.length - 1;i>0;i--){
      if(state.feed[i].split(':')[0].split('|')[1] < num-30240){
        state.feed.splice(i,1)
      } else {
        break;
      }
    }
    for(var i = 0;i<state.dex.steem.buyOrders.length;i++){
      if(state.dex.steem.buyOrders[i].block < num - 86400){release(state.dex.steem.buyOrders[i].txid)}
    }
    for(var i = 0;i<state.dex.sbd.buyOrders.length;i++){
      if(state.dex.sbd.buyOrders[i].block < num - 86400){release(state.dex.sbd.buyOrders[i].txid)}
    }
    for(var i = 0;i<state.dex.steem.sellOrders.length;i++){
      if(state.dex.steem.sellOrders[i].block < num - 86400){release(state.dex.steem.sellOrders[i].txid)}
    }
    for(var i = 0;i<state.dex.sbd.sellOrders.length;i++){
      if(state.dex.sbd.sellOrders[i].block < num - 86400){release(state.dex.sbd.sellOrders[i].txid)}
    }
}
function release(txid){
  var found = ''
  for(var i = 0;i<state.dex.steem.buyOrders.length;i++){
    if(state.dex.steem.buyOrders[i].txid == txid){
      found = state.dex.steem.buyOrders[i]
      state.dex.steem.buyOrders.splice(i,1)
    }
  }
  if(!found){
    for(var i = 0;i<state.dex.sbd.buyOrders.length;i++){
      if(state.dex.sbd.buyOrders[i].txid == txid){
        found = state.dex.sbd.buyOrders[i]
        state.dex.sbd.buyOrders.splice(i,1)
      }
    }
  }

  if(!found){
    for(var i = 0;i<state.dex.steem.sellOrders.length;i++){
      if(state.dex.steem.sellOrders[i].txid == txid){
        found = state.dex.steem.sellOrders[i]
        state.dex.steem.sellOrders.splice(i,1)
      }
    }
  }

  if(!found){
    for(var i = 0;i<state.dex.sbd.sellOrders.length;i++){
      if(state.dex.sbd.sellOrders[i].txid == txid){
        found = state.dex.sbd.sellOrders[i]
        state.dex.sbd.sellOrders.splice(i,1)
      }
    }
  }
  if(found.escrow_id){
    state.escrow.push(found.reject)
  } else {
    state.balances[found.from] += parseInt(found.amount)
    delete state.contracts[found.from][found.txid]
  }
}

function dao(num) {
    var post = `## DLUX DAO REPORT\n`, news = ''
    if(state.postQueue.length)news = '*****\n### News from Humans!\n'
    for(var i = 0; i < state.postQueue.length ; i++){
      news = news + `#### ${state.postQueue[i].title}\n`
      news = news + `${state.postQueue[i].text}\n\n`
    }
    state.postQueue = []
    news = news + '*****\n'
    const header = post + news
    var i = 0,
        j = 0,
        b = 0,
        t = 0
    t = parseInt(state.balances.ra)
    for (var node in state.runners) { //node rate
        b = parseInt(b) + parseInt(state.markets.node[node].marketingRate) || 1
        j = parseInt(j) + parseInt(state.markets.node[node].bidRate) || 1
        i++
        console.log(b, j, i)
    }
    if (!i) {
        b = state.markets.node['dlux-io'].marketingRate
        j = state.markets.node['dlux-io'].bidRate
        i++
    }
    state.stats.marketingRate = parseInt(b / i)
    state.stats.nodeRate = parseInt(j / i)
    post = `![The Hyper Cube](https://ipfs.busy.org/ipfs/QmRtFirFM3f3Lp7Y22KtfsS2qugULYXTBnpnyh8AHzJa7e)\n#### Daily Accounting\n`
    post = post + `Total Supply: ${parseFloat(parseInt(state.stats.tokenSupply)/1000).toFixed(3)} DLUX\n* ${parseFloat(parseInt(state.stats.tokenSupply-state.pow.t-(state.balances.ra +state.balances.rb +state.balances.rc +state.balances.rd +state.balances.re +state.balances.ri +state.balances.rr +state.balances.rn+state.balances.rm))/1000).toFixed(3)} DLUX liquid\n`
    post = post + `* ${parseFloat(parseInt(state.pow.t)/1000).toFixed(3)} DLUX Powered up for Voting\n`
    post = post + `* ${parseFloat(parseInt(state.balances.ra +state.balances.rb +state.balances.rc +state.balances.rd +state.balances.re +state.balances.ri +state.balances.rr +state.balances.rn+state.balances.rm)/1000).toFixed(3)} DLUX in distribution accounts\n`
    post = post + `${parseFloat(parseInt(t)/1000).toFixed(3)} DLUX has been generated today. 5% APY.\n${parseFloat(state.stats.marketingRate/10000).toFixed(4)} is the marketing rate.\n${parseFloat(state.stats.nodeRate/10000).toFixed(4)} is the node rate.\n`
    console.log(`DAO Accounting In Progress:\n${t} has been generated today\n${state.stats.marketingRate} is the marketing rate.\n${state.stats.nodeRate} is the node rate.`)
    state.balances.rn += parseInt(t * parseInt(state.stats.nodeRate) / 10000)
    state.balances.ra = parseInt(state.balances.ra) - parseInt(t * parseInt(state.stats.nodeRate) / 10000)
    state.balances.rm += parseInt(t * state.stats.marketingRate / 10000)
    post = post + `${parseFloat(parseInt(t * state.stats.marketingRate / 10000)/1000).toFixed(3)} DLUX moved to Marketing Allocation.\n`
    if (state.balances.rm > 1000000000) {
        state.balances.rc += state.balances.rm - 1000000000;
        post = post +`${parseFloat((state.balances.rm - 1000000000)/1000).toFixed(3)} moved from Marketing Allocation to Content Allocation due to Marketing Holdings Cap of 1,000,000.000 DLUX\n`
        state.balances.rm = 1000000000
    }
    state.balances.ra = parseInt(state.balances.ra) - parseInt(t * state.stats.marketingRate / 10000)

    i = 0, j = 0
    post = post + `${parseFloat(parseInt(state.balances.rm)/1000).toFixed(3)} DLUX is in the Marketing Allocation.\n##### Node Rewards for Elected Reports and Escrow Transfers\n`
    console.log(num + `:${state.balances.rm} is availible in the marketing account\n${state.balances.rn} DLUX set asside to distribute to nodes`)
    for (var node in state.markets.node) { //tally the wins
        j = j + parseInt(state.markets.node[node].wins)
    }
    b = state.balances.rn
    function _atfun (node){if(state.nomention[node]){return '@_'}else{return '@'}}
    for (var node in state.markets.node) { //and pay them
        i = parseInt(state.markets.node[node].wins / j * b)
        if (state.balances[node]) {
            state.balances[node] += i
        } else {
            state.balances[node] = i
        }
        state.balances.rn -= i
        const _at = _atfun(node)
        post = post + `* ${_at}${node} awarded ${parseFloat(i/1000).toFixed(3)} DLUX for ${state.markets.node[node].wins} credited transaction(s)\n`
        console.log(current + `:@${node} awarded ${i} DLUX for ${state.markets.node[node].wins} credited transaction(s)`)
        state.markets.node[node].wins = 0
    }
    state.balances.rd += parseInt(t * state.stats.delegationRate / 10000) // 10% to delegators
    post = post + `### ${parseFloat(parseInt(state.balances.rd)/1000).toFixed(3)} DLUX set aside for [@dlux-io delegators](https://app.steemconnect.com/sign/delegate-vesting-shares?delegatee=dlux-io&vesting_shares=100%20SP)\n`
    state.balances.ra -= parseInt(t * state.stats.delegationRate / 10000)
    b = state.balances.rd
    j = 0
    console.log(current + `:${b} DLUX to distribute to delegators`)
    for (i = 0; i < state.delegations.length; i++) { //count vests
        j += state.delegations[i].vests
    }
    for (i = 0; i < state.delegations.length; i++) { //reward vests
        k = parseInt(b * state.delegations[i].vests / j)
        if (state.balances[state.delegations[i].delegator] === undefined) {
            state.balances[state.delegations[i].delegator] = 0
        }
        state.balances[state.delegations[i].delegator] += k
        state.balances.rd -= k
        const _at = _atfun(node)
        post = post + `* ${parseFloat(parseInt(k)/1000).toFixed(3)} DLUX for ${_at}${state.delegations[i].delegator}'s ${parseFloat(state.delegations[i].vests/1000000)} Mvests.\n`
        console.log(current + `:${k} DLUX awarded to ${state.delegations[i].delegator} for ${state.delegations[i].vests} VESTS`)
    }
    post = post + `*****\n ## ICO Status\n`
    if (state.balances.ri < 100000000 && state.stats.tokenSupply < 100000000000) {
        if (state.balances.ri == 0) {
            state.stats.tokenSupply += 100000000
            state.balances.ri = 100000000
            var ago = num - state.stats.outOnBlock,dil = ' seconds'
            if (ago !== num) {
                state.balances.rl = parseInt(ago / 30240 * 50000000)
                state.balances.ri = 100000000 - parseInt(ago / 30240 * 50000000)
                state.state.icoPrice = state.state.icoPrice * (1 + (ago / 30240) / 2)
            }
            if(ago > 20){dil = ' minutes';ago=parseFloat(ago/20).toFixed(1)} else {ago = ago * 3}
            if(ago > 60){dil = ' hours';ago=parseFloat(ago/60).toFixed(1)}
            post = post + `### We sold out ${ago}${dil}\nThere are now ${parseFloat(state.balances.ri/1000).toFixed(3)} DLUX for sale from @robotolux for ${parseFloat(state.state.icoPrice/1000).toFixed(3)} Steem each.\n`
        } else {
            var left = state.balances.ri
            state.stats.tokenSupply += 100000000 - left
            state.balances.ri = 100000000
            state.state.icoPrice = state.state.icoPrice - (left / 1000000000)
            if (state.state.icoPrice < 220) state.state.icoPrice = 220
            post = post + `### We Sold out ${100000000 - left} today.\nThere are now ${parseFloat(state.balances.ri/1000).toFixed(3)} DLUX for sale from @robotolux for ${parseFloat(state.state.icoPrice/1000).toFixed(3)} Steem each.\n`
        }
    } else {
      post = post + `### We have ${parseFloat(parseInt(state.balances.ri - 100000000)/1000).toFixed(3)} DLUX left for sale at 0.22 STEEM in our Pre-ICO.\nOnce this is sold pricing feedback on our 3 year ICO starts.[Buy ${parseFloat(10/(parseInt(state.stats.icoPrice)/1000)).toFixed(3)} DLUX* with 10 Steem now!](https://app.steemconnect.com/sign/transfer?to=robotolux&amount=10.000%20STEEM)\n`
    }
    if (state.balances.rl) {
        var dailyICODistrobution = state.balances.rl,
            y = 0
        for (i = 0; i < state.ico.length; i++) {
            for (var node in state.ico[i]) {
                y += state.ico[i][node]
            }
        }
        post = post + `### ICO Over Auction Results:\n${parseFloat(state.balances.rl/1000).toFixed(3)} DLUX was set aside from today's ICO to divide between people who didn't get a chance at fixed price tokens and donated ${parseFloat(y/1000).toFixed(3)} STEEM today.\n`
        for (i = 0; i < state.ico.length; i++) {
            for (var node in state.ico[i]) {
                if (!state.balances[node]) {
                    state.balances[node] = 0
                }
                state.balances[node] += parseInt(state.ico[i][node] / y * state.balances.rl)
                dailyICODistrobution -= parseInt(state.ico[i][node] / y * state.balances.rl)
                post = post + `* @${node} awarded  ${parseFloat(parseInt(state.ico[i][node]/y*state.balances.rl)/1000).toFixed(3)} DLUX for ICO auction\n`
                console.log(current + `:${node} awarded  ${parseInt(state.ico[i][node]/y*state.balances.rl)} DLUX for ICO auction`)
                if (i == state.ico.length - 1) {
                    state.balances[node] += dailyICODistrobution
                    post = post + `* @${node} awarded  ${parseFloat(parseInt(dailyICODistrobution)/1000).toFixed(3)} DLUX for ICO auction\n`
                    console.log(current + `:${node} given  ${dailyICODistrobution} remainder`)
                }
            }
        }
        state.balances.rl = 0
        state.ico = []
    }
    var vol=0, volsbd=0, vols=0, his = [], hisb = [], hi={}
    for (var int = 0; int < state.dex.steem.his.length;int++){
      if (state.dex.steem.his[int].block < num - 30240){
        his.push(state.dex.steem.his.splice(int,1))
      } else {
        vol = parseInt(parseInt(state.dex.steem.his[int].amount) + vol)
        vols = parseInt(parseInt(parseInt(state.dex.steem.his[int].amount)*parseFloat(state.dex.steem.his[int].rate)) + vols)
      }
    }
    for (var int = 0; int < state.dex.sbd.his.length;int++){
      if (state.dex.sbd.his[int].block < num - 30240){
        hisb.push(state.dex.sbd.his.splice(int,1))
      } else {
        vol = parseInt(parseInt(state.dex.sbd.his[int].amount) + vol)
        volsbd = parseInt(parseInt(parseInt(state.dex.sbd.his[int].amount)*parseFloat(state.dex.sbd.his[int].rate)) + volsbd)
      }
    }
    if(his.length){
      hi.block = num - 60480
      hi.open = parseFloat(his[0].rate)
      hi.close = parseFloat(his[his.length-1].rate)
      hi.top = hi.open
      hi.bottom = hi.open
      hi.vol = 0
      for (var int = 0; int < his.length;int++){
        if(hi.top < parseFloat(his[int])){hi.top = parseFloat(his[int].rate)}
        if(hi.bottom > parseFloat(his[int])){hi.bottom = parseFloat(his[int].rate)}
        hi.vol = parseInt(hi.vol + parseInt(his[int].amount))
      }
      state.dex.steem.days.push(hi)
    }
    if(hisb.length){
      hi.open = parseFloat(hisb[0].rate)
      hi.close = parseFloat(hisb[hisb.length-1].rate)
      hi.top = hi.open
      hi.bottom = hi.open
      hi.vol = 0
      for (var int = 0; int < hisb.length;int++){
        if(hi.top < parseFloat(hisb[int])){hi.top = parseFloat(hisb[int].rate)}
        if(hi.bottom > parseFloat(hisb[int])){hi.bottom = parseFloat(hisb[int].rate)}
        hi.vol = parseInt(hi.vol + parseInt(hisb[int].amount))
      }
      state.dex.sbd.days.push(hi)
    }
    post = post + `*****\n### DEX Report\n#### Spot Information\n* Price: ${parseFloat(state.dex.steem.tick).toFixed(3)} STEEM per DLUX\n* Price: ${parseFloat(state.dex.sbd.tick).toFixed(3)} SBD per DLUX\n#### Daily Volume:\n* ${parseFloat(vol/1000).toFixed(3)} DLUX\n* ${parseFloat(vols/1000).toFixed(3)} STEEM\n* ${parseFloat(parseInt(volsbd)/1000).toFixed(3)} SBD\n*****\n`
    state.balances.rc = state.balances.rc + state.balances.ra
    state.balances.ra = 0
    var q = 0,
        r = state.balances.rc
    for (var i = 0; i < state.br.length; i++) {
        q += state.br[i].totalWeight
    }
    var contentRewards = ``
    if(state.br.length)contentRewards = `#### Top Paid Posts\n`
    const compa = state.balances.rc
    for (var i = 0; i < state.br.length; i++) {
        for (var j = 0; j < state.br[i].post.voters.length; j++) {
            state.balances[state.br[i].post.author] += parseInt(state.br[i].post.voters[j].weight * 2 / q * 3)
            state.balances.rc -= parseInt(state.br[i].post.voters[j].weight / q * 3)
            state.balances[state.br[i].post.voters[j].from] += parseInt(state.br[i].post.voters[j].weight / q * 3)
            state.balances.rc -= parseInt(state.br[i].post.voters[j].weight * 2 / q * 3)
        }
      contentRewards = contentRewards + `* [${state.br[i].title}](https://dlux.io/@${state.br[i].post.author}/${state.br[i].post.permlink}) awarded ${parseFloat(parseInt(compa) - parseInt(state.balances.rc)).toFixed(3)} DLUX\n`
    }
    if(contentRewards)contentRewards = contentRewards + `\n*****\n`
    state.br = []
    state.rolling = {}
    for (i = 0; i < state.pending.length; i++) { //clean up markets after 30 days
        if (state.pending[i][3] < num - 864000) {
            state.pending.splice(i, 1)
        }
    }
    var vo = [],breaker = 0,tw=0,ww=0,ii=100,steemVotes = '',ops=[]
    for(var po = 0;po < state.posts.length;po++){
      if(state.posts[po].block < num - 90720 && state.posts[po].block > num - 123960){
        vo.push(state.posts[po])
        breaker=1
      } else if (breaker){break;}
    }
    for (var po = 0;po < vo.length;po++){
      tw = tw + vo[po].totalWeight
    }
    ww=parseInt(tw/100000)
    vo = sortBuyArray(vo, 'totalWeight')
    if(vo.length<ii)ii=vo.length
    for(var oo = 0;oo<ii;oo++){
      var weight = parseInt(ww *vo[oo].totalWeight)
      if(weight>10000)weight=10000
      ops.push([
        "vote",
        {
          "voter": "dlux-io",
          "author": vo[oo].author,
          "permlink": vo[oo].permlink,
          "weight": weight
        }
      ])
      steemVotes = steemVotes + `* [${vo[oo].title}](https://dlux.io/@${vo[oo].author}/${vo[oo].permlink}) by @${vo[oo].author} | ${parseFloat(weight/100).toFixed(3)}% \n`
    }
    if(ops.length){state.escrow.push(['dlux-io',['lots',ops]])}
    const footer = `[Visit dlux.io](https://dlux.io)\n[Find us on Discord](https://discord.gg/Beeb38j)\n[Visit our DEX/Wallet - Soon](https://dlux.io)\n[Learn how to use DLUX](https://github.com/dluxio/dluxio/wiki)\n[Turn off mentions for nodes and delegators](https://app.steemconnect.com/sign/custom-json?id=dluxT_nomention&json=%7B%22mention%22%3Afalse%7D) or [back on](https://app.steemconnect.com/sign/custom-json?id=dluxT_nomention&json=%7B%22mention%22%3Atrue%7D)\n*Price for 25.2 Hrs from posting or until daily 100,000.000 DLUX sold.`
    if(steemVotes)steemVotes = `#### Community Voted DLUX Posts\n`+ steemVotes +`*****\n`
    post = header + contentRewards + steemVotes + post + footer
    var op = ["comment",
                                 {"parent_author": "",
                                  "parent_permlink": "dlux",
                                  "author": "dlux-io",
                                  "permlink": 'dlux'+ num,
                                  "title": `DLUX DAO | Automated Report ${num}`,
                                  "body": post,
                                  "json_metadata": JSON.stringify({tags:["dlux","ico","dex","cryptocurrency"]})}]
    state.escrow.unshift(['dlux-io',op])
    Utils.cleaner()
}

function report(num) {
    agreements = {
        [config.username]: {
            node: config.username,
            agreement: true
        }
    }
    if (plasma.markets) {
        for (var node in plasma.markets.nodes) {
            if (plasma.markets.nodes[node].agreement) {
                agreements[node] = {
                    node,
                    agreement: true
                }
            }
        }
        for (var self in state.runners) {
            if (agreements[self]) {
                agreements[self].top = true
            } else if (plasma.markets.nodes[self].agreement) {
                agreements[self] = {
                    node: self,
                    agreement: true
                }
            } else {
                agreements[self] = {
                    node: self,
                    agreement: false
                }
            }
        }
        var feed = []
        for (var e = 0 ; e < state.feed.length ; e++){
          if (state.feed[e].split('|')[1].split(':')[0] > num -100){
            feed.push(state.feed[e])
          }
        }
        transactor.json(config.username, config.active, 'report', {
            feed: feed,
            agreements: agreements,
            hash: plasma.hashLastIBlock,
            block: plasma.hashBlock,
            version: VERSION,
            escrow: escrow,
            stash: plasma.privHash
        }, function(err, result) {
            if (err) {
                console.error(err, `\nMost likely your ACCOUNT and KEY variables are not set!`);
            } else {
                console.log(current + `:Sent State report and published ${plasma.hashLastIBlock} for ${plasma.hashBlock}`)
            }
        }) //sum plasma and post a transaction
    }
}

function runCustomNFT(contract, executor, blocknum, bal, assets, code, key) { //assets [fee,[name,dlux],[contract],[]]
    var timedOut = false,
        done = false,
        milliseconds = Date.now()
    var valid = true
    const original = contract
    const nftJSON = JSON.stringify(contract)
    const assetsJSON = JSON.stringify(assets)
    const timer = computeTimer(assets[0] || 0)
    var info = `function (){var nft=${nftJSON},executor=${executor},blocknum=${blocknum},dlux=${bal},assets=${assets},code=${code},key=${key};`
    while (!timedOut || !done) {
        setTimeout(function() {
            timedOut = true
        }, timer)
        var proposal = safeEval(`${info}${nft.rule}}`)
        milliseconds = Date.now() - milliseconds
        done = true
    }
    proposal = checkNFT(original, proposal, executor, bal, assets, key)
    return [done, proposal, milliseconds]
}

function expireNFT(n) {
    var o, p = JSON.parse(JSON.stringify(n)),
        f = [0];
    if (n.stack.length == 0) {
        p.behavior = -2
        p.expires++
        o = [true, p, 1, [0, 10]]
    } else {
        p.expires = p.stack[0][1]
        p.behavior = p.stack[0][2]
        p.rule = p.stack[0][3]
        o = [true, p, 1, [0, 10]]
    }
}

function processNFT(o, n) {

}

/*
if(o[2] > 25){
  if (parseInt(o[2]/25) < n.pool){
    n.pool -= parseInt(o[2]/25)
    state.balances.rn += parseInt(o[2]/25)
  } else {
    o[1].behavior = -1
  }
}
if(o[3].length < 2 || !o[0] || o[1].behavior < 0){ //process to disolve
  if(o[1].behavior == -3){ //release to table 1
    for (var name in o[1].assetBenifactors[1]){
      for (var i = 0;i < o[1].assetBenifactors[1][name].length;i++){
        state.contracts[o[1].assetBenifactors[1][name][i]].bearers.push(name)
        if (state.contracts[o[1].assetBenifactors[1][name][i]].pow > 0){
          state.pow[state.contracts[o[1].assetBenifactors[1][name][i]].bearers[-2]] -= state.contracts[o[1].assetBenifactors[1][name][i]].pow
          state.pow[state.contracts[o[1].assetBenifactors[1][name][i]].bearers[-1]] += state.contracts[o[1].assetBenifactors[1][name][i]].pow
        }
      }
    }
    for (var i = 0; i < o[1].benifactors[1].length;i++){
      if (state.balances[o[1].benifactors[1][i].u] === undefined){state.balances[o[1].benifactors[1][i].u] = 0}
      state.balances[o[1].benifactors[1][i].u] += o[1].benifactors[1][i].d
    }
    if (state.balances[o[1].creator] === undefined){state.balances[o[1].creator] = 0}
    state.balances[o[1].creator] += o[1].pool
    if (state.pow[o[1].creator] === undefined){state.pow[o[1].creator] = 0}
    state.pow[creator] += o[1].pow
    delete state.contracts[o[1].self]
  } else if (o[1].behavior == -2){ //release to table 0
    for (var name in o[1].assetBenifactors[0]){
      for (var i = 0;i < o[1].assetBenifactors[0][name].length;i++){
        state.contracts[o[1].assetBenifactors[0][name][i]].bearers.push(name)
        if (state.contracts[o[1].assetBenifactors[0][name][i]].pow > 0){
          state.pow[state.contracts[o[1].assetBenifactors[0][name][i]].bearers[-2]] -= state.contracts[o[1].assetBenifactors[0][name][i]].pow
          state.pow[state.contracts[o[1].assetBenifactors[0][name][i]].bearers[-1]] += state.contracts[o[1].assetBenifactors[0][name][i]].pow
        }
      }
    }
    for (var i = 0; i < o[1].benifactors[0].length;i++){
      if (state.balances[o[1].benifactors[0][i].u] === undefined){state.balances[o[1].benifactors[0][i].u] = 0}
      state.balances[o[1].benifactors[0][i].u] += o[1].benifactors[0][i].d
    }
    if (state.balances[o[1].creator] === undefined){state.balances[o[1].creator] = 0}
    state.balances[o[1].creator] += o[1].pool
    if (state.pow[o[1].creator] === undefined){state.pow[o[1].creator] = 0}
    state.pow[creator] += o[1].pow
    delete state.contracts[o[1].self]
  } else { //release to depositers
    for ( var user in n.deposits) {
      if (state.balances[user] === undefined){state.balances[user] = 0}
      state.balances[user] += n.deposits[user]
    }
    if(n.pow){
      if (state.pow[n.creator] === undefined){state.pow[n.creator] = 0}
      state.pow[creator] += n.pow
    }
    if (state.balances[creator] === undefined){state.balances[creator] = 0}
    state.balances[creator] += n.pool
    delete state.contracts[o[1].self]
  }
} else { //process updates

}


*/

function runNFT(n, e, b, d, a, c, k) { //nft, executor, blocknumber, dluxcoin, assets, code, key
    var o, p = JSON.parse(JSON.stringify(n)),
        f = [0] //output, proposal, finalActions
    switch (n.behavior) {
        case 0: //Custom assign 3 agents and que
            if (state.balances[e] >= d) {
                if (!state.limbo[e]) {
                    state.limbo[e] = d
                } else {
                    state.limbo[e] += d
                }
                state.balances[e] -= d
                assignAgents(n, e, b, d, a, c)
                o = [true, false, 0, [0, 1]]
                return o
            }
            break;
        case 1: //Auction
            if (d > n.bal && c == 0 && !a && state.balances[e] >= d) {
                state.balances[e] -= d
                p.lastExecutor.push([e, b, c])
                p.memo = `${e} outbid ${n.lastExecutor[0]} with ${d} for ${n.self}`
                p.withdraw.push([n.lastExecutor[0], n.bal])
                p.assetBenifactors[0][0][0] = e
                p.benifactors[0][0][0].d = d
                p.bal = d
                p.incrementer++
                delete p.deposits[n.lastExecutor[0]]
                p.deposits[e] = d
                f.append(2)
                f.append(4)
                o = [true, p, 0, f]
            } else {
                o = [false, false, 0, [0]]
            }
            return o
            break;
        case 2: //simple equity
            if (d > 0 && c == 0 && !a && state.balances[e] >= d) {
                state.balances[e] -= d
                p.lastExecutor = [e, b]
                p.benifactors[0][0].push({
                    u: e,
                    d: d
                })
                p.bal = n.bal + d
                p.incrementer++
                if (p.deposits[e]) {
                    p.deposits[e] += d
                } else {
                    p.deposits[e] = d
                }
                f.append(2)
                o = [true, p, 0, f]
            } else {
                o = [false, false, 0, [0]]
            }
            return o
            break;
        case 3: //place simple bet code 0 and code 1 for two way
            if (d > 0 && c == 0 && !a && state.balances[e] >= d) {
                state.balances[e] -= d
                p.lastExecutor = [e, b]
                p.benifactors[0][0].push({
                    u: e,
                    d: d
                })
                p.bal = n.bal + d
                p.incrementer++
                if (p.deposits[e]) {
                    p.deposits[e] += d
                } else {
                    p.deposits[e] = d
                }
                f.append(2)
                o = [true, p, 0, f]
            } else if (d > 0 && c == 1 && !a && state.balances[e] >= d) {
                state.balances[e] -= d
                p.lastExecutor = [e, b]
                p.benifactors[0][1].push({
                    u: e,
                    d: d
                })
                p.bal = n.bal + d
                p.incrementer++
                if (p.deposits[e]) {
                    p.deposits[e] += d
                } else {
                    p.deposits[e] = d
                }
                f.append(2)
                o = [true, p, 0, f]
            } else {
                o = [false, false, 0, [0]]
            }
            return o
            break;
        case 4: //bearer transfer, useful for physical goods and location based experience
            var auth
            if (k) {
                auth = steemClient.memo.decode(n.pubKey, k)
            }
            if (auth == e) { // '#' + e? uses the private key to encypt the user name of the sender
                auth = true //set to expire if purchased...
            } else {
                auth = false
            }
            if (auth) {
                //check price and balance
                //disperse
            } else {
                o = [false, false, 0, [0]]
            }
            return o
            break;
        case 5:
            // pays out contract fee to code enterer... useful for ads
            break;
        case 6: // "quest" nft, executor, blocknumber, dluxcoin, assets, code, key
            var preReqs = 0,
                auth = '',
                l = 1 //l checks if already complete
            if (n.bearer[-1] == e) {
                preReqs = n.rule[c][2].length
                if (n.rule[c][1][4] == false) {
                    l = 0
                }
                if (n.rule[c][0]) {
                    auth = steemClient.memo.decode(n.rule[c][0], k)
                    if (auth == e) {
                        for (var j = 0; j < n.rule[c][2].length; j++) {
                            if (n.rule[j][4] == true) {
                                preReqs--
                            } //checks complete , counts down list
                        }
                    }
                } else {
                    auth = e
                    for (var j = 0; j < n.rule[i][2].length; j++) {
                        if (n.rule[j][4] == true) {
                            preReqs--
                        } //checks complete , counts down list
                    }
                }
            }
            if (!preReqs && auth == e && !l) {
                p.rule[c][1][4] = true
                if (n.rule[c][1][3] && p.rule[c][1][3] > p.bal) {
                    p.bal = p.bal - p.rule[c][1][3]
                    p.withdraw.push([e, p.rule[c][1][3]])
                    f.append(4)
                }
                p.incrementer++
                p.lastExecutor.push([e, b, c])
            } else {
                o = [false, false, 0, [0]]
            }
            o = [true, p, 0, f]
            return o
            break;
        default:
            o = [false, false, 0, [0]]
    }
    return o
}

function assignAgents(n, e, b, d, a, c) {
    state.exes.push({
        id: n.self,
        n,
        e,
        b,
        d,
        a,
        c,
        op: []
    })
    state.exeq.push([utils.agentCycler(), n.self, b, e])
    state.exeq.push([utils.agentCycler(), n.self, b, e])
    state.exeq.push([utils.agentCycler(), n.self, b, e])
}

function checkNFT(nft, proposal, executor, bal, assets) {
    var actions = [0],
        j = 0,
        k = 0,
        l = 0,
        m = 0
    if (nft.incrementer + 1 + assets[1].length + assets[2].length !== proposal.incrementer) {
        return 0
    } //required to count inputs easy to reject incompatible inputs
    for (var i = 0; i < assets[1].length; i++) {
        j += assets[1].bal
    } //dlux in via cascade
    for (var i = 0; i < proposal.withdraw.length; i++) {
        k += proposal.withdraw[i][1]
    }
    for (var i = 0; i < proposal.benifactors[0].length; i++) {
        l += proposal.withdraw[0][i].bal
    } //release table
    for (var i = 0; i < proposal.benifactors[1].length; i++) {
        m += proposal.withdraw[1][i].bal
    } //release table
    if (nft.bal + bal + j - k === proposal.bal) {
        actions.append(4)
    }
    if (nft.bal + bal + j === proposal.bal) {
        actions.append(3)
    }
    if (nft.bal + bal === proposal.bal) {
        actions.append(2)
    }
    if (nft.bal === proposal.bal) {
        actions.append(1)
    }
    if (l || m) {
        if ((l && !m) || (!l && m)) {
            if (proposal.bal === 0 && nft.bal + bal + j === l && j) {
                actions.append(3);
                actions.append(6)
            }
            if (proposal.bal === 0 && nft.bal + bal + j === m && j) {
                actions.append(3);
                actions.append(7)
            }
            if (proposal.bal === 0 && nft.bal + bal === l && bal) {
                actions.append(2);
                actions.append(6)
            }
            if (proposal.bal === 0 && nft.bal + bal === m && bal) {
                actions.append(2);
                actions.append(7)
            }
            if (proposal.bal === 0 && nft.bal === l) {
                actions.append(6)
            }
            if (proposal.bal === 0 && nft.bal === m) {
                actions.append(7)
            }
            if (actions[actions.length - 1] !== 6) {
                if (actions[actions.length - 1] !== 7) {
                    return 0
                }
            }
        } else {
            return 0
        }
    } //contract release to table 1 or 2... contract must be empty to reelease
    if (nft.pow !== proposal.pow) {
        if (proposal.withdrawPow[creator] === (nft.pow - proposal.pow)) {
            actions.append(5)
        } else {
            return 0
        }
    }
    if (nft.bearers !== proposal.bearers) {
        actions.append(8)
    };
    if (nft.owns !== proposal.owns) {
        actions.append(9)
    }
    if (nft.memo !== proposal.memo) {
        if (proposal.memo.length > 255) {
            proposal.memo = proposal.memo.substr(0, 255)
        }
    }
    if (nft.withdrawAsset !== 0) {}
    if (nft.benifactors !== proposal.benifactors) {}
    if (nft.assetBenifactors !== proposal.assetBenifactors) {}

    if (nft.expires !== proposal.expires) {
        actions.append(10)
    } //wills and dead mans switchs
    if (nft.withdraw !== 0) {
        actions.append(4)
    } //trusts and payments for commitment


    return //needs work
}

function computeTimer(fee) {
    if (fee == 0) {
        return false
    } else if (fee < 30000) {
        return parseInt(fee / (parseInt(state.stats.nodeRate / 100) + 1)) + 1
    } else {
        return 3000
    }
}

function exit(consensus) {
    console.log(`Restarting with ${consensus}...`);
    processor.stop(function(){startWith(consensus)});
}

function ipfsSaveState(blocknum, hashable) {
    ipfs.add(hashable, (err, IpFsHash) => {
        if (!err) {
            var hash = ''
            try{hash = IpFsHash[0].hash} catch (e){console.log(e)}
            plasma.hashLastIBlock = hash
            plasma.hashBlock = blocknum
            console.log(current + `:Saved:  ${hash}`)
        } else {
            console.log({
                cycle
            }, 'IPFS Error', err)
            cycleipfs(cycle++)
            if (cycle >= 25) {
                cycle = 0;
                return;
            }
        }
    })
};

function asyncIpfsSaveState(blocknum, hashable) {
    return new Promise((resolve, reject) => {
        ipfs.add(hashable, (err, IpFsHash) => {
            if (!err) {
                resolve(IpFsHash[0].hash)
                console.log(current + `:Saved:  ${IpFsHash[0].hash}`)
            } else {
                resolve('Failed to save state.')
                console.log({
                    cycle
                }, 'IPFS Error', err)
                cycleipfs(cycle++)
                if (cycle >= 25) {
                    cycle = 0;
                    return;
                }
            }
        })
    })
};

function sortBuyArray(array, key) {
    return array.sort(function(a, b) {
        return b[key] - a[key];
    });
}

function sortSellArray(array, key) {
    return array.sort(function(a, b) {
        return a[key] - b[key];
    });
}

function noi(t) { //node ops incrementer and cleaner... 3 retries and out
    NodeOps[t][0][0] = 5
    NodeOps[t][0][1]++
    if (NodeOps[t][0][1] > 3) {
        NodeOps.splice(t, 1)
    }
}


//encryption check will not work for your username!!!
var Private = {
    pubKeys: {
        caramaeplays: 'STM75b5FoQxzJLFuTJCkp9s4GmS41qBgZte7iuV6VZP133FT4MNU6',
        disregardfiat: 'STM6phwq25EG8S2PifKgs3riH2d1gF868v9TTKF5cXxWscvrBaegz'
    },
    tier: [
        ['disregardfiat', 'caramaeplays']
    ],
    models: [],
    banned: [],
    content: {
        test: {
            self: 'test',
            level: 0,
            title: 'Encryption Check 1',
            body: 'Your memo key is configured!'
        },
        test_enc: {
            self: 'test_enc',
            level: 1,
            title: 'Encryption Check 2',
            body: '#FA4KAVwEYmumHgs1wAyfdXyUPc4YZ2rbRZrDMcnur5ebdTJDLwcGWhc5ZckJ5xSs4vKVtLbtvLAvjmAzJ5q5ayRwQgXp6hbr5b7yaAWgTVRLR3DcTaFzDCMUwhVwTqLxN'
        },
    }
}
var Utils = {
    save: function() {
        const priv = Buffer.from(JSON.stringify([num, state]))
        ipfs.add(priv, (err, IpFsHash) => {
            if (!err) {
                plasma.privHash = IpFsHash[0].hash
                console.log(current + `:Saved: Private state ${IpFsHash[0].hash}`)
            } else {
                console.log({
                    cycle
                }, 'IPFS Error', err)
            }
        })
    },
    addModel: function(num, tier, dlux) {
        Private.models.push([num, tier, dlux])
        Utils.save()
    },
    deleteModel: function(num, tier, dlux) {
        for (var i = 0; i < Private.models.length; i++) {
            if (Private.models[i] == [num, tier, dlux]) {
                Private.models.splice(i, 1);
                break;
            }
        }
        Utils.save()
    },
    addContent: function(content) {
        Private.content[content.self] = content
        Utils.save()
    },
    deleteContent: function(content) {
        delete Private.content[content]
        Utils.save()
    },
    setContentLevel: function(content, level) {
        try {
            if (level == 0 && Private.content[content].level > 0) {
                Private.content[content].body = steemClient.memo.decode(config.memoKey, Private.content[content].body)
            } else if (level > 0 && Private.content[content].level == 0) {
                Private.content[content].body = steemClient.memo.encode(config.memoKey, Private.pubKeys[config.username], Private.content[content].body)
            }
            Private.content[content].level = level
            Utils.save()
        } catch (e) {
            console.log(e)
        }
    },
    ban: function(name) {
        if (Private.banned.indexOf(name) == -1) {
            Private.banned.push(name)
            var i = Utils.accessLevel(name)
            if (i >= 0) {
                Private.tier[i].splice(Private.tier[i].indexOf(name), 1)
            }
            Utils.save()
        }
    },
    unban: function(name) {
        var i = Private.banned.indexOf(name)
        if (i >= 0) {
            Private.banned.splice(i, 1)
        }
        Utils.save()
    },
    getContent: function(content, name) {
        return new Promise((resolve, reject) => {
            var error = ''
            var json = ''
            var result = {}
            var accessLevel = Utils.accessLevel(name)
            if (accessLevel >= 0) {
                try {
                    json = Private.content[content]
                } catch (e) {
                    error += ' 404: Content not found'
                }
                if (json && json.level <= accessLevel) {
                    result.level = json.level
                    result.title = json.title
                    result.body = Utils.unsealer(json.body)
                } else {
                    error += ` @${name} doesn't have access?`
                }
            } else {
                error += ` @${name} doesn't have access`
            }
            if (error) {
                result.title = error
            }
            resolve(result)
        })
    },
    getAllContent: function(name) {
        return new Promise((resolve, reject) => {
            if (!Private.pubKeys[name]) {
                Utils.sealer(null, name).then(meh => {
                    let al = Utils.accessLevel(name)
                    var value = Private
                    for (var item in value.content) {
                        if (value.content[item].level > al) {
                            delete value.content[item]
                        } else if (value.content[item].level > 0) {
                            value.content[item].body = steemClient.memo.decode(config.memoKey, value.content[item].body)
                        }
                        value.content[item].body = steemClient.memo.encode(config.memoKey, Private.pubKeys[name], value.content[item].body)
                    }
                    resolve(value.content)
                });
            } else {
                let al = Utils.accessLevel(name)
                var value = {}
                for (var item in Private.content) {
                    if (Private.content[item].level > al) {} else if (Private.content[item].level > 0) {
                        value[item] = {
                            body: steemClient.memo.decode(config.memoKey, (Private.content[item].body)),
                            title: Private.content[item].title,
                            level: Private.content[item].level,
                            self: Private.content[item].self
                        }
                    } else {
                        value[item] = {
                            body: Private.content[item].body,
                            title: Private.content[item].title,
                            level: Private.content[item].level,
                            self: Private.content[item].self
                        }
                    }
                    value[item].body = steemClient.memo.encode(config.memoKey, Private.pubKeys[name], value[item].body)
                }
                resolve(value)
            }
        })
    },
    cleaner: function(num) {
        for (var i = 0; i < Private.tier.length; i++) {
            for (var j = 0; j < Private.tier[i].length; j++) {
                if (Private.tier[i][j][0] <= num) {
                    Private.tier[i].splice(j, 1)
                }
            }
        }
    },
    assignLevel: function(name, level, until) {
        var error = '',
            current = ''
        if (level < Private.tier.length) {
            try {
                current = Utils.accessLevel(name)
            } catch (e) {
                if (e) {
                    error = 'Not Found'
                }
            }
            if (current) {
                for (var i = 0; i < Private.tier[current].length; i++) {
                    if (Private.tier[current][i][0] == name) {
                        Private.tier[current][i].splice(i, 1);
                        break;
                    }
                }
            }
            if (Private.banned.indexOf(name) == -1) {
                Private.tier[level].push([name, until])
                Utils.save()
            }
        }
    },
    addAccessLevel: function() {
        Private.tier.push([]);
        Utils.save();
    },
    removeAccesLevel: function(tier) {
        tier -= 1
        if (Private.tier[tier].length > 0) {
            for (var i = 0; i < Private.tier[tier].length; i++) {
                if (tier == 0) {
                    Private.tier[tier + 1].push(Private.tier[tier][i])
                } else {
                    Private.tier[tier - 1].push(Private.tier[tier][i])
                }
            }
        }
        if (tier >= 0) {
            Private.tier.splice(tier, 1)
            Utils.save();
        }
    },
    accessLevel: function(name) {
        var level = 0
        for (var i = 0; i < Private.tier.length; i++) {
            for (var j = 0; j < Private.tier[i].length; j++) {
                if (Private.tier[i][j] == name) {
                    level = i + 1;
                    break;
                }
            }
        }
        return level
    },
    upKey: function(name, key) {
        if (Private.pubKeys[name]) {
            Private.pubKeys[name] = key
        }
    },
    sealer: function(md, to) {
        return new Promise((resolve, reject) => {
            if (!Private.pubKeys[to]) {
                steemClient.api.getAccounts([to], (err, result) => {
                    if (err) {
                        console.log(err)
                        reject()
                    }
                    if (result.length === 0) {
                        reject()
                        console.log('No Such User')
                    }
                    Private.pubKeys[to] = result[0].memo_key
                    var encrypted = steemClient.memo.encode(config.memoKey, Private.pubKeys[to], `#` + md);
                    resolve(encrypted)
                });
            } else {
                var encrypted = steemClient.memo.encode(config.memoKey, Private.pubKeys[to], `#` + md);
                resolve(encrypted)
            }
        });
    },
    unsealer: function(enc) {
        var decoded = steemClient.memo.decode(config.memoKey, enc)
        return decoded
    }
}
