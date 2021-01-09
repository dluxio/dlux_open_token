const config = require('./config');
const { plasma, VERSION, escrow, NodeOps } = require("./index");

//tell the hive your state, this is asynchronous with IPFS return... 
function report() {
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
    NodeOps.unshift([
        [0, 0], op
    ]);
}
exports.report = report;