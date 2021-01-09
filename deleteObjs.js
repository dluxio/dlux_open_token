const { store } = require("./index");

exports.deleteObjs = (paths) => new Promise((resolve, reject) => {
    var ops = [];
    for (i = 0; i < paths.length; i++) {
        ops.push({ type: 'del', path: paths[i] });
    }
    store.batch(ops, [resolve, reject, paths.length]);
})