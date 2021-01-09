const { store } = require('./index')
const { getPathNum } = require('./getPathNum')
const { getPathObj } = require('./getPathObj')
const { release } = require('./release')

exports.forceCancel = function(rate, type, block_num) {
    return new Promise((resolve, reject) => {
        const price = parseFloat(rate)
        getPathObj(['dex', type, 'sellOrders'])
            .then(s => {
                for (o in s) {
                    if (parseFloat(o.split(":")[0]) < (price * .6)) {
                        release(o.from, o.split(":")[1], block_num)
                            .then(r => { resolve(r) })
                            .catch(e => { reject(e) })
                    } else if (parseFloat(o.split(":")[0]) > (price * 1.4)) {
                        release(o.from, o.split(":")[1], block_num)
                            .then(r => { resolve(r) })
                            .catch(e => { reject(e) })
                    }
                }
            })
            .catch(e => { reject(e) })
        getPathObj(['dex', type, 'buyOrders'])
            .then(s => {
                for (o in s) {
                    if (parseFloat(o.split(":")[0]) < (price * .6)) {
                        release(o.from, o.split(":")[1], block_num)
                            .then(r => { resolve(r) })
                            .catch(e => { reject(e) })
                    } else if (parseFloat(o.split(":")[0]) > (price * 1.4)) {
                        release(o.from, o.split(":")[1], block_num)
                            .then(r => { resolve(r) })
                            .catch(e => { reject(e) })
                    }
                }
            })
            .catch(e => { reject(e) })
    })
}

exports.add = function(node, amount) {
    return new Promise((resolve, reject) => {
        store.get(['balances', node], function(e, a) {
            if (!e) {
                const a2 = typeof a != 'number' ? amount : a + amount
                store.batch([{ type: 'put', path: ['balances', node], data: a2 }], [resolve, reject, 1])
            } else {
                console.log(e)
            }
        })
    })
}
exports.addCol = function(node, amount) {
    console.log('addCol: ', { node, amount })
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
exports.deletePointer = function(escrowID, user) { //escrow IDs are unique to user, this checks for a collision before deleting the whole pointer
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
exports.credit = function(node) {
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
exports.nodeUpdate = function(node, op, val) { //for keeping node stats
    return new Promise((resolve, reject) => {
        store.get(['markets', 'node', node], function(e, a) {
            if (!e) {
                if (!a.strikes) a.strikes = 0
                if (!a.burned) a.burned = 0
                if (!a.moved) a.moved = 0
                switch (op) {
                    case 'strike':
                        a.strikes++
                            a.burned += val
                        break;
                    case 'ops':
                        a.escrows++
                            a.moved += val
                        break;
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

exports.penalty = function(node, amount) {
    console.log('penalty: ', { node, amount })
    return new Promise((resolve, reject) => {
        pts = getPathNum(['stats', 'tokenSupply'])
        Promise.all([pts]).then(r => {
            var a2 = r[1]
            newBal = a2 - amount
            if (newBal < 0) { newBal = 0 }
            const forfiet = a2 - newBal
            var ops = [{ type: 'put', path: ['balances', node], data: newBal }]
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

exports.chronAssign = function(block, op) {
    return new Promise((resolve, reject) => {
        const t = block + ':' + hashThis(stringify(op))
        store.batch([{ type: 'put', path: ['chrono', t], data: op }], [resolve, reject, t])
    })
}

function hashThis(data) {
    const digest = crypto.createHash('sha256').update(data).digest()
    const digestSize = Buffer.from(digest.byteLength.toString(16), 'hex')
    const combined = Buffer.concat([hashFunction, digestSize, digest])
    const multihash = bs58.encode(combined)
    return multihash.toString()
}

exports.hashThis = hashThis