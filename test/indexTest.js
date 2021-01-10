const assert = require('chai').assert
const app = require('./../processing_routes/index')
const { store } = require('./../index')
const test_state = require('./test_state')

function init() {
    return new Promise((resolve, reject) => {
        store.del([], function(e) {
            if (e) { console.log(e) }
            store.put([], test_state, function(err) {
                if (err) reject(err)
                resolve(true)
            })
        })
    })
}

describe('State', function() {
    it('DB init:', function() {
        return init()
            .then(res => assert.equal(res, true))
    })

    it('Add test node A:', () => {
        let json = {
            domain: 'localhost',
            bidRate: 2001,
            marketingRate: -1,
            escrow: true,
            block_num: 1,
            transaction_id: 1
        }
        return new Promise((resolve, reject) => {
                app.node_add(json, 'node-opa', true, [resolve, reject])
            })
            .then(ops => {
                assert.equal(ops[0].path[2], 'node-opa')
                assert.equal(ops[0].data.domain, 'localhost')
                assert.equal(ops[0].data.bidRate, 2000)
                assert.equal(ops[0].data.marketingRate, 0)
            })
    })

    it('Add test node B:', () => {
        let json = {
            domain: 'localhost',
            bidRate: 1000,
            marketingRate: 'shrimp',
            escrow: true,
            block_num: 1,
            transaction_id: 1
        }
        return new Promise((resolve, reject) => {
                app.node_add(json, 'node-opb', true, [resolve, reject])
            })
            .then(ops => {
                assert.equal(ops[0].path[2], 'node-opb')
                assert.equal(ops[0].data.domain, 'localhost')
                assert.equal(ops[0].data.bidRate, 1000)
                assert.equal(ops[0].data.marketingRate, 0)
            })
    })

    it('Add test node D:', () => {
        let json = {
            domain: 'localhost',
            bidRate: 1,
            marketingRate: 1,
            escrow: true,
            block_num: 1,
            transaction_id: 1
        }
        return new Promise((resolve, reject) => {
                app.node_add(json, 'node-opd', true, [resolve, reject])
            })
            .then(ops => {
                assert.equal(ops[0].path[2], 'node-opd')
                assert.equal(ops[0].data.domain, 'localhost')
                assert.equal(ops[0].data.bidRate, 1)
                assert.equal(ops[0].data.marketingRate, 1)
            })
    })

    it('Testing send:', () => {
        let json = {
            to: 'test-to',
            amount: 1000,
            block_num: 1,
            transaction_id: 1
        }
        return new Promise((resolve, reject) => {
                app.send(json, 'test-from', true, [resolve, reject])
            })
            .then(ops => {
                assert.equal(ops[0].path[1], 'test-from')
                assert.equal(ops[1].path[1], 'test-to')
                assert.equal(ops[1].data, 1001000)
                assert.equal(ops[0].data, 999000)
            })
    })

    it('Liquidizing Node A:', () => {
        let json = {
            to: 'node-opa',
            amount: 90000,
            block_num: 1,
            transaction_id: 1
        }
        return new Promise((resolve, reject) => {
                app.send(json, 'test-from', true, [resolve, reject])
            })
            .then(ops => {
                assert.equal(ops[0].path[1], 'test-from')
                assert.equal(ops[1].path[1], 'node-opa')
                assert.equal(ops[1].data, 90000)
                assert.equal(ops[0].data, 909000)
            })
    })

    it('Liquidizing Node B:', () => {
        let json = {
            to: 'node-opb',
            amount: 9000,
            block_num: 1,
            transaction_id: 1
        }
        return new Promise((resolve, reject) => {
                app.send(json, 'test-from', true, [resolve, reject])
            })
            .then(ops => {
                assert.equal(ops[0].path[1], 'test-from')
                assert.equal(ops[1].path[1], 'node-opb')
                assert.equal(ops[1].data, 9000)
                assert.equal(ops[0].data, 900000)
            })
    })

    it('Testing over send:', () => {
        let json = {
            to: 'test-to',
            amount: 900001,
            block_num: 1,
            transaction_id: 1
        }
        return new Promise((resolve, reject) => {
                app.send(json, 'test-from', true, [resolve, reject])
            })
            .then(ops => {
                assert.equal(ops[0].data, '@test-from| Invalid send operation')
            })
    })

    it('Testing neg send:', () => {
        let json = {
            to: 'test-to',
            amount: -1,
            block_num: 1,
            transaction_id: 1
        }
        return new Promise((resolve, reject) => {
                app.send(json, 'test-from', true, [resolve, reject])
            })
            .then(ops => {
                assert.equal(ops[0].data, '@test-from| Invalid send operation')
            })
    })

    it('Testing string send:', () => {
        let json = {
            to: 'test-to',
            amount: 'tri4l',
            block_num: 1,
            transaction_id: 1
        }
        return new Promise((resolve, reject) => {
                app.send(json, 'test-from', true, [resolve, reject])
            })
            .then(ops => {
                assert.equal(ops[0].data, '@test-from| Invalid send operation')
            })
    })

    it('Testing 0 send:', () => {
        let json = {
            to: 'test-to',
            amount: 0,
            block_num: 1,
            transaction_id: 1
        }
        return new Promise((resolve, reject) => {
                app.send(json, 'test-from', true, [resolve, reject])
            })
            .then(ops => {
                assert.equal(ops[0].data, '@test-from| Invalid send operation')
            })
    })

    /*
    dlux_report
    json: {"hash":"QmYaMrk7MhXzCMEZNH2tcvURzx1taEStJ4fM5KoCXN77Mz","block":50322301}
    */

    it('Build consensus Leader:', () => {
        let json = {
            hash: 'hash',
            block: 1,
            block_num: 70,
            transaction_id: '5L'
        }
        return new Promise((resolve, reject) => {
                app.report(json, 'leader', true, [resolve, reject])
            })
            .then(ops => {
                assert.equal(ops[0].data.self, 'leader')
                assert.equal(ops[0].data.report.hash, 'hash')
            })
    })

    it('Build consensus A:', () => {
        let json = {
            hash: 'hash',
            block: 1,
            block_num: 70,
            transaction_id: '5L'
        }
        return new Promise((resolve, reject) => {
                app.report(json, 'node-opa', true, [resolve, reject])
            })
            .then(ops => {
                assert.equal(ops[0].data.self, 'node-opa')
                assert.equal(ops[0].data.report.hash, 'hash')
            })
    })

    it('Build consensus B:', () => {
        let json = {
            hash: 'hash',
            block: 1,
            block_num: 70,
            transaction_id: '5L'
        }
        return new Promise((resolve, reject) => {
                app.report(json, 'node-opb', true, [resolve, reject])
            })
            .then(ops => {
                assert.equal(ops[0].data.self, 'node-opb')
                assert.equal(ops[0].data.report.hash, 'hash')
            })
    })

    it('Alt consensus D:', () => {
        let json = {
            hash: 'hash-dif',
            block: 1,
            block_num: 70,
            transaction_id: '5L'
        }
        return new Promise((resolve, reject) => {
                app.report(json, 'node-opd', true, [resolve, reject])
            })
            .then(ops => {
                assert.equal(ops[0].data.self, 'node-opd')
                assert.equal(ops[0].data.report.hash, 'hash-dif')
            })
    })

    it('Disallow Randos:', () => {
            let json = {
                hash: 'hash',
                block: 1,
                block_num: 70,
                transaction_id: '5L'
            }
            return new Promise((resolve, reject) => {
                    app.report(json, 'test-to', true, [resolve, reject])
                })
                .then(ops => {
                    assert.notOk(ops)
                })
        })
        /*
            it('Establish:', () => {
                let json = {
                    hash: 'hash',
                    block: 1,
                    block_num: 70,
                    transaction_id: '5L'
                }
                return new Promise((resolve, reject) => {
                        app.report(json, 'test-to', true, [resolve, reject])
                    })
                    .then(ops => {
                        assert.notOk(ops)
                    })
            })
        */

})