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
        Prb = getPathNum(['balances', 'ra']);
    Promise.all([Prunners, Pnode, Pstats, Prb]).then(function(v) {
        deleteObjs([
                ['runners'],
                ['queue']
            ])
            .then(empty => {
                var runners = v[0],
                    nodes = v[1],
                    stats = v[2],
                    rbal = v[3],
                    queue = [],
                    tally = {
                        agreements: {
                            runners: {},
                            tally: {},
                            votes: 0
                        },
                        election: {},
                        winner: {},
                        results: []
                    };
                for (var node in runners) {
                    tally.agreements.runners[node] = nodes[node];
                    var getHash;
                    try { getHash = nodes[node].report.hash; } catch (e) {}
                    tally.agreements.tally[node] = {
                        self: node,
                        hash: getHash,
                        votes: 0
                    }; //build a dataset to count
                }
                for (var node in tally.agreements.runners) {
                    var agreements;
                    try { agreements = tally.agreements.runners[node].report.agreements; } catch (e) {}
                    for (var subnode in agreements) {
                        if (tally.agreements.tally[subnode]) {
                            if (tally.agreements.tally[subnode].hash == tally.agreements.tally[node].hash && nodes[node].report.block === num - 99) {
                                tally.agreements.tally[subnode].votes++;
                            }
                        }
                    }
                    tally.agreements.votes++;
                }
                var l = 0;
                var consensus, firstCatch, first = [];
                for (var node in runners) {
                    l++;
                    var forblock = 0;
                    try {
                        forblock = nodes[node].report.block;
                    } catch (e) {}
                    if (tally.agreements.tally[node].votes / tally.agreements.votes >= 2 / 3) {
                        consensus = tally.agreements.runners[node].report.hash;
                        if (firstCatch) {
                            firstCatch();
                            firstCatch = null;
                        }
                    } else if (l > 1) {
                        if (first.length && tally.agreements.runners[node].report.hash == tally.agreements.runners[first[0]].report.hash) {
                            first.push(node);
                            console.log(node + ' also scheduled for removal');
                        } else {
                            remove(node);
                            console.log('uh-oh:' + node + ' scored ' + tally.agreements.tally[node].votes + '/' + tally.agreements.votes);
                        }
                    } else if (l == 1) {
                        if (nodes[node].report.block === num - 99)
                            consensus = nodes[node].report.hash;
                        console.log('old-consensus catch scheduled for removal upon consensus: ' + node);
                        first = [node];
                        firstCatch = () => { for (i in first) { remove(first[i]); } };
                    }

                    function remove(node) { delete runners[node]; }
                }
                console.log('Consensus: ' + consensus);
                let newPlasma = {
                    consensus
                };
                stats.lastBlock = stats.hashLastIBlock;
                if (consensus)
                    stats.hashLastIBlock = consensus;
                for (var node in nodes) {
                    nodes[node].attempts++;
                    var getHash;
                    try { getHash = nodes[node].report.hash; } catch (e) {}
                    if (getHash == stats.hashLastIBlock) {
                        nodes[node].yays++;
                        nodes[node].lastGood = num;
                    }
                }
                if (l < 20) {
                    for (var node in nodes) {
                        tally.election[node] = nodes[node];
                    }
                    tally.results = [];
                    for (var node in runners) {
                        queue.push(node);
                        delete tally.election[node];
                    }
                    for (var node in tally.election) {
                        var getHash;
                        try { getHash = nodes[node].report.hash; } catch (e) {}
                        if (getHash !== stats.hashLastIBlock && stats.hashLastIBlock) {
                            delete tally.election[node];
                        }
                    }
                    var t = 0;
                    for (var node in tally.election) {
                        t++;
                        tally.results.push([node, parseInt(((tally.election[node].yays / tally.election[node].attempts) * tally.election[node].attempts))]);
                    }
                    if (t) {
                        tally.results.sort(function(a, b) {
                            return a[1] - b[1];
                        });
                        for (p = 0; p < tally.results.length; p++) {
                            queue.push(tally.results[p][0]);
                        }
                        tally.winner = tally.results.pop();
                        runners[tally.winner[0]] = {
                            self: nodes[tally.winner[0]].self,
                            domain: nodes[tally.winner[0]].domain
                        };
                    }
                }
                for (var node in runners) {
                    nodes[node].wins++;
                }
                const mint = parseInt(stats.tokenSupply / stats.interestRate);
                stats.tokenSupply += mint;
                rbal += mint;
                store.batch([
                    { type: 'put', path: ['stats'], data: stats },
                    { type: 'put', path: ['queue'], data: queue },
                    { type: 'put', path: ['runners'], data: runners },
                    { type: 'put', path: ['markets', 'node'], data: nodes },
                    { type: 'put', path: ['balances', 'ra'], data: rbal }
                ], [resolve, reject, newPlasma]);
                if (consensus && (consensus != plasma.hashLastIBlock || consensus != nodes[config.username].report.hash) && isStreaming) { //this doesn't seem to be catching failures
                    exit(consensus);
                    var errors = ['failed Consensus'];
                    //const blockState = Buffer.from(JSON.stringify([num, state]))
                    plasma.hashBlock = '';
                    plasma.hashLastIBlock = '';
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