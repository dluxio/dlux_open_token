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
        Prpow = getPathObj(['pow'])
    Promise.all([Prunners, Pnode, Pstats, Prb, Prcol, Prpow]).then(function(v) {
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
                    rpow = v[5],
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
                    try { hash = nodes[node].report.hash } catch {}
                    try { when = nodes[node].report.block_num } catch {}
                    try { online = hash && nodes[node].escrow } catch {}
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
                for (hash in tally.agreements.hashes) {
                    if (tally.agreements.tally[tally.agreements.hashes[hash]] > (tally.agreements.votes / 3)) {
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
                            new_queue[node] = {
                                t: (rbal[node] || 0) + (rcol[node] || 0) + (rpow[node] || 0),
                                l: rbal[node] || 0,
                                c: rcol[node] || 0,
                                p: rpow[node] || 0
                            }
                        }
                    }
                    for (node in new_queue) {
                        if (runners.hasOwnProperty(node)) {
                            still_running[node] = new_queue[node]
                        } else {
                            election[node] = new_queue[node]
                        }
                    }
                    if (Object.keys(still_running).length < 25) {
                        let winner = {
                            node: '',
                            t: 0
                        }
                        for (node in election) {
                            if (election[node].t > winner.t) {
                                winner.node = node
                                winner.t = election[node].t
                            }
                        }
                        if (winner.node) {
                            still_running[winner.node] = new_queue[winner.node]
                        }
                    }
                    let MultiSigCollateral = 0
                    for (node in still_running) {
                        MultiSigCollateral += still_running[node].t
                    }
                    stats.MultiSigCollateral = MultiSigCollateral
                    stats.lastBlock = stats.hashLastIBlock;
                    if (consensus)
                        stats.hashLastIBlock = consensus;
                    for (var node in nodes) {
                        var getHash;
                        if (nodes[node].report.block_num > num - 50) {
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
                    new_queue = queue
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
                if (Object.keys(new_queue)) ops.push({ type: 'put', path: ['queue'], data: new_queue })
                store.batch(ops, [resolve, reject, newPlasma]);
                if (consensus && (consensus != plasma.hashLastIBlock || consensus != nodes[config.username].report.hash) && isStreaming) { //this doesn't seem to be catching failures
                    exit(consensus);
                    //var errors = ['failed Consensus'];
                    //const blockState = Buffer.from(JSON.stringify([num, state]))
                    //plasma.hashBlock = '';
                    //plasma.hashLastIBlock = '';
                    console.log(num + `:Abandoning ${plasma.hashLastIBlock} because ${errors[0]}`);
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