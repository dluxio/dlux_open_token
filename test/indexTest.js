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

    it('Testing over send:', () => {
        let json = {
            to: 'test-to',
            amount: 1000000,
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
})