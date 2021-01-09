const { ipfs } = require("./index");

exports.ipfsSaveState = (blocknum, buffer) => {
    return new Promise((resolve, reject) => {
        ipfs.add(buffer, (err, ipfs_return) => {
            if (!err) {
                var hash = '';
                try {
                    hash = ipfs_return[0].hash;
                } catch (e) { console.log(e); }
                console.log(blocknum + `:Saved: ${hash}`);
                resolve({
                    hashLastIBlock: hash,
                    hashBlock: blocknum
                })
            } else {
                console.log({
                    //cycle
                }, 'IPFS Error', err);
                reject(err)
                    /*
                    cycleipfs(cycle++)
                    if (cycle >= 25) {
                        cycle = 0;
                        return;
                    }
                    */
            }
        })
    })
}