const config = require('./../config')
const { store } = require("../index");
const { getPathNum } = require("../getPathNum");
const { getPathObj } = require('../getPathObj')
const { chronAssign } = require('../lil_ops')

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
            if (amount < lbal && active) {
                ops.push({ type: 'put', path: ['balances', from], data: lbal - amount });
                ops.push({ type: 'put', path: ['pow', from], data: pbal + amount });
                ops.push({ type: 'put', path: ['pow', 't'], data: tpow + amount });
                ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: `@${from}| Powered up ${parseFloat(json.amount / 1000).toFixed(3)} ${config.TOKEN}` });
            } else {
                ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: `@${from}| Invalid power up` });
            }
            store.batch(ops, pc);
        })
        .catch(e => { console.log(e); });

}

exports.power_down = (json, from, active, pc) => {
    var amount = parseInt(json.amount),
        powp = getPathNum(['pow', from]);
    powd = getPathObj(['powd', from]);
    Promise.all([powp, powd])
        .then(o => {
            let p = typeof o[0] != 'number' ? 0 : o[0],
                downs = 0[1] || {},
                ops = [],
                assigns = [];
            if (typeof amount == 'number' && amount >= 0 && p >= amount && active) {
                var odd = parseInt(amount % 13),
                    weekly = parseInt(amount / 13);
                for (var i = 0; i < 13; i++) {
                    if (i == 12) {
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
                            newdowns[d] = a[d];
                        }

                        for (i in downs) {
                            ops.push({ type: 'del', path: ['chrono', downs[i]] });
                            ops.push({ type: 'put', path: ['powd', from, downs[i]], data: newdowns });
                        }
                        ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: `@${from}| Powered down ${parseFloat(amount / 1000).toFixed(3)} ${config.TOKEN}` });
                        store.batch(ops, pc);
                    });
            } else if (typeof amount == 'number' && amount == 0 && active) {
                for (i in downs) {
                    ops.push({ type: 'del', path: ['chrono', downs[i]] });
                }
                ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: `@${from}| Canceled Power Down` });
                store.batch(ops, pc);
            } else {
                ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: `@${from}| Invalid Power Down` });
                store.batch(ops, pc);
            }

        })
        .catch(e => { console.log(e); });

}