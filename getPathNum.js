const { store } = require("./index");

function getPathNum(path) {
    return new Promise(function(resolve, reject) {
        store.get(path, function(err, obj) {
            if (err) {
                reject(err);
            } else {
                if (typeof obj != 'number') {
                    resolve(0);
                } else {
                    resolve(obj);
                }
            }
        });
    });
}
exports.getPathNum = getPathNum;