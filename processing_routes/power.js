const config = require('./../config')
const { store } = require("../index");
const { getPathObj, getPathNum } = require('../getPathObj')
const { chronAssign } = require('../lil_ops')
const { postToDiscord } = require('./../discord');

exports.power_up = (json, from, active, pc) => {
    var amount = parseInt(json.amount),
        lpp = getPathNum(['balances', from]),
        tpowp = getPathNum(['pow', 't']),
        powp = getPathNum(['pow', from]);

    Promise.all([lpp, tpowp, powp])
        .then(bals => {
            let lb = bals[0],
                tpow = bals[1],
                pow = bals[2],
                lbal = typeof lb != 'number' ? 0 : lb,
                pbal = typeof pow != 'number' ? 0 : pow,
                ops = [];
            if (amount <= lbal && active) {
                ops.push({ type: 'put', path: ['balances', from], data: lbal - amount });
                ops.push({ type: 'put', path: ['pow', from], data: pbal + amount });
                ops.push({ type: 'put', path: ['pow', 't'], data: tpow + amount });
                const msg = `@${from}| Powered up ${parseFloat(json.amount / 1000).toFixed(3)} ${config.TOKEN}`
                if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg });
            } else {
                ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: `@${from}| Invalid power up` });
            }
            store.batch(ops, pc);
        })
        .catch(e => { console.log(e); });

}

exports.power_grant = (json, from, active, pc) => {
    var amount = parseInt(json.amount),
        to = json.to,
        Pgranting_from_total = getPathNum(['granting', from, 't']),
        Pgranting_to_from = getPathNum(['granting', from, to]),
        Pgranted_to_from = getPathNum(['granted', to, from]),
        Pgranted_to_total = getPathNum(['granted', to, 't']),
        Ppower = getPathNum(['pow', from]),
        Pup_from = getPathObj(['up', from]),
        Pdown_from = getPathObj(['down', from]),
        Pup_to = getPathObj(['up', to]),
        Pdown_to = getPathObj(['down', to])
    Promise.all([
            Ppower,
            Pgranted_to_from,
            Pgranted_to_total,
            Pgranting_to_from,
            Pgranting_from_total,
            Pup_from,
            Pup_to,
            Pdown_from,
            Pdown_to
        ])
        .then(mem => {
            let from_power = mem[0],
                granted_to_from = mem[1],
                granted_to_total = mem[2],
                granting_to_from = mem[3],
                granting_from_total = mem[4],
                up_from = mem[5],
                up_to = mem[6],
                down_from = mem[7],
                down_to = mem[8],
                ops = [];
            if (amount < from_power && amount >= 0 && active) {
                if (amount > granted_to_from) {
                    let more = amount - granted_to_from
                    if (up_from.max) {
                        up_from.max -= more
                    }
                    if (down_from.max) {
                        down_from.max -= more
                    }
                    if (up_to.max) {
                        up_to.max += more
                    }
                    if (down_to.max) {
                        down_to.max += more
                    }
                    ops.push({ type: 'put', path: ['granting', from, 't'], data: granting_from_total + more });
                    ops.push({ type: 'put', path: ['granting', from, to], data: granting_to_from + more });
                    ops.push({ type: 'put', path: ['granted', to, from], data: granted_to_from + more });
                    ops.push({ type: 'put', path: ['granted', to, 't'], data: granted_to_total + more });
                    ops.push({ type: 'put', path: ['pow', from], data: from_power - more }); //weeks wait? chron ops? no because of the power growth at vote
                    ops.push({ type: 'put', path: ['up', from], data: up_from });
                    ops.push({ type: 'put', path: ['down', from], data: down_from });
                    ops.push({ type: 'put', path: ['up', to], data: up_to });
                    ops.push({ type: 'put', path: ['down', to], data: down_to });
                    const msg = `@${from}| Has granted ${parseFloat(amount/1000).toFixed(3)} to ${to}`
                    if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                    ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg });
                } else if (amount < granted_to_from) {
                    let less = granted_to_from - amount
                    if (up_from.max) {
                        up_from.max += less
                    }
                    if (down_from.max) {
                        down_from.max += less
                    }
                    if (up_to.max) {
                        up_to.max -= less
                    }
                    if (down_to.max) {
                        down_to.max -= less
                    }
                    ops.push({ type: 'put', path: ['granting', from, 't'], data: granting_from_total - less });
                    ops.push({ type: 'put', path: ['granting', from, to], data: granting_to_from - less });
                    ops.push({ type: 'put', path: ['granted', to, from], data: granted_to_from - less });
                    ops.push({ type: 'put', path: ['granted', to, 't'], data: granted_to_total - less });
                    ops.push({ type: 'put', path: ['pow', from], data: from_power + less });
                    ops.push({ type: 'put', path: ['up', from], data: up_from });
                    ops.push({ type: 'put', path: ['down', from], data: down_from });
                    ops.push({ type: 'put', path: ['up', to], data: up_to });
                    ops.push({ type: 'put', path: ['down', to], data: down_to });
                    const msg = `@${from}| Has granted ${parseFloat(amount/1000).toFixed(3)} to ${to}`
                    if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                    ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg });
                } else {
                    const msg = `@${from}| Has already granted ${parseFloat(amount/1000).toFixed(3)} to ${to}`
                    if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                    ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg });
                }
            } else {
                const msg = `@${from}| Invalid delegation`
                if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg });
            }
            store.batch(ops, pc);
        })
        .catch(e => { console.log(e); });

}

exports.power_down = (json, from, active, pc) => {
    var powp = getPathNum(['pow', from]),
        powd = getPathObj(['powd', from]);
    Promise.all([powp, powd])
        .then(o => {
            let p = typeof o[0] != 'number' ? 0 : o[0],
                downs = o[1] || {},
                ops = [],
                assigns = [],
                amount = parseInt(json.amount)
            if (typeof amount == 'number' && amount >= 0 && p >= amount && active) {
                var odd = parseInt(amount % 4),
                    weekly = parseInt(amount / 4);
                for (var i = 0; i < 4; i++) {
                    if (i == 3) {
                        weekly += odd;
                    }
                    assigns.push(chronAssign(parseInt(json.block_num + (200000 * (i + 1))), {
                        block: parseInt(json.block_num + (200000 * (i + 1))),
                        op: 'power_down',
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
                        ops.push({ type: 'put', path: ['powd', from], data: newdowns });
                        for (i in downs) {
                            ops.push({ type: 'del', path: ['chrono', i] });
                        }
                        const msg = `@${from}| Powered down ${parseFloat(amount / 1000).toFixed(3)} ${config.TOKEN}`
                        if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                        ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg });
                        store.batch(ops, pc);
                    });
            } else if (typeof amount == 'number' && amount == 0 && active) {
                for (i in downs) {
                    ops.push({ type: 'del', path: ['chrono', downs[i]] });
                }
                const msg = `@${from}| Canceled Power Down`
                if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg });
                store.batch(ops, pc);
            } else {
                const msg = `@${from}| Invalid Power Down`
                if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg });
                store.batch(ops, pc);
            }

        })
        .catch(e => { console.log(e); });

}