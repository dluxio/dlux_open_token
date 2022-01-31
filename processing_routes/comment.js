const config = require('./../config')
const { store } = require('./../index')
const { chronAssign } = require('./../lil_ops')
const { getPathObj } = require('../getPathObj')
const { contentToDiscord } = require('./../discord')
const { insertNewPost } = require('./../edb');

exports.comment = (json, pc) => {
    let meta = {}
    try { meta = JSON.parse(json.json_metadata) } catch (e) {}
    let community_post = false
    if (json.author == config.leader && parseInt(json.permlink.split(config.tag)[1]) > json.block_num - 31000) {
        //console.log('leader post')
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
    } else if (config.features.pob && meta.arHash || meta.vrHash || meta.appHash || meta.audHash) {
        Ppost = getPathObj(['posts', `${json.author}/${json.permlink}`])
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
                            block_num: json.block_num,
                            op: 'del_pend'
                        }
                    })
                } else {
                    post.meta = meta
                    ops.push({
                        type: 'put',
                        path: ['posts', `${json.author}/${json.permlink}`],
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
    //console.log(json)
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
                    var assigns = []
                    assigns.push(chronAssign(json.block_num + 201600, {
                        block: parseInt(json.block_num + 201600),
                        op: 'post_reward',
                        author: json.author,
                        permlink: json.permlink
                    }))
                    assigns.push(chronAssign(parseInt(json.block_num + 20000), {
                        block: parseInt(json.block_num + 20000),
                        op: 'post_vote',
                        author: json.author,
                        permlink: json.permlink
                    }))
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
                    if(config.dbcs){
                                insertNewPost({
                            block: json.block_num,
                            author: json.author,
                            permlink: json.permlink
                        })
                    }
                    var pins = {}
                    for (i in a.meta.assets) {
                            if (a.meta.assets[i].pin) {
                                pins[a.meta.assets[i].hash] = { 
                                    h: a.meta.assets[i].hash, //hash
                                    b: 0, //bytes
                                    v: 0  //verifies
                                }
                            }
                            if (a.meta.assets[i].pin && a.meta.assets[i].thumbHash && a.meta.assets[i].thumbHash != a.meta.assets[i].hash){
                                pins[a.meta.assets[i].thumbHash] = { 
                                    h: a.meta.assets[i].thumbHash, //hash
                                    b: 0, //bytes
                                    v: 0  //verifies
                                }
                            }
                    }
                    if(Object.keys(pins).length)ops.push({ type: 'put', path: ['ipfs', 'unbundled', `${json.author}:${json.permlink}`], data: pins })
                    if(config.pintoken){
                        //ipfsVerify(`${json.author}:${json.permlink}`, pins)
                    }
                    /*
                    if (config.pintoken) {
                        var pins = []
                        for (i in a.meta.assets) {
                            if (a.meta.assets[i].pin) pins.push({ hash: a.meta.assets[i].hash })
                            if (a.meta.assets[i].pin && a.meta.assets[i].thumbHash && a.meta.assets[i].thumbHash != a.meta.assets[i].hash) pins.push({ hash: a.meta.assets[i].hash })
                        }
                        if (pins.length) {
                            var options = {
                                'method': 'POST',
                                'url': config.pinurl,
                                'headers': {
                                    'Content-Type': 'application/json'
                                },
                                formData: {
                                    'items': JSON.stringify(pins),
                                    'secret': config.pintoken,
                                    'by': json.author,
                                    'block': json.block_num.toString()
                                }
                            };
                            request(options, function(error, response) {
                                if (error) throw new Error(error);
                                console.log(response.body);
                            });
                        }
                    }
                    */
                    /*
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
                    */
                    ops.push({ type: 'del', path: ['pend', `${json.author}/${json.permlink}`] })
                    ops.push({ type: 'del', path: ['chrono', `${a.block_num + 28800}:pend:${json.author}/${json.permlink}`] })
                    const msg = `@${json.author}|${json.permlink} added to ${config.TOKEN} rewardable content`
                    if (config.hookurl) contentToDiscord(json.author, json.permlink)
                    ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg })
                    if (process.env.npm_lifecycle_event == 'test') pc[2] = ops
                    Promise.all(assigns)
                    .then(v=>{
                        store.batch(ops, pc)
                    })
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