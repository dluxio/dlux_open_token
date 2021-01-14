const config = require('./config');
const { getPathNum } = require("./getPathNum");
const { getPathObj } = require("./getPathObj");
const { deleteObjs } = require('./deleteObjs')
const { store, exit } = require("./index");

//determine consensus... needs some work with memory management
exports.tally = (num, plasma, isStreaming) => new Promise((resolve, reject) => {
    var Prunners = getPathObj(['runners']),
        Pnode = getPathObj(['markets', 'node']),
        Pstats = getPathObj(['stats']),
        Prb = getPathObj(['balances']),
        Prcol = getPathObj(['col']),
        Prpow = getPathObj(['gov']),
        Prqueue = getPathObj(['queue'])
    Promise.all([Prunners, Pnode, Pstats, Prb, Prcol, Prpow, Prqueue]).then(function(v) {
        deleteObjs([
                ['runners'],
                ['queue']
            ])
            .then(empty => {
                var runners = v[0],
                    nodes = v[1],
                    stats = v[2],
                    rbal = v[3],
                    rcol = v[4],
                    rgov = v[5],
                    queue = {},
                    tally = {
                        agreements: {
                            hashes: {},
                            runners: {},
                            tally: {},
                            votes: 0
                        }
                    },
                    consensus = undefined
                for (node in nodes) {
                    var hash = '',
                        when = 0,
                        online = 0
                    try { hash = nodes[node].report.hash } catch (e) { console.log({ node }) }
                    try { when = nodes[node].report.block_num } catch { console.log({ node }) }
                    try { online = hash && nodes[node].escrow } catch { console.log({ node }) }
                    if (when > (num - 50) && hash && online) {
                        tally.agreements.hashes[node] = hash
                        tally.agreements.tally[hash] = 0
                    } //recent and signing
                }
                for (runner in runners) {
                    tally.agreements.votes++
                        if (tally.agreements.hashes[runner]) {
                            tally.agreements.tally[tally.agreements.hashes[runner]]++
                        }
                }
                let threshhold = tally.agreements.votes
                if (Object.keys(runners).length > threshhold) threshhold = Object.keys(runners).length
                for (hash in tally.agreements.hashes) {
                    if (tally.agreements.tally[tally.agreements.hashes[hash]] > (threshhold / 2)) {
                        consensus = tally.agreements.hashes[hash]
                        break;
                    }
                }
                let still_running = {}
                let election = {}
                let new_queue = {}
                console.log('Consensus: ' + consensus)
                if (consensus) {
                    stats.hashLastIBlock = consensus;
                    for (node in tally.agreements.hashes) {
                        if (tally.agreements.hashes[node] == consensus) {
                            if (num < 50500000) {
                                new_queue[node] = {
                                    t: (rbal[node] || 0) + (rcol[node] || 0) + (rgov[node] || 0),
                                    l: rbal[node] || 0,
                                    c: rcol[node] || 0,
                                    g: rgov[node] || 0
                                }
                            } else {
                                new_queue[node] = {
                                    t: (rcol[node] || 0) + (rgov[node] || 0),
                                    l: rbal[node] || 0,
                                    c: rcol[node] || 0,
                                    g: rgov[node] || 0
                                }
                            }
                        }
                    }
                    let counting_array = []
                    for (node in new_queue) {
                        if (runners.hasOwnProperty(node)) {
                            still_running[node] = new_queue[node]
                            counting_array.push(new_queue[node].t)
                        } else {
                            election[node] = new_queue[node]
                        }
                    }
                    //concerns, size of multi-sig transactions
                    //minimum to outweight large initial stake holders
                    //adjust size of runners group based on stake
                    let low_sum = 0
                    let next = 0,
                        next_bal = 0,
                        last_bal = 0
                    counting_array.sort((a, b) => a - b)
                    for (i = 0; i < parseInt(counting_array.length / 2) + 1; i++) {
                        low_sum += counting_array[i]
                        last_bal = counting_array[i]
                        next = i + 1
                    }
                    next_bal = counting_array[next]
                    if (Object.keys(still_running).length < 25) {
                        let winner = {
                            node: '',
                            t: 0
                        }
                        for (node in election) {
                            if (election[node].t > winner.t) { //disallow 0 bals in governance
                                winner.node = node
                                winner.t = election[node].t
                            }
                        }
                        if (winner.node && (winner.t > next_bal || Object.keys(still_running).length < 7)) {
                            still_running[winner.node] = new_queue[winner.node]
                        }
                    }
                    let collateral = []
                    for (node in still_running) {
                        collateral.push(still_running[node].t)
                    }
                    collateral.sort((a, b) => a - b)
                    let MultiSigCollateral = 0
                    for (i = 0; i < collateral.length; i++) {
                        MultiSigCollateral += collateral[i]
                    }
                    stats.multiSigCollateral = MultiSigCollateral
                    stats.safetyLimit = low_sum
                    stats.lastBlock = stats.hashLastIBlock;
                    stats.hashLastIBlock = consensus;
                    for (var node in nodes) {
                        var getHash, getNum = 0
                        try { getNum = nodes[node].report.block_num } catch (e) {}
                        if (getNum > num - 50) {
                            nodes[node].attempts++;
                        }
                        try { getHash = nodes[node].report.hash; } catch (e) {}
                        if (getHash == stats.hashLastIBlock) {
                            nodes[node].yays++;
                            nodes[node].lastGood = num;
                        }
                    }
                    for (var node in still_running) {
                        nodes[node].wins++;
                    }
                } else {
                    new_queue = v[6]
                    still_running = runners
                }
                let newPlasma = {
                    consensus: consensus || 0,
                    new_queue,
                    still_running,
                    stats
                };
                const mint = parseInt(stats.tokenSupply / stats.interestRate);
                stats.tokenSupply += mint;
                rbal.ra += mint;
                let ops = [
                    { type: 'put', path: ['stats'], data: stats },
                    { type: 'put', path: ['runners'], data: still_running },
                    { type: 'put', path: ['markets', 'node'], data: nodes },
                    { type: 'put', path: ['balances', 'ra'], data: rbal.ra }
                ]
                if (Object.keys(new_queue).length) ops.push({ type: 'put', path: ['queue'], data: new_queue })
                    //if (process.env.npm_lifecycle_event == 'test') newPlasma = ops
                store.batch(ops, [resolve, reject, newPlasma]);
                if (process.env.npm_lifecycle_event != 'test') {
                    if (consensus && (consensus != plasma.hashLastIBlock || consensus != nodes[config.username].report.hash) && isStreaming) {
                        exit(consensus);
                        //var errors = ['failed Consensus'];
                        //const blockState = Buffer.from(JSON.stringify([num, state]))
                        //plasma.hashBlock = '';
                        //plasma.hashLastIBlock = '';
                        console.log(num + `:Abandoning ${plasma.hashLastIBlock} because failed consensus.`);
                    }
                }
            })
            .catch(e => { console.log(e); });
    });
})

