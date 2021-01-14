const config = require('./../config')
const { store } = require("./../index");
const { getPathNum } = require('./../getPathNum')
const { getPathObj } = require('./../getPathObj')

exports.vote = (json, pc) => {
    getPathObj(['posts', `${json.author}/${json.permlink}`]).then(p => {
        if (Object.keys(p).length) {
            if (!Object.hasOwnProperty('votes')) {
                p.votes = {}
            }
            var PvotePow = getPathObj(['up', json.voter]),
                PdVotePow = getPathObj(['down', json.voter])
            PPow = getPathNum(['pow', json.voter])
            Promise.all([PvotePow, PdVotePow, PPow]).then(function(v) {
                    var up = v[0],
                        down = v[1],
                        pow = v[2],
                        ops = [],
                        weights
                    if (!pow) {
                        pc[0](pc[2])
                    } else {
                        if (json.weight >= 0) {
                            weights = upPowerMagic(up, json)
                        } else {
                            weights = downPowerMagic(up, down, json)
                            ops.push({ type: 'put', path: ['down', json.voter], data: weights.down })
                        }
                        p.votes[json.voter] = {
                            b: json.block_num,
                            v: weights.vote
                        }
                        ops.push({ type: 'put', path: ['up', json.voter], data: weights.dowupn })
                        ops.push({ type: 'put', path: ['posts', json.author, json.permlink], data: p })
                        store.batch(ops, pc)
                    }
                })
                .catch(e => console.log(e))
        } else {
            pc[0](pc[2])
        }
    })
}

exports.vote_content = (json, from, active, pc) => {
    var powPromise = getPathNum(['pow', from]),
        postPromise = getPathObj(['posts', `${json.author}/${json.permlink}`]),
        rollingPromise = getPathNum(['rolling', from]),
        nftPromise = getPathNum(['pow', 'n', from]); //an approach to token delegation by wrapping power in nft contracts - untested
    Promise.all([powPromise, postPromise, rollingPromise, nftPromise])
        .then(function(v) {
            var pow = v[0],
                post = v[1],
                rolling = v[2],
                nft = v[3],
                ops = [];
            if (pow >= 1) {
                if (Object.keys(post).length) {
                    console.log(post);
                    if (!post.voters) { post.voters = {}; }
                    if (!rolling) {
                        rolling = parseInt((nft + pow) * 10);
                    }
                    const w = json.weight > 0 && json.weight < 10001 ? parseInt(json.weight * rolling / 100000) : parseInt(rolling / 10);
                    post.totalWeight += parseInt(json.weight * rolling / 100000);
                    post.voters[from] = {
                        block: json.block_num,
                        weight: w
                    };
                    ops.push({ type: 'put', path: ['posts', `${json.author}/${json.permlink}`], data: post });
                    ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: `@${from}| voted for @${json.author}/${json.permlink}` });
                    rolling -= w;
                    ops.push({ type: 'put', path: ['rolling', from], data: rolling });
                } else {
                    ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: `@${from}| tried to vote for an unknown post` });
                }
            } else {
                ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: `@${from}| doesn't have the ${config.TOKEN} POWER to vote` });
            }
            store.batch(ops, pc);
        })
        .catch(function(e) {
            console.log(e);
        });
}