const { store, config, client, unshift } = require('./../index')
const { deleteObjs } = require('./../deleteObjs')
const { chronAssign } = require('./../lil_ops')
const { rtrades } = require('./../rtrades')
exports.comment = function(json, pc) { //grab posts to reward
    if (json.author == config.leader) {
        store.get(['escrow', json.author], function(e, a) {
            if (!e) {
                var ops = []
                for (b in a) {
                    if (a[b][1].permlink == json.permlink && b == 'comment') {
                        ops.push({ type: 'del', path: ['escrow', json.author, b] })
                    }
                }
                store.batch(ops, pc)
            } else {
                console.log(e)
            }
        })
    } else {
        pc[0](pc[2])
    }
}

exports.comment_options = function(json, pc) { //grab posts to reward
    try {
        var filter = json.extensions[0][1].beneficiaries
    } catch (e) {
        pc[0](pc[2])
        return;
    }
    var ops = []
    for (var i = 0; i < filter.length; i++) {
        if (filter[i].account == config.ben && filter[i].weight >= config.delegationWeight) {
            store.get(['queue'], function(e, a) {
                if (e) console.log(e)
                deleteObjs([
                        ['queue']
                    ]).then(empty => {
                        var queue = []
                        for (var numb in a) {
                            queue.push(a[numb])
                        }
                        chronAssign(json.block_num + 144000, {
                            block: parseInt(json.block_num + 144000),
                            op: 'post_reward',
                            author: json.author,
                            permlink: json.permlink
                        })
                        var assignments = [0, 0, 0, 0]
                        if (config.username == config.leader) { //pin content ... hard set here since rewards are still hard set as well
                            assignments[0] = config.username
                        }
                        if (!e) {
                            assignments[1] = queue.shift() //consensus accounts for API retrivals
                            assignments[2] = queue.shift()
                            assignments[3] = queue.shift()
                            queue.push(assignments[1])
                            queue.push(assignments[2])
                            queue.push(assignments[3])
                        }
                        ops.push({
                            type: 'put',
                            path: ['posts', `${json.author}/${json.permlink}`],
                            data: {
                                block: json.block_num,
                                author: json.author,
                                permlink: json.permlink,
                                totalWeight: 1,
                                voters: {},
                                reblogs: {},
                                credentials: {},
                                signatures: {},
                                customJSON: {
                                    assignments: [config.leader, assignments[1], assignments[2], assignments[3]]
                                },
                            }
                        })
                        ops.push({ type: 'put', path: ['queue'], data: queue })
                        ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: `@${json.author}|${json.permlink} added to ${config.TOKEN} rewardable content` })
                        store.batch(ops, pc)
                        if (assignments[0] == config.username || assignments[1] == config.username || assignments[2] == config.username || assignments[3] == config.username) {
                            client.database.call('get_content', [json.author, json.permlink])
                                .then(result => {
                                    console.log('hive content', result)
                                    var trimmed = JSON.parse(result.json_metadata),
                                        final = { a: [] }
                                    for (j in trimmed.assets) {
                                        if (trimmed.assets[j].hash.length == 46) final.a.push(trimmed.assets[j].hash) //a for assets
                                    }
                                    if (trimmed.app.length < 33) { //p for process
                                        final.p = trimmed.app
                                    }
                                    try {
                                        if (trimmed.Hash360.length == 46) { //s for surround
                                            final.s = trimmed.Hash360
                                        }
                                    } catch (e) {}
                                    if (trimmed.vrHash.length == 46) { //e for executable
                                        final.e = trimmed.vrHash
                                    }
                                    try {
                                        if (JSON.stringify(trimmed.loc).length < 1024) { //l for spactial indexing
                                            final.l = trimmed.loc
                                        }
                                    } catch (e) {}
                                    final.t = trimmed.tags
                                    final.d = result.title
                                    if (assignments[0]) { //mirror username will need rtrades login
                                        var bytes = rtrades.checkNpin(JSON.parse(result.json_metadata)
                                            .assets)
                                        bytes.then(function(value) {
                                            var op = ["custom_json", {
                                                required_auths: [config.username],
                                                required_posting_auths: [],
                                                id: `${config.prefix}cjv`, //custom json verification
                                                json: JSON.stringify({
                                                    a: json.author,
                                                    p: json.permlink,
                                                    c: final, //customJson trimmed
                                                    b: value //amount of bytes posted
                                                })
                                            }]
                                            unshift([
                                                [0, 0], op
                                            ])
                                        }).catch(e => { console.log(e) })
                                    } else {
                                        var op = ["custom_json", {
                                            required_auths: [config.username],
                                            required_posting_auths: [],
                                            id: `${config.prefix}cjv`, //custom json verification
                                            json: JSON.stringify({
                                                a: json.author,
                                                p: json.permlink,
                                                c: final
                                            })
                                        }]
                                        unshift([
                                            [0, 0], op
                                        ])
                                    }
                                }).catch(e => { console.log(e) });
                        }
                    })
                    .catch(e => { console.log(e) })
            })
        } else {
            pc[0](pc[2])
        }
    }
}