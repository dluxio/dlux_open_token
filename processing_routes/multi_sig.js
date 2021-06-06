const config = require('./../config')
const { store } = require("./../index");
const { getPathObj } = require("../getPathObj");

  
    processor.onOperation('account_update', function(json, pc) { //ensure proper keys are on record for DAO accounts
        let agentsP = getPathObj(['agents']),
            statsP = getPathObj(['stats']),
            keysP = getPathObj(['markets', 'node', json.account, 'puBkey'])
        Promise.all([agentsP, statsP, keysP, runnersP])
            .then(a => {
                let agents = a[0],
                    stats = a[1],
                    keyPair = a[2],
                    ops = []
                if (json.account == config.msaccount && json.active != null) { //update agents
                    for (agent in agents) { //list of public keys ever used with the current weight
                        agents[agent].o = 0 //turn all weights to 0
                        agents[agent].a = 0 //owner active weights
                    }
                    if(json.active !== undefined){
                        for (i = 0; i < json.active.key_auths.length; i++) {
                            stats.auth[json.active.key_auths[i][0]] = json.active.key_auths[i][1]
                            if(agents[keyPairs[json.active.key_auths[i][0]]] !== undefined){
                                agents[keyPairs[json.active.key_auths[i][0]]] = {}
                            }
                            agents[keyPairs[json.active.key_auths[i][0]]].a = json.active.key_auths[i][1]
                        }
                        stats.auth_at = json.active.weight_threshold
                    }
                    if(json.owner !== undefined){
                        for (i = 0; i < json.owner.key_auths.length; i++) {
                            stats.auth[json.owner.key_auths[i][0]] = json.owner.key_auths[i][1]
                            if(agents[keyPairs[json.owner.key_auths[i][0]]] !== undefined){
                                agents[keyPairs[json.owner.key_auths[i][0]]] = {}
                            }
                            agents[keyPairs[json.owner.key_auths[i][0]]].o = json.owner.key_auths[i][1]
                        }
                        stats.auth_ot = json.owner.weight_threshold
                    }
                    //auto update active public keys
                    ops.push({ type: 'put', path: ['stats'], data: stats })
                    ops.push({ type: 'put', path: ['agents'], data: agents })
                    console.log(ops);
                    store.batch(ops, pc)
                } else if (keyPair && json.active !== undefined) {
                    ops.push({ type: 'put', path: ['markets', 'node', json.account, 'puBkey'], data: json.active.key_auths[0][0] }) //keep record of public keys of node operators
                    console.log(ops);
                    store.batch(ops, pc)
                } else {
                    pc[0](pc[2])
                }
            })
            .catch(e => { console.log(e) })
    });
/*
    processor.onOperation('claim_account', function(json, pc) {
        getPathObj(['agents', json.creator])
            .then(re => {
                let r = re,
                    ops = []
                if (Object.keys(r).length) { //adjust inventories
                    r.i++
                        ops.push({ type: 'put', path: ['agents', json.creator], data: r })
                    ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: `${json.creator} claimed an ACT` })
                    console.log({ msg: 'claim', ops });
                    store.batch(ops, pc)
                } else {
                    pc[0](pc[2])
                }
            })
            .catch(e => { console.log(e) })
    });


    processor.onOperation('create_claimed_account', function(json, pc) {
        let agentP = getPathObj(['agents', json.creator]),
            conP = getPathObj(['contracts', json.creator, json.new_account_name + ':c'])
        Promise.all([agentP, conP])
            .then(a => {
                let r = a[0],
                    con = a[1],
                    ops = []
                if (Object.keys(r).length) { //adjust inventories
                    r.i--
                    ops.push({ type: 'put', path: ['agents', json.creator], data: r })
                    ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: `@${json.creator} redeemed DACT for ${json.new_account_name}` })
                    console.log(ops, 'adjust ACT inventories'); //needs more work
                }
                if (Object.keys(con).length) { //if a contract account --ACT options ---probably too advanced to build and test together
                    if (con[`${json.new_account_name}:c`] != null) {
                        r.ir++ //update redeemed total
                            //state.bot.push(con[`${json.new_account_name}:c`]) //push payment to multisig bot build a thing for this
                            ops.push({ type: 'del', path: ['contracts', json.creator, json.new_account_name + ':c'] })
                    }
                    ops.push({ type: 'put', path: ['agents', json.creator], data: r })
                    console.log(ops, 'create'); //needs more work
                    store.batch(ops, pc)
                }
            })
            .catch(e => { console.log(e) })
    });
*/