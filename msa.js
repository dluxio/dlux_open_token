const { store, hiveClient } = require('./index')
const { getPathObj } = require('./getPathObj')
const config = require('./config')
const stringify = require('json-stable-stringify');
//const privateKey = hiveClient.PrivateKey.fromString(config.msprivatekey);


exports.consolidate = (num, plasma, bh, owner) => {
    return new Promise((resolve, reject) => {
        var query = 'msa'
        if(owner == 'owner')query = 'mso'
        const queryf = query == 'msa' ? 'mss' : 'msso'
        const sel_key = query == 'msa' ? config.active : config.msowner
        store.get([query], (err, result) => {
            if (err || Object.keys(result).length === 0) {
                resolve('NONE')
            } else {
                let join = {},
                    ops = []
                for (var item in result) {
                    result[item] = JSON.parse(result[item])
                    if (join[result[item][1].to]){
                        join[result[item][1].to] = join[result[item][1].to] + ',' + item
                    } else {
                        join[result[item][1].to] = item
                    }
                }
                for (var account in join){
                    if(join[account].split(',').length > 1){
                        let memohive = '',
                            memohbd = '',
                            hive = 0,
                            hbd = 0,
                            items = join[account].split(',')
                        for (var item in items){
                            if(result[items[item]][1].amount.split(' ')[1] == "HIVE"){
                                hive = hive + parseInt(parseFloat(result[items[item]][1].amount.split(' ')[0])*1000)
                                memohive = memohive + result[items[item]][1].memo + ',' 
                            } else {
                                hbd = hbd + parseInt(parseFloat(result[items[item]][1].amount.split(' ')[0])*1000)
                                memohbd = memohbd + result[items[item]][1].memo + ','
                            }
                            delete result[items[item]]
                            //ops.push({type: 'del', path:['msa', items[item]]})
                        }
                        memohbd += `hbd:${num}`
                        memohive += `hive:${num}`
                        if(hive){
                            const transfer = [
                                    "transfer",
                                    {
                                        "from": config.msaccount,
                                        "to": account,
                                        "amount": parseFloat(hive/1000).toFixed(3) + ' HIVE',
                                        "memo": memohive
                                    }
                                ]
                            result[`${account}:hive:${num}`] = transfer
                        }
                        if(hbd){
                            const transfer = [
                                    "transfer",
                                    {
                                        "from": config.msaccount,
                                        "to": account,
                                        "amount": parseFloat(hbd/1000).toFixed(3) + ' HBD',
                                        "memo": memohbd
                                    }
                                ]
                            result[`${account}:hbd:${num}`] = transfer
                        }
                    }
                }
                ops.push({type: 'del', path: [query]})
                let txs = []
                for (var tx in result){
                    txs.push(result[tx])
                }
                let sig = {
                    block: num,
                    sig: ''
                },
                now = Date.parse(bh.timestamp + '.000Z'),
                op = {
                    ref_block_num: bh.block_number & 0xffff,
                    ref_block_prefix: Buffer.from(bh.block_id, 'hex').readUInt32LE(4),
                    expiration: new Date(now + 3660000).toISOString().slice(0, -5),
                    operations: txs,
                    extensions: [],
                }
                ops.push({type: 'put', path: [queryf, `${num}`], data: stringify(op)})
                if(config.msowner && config.active && txs.length){
                    const stx = hiveClient.auth.signTransaction(op, [sel_key])
                    sig.sig = stx.signatures[0]
                }
                store.batch(ops, [resolve, reject, sig])
            }
        })
    })
}

exports.osign = (num, type, missed, bh) => {
    return new Promise((resolve, reject) => {
        if(bh) {
            let Pmissed = getPathObj([type, `${type == 'mso' ? missed[0] : missed[0].replace(':sigs', '')}`]),
            Pstats = getPathObj(['stats'])
        Promise.all([Pmissed, Pstats]).then(mem => {
                let sig = {
                        block: num,
                        sig: ''
                    },
                    obj = typeof mem[0] == 'string' ? JSON.parse(mem[0]) : mem[0],
                    ops = [],
                    now = Date.parse(bh.timestamp + '.000Z')
                    op = {
                        ref_block_num: bh.block_number & 0xffff,
                        ref_block_prefix: Buffer.from(bh.block_id, 'hex').readUInt32LE(4),
                        expiration: new Date(now + 3660000).toISOString().slice(0, -5),
                        operations: obj.length ? [obj] : obj.operations,
                        extensions: [],
                    }
                    for(var i = 0; i < missed.length; i++){
                        ops.push({type:'del', path:[type, `${missed[i]}`]})
                    }
                    if(op.operations)ops.push({type: 'put', path: ['msso', `${num}`], data: stringify(op)})
                    if(op.operations && mem[1].ms.active_account_auths[config.username]  && config.msowner){
                        const stx = hiveClient.auth.signTransaction(op, [config.msowner])
                        sig.sig = stx.signatures[0]
                    }
                    store.batch(ops, [resolve, reject, sig])
                
            })
        } else {
            console.log('no BH')
            resolve('No Sig')
        }
        
    })
}

