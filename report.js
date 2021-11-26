const config = require('./config');

//tell the hive your state, this is asynchronous with IPFS return... 
function report(plasma, con) {
    return new Promise((resolve, reject) => {
        con.then(r =>{
            let report = {
                hash: plasma.hashLastIBlock,
                block: plasma.hashBlock,
                stash: plasma.privHash
            }
        try {if(r.block > report.block){
                report.sig = r.sig,
                report.sig_block = r.block
            }
        } catch (e){}

        var op = ["custom_json", {
            required_auths: [config.username],
            required_posting_auths: [],
            id: `${config.prefix}report`,
            json: JSON.stringify(report)
        }];
        resolve([
            [0, 0], op
        ])
        })
    })
}
exports.report = report;