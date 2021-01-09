const { store } = require("./index");
const { add, chronAssign } = require('./lil_ops')

//how to trigger cancels and expirations
exports.release = (from, txid, bn) => new Promise((resolve, reject) => {
    store.get(['contracts', from, txid], function(er, a) {
        if (er) { console.log(er); } else {
            var ops = [];
            switch (a.type) {
                case 'ss':
                    store.get(['dex', 'hive', 'sellOrders', `${a.rate}:${a.txid}`], function(e, r) {
                        if (e) { console.log(e); } else if (isEmpty(r)) { console.log('Nothing here' + a.txid); } else {
                            add(r.from, r.amount).then(empty => {
                                ops.push({ type: 'del', path: ['contracts', from, txid] });
                                ops.push({ type: 'del', path: ['chrono', a.expire_path] });
                                ops.push({ type: 'del', path: ['dex', 'hive', 'sellOrders', `${a.rate}:${a.txid}`] });
                                store.batch(ops, [resolve, reject]);
                            }).catch(e => { reject(e); });
                        }
                    });
                    break;
                case 'ds':
                    store.get(['dex', 'hbd', 'sellOrders', `${a.rate}:${a.txid}`], function(e, r) {
                        if (e) { console.log(e); } else if (isEmpty(r)) { console.log('Nothing here' + a.txid); } else {
                            add(r.from, r.amount).then(empty => {
                                ops.push({ type: 'del', path: ['contracts', from, txid] });
                                ops.push({ type: 'del', path: ['chrono', a.expire_path] });
                                ops.push({ type: 'del', path: ['dex', 'hbd', 'sellOrders', `${a.rate}:${a.txid}`] });
                                store.batch(ops, [resolve, reject]);
                            }).catch(e => { reject(e); });

                        }
                    });
                    break;
                case 'sb':
                    store.get(['dex', 'hive', 'buyOrders', `${a.rate}:${a.txid}`], function(e, r) {
                        if (e) { console.log(e); } else if (isEmpty(r)) { console.log('Nothing here' + a.txid); } else {
                            a.cancel = true;
                            chronAssign(bn + 200, { op: 'check', agent: r.reject[0], txid: r.txid + ':cancel', acc: from, id: txid })
                                .then(empty => {
                                    ops.push({ type: 'put', path: ['escrow', r.reject[0], r.txid + ':cancel'], data: r.reject[1] });
                                    ops.push({ type: 'put', path: ['contracts', from, r.txid], data: a });
                                    ops.push({ type: 'del', path: ['dex', 'hive', 'buyOrders', `${a.rate}:${a.txid}`] });
                                    store.batch(ops, [resolve, reject]);
                                }).catch(e => { reject(e); });
                        }
                    });
                    break;
                case 'db':
                    store.get(['dex', 'hbd', 'buyOrders', `${a.rate}:${a.txid}`], function(e, r) {
                        if (e) {
                            console.log(e);
                        } else if (isEmpty(r)) {
                            console.log('Nothing here' + a.txid);
                        } else {
                            a.cancel = true;
                            chronAssign(bn + 200, { op: 'check', agent: r.reject[0], txid: r.txid + ':cancel', acc: from, id: txid })
                                .then(empty => {
                                    ops.push({ type: 'put', path: ['contracts', from, r.txid], data: a });
                                    ops.push({ type: 'put', path: ['escrow', r.reject[0], r.txid + ':cancel'], data: r.reject[1] });
                                    ops.push({ type: 'del', path: ['dex', 'hbd', 'buyOrders', `${a.rate}:${a.txid}`] });
                                    store.batch(ops, [resolve, reject]);
                                }).catch(e => { reject(e); });
                        }
                    });
                    break;
                default:
                    resolve();
            }
        }
    });
})

function isEmpty(obj) {
    for (var key in obj) {
        if (obj.hasOwnProperty(key)) return false;
    }
    return true
}