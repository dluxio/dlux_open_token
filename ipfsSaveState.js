const { ipfs } = require("./index");

exports.ipfsSaveState = (blocknum, buffer) => {
    ipfs.add(buffer, (err, ipfs_return) => {
        if (!err) {
            var hash = '';
            try {
                hash = ipfs_return[0].hash;
            } catch (e) { console.log(e); }
            console.log(blocknum + `:Saved: ${hash}`);
            return {
                hashLastIBlock: hash,
                hashBlock: blocknum
            };
        } else {
            console.log({
                //cycle
            }, 'IPFS Error', err);
            /*
            cycleipfs(cycle++)
            if (cycle >= 25) {
                cycle = 0;
                return;
            }
            */
        }
    });
}