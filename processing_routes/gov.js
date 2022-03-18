const config = require('./../config')
const { store } = require("../index");
const { getPathObj, getPathNum } = require('../getPathObj')
const { chronAssign } = require('../lil_ops')
const { postToDiscord } = require('./../discord')

exports.gov_up = (json, from, active, pc) => {
    var amount = parseInt(json.amount),
        Pliquid = getPathNum(['balances', from]),
        Pgovt = getPathNum(['gov', 't']),
        Pgov = getPathNum(['gov', from]),
        Pnode = getPathObj(['markets', 'node', from])

    Promise.all([Pliquid, Pgovt, Pgov, Pnode])
        .then(bals => {
            let lbal = bals[0],
                govt = bals[1],
                gbal = bals[2],
                ops = [];
            if (amount <= lbal && active && bals[3].self == from) {
                ops.push({ type: 'put', path: ['balances', from], data: lbal - amount });
                ops.push({ type: 'put', path: ['gov', from], data: gbal + amount });
                ops.push({ type: 'put', path: ['gov', 't'], data: govt + amount });
                const msg = `@${from}| Locked ${parseFloat(json.amount / 1000).toFixed(3)} ${config.TOKEN} for Governance`
                if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg });
            } else {
                ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: `@${from}| Invalid gov up` });
            }
            if (process.env.npm_lifecycle_event == 'test') pc[2] = ops
            store.batch(ops, pc);
        })
        .catch(e => { console.log(e); });

}

exports.gov_down = (json, from, active, pc) => {
    var amount = parseInt(json.amount),
        Pgov = getPathNum(['gov', from]),
        Pgovd = getPathObj(['govd', from])
    Promise.all([Pgov, Pgovd, ])
        .then(o => {
            let gov = o[0],
                downs = o[1] || {}
            ops = [],
                assigns = [];
            if (typeof amount == 'number' && amount >= 0 && gov >= amount && active) {
                var odd = parseInt(amount % 4),
                    weekly = parseInt(amount / 4);
                for (var i = 0; i < 4; i++) {
                    if (i == 3) {
                        weekly += odd;
                    }
                    assigns.push(chronAssign(parseInt(json.block_num + (201600 * (i + 1))), {
                        block: parseInt(json.block_num + (201600 * (i + 1))),
                        op: 'gov_down',
                        amount: weekly,
                        by: from
                    }));
                }
                Promise.all(assigns)
                    .then(a => {
                        var newdowns = {};
                        for (d in a) {
                            newdowns[a[d]] = a[d];
                        }
                        ops.push({ type: 'put', path: ['govd', from], data: newdowns });
                        for (i in downs) {
                            ops.push({ type: 'del', path: ['chrono', downs[i]] });
                        }
                        const msg = `@${from}| Set withdrawl of ${parseFloat(amount / 1000).toFixed(3)} ${config.TOKEN} from Governance`
                        if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                        ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg });
                        if (process.env.npm_lifecycle_event == 'test') pc[2] = ops
                        store.batch(ops, pc);
                    });
            } else if (typeof amount == 'number' && amount == 0 && active) {
                for (i in downs) {
                    ops.push({ type: 'del', path: ['chrono', i] });
                }
                const msg = `@${from}| Canceled Governance withdrawl`
                ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg });
                if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                if (process.env.npm_lifecycle_event == 'test') pc[2] = ops
                store.batch(ops, pc);
            } else {
                ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: `@${from}| Invalid Governance withdrawl` });
                if (process.env.npm_lifecycle_event == 'test') pc[2] = ops
                store.batch(ops, pc);
            }

        })
        .catch(e => { console.log(e); });

}