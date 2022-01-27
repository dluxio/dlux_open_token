const { getPathObj, deleteObjs } = require("./getPathObj");
const { store } = require("./index");
const config = require('./config');

//determine consensus... needs some work with memory management
exports.voter = () => {
    return new Promise((resolve, reject) => {
        var Ppending = getPathObj(['pendingvote'])
        Promise.all([Ppending]).then(function(v) {
                deleteObjs([
                        ['pendingvote']
                    ])
                    .then(empty => {
                        let posts = v[0],
                            totalWeight = 0,
                            ops = []
                        for (post in posts) {
                            totalWeight += posts[post].v
                        }
                        for (post in posts) {
                            let b = {
                                author: post.split('/')[0],
                                permlink: post.split('/')[1]
                            }
                            ops.push({
                                type: 'put',
                                path: ['escrow', config.leader, `vote:${b.author}/${b.permlink}`],
                                data: ["vote",
                                    {
                                        "voter": config.leader,
                                        "author": b.author,
                                        "permlink": b.permlink,
                                        "weight": parseInt((posts[post].v / totalWeight) * 10000)
                                    }
                                ]
                            })
                        }
                        if (ops.length) {
                            store.batch(ops, [resolve, reject, 1])
                        } else {
                            resolve(1)
                        }
                    })
                    .catch(e => { console.log(e) })
            })
            .catch(e => console.log(e))
    })
}