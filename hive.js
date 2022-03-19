const config = require('./config.js');
const { hiveClient } = require('./index');

const Hive = {
    getOwners: function (account){
        return new Promise(function (resolve, reject){
            hiveClient.api.setOptions({ url: config.startURL });
            hiveClient.api.getAccounts([account], function (err, result){
                hiveClient.api.setOptions({ url: config.clientURL });
                if(err) reject(err)
                else resolve(result[0].active.account_auths)
            })
        })
    },
    getRecentReport: function (account, walletOperationsBitmask){
        return new Promise(function (resolve, reject){
            hiveClient.api.setOptions({ url: config.startURL });
            hiveClient.api.getAccountHistory(account, -1, 100, ...walletOperationsBitmask, function(err, result) {
                hiveClient.api.setOptions({ url: config.clientURL });
                if(err) reject(err)
                let ebus = result.filter(tx => tx[1].op[1].id === `${config.prefix}report`), recents = []
                for (i = ebus.length - 1; i >= 0; i--) {
                    if (JSON.parse(ebus[i][1].op[1].json).hash && parseInt(JSON.parse(ebus[i][1].op[1].json).block) > parseInt(config.override)) {
                        recents.push([JSON.parse(ebus[i][1].op[1].json).hash, JSON.parse(ebus[i][1].op[1].json).block])
                    }
                }
                resolve(recents.shift())
            })
        })
    }
}

exports.Hive = Hive