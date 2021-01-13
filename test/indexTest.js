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
    this.timeout(10000);
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

    it('Gov Up Node opb:', () => {
        let json = {
            amount: 8000,
            block_num: 2,
            transaction_id: 2
        }
        return new Promise((resolve, reject) => {
                app.gov_up(json, 'node-opb', true, [resolve, reject])
            })
            .then(ops => {
                assert.equal(ops[0].data, 1000)
                assert.equal(ops[0].path[1], 'node-opb')
                assert.equal(ops[1].data, 8000)
                assert.equal(ops[2].data, 8000)
            })
    })

    it('Gov Up Node opa:', () => {
        let json = {
            amount: 80000,
            block_num: 2,
            transaction_id: 2
        }
        return new Promise((resolve, reject) => {
                app.gov_up(json, 'node-opa', true, [resolve, reject])
            })
            .then(ops => {
                assert.equal(ops[0].data, 10000)
                assert.equal(ops[0].path[1], 'node-opa')
                assert.equal(ops[1].data, 80000)
                assert.equal(ops[2].data, 88000)
            })
    })

    it('Gov Up Node leader:', () => {
        let json = {
            amount: 800000,
            block_num: 2,
            transaction_id: 2
        }
        return new Promise((resolve, reject) => {
                app.gov_up(json, 'leader', true, [resolve, reject])
            })
            .then(ops => {
                assert.equal(ops[0].data, 200000)
                assert.equal(ops[0].path[1], 'leader')
                assert.equal(ops[1].data, 800000)
                assert.equal(ops[2].data, 888000)
            })
    })

    it('Gov Up Node opd:', () => {
        let json = {
            amount: 800,
            block_num: 2,
            transaction_id: 2
        }
        return new Promise((resolve, reject) => {
                app.gov_up(json, 'node-opd', true, [resolve, reject])
            })
            .then(ops => {
                assert.equal(ops[0].data, '@node-opd| Invalid gov up')
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
            block: 50499901,
            block_num: 50499999,
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
            block: 50499901,
            block_num: 50499999,
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
            block: 50499901,
            block_num: 50499999,
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
            block: 50499901,
            block_num: 50499999,
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
            block: 50499901,
            block_num: 50499999,
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
            tally(50500000, plasma, true)
                .then(ops => {
                    assert.equal(ops.consensus, 'hash')
                    assert.equal(ops.new_queue.leader.t, 800000)
                    assert.equal(ops.new_queue['node-opa'].t, 80000)
                    assert.equal(ops.new_queue['node-opb'].t, 8000)
                    assert.equal(ops.still_running.leader.t, 800000)
                    assert.equal(ops.still_running['node-opa'].t, 80000)
                    assert.equal(ops.stats.tokenSupply, 203000096)
                    assert.equal(ops.stats.multiSigCollateral, 80000)
                    store.get(['markets', 'node', 'leader'], function(e, r) {
                        console.log(r)

                    })
                })
        })
        /*
            it('Check on nodes:', () => {
                store.get(['markets', 'node', 'leader'], function(e, r) {
                    console.log(r)

                })
            })
        */
    it('Testing dlux hive sell listing:', () => {
        let json = {
            hive: 10,
            dlux: 100,
            hours: 1,
            block_num: 101,
            transaction_id: 101
        }
        return new Promise((resolve, reject) => {
                app.dex_hive_sell(json, 'leader', true, [resolve, reject])
            })
            .then(ops => {
                assert.equal(ops[3].data, '@leader| has placed order DLUXQmUQxeGyAobwtxXYexTmpYxNr2rT2AeAF5mRHs1gftgWnn to sell 0.100 for 0.010 HIVE')
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

    it('Testing dlux hive buy listing out of network agent:', () => {
        let json = {
            from: 'minnow',
            to: 'node-opa',
            agent: 'rando',
            hive_amount: '0.100 HIVE',
            hbd_amount: '0.000 HBD',
            fee: '0.000 HIVE',
            escrow_id: 654321,
            ratification_deadline: '2021-01-15T20:00:00',
            escrow_expiration: '2021-01-22T12:00:00',
            json_meta: JSON.stringify({
                dextx: {
                    dlux: 1000,
                },
                hours: 1
            }),
            block_num: 102,
            transaction_id: 111,
            timestamp: '2021-01-15T12:00:00'
        }
        return new Promise((resolve, reject) => {
                app.escrow_transfer(json, [resolve, reject])
            })
            .then(ops => {
                assert.equal(ops, 'fail_thru')
            })
    })

    it('Testing dlux hive buy listing out of network to:', () => {
        let json = {
            from: 'minnow',
            to: 'rando',
            agent: 'node-opb',
            hive_amount: '0.100 HIVE',
            hbd_amount: '0.000 HBD',
            fee: '0.000 HIVE',
            escrow_id: 654321,
            ratification_deadline: '2021-01-15T20:00:00',
            escrow_expiration: '2021-01-22T12:00:00',
            json_meta: JSON.stringify({
                dextx: {
                    dlux: 1000,
                },
                hours: 1
            }),
            block_num: 102,
            transaction_id: 111,
            timestamp: '2021-01-15T12:00:00'
        }
        return new Promise((resolve, reject) => {
                app.escrow_transfer(json, [resolve, reject])
            })
            .then(ops => {
                assert.equal(ops, 'fail_thru')
            })
    })

    it('Testing dlux hive buy listing:', () => {
        let json = {
            from: 'minnow',
            to: 'node-opa',
            agent: 'node-opb',
            hive_amount: '0.100 HIVE',
            hbd_amount: '0.000 HBD',
            fee: '0.000 HIVE',
            escrow_id: 654321,
            ratification_deadline: '2021-01-15T20:00:00',
            escrow_expiration: '2021-01-22T12:00:00',
            json_meta: JSON.stringify({
                dextx: {
                    dlux: 1000,
                },
                hours: 1
            }),
            block_num: 50500005,
            transaction_id: 111,
            timestamp: '2021-01-15T12:00:00'
        }
        return new Promise((resolve, reject) => {
                app.escrow_transfer(json, [resolve, reject])
            })
            .then(ops => {
                console.log(ops)
                assert.equal(ops[0].path[1], 'node-opb')
                assert.equal(ops[0].path[2], 'DLUXQma1TSmexWi1TtRqKpYhVUpvos9GQ95uHchcJMdq6isCLk:listApproveA')
                assert.equal(ops[1].path[1], 'node-opa')
                assert.equal(ops[1].path[2], 'DLUXQma1TSmexWi1TtRqKpYhVUpvos9GQ95uHchcJMdq6isCLk:listApproveT')
                assert.equal(ops[3].data, 88000)
                assert.equal(ops[4].data, 7000)
                assert.equal(ops[5].data, 2000)
                assert.equal(ops[6].data, 2000)
            })
    })

    it('Testing dlux hbd buy listing:', () => {
        let json = {
            from: 'minnow',
            to: 'node-opa',
            agent: 'node-opb',
            hive_amount: '0.000 HIVE',
            hbd_amount: '0.100 HBD',
            fee: '0.000 HIVE',
            escrow_id: 65432,
            ratification_deadline: '2021-01-15T20:00:00',
            escrow_expiration: '2021-01-22T12:00:00',
            json_meta: JSON.stringify({
                dextx: {
                    dlux: 1000,
                },
                hours: 1
            }),
            block_num: 50500005,
            transaction_id: 112,
            timestamp: '2021-01-15T12:00:00'
        }
        return new Promise((resolve, reject) => {
                app.escrow_transfer(json, [resolve, reject])
            })
            .then(ops => {
                assert.equal(ops[0].path[1], 'node-opb')
                assert.equal(ops[0].path[2], 'DLUXQmNigd1h1FH6RuPKwi45k31pc1xz6w4mngZH7ZECwkTVrm:listApproveA')
                assert.equal(ops[1].path[1], 'node-opa')
                assert.equal(ops[1].path[2], 'DLUXQmNigd1h1FH6RuPKwi45k31pc1xz6w4mngZH7ZECwkTVrm:listApproveT')
                assert.equal(ops[3].data, 86000)
                assert.equal(ops[4].data, 5000)
                assert.equal(ops[5].data, 4000)
                assert.equal(ops[6].data, 4000)
            })
    })

    it('Testing dlux hive buy:', () => {
        let json = {
            from: 'whale',
            to: 'node-opa',
            agent: 'node-opb',
            hive_amount: '0.010 HIVE',
            hbd_amount: '0.000 HBD',
            fee: '0.000 HIVE',
            escrow_id: 654321,
            ratification_deadline: '2021-01-15T20:00:00',
            escrow_expiration: '2021-01-22T12:00:00',
            json_meta: JSON.stringify({
                contract: '0.1000000:DLUXQmUQxeGyAobwtxXYexTmpYxNr2rT2AeAF5mRHs1gftgWnn',
                for: 'leader',
                hours: 1
            }),
            block_num: 50500005,
            transaction_id: 111,
            timestamp: '2021-01-15T12:00:00'
        }
        return new Promise((resolve, reject) => {
                app.escrow_transfer(json, [resolve, reject])
            })
            .then(ops => {
                assert.equal(ops[5].data, 100)
                assert.equal(ops[6].data, 85800)
                assert.equal(ops[7].data, 4800)
                assert.equal(ops[8].data, 4200)
                assert.equal(ops[9].data, 4200)
            })
    })

})