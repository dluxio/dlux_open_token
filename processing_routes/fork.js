const config = require('./../config')
const { store } = require('./../index')
const { getPathObj } = require('../getPathObj')
const { postToDiscord, contentToDiscord } = require('./../discord')

exports.fork_propose = (json, from, active, pc) => {
    var postPromise = getPathObj(['posts', `${json.a}/${json.p}`]);
    Promise.all([postPromise])
        .then(function(v) {
            var post = v[0];
            ops = [],
                auth = false;
            if (Object.keys(post).length) {
                if (from == config.leader) { //centralized pinning report
                    post.b = json.b
                    ops.push({ type: 'put', path: ['posts', `${json.a}/${json.p}`], data: post });
                    store.batch(ops, pc);
                } else {
                    pc[0](pc[2]);
                }
            } else {
                pc[0](pc[2]);
            }
        })
        .catch(function(e) {
            console.log(e);
        });
}