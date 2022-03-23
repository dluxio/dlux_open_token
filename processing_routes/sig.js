const config = require('./../config')
const { store } = require("./../index");
const { getPathObj, deleteObjs } = require("./../getPathObj");
//const { postToDiscord } = require('./../discord')
//const { chronAssign } = require('./../lil_ops')
const { verify_broadcast } = require('./../tally')

exports.account_update = (json, pc) => {
    if(json.account == config.msaccount){
        store.batch([{type:'del', path:['stats', 'ms']}], [after, pc[1], 'del'])
        function after() {
            var ops = []
            if(json.active) {
                let account_auths = {}
                for (var i = 0; i < json.active.account_auths.length; i++){
                    account_auths[json.active.account_auths[i][0]] = json.active.account_auths[i][1]
                }
                ops.push({type:'put', path:['stats', 'ms', 'active_account_auths'], data: account_auths})
                if(json.active.weight_threshold) ops.push({type:'put', path:['stats', 'ms', 'active_threshold'], data: json.active.weight_threshold})
            }
            if(json.owner) {
                let owner_key_auths = {}
                for (var i = 0; i < json.owner.key_auths.length;i++){
                    owner_key_auths[json.owner.key_auths[i][0]] = json.owner.key_auths[i][1]
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
            ops.push({type:'del', path:['msso']})
            store.batch(ops, pc)
        }
    } else {
        pc[0](pc[2])
    }
}

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

exports.osig_submit = (json, from, active, pc) => {
    var Pop = getPathObj(['msso', `${json.sig_block}`]),
        Psigs = getPathObj(['msso', `${json.sig_block}:sigs`]),
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
                    verify_broadcast(msop, sigarr, stats.ms.owner_threshold)
                }
                ops.push({ type: 'put', path: ['msso', `${json.sig_block}:sigs`], data: sigs })
                store.batch(ops, pc);
                //try to sign
            } else {
                pc[0](pc[2])
            }
        })
        .catch(e => { console.log(e); });
}
