const config = require('./config');

//tell the hive your state, this is asynchronous with IPFS return... 
function report(plasma) {
    return new Promise((resolve, reject) => {
        var op = ["custom_json", {
            required_auths: [config.username],
            required_posting_auths: [],
            id: `${config.prefix}report`,
            json: JSON.stringify({
                hash: plasma.hashLastIBlock,
                block: plasma.hashBlock,
                stash: plasma.privHash,
                ms: {
                    exp: new Date((new Date(plasma.bh.timestamp).getTime()) + 86400000).toISOString().slice(0, -5),
                    rbn: plasma.bh.block_number,
                    rbp: Buffer.from(plasma.bh.block_id, 'hex').readUInt32LE(4) 
                }
            })
        }];
        resolve([
            [0, 0], op
        ])
    })
}
exports.report = report;