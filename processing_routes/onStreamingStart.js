const config = require('./../config')
const { store, unshiftOp, TXID } = require("./../index");

exports.onStreamingStart = () => {
    console.log("At real time.");
    TXID.current()
    store.get(['markets', 'node', config.username], function(e, a) {
        if (!a.domain && config.NODEDOMAIN) {
            var op = ["custom_json", {
                required_auths: [config.username],
                required_posting_auths: [],
                id: `${config.prefix}node_add`,
                json: JSON.stringify({
                    domain: config.NODEDOMAIN,
                    bidRate: config.bidRate,
                    escrow: true
                })
            }];
            unshiftOp([
                [0, 0], op
            ]);
            return op
        }
    });
}