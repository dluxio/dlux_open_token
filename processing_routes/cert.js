const config = require('../config');
const { store } = require('./../index')
    //const { postToDiscord } = require('./../discord')

exports.cert = (json, from, active, pc) => {
    var postPromise = getPathObj(['posts', `${json.author}/${json.permlink}`]);
    Promise.all([postPromise])
        .then(function(v) {
            var post = v[0];
            ops = [];
            if (post) {
                post.cert[from] = json.cert;
                ops.push({ type: 'put', path: ['posts', `${json.author}/${json.permlink}`], data: post });
                let msg = `@${from}| Signed a certificate on ${json.author}/${json.permlink}`
                ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg });
                if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                store.batch(ops, pc);
            } else {
                pc[0](pc[2]);
            }
        })
        .catch(function(e) {
            console.log(e);
        });
}