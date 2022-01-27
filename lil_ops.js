const { store } = require('./index')
const { getPathObj, getPathNum } = require('./getPathObj')
const crypto = require('crypto');
const bs58 = require('bs58');
const hashFunction = Buffer.from('12', 'hex');
const stringify = require('json-stable-stringify');
const { postToDiscord } = require('./discord');
const config = require('./config');

const burn = (amount) => {
    return new Promise((resolve, reject) => {
        getPathNum(['stats', 'tokenSupply'])
        .then(sup => {
            store.batch([{ type: 'put', path: ['stats', 'tokenSupply'], data: sup - amount }], [resolve, reject, 1])
        })
    })
}
exports.burn = burn
const forceCancel = (rate, type, block_num) => {
    return new Promise((resolve, reject) => {
        const price = parseFloat(rate)
        let Ps = getPathObj(['dex', type, 'sellOrders'])
        let Pb = getPathObj(['dex', type, 'buyOrders'])
        Promise.all([Ps, Pb])
            .then(s => {
                let gone = 0
                for (o in s[0]) {
                    if (parseFloat(o.split(":")[0]) < (price * .6)) {
                        gone++
                        release(o.from, o.split(":")[1], block_num)
                    } else if (parseFloat(o.split(":")[0]) > (price * 1.4)) {
                        gone++
                        release(o.from, o.split(":")[1], block_num)
                    }
                }
                for (o in s[1]) {
                    if (parseFloat(o.split(":")[0]) < (price * .6)) {
                        gone++
                        release(o.from, o.split(":")[1], block_num)
                    } else if (parseFloat(o.split(":")[0]) > (price * 1.4)) {
                        gone++
                        release(o.from, o.split(":")[1], block_num)
                    }
                }
                resolve(gone)
            })
            .catch(e => { reject(e) })
    })
}
exports.forceCancel = forceCancel

const add = (node, amount) => {
    return new Promise((resolve, reject) => {
        store.get(['balances', node], function(e, a) {
            if (!e) {
                console.log(amount + ' to ' + node)
                const a2 = typeof a != 'number' ? amount : a + amount
                console.log('final balance ' +a2)
                store.batch([{ type: 'put', path: ['balances', node], data: a2 }], [resolve, reject, 1])
            } else {
                console.log(e)
            }
        })
    })
}
exports.add = add

const addc = (node, amount) => {
    return new Promise((resolve, reject) => {
        store.get(['cbalances', node], function(e, a) {
            if (!e) {
                console.log(amount + ' to ' + node)
                const a2 = typeof a != 'number' ? amount : a + amount
                console.log('final balance ' +a2)
                store.batch([{ type: 'put', path: ['cbalances', node], data: a2 }], [resolve, reject, 1])
            } else {
                console.log(e)
            }
        })
    })
}
exports.addc = addc

const addMT = (path, amount) => {
    return new Promise((resolve, reject) => {
        store.get(path, function(e, a) {
            if (!e) {
                const a2 = typeof a != 'number' ? parseInt(amount) : parseInt(a) + parseInt(amount)
                console.log(`MTo:${a},add:${amount},final:${a2}`, )
                store.batch([{ type: 'put', path, data: a2 }], [resolve, reject, 1])
            } else {
                console.log(e)
            }
        })
    })
}
exports.addMT = addMT

const addCol = (node, amount) => {
    return new Promise((resolve, reject) => {
        store.get(['col', node], function(e, a) {
            if (!e) {
                const a2 = typeof a != 'number' ? amount : a + amount
                console.log({ node, a })
                store.batch([{ type: 'put', path: ['col', node], data: a2 }], [resolve, reject, 1])
            } else {
                console.log(e)
            }
        })
    })
}
exports.addCol = addCol

const addGov = (node, amount) => {
    return new Promise((resolve, reject) => {
        store.get(['gov', node], function(e, a) {
            if (!e) {
                const a2 = typeof a != 'number' ? amount : a + amount
                console.log({ node, a })
                store.batch([{ type: 'put', path: ['gov', node], data: a2 }], [resolve, reject, 1])
            } else {
                console.log(e)
            }
        })
    })
}
exports.addGov = addGov

const deletePointer = (escrowID, user) => {
    return new Promise((resolve, reject) => {
        const escrow_id = typeof escrowID == 'string' ? escrowID : escrowID.toString()
        store.get(['escrow', escrow_id], function(e, a) {
            if (!e) {
                var found = false
                const users = Object.keys(a)
                for (i = 0; i < users.length; i++) {
                    if (user = users[i]) {
                        found = true
                        break
                    }
                }
                if (found && users.length == 1) {
                    store.batch([{ type: 'del', path: ['escrow', escrow_id] }], [resolve, reject, users.length])
                } else if (found) {
                    store.batch([{ type: 'del', path: ['escrow', escrow_id, user] }], [resolve, reject, users.length])
                }
            }
        })
    })
}
exports.deletePointer = deletePointer

const credit = (node) => {
    return new Promise((resolve, reject) => {
        getPathNum(['markets', 'node', node, 'wins'])
            .then(a => {
                store.batch([{ type: 'put', path: ['markets', 'node', node, 'wins'], data: a++ }], [resolve, reject, 1])
            })
            .catch(e => {
                reject(e)
            })
    })
}
exports.credit = credit


const nodeUpdate = (node, op, val) => {
    return new Promise((resolve, reject) => {
        store.get(['markets', 'node', node], function(e, a) {
            if (!e) {
                if (!a.strikes)
                    a.strikes = 0
                if (!a.burned)
                    a.burned = 0
                if (!a.moved)
                    a.moved = 0
                switch (op) {
                    case 'strike':
                        a.strikes++
                            a.burned += val
                        break
                    case 'ops':
                        a.escrows++
                            a.moved += val
                        break
                    default:
                }
                store.batch([{ type: 'put', path: ['markets', 'node', node], data: a }], [resolve, reject, 1])
            } else {
                console.log(e)
                resolve()
            }
        })
    })
}
exports.nodeUpdate = nodeUpdate

const penalty = (node, amount) => {
    console.log('penalty: ', { node, amount })
    return new Promise((resolve, reject) => {
        pts = getPathNum(['gov', node])
        Promise.all([pts]).then(r => {
            var a2 = r[1]
            newBal = a2 - amount
            if (newBal < 0) { newBal = 0 }
            const forfiet = a2 - newBal
            var ops = [{ type: 'put', path: ['gov', node], data: newBal }]
            nodeUpdate(node, 'strike', amount)
                .then(empty => {
                    store.batch(ops, [resolve, reject, forfiet])
                })
                .catch(e => { reject(e) })
        }).catch(e => {
            reject(e)
        })
    })
}
exports.penalty = penalty

const chronAssign = (block, op) => {
    return new Promise((resolve, reject) => {
        const t = block + ':' + hashThis(stringify(op))
        store.batch([{ type: 'put', path: ['chrono', t], data: op }], [resolve, reject, t])
    })
}
exports.chronAssign = chronAssign

function hashThis(data) {
    const digest = crypto.createHash('sha256').update(data).digest()
    const digestSize = Buffer.from(digest.byteLength.toString(16), 'hex')
    const combined = Buffer.concat([hashFunction, digestSize, digest])
    const multihash = bs58.encode(combined)
    return multihash.toString()
}
exports.hashThis = hashThis

function isEmpty(obj) {
    for (var key in obj) {
        if (obj.hasOwnProperty(key)) return false;
    }
    return true
}
exports.isEmpty = isEmpty;