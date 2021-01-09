const { store } = require("./index");

function getPathObj(path) {
    return new Promise(function(resolve, reject) {
        store.get(path, function(err, obj) {
            if (err) {
                reject(err);
            } else {
                resolve(obj);
            }
        });
    });
}
exports.getPathObj = getPathObj;