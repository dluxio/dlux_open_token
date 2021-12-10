const config = require('./../config')
const { store } = require("./../index");
const hive = require('@hiveio/hive-js');
const { getPathObj, deleteObjs } = require("./../getPathObj");
const { postToDiscord } = require('./../discord')
const { chronAssign } = require('./../lil_ops')
const { verify_broadcast } = require('./../tally')

exports.account_update = (json, pc) => {
    Pnode = getPathObj(['makerts', 'node', json.account])
    Promise.all([Pnode])
        .then(r => {
            node = r[0]
            if (Object.keys(node).length) {
                if (JSON.parse(json.json_metadata).dluxPubKey) {
                    node.pubKey_to_verify = JSON.parse(json.json_metadata).dluxPubKey
                } else if (json.active && json.active.key_auths.length == 1) {
                    node.pubKey_to_verify = json.active.key_auths[0][0]
                } else {
                    pc[0](pc[2])
                }
                let ops = [{ type: 'put', path: ['makerts', 'node', json.account], data: node }]
                store.batch(ops, pc)
            } else if (json.account == config.msaccount) {
                deleteObjs(['ms', 'ops', `account_update:${JSON.parse(json.json_metadata).id}`])
                    .then(empty => pc[0](pc[2]))
            } else {
                pc[0](pc[2])
            }
        })
        .catch(e => {
            pc[0](pc[2])
        })
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