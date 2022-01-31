const config = require('./../config')
const { store } = require("./../index");
const { getPathNum } = require("./../getPathObj");
const { postToDiscord } = require('./../discord');
const { updatePromote } = require('./../edb');

exports.send = (json, from, active, pc) => {
    let fbalp = getPathNum(['balances', from]),
        tbp = getPathNum(['balances', json.to]); //to balance promise
    Promise.all([fbalp, tbp])
        .then(bals => {
            let fbal = bals[0],
                tbal = bals[1],
                ops = [];
            send = parseInt(json.amount);
            if (json.to && typeof json.to == 'string' && send > 0 && fbal >= send && active && json.to != from) { //balance checks
                ops.push({ type: 'put', path: ['balances', from], data: parseInt(fbal - send) });
                ops.push({ type: 'put', path: ['balances', json.to], data: parseInt(tbal + send) });
                let msg = `@${from}| Sent @${json.to} ${parseFloat(parseInt(json.amount) / 1000).toFixed(3)} ${config.TOKEN}`
                if(json.to === 'null' && json.memo.split('/')[1]){
                    msg = `@${from}| Promoted @${json.memo} with ${parseFloat(parseInt(json.amount) / 1000).toFixed(3)} ${config.TOKEN}`
                    if(config.dbcs){
                        let author = json.memo.split('/')[0],
                            permlink = json.memo.split('/')[1]
                        if(author.split('@')[1]){
                            author = author.split('@')[1]
                        }
                        updatePromote(author,permlink, send)
                    }
                }
                if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg });
            } else {
                ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: `@${from}| Invalid send operation` });
            }
            if (process.env.npm_lifecycle_event == 'test') pc[2] = ops
            store.batch(ops, pc);
        })
        .catch(e => { console.log(e); });
}

exports.claim = (json, from, active, pc) => {
    let fbalp = getPathNum(['cbalances', from]),
        tbp = getPathNum(['balances', from]),
        splitp = getPathNum([json.gov ? 'gov': 'pow', from]),
        totp = getPathNum([json.gov ? 'gov': 'pow', 't']);
        claimp = getPathNum(['claim', from]);
    Promise.all([fbalp, tbp, splitp, totp, claimp])
        .then(bals => {
            let fbal = bals[0],
                tbal = bals[1],
                split = bals[2],
                tot = bals[3],
                claims = bals[4],
                ops = [],
                claim = parseInt(fbal);
            if (claim > 0) {
                const half = parseInt(claim / 2),
                    other = claim - half,
                    msg = `@${from}| Claimed ${parseFloat(parseInt(claim) / 1000).toFixed(3)} ${config.TOKEN} - Half ${json.gov ? 'locked in gov': 'powered up.'}`
                ops.push({ type: 'del', path: ['cbalances', from] });
                ops.push({ type: 'put', path: ['balances', from], data: parseInt(tbal + half) });
                ops.push({ type: 'put', path: [json.gov ? 'gov': 'pow', from], data: parseInt(split + other) });
                ops.push({ type: 'put', path: [json.gov ? 'gov': 'pow', 't'], data: parseInt(tot + other) });
                if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg });
            } else {
                ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: `@${from}| Invalid claim operation` });
            }
            if (process.env.npm_lifecycle_event == 'test') pc[2] = ops
            store.batch(ops, pc);
        })
        .catch(e => { console.log(e); });
}