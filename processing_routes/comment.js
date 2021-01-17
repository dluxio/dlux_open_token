const config = require('./../config')
const { rtrades } = require('./../rtrades')
const { store, unshiftOp } = require('./../index')
const { deleteObjs } = require('./../deleteObjs')
const { chronAssign } = require('./../lil_ops')
const { getPathObj } = require('../getPathObj')
const { postToDiscord } = require('./../discord')

exports.comment = (json, pc) => {
    let meta = {}
    try { meta = JSON.parse(json.json_metadata) } catch (e) {}
    let community_post = false
    if (json.author == config.leader && parseInt(json.permlink.split('dlux')[1]) > json.block_num - 31000) {
        console.log('leader post')
        store.get(['escrow', json.author], function(e, a) {
            if (!e) {
                var ops = []
                for (b in a) {
                    if (a[b][1].permlink == json.permlink && b == 'comment') {
                        ops.push({ type: 'del', path: ['escrow', json.author, b] })
                    }
                }
                if (process.env.npm_lifecycle_event == 'test') pc[2] = ops
                store.batch(ops, pc)
            } else {
                console.log(e)
            }
        })
    } else if (meta.arHash || meta.vrHash || meta.appHash || meta.audHash) {
        Ppost = getPathObj(['post', `${json.author}/${json.permlink}`])
        Promise.all([Ppost])
            .then(postarray => {
                post = postarray[0]
                var ops = []
                if (!Object.keys(post).length) { //check if promoted/voted
                    //store json until a vote or promote with comment options
                    ops.push({
                        type: 'put',
                        path: ['pend', `${json.author}/${json.permlink}`],
                        data: {
                            author: json.author,
                            permlink: json.permlink,
                            block_num: json.block_num,
                            meta
                        }
                    })
                    ops.push({
                        type: 'put',
                        path: ['chrono', `${json.block_num + 28800}:pend:${json.author}/${json.permlink}`],
                        data: {
                            author: json.author,
                            permlink: json.permlink,
                            block_num: json.block_num
                        }
                    })
                } else {
                    post.meta = meta
                    ops.push({
                        type: 'put',
                        path: ['post', `${json.author}/${json.permlink}`],
                        data: post
                    })
                }
                if (process.env.npm_lifecycle_event == 'test') pc[2] = ops
                store.batch(ops, pc)
            })
            .catch(e => { console.log(e) })
            /*
                }
                

                    //tag search for -LEO Community
                    for (tag in meta.tags) {
                        if (community_post) { break; }
                        for (i = 0; i < config.community_tags.length; i++) {
                            if (tag == config.community_tags[i]) {
                                community_post = true
                                break;
                            }
                        }
                    }

                    
                if (community_post) {

                    //tag picker only -LEO Community
                    var exp_path = chronAssign(json.block_num + 201600, { op: 'post_reward', a: json.author, p: json.permlink })
                    promies.all([exp_path])
                        .then(r => {
                            const post = {
                                author: json.author,
                                permlink: json.permlink,
                                expire_path: r[0],
                                block: json.block_num
                            }
                            var ops = [{ type: 'put', path: ['posts', json.author, json.permlink], data: post }]
                            store.batch(ops, pc)
                        })
                        .catch(e => console.log(e))
            */
    } else {
        pc[0](pc[2])
    }
}

exports.comment_options = (json, pc) => {
    try {
        var filter = json.extensions[0][1].beneficiaries
    } catch (e) {
        pc[0](pc[2])
        return
    }
    var ops = []
    for (var i = 0; i < filter.length; i++) {
        if (filter[i].account == config.ben && filter[i].weight >= config.delegationWeight) {
            store.get(['pend', `${json.author}/${json.permlink}`], function(e, a) {
                if (e) { console.log(e) }
                if (Object.keys(a).length) {
                    chronAssign(json.block_num + 201600, {
                        block: parseInt(json.block_num + 201600),
                        op: 'post_reward',
                        author: json.author,
                        permlink: json.permlink
                    })
                    ops.push({
                        type: 'put',
                        path: ['posts', `${json.author}/${json.permlink}`],
                        data: {
                            block: json.block_num,
                            author: json.author,
                            permlink: json.permlink,
                            customJSON: a.meta
                        }
                    })
                    if (config.username == config.leader) {
                        var bytes = rtrades.checkNpin(a.meta.assets)
                        bytes.then(function(value) {
                            var op = ["custom_json", {
                                required_auths: [config.username],
                                required_posting_auths: [],
                                id: `${config.prefix}cjv`,
                                json: JSON.stringify({
                                    a: json.author,
                                    p: json.permlink,
                                    b: value //amount of bytes posted
                                })
                            }]
                            unshiftOp([
                                [0, 0], op
                            ])
                        })
                    }
                    ops.push({ type: 'del', path: ['pend', `${json.author}/${json.permlink}`] })
                    ops.push({ type: 'del', path: ['chrono', `${a.block_num + 28800}:pend:${json.author}/${json.permlink}`] })
                    const msg = `@${json.author}|${json.permlink} added to ${config.TOKEN} rewardable content`
                    if (config.hookurl) postToDiscord(msg) //embed discord
                    ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg })
                    if (process.env.npm_lifecycle_event == 'test') pc[2] = ops
                    store.batch(ops, pc)
                } else {
                    ops.push({ type: 'del', path: ['pend', `${json.author}/${json.permlink}`] })
                    ops.push({ type: 'del', path: ['chrono', `${a.block_num + 28800}:pend:${json.author}/${json.permlink}`] })
                    if (process.env.npm_lifecycle_event == 'test') pc[2] = ops
                    store.batch(ops, pc)
                }
            })
        } else {
            pc[0](pc[2])
        }
    }
}

/*
processor.onOperation('comment', function(json, pc) { //grab posts to reward
        let meta = JSON.parse(json.json_metadata)
        let community_post = false
        //store meta data, promote post if comment options with bens, demote if vote.
        if (meta.arHash || meta.vrHash || meta.appHash || meta.audHash){
            
        }

        /* //tag search for -LEO Community
        for (tag in meta.tags) {
            if (community_post) { break; }
            for (i = 0; i < config.community_tags.length; i++) {
                if (tag == config.community_tags[i]) {
                    community_post = true
                    break;
                }
            }
        }
if (community_post) {

 //tag picker only -LEO Community
    var exp_path = chronAssign(json.block_num + 201600, { op: 'post_reward', a: json.author, p: json.permlink })
    promies.all([exp_path])
        .then(r => {
            const post = {
                author: json.author,
                permlink: json.permlink,
                expire_path: r[0],
                block: json.block_num
            }
            var ops = [{ type: 'put', path: ['posts', json.author, json.permlink], data: post }]
            store.batch(ops, pc)
        })
        .catch(e => console.log(e))
        
} else {
    pc[0](pc[2])
}

if (json.author == config.leader) { //clear auto-voter
    store.get(['escrow', json.author], function(e, a) {
        if (!e) {
            var ops = []
            for (b in a) {
                if (a[b][1].permlink == json.permlink && b == 'comment') {
                    ops.push({ type: 'del', path: ['escrow', json.author, b] })
                    if (json.author == config.username) {
                        for (var i = 0; i < NodeOps.length; i++) {
                            if (NodeOps[i][1][1].permlink == json.permlink && NodeOps[i][1][0] == 'comment') {
                                NodeOps.splice(i, 1)
                            }
                        }
                        delete plasma.pending[b]
                    }
                    break;
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

});
*/