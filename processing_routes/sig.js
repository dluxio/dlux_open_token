const config = require('./../config')
const { store } = require("./../index");
const hive = require('@hiveio/hive-js');
const { getPathObj } = require("./../getPathObj");
const { postToDiscord } = require('./../discord')
const { deleteObjs } = require('./../deleteObjs')
const { chronAssign } = require('./../lil_ops')

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
    var Pop = getPathObj(['ms', 'ops', json.op]),
        Pstats = getPathObj(['stats'])
    Promise.all([Pop, Pstats])
        .then(got => {
            let msop = got[0],
                stats = got[1],
                ops = []
                //verify sig
            if (active && Object.keys(msop).length && stats.ms_auths[from]) {
                let next = 0
                for (sig in msop.pend) {
                    if (parseInt(sig) > next)
                        next = parseInt(sig)
                }
                next++
                msop.pend[next.toString()] = {
                    sig: json.sig,
                    by: from
                }

                ops.push({ type: 'put', path: ['ms', 'ops', json.op], data: msop })
                store.batch(ops, pc);
            } else {
                pc[0](pc[2])
            }
        })
        .catch(e => { console.log(e); });
}