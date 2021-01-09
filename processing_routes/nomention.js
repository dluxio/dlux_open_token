const { store } = require('./../index')

exports.nomention = (json, from, active, pc) => {
    if (typeof json.nomention == 'boolean') {
        store.get(['delegations', from], function(e, a) {
            var ops = []
            if (!e && json.nomention) {
                ops.push({ type: 'put', path: ['nomention', from], data: true })
            } else if (!e && !json.nomention) {
                ops.push({ type: 'del', path: ['nomention', from] })
            }
            store.batch(ops, pc)
        })
    } else {
        pc[0](pc[2])
    }
}