/*
function check() { //is this needed at all? -not until doing oracle checks i think
    plasma.markets = {
        nodes: {},
        ipfss: {},
        relays: {}
    }
    let sp = getPathObj(['stats']),
        ap = getPathObj(['markets', 'node'])
    Promise.all([sp, ap])
        .then(ps => {
            let s = ps[0],
                b = ps[1]
            for (var account in b) {
                var self = b[account].self
                plasma.markets.nodes[self] = {
                    self: self,
                    agreement: false,
                }
                var domain = b[self] ? b[self].domain : 0
                if (domain && domain != config.NODEDOMAIN) {
                    var domain = b[self].domain
                    if (domain.slice(-1) == '/') {
                        domain = domain.substring(0, domain.length - 1)
                    }
                    fetch(`${domain}/stats`)
                        .then(function(response) {
                            return response.json();
                        })
                        .then(function(myJson) {
                            if (s.hashLastIBlock === myJson.stats.hashLastIBlock) {
                                plasma.markets.nodes[myJson.node].agreement = true
                            }
                        }).catch(e => {})
                }
            }
        })
        .catch(e => { console.log(e) })
    store.get(['stats'], function(e, s) {
        store.get(['markets', 'node'], function(e, a) {
            var b = a
            for (var account in b) {
                var self = b[account].self
                plasma.markets.nodes[self] = {
                    self: self,
                    agreement: false,
                }
                var domain = b[self] ? b[self].domain : 0
                if (domain && domain != config.NODEDOMAIN) {
                    var domain = b[self].domain
                    if (domain.slice(-1) == '/') {
                        domain = domain.substring(0, domain.length - 1)
                    }
                    fetch(`${domain}/stats`)
                        .then(function(response) {
                            //console.log(response)
                            return response.json();
                        })
                        .then(function(myJson) {
                            if (s.hashLastIBlock === myJson.stats.hashLastIBlock) {
                                plasma.markets.nodes[myJson.node].agreement = true
                            }
                        }).catch(e => {})
                }
            }
        })
    })
}
*/