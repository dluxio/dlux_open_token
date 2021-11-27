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

function getPathSome(path, arg) {
    return new Promise(function(resolve, reject) {
        store.someChildren(path, arg, function(err, obj) {
            if (err) {
                reject(err);
                resolve({})
            } else {
                resolve(obj);
            }
        });
    });
}
exports.getPathSome = getPathSome;