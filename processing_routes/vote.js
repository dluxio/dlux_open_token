const { store, config, NodeOps } = require("./../index");
const { getPathNum } = require('./../getPathNum')
const { getPathObj } = require('./../getPathObj')

exports.vote = (json, pc) => {
    if (json.voter == config.leader) {
        store.get(['escrow', json.voter], function(e, a) {
            if (!e) {
                var found = 0;
                for (b in a) {
                    console.log(a, b, json);
                    if (a[b][1].permlink == json.permlink && a[b][1].author == json.author) {
                        found++;
                        let ops = [{ type: 'del', path: ['escrow', json.voter, b] }];
                        store.batch(ops, pc);
                        try {
                            if (json.voter == config.username) {
                                delete plasma.pending[b];
                                for (var i = 0; i < NodeOps.length; i++) {
                                    if (NodeOps[i][1][1].author == json.author && NodeOps[i][1][1].permlink == json.permlink && NodeOps[i][1][0] == 'vote') {
                                        NodeOps.splice(i, 1);
                                    }
                                }
                            }
                        } catch (e) { console.log(e); }
                        break;
                    } else {
                        pc[0](pc[2]);
                    }
                }
                if (!found) {
                    pc[0](pc[2]);
                }
            } else {
                pc[0](pc[2]);
            }
        });
    } else {
        pc[0](pc[2]);
    }
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