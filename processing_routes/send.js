const config = require('./../config')
const { store } = require("./../index");
const { getPathNum } = require("./../getPathNum");
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
            if (json.to && typeof json.to == 'string' && send > 0 && fbal >= send && active) { //balance checks
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
                if (config.hookurl) postToDiscord(msg)
                ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg });
            } else {
                ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: `@${from}| Invalid send operation` });
            }
            if (process.env.npm_lifecycle_event == 'test') pc[2] = ops
            store.batch(ops, pc);
        })
        .catch(e => { console.log(e); });
}