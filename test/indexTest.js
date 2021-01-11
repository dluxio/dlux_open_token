const assert = require('chai').assert
const app = require('./../processing_routes/index')
const { tally } = require('./../tally')
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

    it('Establish queue and consensus:', () => {
        let plasma = {
            hashLastIBlock: 'hash'
        }
        tally(100, plasma, true)
            .then(ops => {
                assert.equal(ops.consensus, 'hash')
                assert.equal(ops.new_queue.leader.t, 101000000)
                assert.equal(ops.new_queue['node-opa'].t, 90000)
                assert.equal(ops.new_queue['node-opb'].t, 9000)
                assert.equal(ops.still_running.leader.t, 101000000)
                assert.equal(ops.still_running['node-opa'].t, 90000)
                assert.equal(ops.stats.tokenSupply, 101090000)
                assert.equal(ops.stats.multiSigCollateral, 101090000)
            })
    })

    it('Testing dlux hive sell listing:', () => {
        let json = {
            hive: 1000,
            dlux: 10000,
            hours: 1,
            block_num: 101,
            transaction_id: 101
        }
        return new Promise((resolve, reject) => {
                app.dex_hive_sell(json, 'leader', true, [resolve, reject])
            })
            .then(ops => {
                assert.equal(ops[3].data, '@leader| has placed order DLUXQmUQxeGyAobwtxXYexTmpYxNr2rT2AeAF5mRHs1gftgWnn to sell 10.000 for 1.000 HIVE')
            })
    })

    it('Build hive sell listings for Tests A:', () => {
        let json = {
            hive: 1000,
            dlux: 9999,
            hours: 1,
            block_num: 101,
            transaction_id: 102
        }
        return new Promise((resolve, reject) => {
                app.dex_hive_sell(json, 'leader', true, [resolve, reject])
            })
            .then(ops => {
                assert.equal(ops[3].data, '@leader| has placed order DLUXQmRaq1xddXPqBeAa6DMfDhbqYBW8KDajH2TB4Fau1nAwZ7 to sell 9.999 for 1.000 HIVE')
            })
    })

    it('Build hive sell listings for Tests B:', () => {
        let json = {
            hive: 1000,
            dlux: 9990,
            hours: 1,
            block_num: 101,
            transaction_id: 103
        }
        return new Promise((resolve, reject) => {
                app.dex_hive_sell(json, 'leader', true, [resolve, reject])
            })
            .then(ops => {
                assert.equal(ops[3].data, '@leader| has placed order DLUXQmZuiTkVnSyfM3m7myRYdsMdngcKfvV8wrjJvaysb3DeXZ to sell 9.990 for 1.000 HIVE')
            })
    })

    it('Build hive sell listings for Tests C:', () => {
        let json = {
            hive: 1000,
            dlux: 9900,
            hours: 1,
            block_num: 101,
            transaction_id: 104
        }
        return new Promise((resolve, reject) => {
                app.dex_hive_sell(json, 'leader', true, [resolve, reject])
            })
            .then(ops => {
                assert.equal(ops[3].data, '@leader| has placed order DLUXQmQyPGmVrJQbXiXXEFyF6TtJd6VNhNnD3XmTvamTw7sDQq to sell 9.900 for 1.000 HIVE')
            })
    })

    it('Build hive sell listings for Tests D:', () => {
        let json = {
            hive: 1000,
            dlux: 9000,
            hours: 1,
            block_num: 101,
            transaction_id: 105
        }
        return new Promise((resolve, reject) => {
                app.dex_hive_sell(json, 'leader', true, [resolve, reject])
            })
            .then(ops => {
                assert.equal(ops[3].data, '@leader| has placed order DLUXQmb92SjGXBBWKrEc5U8saKfaYuDPfkygKE7tKcgsfcdHYA to sell 9.000 for 1.000 HIVE')
            })
    })

    it('Testing dlux sell listing with insuffiecent dlux:', () => {
        let json = {
            hive: 100000,
            dlux: 1000000,
            hours: 1,
            block_num: 101,
            transaction_id: 101
        }
        return new Promise((resolve, reject) => {
                app.dex_hive_sell(json, 'leader', false, [resolve, reject])
            })
            .then(ops => {
                assert.equal(ops[0].data, '@leader| tried to place an order to sell 1000.000 for 100.000 HIVE')
            })
    })

    it('Testing dlux sell listing with posting permission:', () => {
        let json = {
            hive: 1000,
            dlux: 10000,
            hours: 1,
            block_num: 101,
            transaction_id: 101
        }
        return new Promise((resolve, reject) => {
                app.dex_hive_sell(json, 'leader', false, [resolve, reject])
            })
            .then(ops => {
                assert.equal(ops[0].data, '@leader| tried to place an order to sell 10.000 for 1.000 HIVE')
            })
    })

    it('Testing dlux sell listing with string:', () => {
        let json = {
            hive: '1000',
            dlux: '10000',
            hours: 1,
            block_num: 101,
            transaction_id: 101
        }
        return new Promise((resolve, reject) => {
                app.dex_hive_sell(json, 'leader', false, [resolve, reject])
            })
            .then(ops => {
                assert.equal(ops[0].data, '@leader| tried to place an order to sell 10.000 for 1.000 HIVE')
            })
    })

    it('Testing dlux sell listing high curb:', () => {
        let json = {
            hive: 799,
            dlux: 10000,
            hours: 1,
            block_num: 101,
            transaction_id: 101
        }
        return new Promise((resolve, reject) => {
                app.dex_hive_sell(json, 'leader', true, [resolve, reject])
            })
            .then(ops => {
                assert.equal(ops[0].data, '@leader| tried to place an order to sell 10.000 for 0.799 HIVE')
            })
    })

    it('Testing dlux sell listing low curb:', () => {
        let json = {
            hive: 1201,
            dlux: 10000,
            hours: 1,
            block_num: 101,
            transaction_id: 101
        }
        return new Promise((resolve, reject) => {
                app.dex_hive_sell(json, 'leader', true, [resolve, reject])
            })
            .then(ops => {
                assert.equal(ops[0].data, '@leader| tried to place an order to sell 10.000 for 1.201 HIVE')
            })
    })

    it('Testing dlux hbd sell listing:', () => {
        let json = {
            hbd: 1000,
            dlux: 10000,
            hours: 1,
            block_num: 101,
            transaction_id: 106
        }
        return new Promise((resolve, reject) => {
                app.dex_hbd_sell(json, 'leader', true, [resolve, reject])
            })
            .then(ops => {
                assert.equal(ops[3].data, '@leader| has placed order DLUXQmSkqEjmJmsGCKdg87BdHMezTeonVqvvU8Z9mder2N62Yy to sell 10.000 for 1.000 HBD')
            })
    })

    it('Build hbd sell listings for Tests A:', () => {
        let json = {
            hbd: 1000,
            dlux: 9999,
            hours: 1,
            block_num: 101,
            transaction_id: 107
        }
        return new Promise((resolve, reject) => {
                app.dex_hbd_sell(json, 'leader', true, [resolve, reject])
            })
            .then(ops => {
                assert.equal(ops[3].data, '@leader| has placed order DLUXQmcg2v7jTLCBMPff7NzZJ1A1hdyhtqjmCSuGTcpm6SZ9oB to sell 9.999 for 1.000 HBD')
            })
    })

    it('Build hbd sell listings for Tests B:', () => {
        let json = {
            hbd: 1000,
            dlux: 9990,
            hours: 1,
            block_num: 101,
            transaction_id: 108
        }
        return new Promise((resolve, reject) => {
                app.dex_hbd_sell(json, 'leader', true, [resolve, reject])
            })
            .then(ops => {
                assert.equal(ops[3].data, '@leader| has placed order DLUXQmSWyXa8yKsM4vAu3BCsnEkW2CH74YNPKPTkfbKuKntUuw to sell 9.990 for 1.000 HBD')
            })
    })

    it('Build hbd sell listings for Tests C:', () => {
        let json = {
            hbd: 1000,
            dlux: 9900,
            hours: 1,
            block_num: 101,
            transaction_id: 109
        }
        return new Promise((resolve, reject) => {
                app.dex_hbd_sell(json, 'leader', true, [resolve, reject])
            })
            .then(ops => {
                assert.equal(ops[3].data, '@leader| has placed order DLUXQmRd6h8iiy1MEnhJAsQisyU4xr6zGSerhndVc2zS2saVf1 to sell 9.900 for 1.000 HBD')
            })
    })

    it('Build hbd sell listings for Tests D:', () => {
        let json = {
            hbd: 801,
            dlux: 10000,
            hours: 1,
            block_num: 101,
            transaction_id: 110
        }
        return new Promise((resolve, reject) => {
                app.dex_hbd_sell(json, 'leader', true, [resolve, reject])
            })
            .then(ops => {
                assert.equal(ops[3].data, '@leader| has placed order DLUXQmZyKw3RSwA5D9E8zW3s5iZ22azcpTdyM7hhVfCvnTaqnX to sell 10.000 for 0.801 HBD')
            })
    })

    it('Testing hbd dlux sell listing with posting permission:', () => {
        let json = {
            hbd: 1000,
            dlux: 10000,
            hours: 1,
            block_num: 101,
            transaction_id: 101
        }
        return new Promise((resolve, reject) => {
                app.dex_hbd_sell(json, 'leader', false, [resolve, reject])
            })
            .then(ops => {
                assert.equal(ops[0].data, '@leader| tried to place an order to sell 10.000 for 1.000 HBD')
            })
    })

    it('Testing hbd dlux sell listing with string:', () => {
        let json = {
            hbd: '1000',
            dlux: '10000',
            hours: 1,
            block_num: 101,
            transaction_id: 101
        }
        return new Promise((resolve, reject) => {
                app.dex_hbd_sell(json, 'leader', false, [resolve, reject])
            })
            .then(ops => {
                assert.equal(ops[0].data, '@leader| tried to place an order to sell 10.000 for 1.000 HBD')
            })
    })

    it('Testing hbd dlux sell listing high curb:', () => {
        let json = {
            hbd: 799,
            dlux: 10000,
            hours: 1,
            block_num: 101,
            transaction_id: 101
        }
        return new Promise((resolve, reject) => {
                app.dex_hbd_sell(json, 'leader', true, [resolve, reject])
            })
            .then(ops => {
                assert.equal(ops[0].data, '@leader| tried to place an order to sell 10.000 for 0.799 HBD')
            })
    })

    it('Testing hbd dlux sell listing low curb:', () => {
        let json = {
            hbd: 1201,
            dlux: 10000,
            hours: 1,
            block_num: 101,
            transaction_id: 101
        }
        return new Promise((resolve, reject) => {
                app.dex_hbd_sell(json, 'leader', true, [resolve, reject])
            })
            .then(ops => {
                assert.equal(ops[0].data, '@leader| tried to place an order to sell 10.000 for 1.201 HBD')
            })
    })

})