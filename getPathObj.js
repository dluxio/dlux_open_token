const { store } = require("./index");

function getPathObj(path) {
    return new Promise(function(resolve, reject) {
        store.get(path, function(err, obj) {
            if (err) {
                console.log(path)
                resolve({});
            } else {
                resolve(obj);
            }
        });
    });
}
exports.getPathObj = getPathObj;