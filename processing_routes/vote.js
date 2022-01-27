const config = require('./../config')
const { store } = require("./../index");
const { getPathObj, getPathNum, deleteObjs } = require('./../getPathObj')
const { updatePostVotes } = require('./../edb');

exports.vote = (json, pc) => {
    if (json.voter == config.leader) {
        deleteObjs([
                ['escrow', config.leader, `vote:${json.author}/${json.permlink}`]
            ])
            .then(empty => pc[0](pc[2]))
            .catch(e => console.log(e))
    } else {
        getPathObj(['posts', `${json.author}/${json.permlink}`]).then(p => {
            if (Object.keys(p).length) {
                const oldVotes = p.votes || {}
                p.votes = oldVotes
                var PvotePow = getPathObj(['up', json.voter]),
                    PdVotePow = getPathObj(['down', json.voter]),
                    PPow = getPathNum(['pow', json.voter]),
                    PGrant = getPathNum(['granted', json.voter, 't'])
                Promise.all([PvotePow, PdVotePow, PPow, PGrant]).then(function(v) {
                        var up = v[0],
                            down = v[1],
                            pow = v[2] + v[3],
                            ops = [],
                            weights
                        if (!pow) {
                            pc[0](pc[2])
                        } else {
                            if (!Object.keys(up).length) {
                                up = {
                                    max: pow * 50,
                                    last: 0,
                                    power: pow * 50
                                }
                                down = {
                                    max: pow * 50,
                                    last: 0,
                                    power: pow * 50
                                }
                            } else {
                                up.max = pow * 50
                                down.max = pow * 50
                            }
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
                            if(config.dbcs){
                                updatePostVotes(p)
                            }
                            ops.push({ type: 'put', path: ['up', json.voter], data: weights.up })
                            ops.push({ type: 'put', path: ['posts', `${json.author}/${json.permlink}`], data: p })
                            store.batch(ops, pc)
                        }
                    })
                    .catch(e => pc[0](pc[2]))
            } else {
                pc[0](pc[2])
            }
        })
    }
}

/*
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
*/
function upPowerMagic(up, json) {
    const healTime = json.block_num - up.last //144000 blocks in 5 days
    const heal = parseInt(up.max * healTime / 144000)
    var newPower = up.power + heal
    if (newPower > up.max) {
        newPower = up.max
    }
    var vote = parseInt(newPower * json.weight / 500000) //50 from max AND 10000 from full weight
    newPower -= vote
    const newUp = {
        max: up.max,
        last: json.block_num,
        power: newPower
    }
    return { up: newUp, vote: vote }
}

function downPowerMagic(up, down, json) {
    const downHealTime = json.block_num - down.last //144000 blocks in 5 days
    const downHeal = parseInt(down.max * downHealTime / 144000)
    var newDownPower = down.power + downHeal
    if (newDownPower > down.max) {
        newDownPower = down.max
    }
    const healTime = json.block_num - up.last //144000 blocks in 5 days
    const heal = parseInt(up.max * healTime / 144000)
    var newPower = up.power + heal
    if (newPower > up.max) {
        newPower = up.max
    }
    var bigSpender = false
    var vote
    var downvote = parseInt(newDownPower * json.weight / 500000) //5 from max AND 10000 from full weight
    newDownPower -= downvote
    if (newDownPower < down.max * 0.9) { //further down power vote effect up and down power meters
        bigSpender = true
    }
    if (bigSpender) {
        vote = parseInt(newPower * json.weight / 500000) //50 from max AND 10000 from full weight
        if (vote > downVote) {
            newPower -= vote
            newDownPower -= vote
        } else {
            newPower -= downVote
            newDownPower -= downVote
        }
    }
    const newUp = {
        max: up.max,
        last: json.block_num,
        power: newPower
    }
    const newDown = {
        max: down.max,
        last: json.block_num,
        power: newDownPower
    }
    return { up: newUp, down: newDown, vote: downvote }
}