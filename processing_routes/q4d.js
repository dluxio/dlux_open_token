const config = require('./../config')
const { store } = require('./../index')

exports.q4d = (json, from, active, pc) => {
    if (from = config.leader && json.text && json.title) {
        store.batch([{
            type: 'put',
            path: ['postQueue', json.title],
            data: {
                text: json.text,
                title: json.title
            }
        }], pc)
    } else {
        pc[0](pc[2])
    }
}