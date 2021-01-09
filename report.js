const config = require('./config');
const { VERSION, escrow, unshift } = require("./index");

//tell the hive your state, this is asynchronous with IPFS return... 
function report(plasma) {
    var op = ["custom_json", {
        required_auths: [config.username],
        required_posting_auths: [],
        id: `${config.prefix}report`,
        json: JSON.stringify({
            hash: plasma.hashLastIBlock,
            block: plasma.hashBlock,
            version: VERSION,
            escrow: escrow,
            stash: plasma.privHash
        })
    }];
    unshift([
        [0, 0], op
    ]);
}
exports.report = report;