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
                stash: plasma.privHash
            })
        }];
        resolve([
            [0, 0], op
        ])
    })
}
exports.report = report;