exports.sign = (num, plasma, missed, bh) => {
    return new Promise((resolve, reject) => {
        if(bh){
            let Pmissed = getPathObj(['mss', `${missed}`]),
            Pstats = getPathObj(['stats'])
        Promise.all([Pmissed, Pstats]).then(mem => {
                let sig = {
                        block: num,
                        sig: ''
                    },
                    obj = JSON.parse(mem[0]),
                    ops = [],
                    now = Date.parse(bh.timestamp + '.000Z'),
                    op = {
                        ref_block_num: bh.block_number & 0xffff,
                        ref_block_prefix: Buffer.from(bh.block_id, 'hex').readUInt32LE(4),
                        expiration: new Date(now + 3660000).toISOString().slice(0, -5),
                        operations: obj.operations,
                        extensions: [],
                    }
                    ops.push({type:'del', path:['mss', `${missed}`]})
                    ops.push({type:'del', path:['mss', `${missed}:sigs`]})
                    ops.push({type: 'put', path: ['mss', `${num}`], data: stringify(op)})
                    if(mem[1].ms.active_account_auths[config.username]  && config.active){
                        const stx = hiveClient.auth.signTransaction(op, [config.active])
                        sig.sig = stx.signatures[0]
                    }
                    store.batch(ops, [resolve, reject, sig])
                
            })
        } else {
            console.log('no BH')
            resolve('No Sig')
        }
        
    })
}

/*
exports.createAccount = (creator, account) => {
    return new Promise((resolve, reject) => {
        if (creator = config.username){
            var ops = []
            const op = [
                "create_claimed_account",
                {
                    "creator": config.username,
                    "new_account_name": "dlux-cc",
                    "owner": {
                    "weight_threshold": 2,
                    "account_auths": [],
                    "key_auths": [
                        [
                        "STM8TPTJXiCbGaEhAheXxQqbX4isq3UWiPuQBnHLmCKpmmNXhu31m",
                        1
                        ],
                        [
                        "STM7Hgi4pjf5e7u6oKLdhWfgForEVikzvpkK5ejdaMzAzH6dWAtAD",
                        1
                        ],
                        [
                        "STM5Rp1fWQMS7tAPVqatg8B22faeJGcKkfsez3mgUwGZPE9aqWd6X",
                        1
                        ]
                    ]
                    },
                    "active": {
                    "weight_threshold": 2,
                    "account_auths": [
                        [
                        "disregardfiat",
                        1
                        ],
                        [
                        "dlux-io",
                        1
                        ],
                        [
                        "markegiles",
                        1
                        ]
                    ],
                    "key_auths": []
                    },
                    "posting": {
                    "weight_threshold": 1,
                    "account_auths": [
                        [
                        "disregardfiat",
                        1
                        ],
                        [
                        "dlux-io",
                        1
                        ],
                        [
                        "markegiles",
                        1
                        ]
                    ],
                    "key_auths": []
                    },
                    "memo_key": "STM5se9o2oZwY7ztpo2scyvf12RR41zaYa6rozBtetwfr1DmH1J5k",
                    "json_metadata": "{}"
                }
                ]
                ops.push(op)
            hiveClient.broadcast.send({
                extensions: [],
                operations: ops}, [config.active], (err, result) => {
                console.log(err, result);
            });
        } else {
            resolve('Not Me')
        }
    })
}

*/

exports.updateAccount = (accounts) => {
    return new Promise((resolve, reject) => {
        hiveClient.broadcast.accountCreate(wif, fee, creator, newAccountName, owner, active, posting, memoKey, jsonMetadata, function(err, result) {
        console.log(err, result);
        });

    })
}