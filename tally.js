const config = require('./config');
const { getPathNum } = require("./getPathNum");
const { getPathObj } = require("./getPathObj");
const { deleteObjs } = require('./deleteObjs')
const { store, exit } = require("./index");
const { updatePost } = require('./edb');

//determine consensus... needs some work with memory management
exports.tally = (num, plasma, isStreaming) => {
    return new Promise((resolve, reject) => {
        var Prunners = getPathObj(['runners']),
            Pnode = getPathObj(['markets', 'node']),
            Pstats = getPathObj(['stats']),
            Prb = getPathObj(['balances']),
            Prcol = getPathObj(['col']),
            Prpow = getPathObj(['gov']),
            Prqueue = getPathObj(['queue']),
            Ppending = getPathObj(['pendingpayment'])
        Promise.all([Prunners, Pnode, Pstats, Prb, Prcol, Prpow, Prqueue, Ppending]).then(function(v) {
            deleteObjs([
                    ['runners'],
                    ['queue'],
                    ['pendingpayment']
                ])
                .then(empty => {
                    var runners = v[0],
                        nodes = v[1],
                        stats = v[2],
                        rbal = v[3],
                        rcol = v[4],
                        rgov = v[5],
                        pending = v[7],
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
                        stats.lastIBlock = num - 100
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
                        let last_bal = 0
                        counting_array.sort((a, b) => a - b)
                        for (i = 0; i < parseInt(counting_array.length / 2) + 1; i++) {
                            low_sum += counting_array[i]
                            last_bal = counting_array[i]
                        }
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
                            //console.log({counting_array, low_sum, last_bal, still_running})
                            stats.gov_threshhold = parseInt((low_sum - last_bal) / (Object.keys(still_running).length / 2)) 
                            if (winner.node && (winner.t > stats.gov_threshhold || Object.keys(still_running).length < 9)) { //simple test to see if the election will benifit the runners collateral totals
                                still_running[winner.node] = new_queue[winner.node]
                            }
                        } else {
                            stats.gov_threshhold = "FULL"
                        }
                        let collateral = []
                        for (node in still_running) {
                            collateral.push(still_running[node].t)
                        }
                        let MultiSigCollateral = 0
                        for (i = 0; i < collateral.length; i++) {
                            MultiSigCollateral += collateral[i]
                        }
                        stats.multiSigCollateral = MultiSigCollateral
                        stats.safetyLimit = low_sum
                        stats.hashLastIBlock = stats.lastBlock;
                        stats.lastBlock = consensus;
                        for (var node in nodes) {
                            var getHash, getNum = 0
                            try { getNum = nodes[node].report.block_num } catch (e) {}
                            if (getNum > num - 50) {
                                nodes[node].attempts++;
                            }
                            try { getHash = nodes[node].report.hash; } catch (e) {}
                            if (getHash == stats.lastBlock) {
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
                    
                    let weights = 0
                    for (post in pending) {
                        weights += pending[post].t.totalWeight
                    }
                    let inflation_floor = parseInt((stats.movingWeight.running + (weights/140)) / 2016) //minimum payout in time period
                        running_weight = parseInt(stats.movingWeight.running / 2016)
                    if (running_weight < inflation_floor){
                        running_weight = inflation_floor
                    }
                    if (num < 50700000) {
                        stats.movingWeight.dailyPool = 700000
                    }
                    let this_weight = parseInt(weights / 2016),
                        this_payout = parseInt((((rbal.rc / 200) + stats.movingWeight.dailyPool) / 304) * (this_weight / running_weight)) //subtract this from the rc account... 13300 is 70% of inflation
                        stats.movingWeight.running = parseInt(((stats.movingWeight.running * 2015) / 2016) + (weights / 2016)) //7 day average at 5 minute intervals
                    payout(this_payout, weights, pending, num)
                        .then(change => {
                            const mint = parseInt(stats.tokenSupply / stats.interestRate);
                            stats.tokenSupply += mint;
                            rbal.ra += mint;
                            let ops = [
                                { type: 'put', path: ['stats'], data: stats },
                                { type: 'put', path: ['runners'], data: still_running },
                                { type: 'put', path: ['markets', 'node'], data: nodes },
                                { type: 'put', path: ['balances', 'ra'], data: rbal.ra },
                                { type: 'put', path: ['balances', 'rc'], data: rbal.rc - (this_payout - change) }
                            ]
                            if (Object.keys(new_queue).length) ops.push({ type: 'put', path: ['queue'], data: new_queue })
                                //if (process.env.npm_lifecycle_event == 'test') newPlasma = ops
                                //console.log({ stats, still_running, nodes, new_queue })
                            store.batch(ops, [resolve, reject, newPlasma]);
                            if (process.env.npm_lifecycle_event != 'test') {
                                if (consensus && (consensus != plasma.hashLastIBlock || consensus != nodes[config.username].report.hash && nodes[config.username].report.block_num > num - 100) && isStreaming) {
                                    exit(consensus);
                                    //var errors = ['failed Consensus'];
                                    //const blockState = Buffer.from(JSON.stringify([num, state]))
                                    //plasma.hashBlock = '';
                                    //plasma.hashLastIBlock = '';
                                    console.log(num + `:Abandoning ${plasma.hashLastIBlock} because failed consensus.`);
                                }
                            }
                        })
                })
                .catch(e => { console.log(e); });
        });
    })
}

function payout(this_payout, weights, pending, num) {
    return new Promise((resolve, reject) => {
        let payments = {},
            out = 0
        for (post in pending) {
            payments[post.split('/')[0]] = 0
            for (voter in pending[post].votes) {
                payments[voter] = 0
            }
        }
        for (post in pending) {
            if (pending[post].t.totalWeight > 0) {
                const TotalPostPayout = parseInt(this_payout * (pending[post].t.totalWeight) / weights)
                pending[post].paid = TotalPostPayout
                pending[post].author_payout = parseInt(TotalPostPayout / 2)
                payments[post.split('/')[0]] += parseInt(TotalPostPayout / 2) //author reward
                out += parseInt(TotalPostPayout / 2)
                for (voter in pending[post].votes) {
                    if (pending[post].votes[voter].v > 0) {
                        const this_vote = parseInt((TotalPostPayout * pending[post].votes[voter].w) / (pending[post].t.linearWeight * 2))
                        pending[post].votes[voter].p = this_vote
                        payments[voter] += this_vote
                        out += this_vote
                    }
                }
            }
        }
        let promises = []
        for (account in payments) {
            promises.push(getPathNum(['balances', account]))
        }
        Promise.all(promises).then(p => {
            if (p.length) {
                let i = 0,
                    ops = [{ type: 'put', path: ['paid', num.toString()], data: pending }]
                    if(config.dbcs){
                        for (i in pending){
                            updatePost(pending[i])
                        }
                    }
                for (account in payments) {
                    ops.push({ type: 'put', path: ['balances', account], data: p[i] + payments[account] })
                    i++
                }
                let change = this_payout - out
                store.batch(ops, [resolve, reject, change]) //return the paid ammount so millitokens aren't lost
            } else {
                resolve(this_payout)
            }
        })
    })
}

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