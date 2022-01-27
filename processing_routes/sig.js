const config = require('./../config')
const { store } = require("./../index");
const hive = require('@hiveio/hive-js');
const { getPathObj, deleteObjs } = require("./../getPathObj");
const { postToDiscord } = require('./../discord')
const { chronAssign } = require('./../lil_ops')
const { verify_broadcast } = require('./../tally')

exports.account_update = (json, pc) => {
    if(json.account == config.msaccount){
        var ops = [{type:'del', path:['stats', 'ms']}]
        if(json.active) {
            let account_auths = {}
            for (var i = 0; i < json.active.account_auths.length;i++){
                account_auths[json.active.account_auths[i][0]] = json.active.account_auths[i][1]
            }
            ops.push({type:'put', path:['stats', 'ms', 'active_account_auths'], data: account_auths})
            if(json.active.weight_threshold) ops.push({type:'put', path:['stats', 'ms', 'active_threshold'], data: json.active.weight_threshold})
        }
        if(json.owner) {
            let owner_key_auths = {}
            for (var i = 0; i < json.owner.owner_key_auths.length;i++){
                owner_key_auths[json.owner.owner_key_auths[i][0]] = json.owner.owner_key_auths[i][1]
            }
            ops.push({type:'put', path:['stats', 'ms', 'owner_key_auths'], data: owner_key_auths})
            if(json.owner.weight_threshold) ops.push({type:'put', path:['stats', 'ms', 'owner_threshold'], data: json.owner.weight_threshold})
        }
        if(json.posting) {
            let paccount_auths = {}
            for (var i = 0; i < json.posting.account_auths.length;i++){
                paccount_auths[json.posting.account_auths[i][0]] = json.posting.account_auths[i][1]
            }
            ops.push({type:'put', path:['stats', 'ms', 'active_account_auths'], data: paccount_auths})
            if(json.posting.weight_threshold) ops.push({type:'put', path:['stats', 'ms', 'posting_threshold'], data: json.posting.weight_threshold})
        }
        if(json.memo_key) ops.push({type:'put', path:['stats', 'ms', 'memo_key'], data: json.memo_key})
        getPathObj(['mss']).then(mss => {
            var done = false
            for (var block in mss){
                if([block].indexOf('account_update') > 0){
                    ops.push({type:'del', path:['mss', `${block}`]})
                    ops.push({type:'del', path:['mss', `${block}:sigs`]})
                    store.batch(ops, pc)
                    done = true
                }
            }
            if (!done) {
                store.batch(ops, pc)
            }
        })
    } else {
        pc[0](pc[2])
    }
}

/*
"ms": {
            "account": "dlux-cc",
            "active_account_auths": {
               "disregardfiat": 1,
               "dlux-io": 1,
               "markegiles": 1
            },
            "active_threshold": 2,
            "memo_key": "STM5se9o2oZwY7ztpo2scyvf12RR41zaYa6rozBtetwfr1DmH1J5k",
            "owner_key_auths": {
               "STM5Rp1fWQMS7tAPVqatg8B22faeJGcKkfsez3mgUwGZPE9aqWd6X": 1,
               "STM7Hgi4pjf5e7u6oKLdhWfgForEVikzvpkK5ejdaMzAzH6dWAtAD": 1,
               "STM8TPTJXiCbGaEhAheXxQqbX4isq3UWiPuQBnHLmCKpmmNXhu31m": 1
            },
            "owner_threshold": 2,
            "posting_account_auths": {
               "disregardfiat": 1,
               "dlux-io": 1,
               "markegiles": 1
            },
            "posting_threshold": 1
         }
*/

exports.sig_submit = (json, from, active, pc) => {
    var Pop = getPathObj(['mss', `${json.sig_block}`]),
        Psigs = getPathObj(['mss', `${json.sig_block}:sigs`]),
        Pstats = getPathObj(['stats'])
    Promise.all([Pop, Pstats, Psigs])
        .then(got => {
            let msop = got[0],
                stats = got[1],
                sigs = got[2]
                ops = []
                try{
                    msop = JSON.parse(msop)
                } catch (e){}
            if (active && stats.ms.active_account_auths[from] && msop.expiration) {
                sigs[from] = json.sig
                if(Object.keys(sigs).length >= stats.ms.active_threshold){
                    let sigarr = []
                    for(var i in sigs){
                        sigarr.push(sigs[i])
                    }
                    verify_broadcast(msop, sigarr, stats.ms.active_threshold)
                }
                ops.push({ type: 'put', path: ['mss', `${json.sig_block}:sigs`], data: sigs })
                store.batch(ops, pc);
                //try to sign
            } else {
                pc[0](pc[2])
            }
        })
        .catch(e => { console.log(e); });
}

/*
processor.onOperation('account_update', function(json, pc) { //ensure proper keys are on record for DAO accounts
        let agentsP = getPathObj(['agents']),
            statsP = getPathObj(['stats']),
            keysP = getPathObj(['keyPairs'])
        Promise.all([agentsP, statsP, keysP])
            .then(a => {
                let agents = a[0],
                    stats = a[1],
                    keyPairs = a[2],
                    ops = []
                if (json.account == config.msaccount) {
                    stats.auths = {}
                    for (var agent in agents) {
                        agents[agent].o = 0
                    }
                    for (var i = 0; i < json.owner.key_auths.length; i++) {
                        stats.auth[json.owner.key_auths[i][0]] = 1
                        agents[keyPairs[json.owner.key_auths[i][0]]].o = 1
                    }
                    //auto update active public keys
                    ops.push({ type: 'put', path: ['stats'], data: stats })
                    ops.push({ type: 'put', path: ['agents'], data: agents })
                    console.log(ops);
                    store.batch(ops, pc)
                } else if (agents[json.account] != null && json.active != null) {
                    ops.push({ type: 'put', path: ['agents', json.account, 'p'], data: json.active.key_auths[0][0] }) //keep record of public keys of agents
                    ops.push({ type: 'put', path: ['keyPairs', json.active.key_auths[0][0]], data: json.account })
                    console.log(ops);
                    store.batch(ops, pc)
                } else {
                    pc[0](pc[2])
                }
            })
            .catch(e => { console.log(e) })
    });

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