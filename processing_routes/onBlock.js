const { store, config, VERSION, current, NodeOps, client, hiveClient, plasma } = require("./../index");
const { getPathNum } = require("./../getPathNum");
const { getPathObj } = require("./../getPathObj");
const { processor } = require('./../processor')
const { report } = require('./../report');
const { dao } = require('./../dao');
const { tally } = require('./../tally');
const { ipfsSaveState } = require('./../ipfsSaveState');
const { waitup } = require('./../waitup');

exports.onBlock = function(num, pc) {
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
                            let lbp = getPathNum(['balances', from]),
                                tpowp = getPathNum(['pow', 't']),
                                powp = getPathNum(['pow', from])
                            promises.push(powerDownOp([lbp, tpowp, powp], from, delkey, num, chrops[i].split(':')[1], b))

                            function powerDownOp(promies, from, delkey, num, id, b) {
                                return new Promise((resolve, reject) => {
                                    Promise.all(promies)
                                        .then(bals => {
                                            let lbal = bals[0],
                                                tpow = bals[1],
                                                pbal = bals[2]
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
                            promises.push(postRewardOP(b, num, chrops[i].split(':')[1], delkey))

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
                                        ops.push({ type: 'del', path: ['chrono', delKey] })
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
                report(num)
            }
            if ((num - 20000) % 30240 === 0) { //time for daily magic
                promises.push(dao(num))
            }
            if (num % 100 === 0 && processor.isStreaming()) {
                client.database.getAccounts([config.username])
                    .then(function(result) {
                        var account = result[0]

                    });
            }
            if (num % 100 === 0) {
                promises.push(tally(num));
            }
            if (num % 100 === 1) {
                store.get([], function(err, obj) {
                    const blockState = Buffer.from(stringify([num, obj]))
                    ipfsSaveState(num, blockState)
                        .then(hash_block = {

                        })
                        .catch(e => { console.log(e) })
                })
            }
            if (promises.length) {
                waitup(promises, pc, [resolve, reject])
            } else {
                resolve(pc)
            }
            //rest is out of consensus
            /*
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
            //*
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
}