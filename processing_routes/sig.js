const config = require('./../config')
const { store } = require("./../index");
const { getPathObj } = require("./../getPathObj");
const { postToDiscord } = require('./../discord')
const { deleteObjs } = require('./../deleteObjs')
const { chronAssign, signedBy, broadcast } = require('./../lil_ops');

exports.account_update = (json, pc) => { //ensure proper keys are on record for DAO accounts
        let agentsP = getPathObj(['agents']),
            statsP = getPathObj(['stats']),
            keysP = getPathObj(['markets', 'node', json.account, 'pubKey'])
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
                    ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: 'MultiSig Account Update' })
                            
                    console.log(ops);
                    store.batch(ops, pc)
                } else if (keyPair && json.active !== undefined && json.active.key_auths[0]) {
                    ops.push({ type: 'put', path: ['markets', 'node', json.account, 'pubKey'], data: json.active.key_auths[0][0] }) //keep record of public keys of node operators
                    ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: `@${json.account} Account Update` })
                            
                    console.log(ops);
                    store.batch(ops, pc)
                } else {
                    pc[0](pc[2])
                }
            })
            .catch(e => { console.log(e) })
    }

exports.sig_submit = (json, from, active, pc) => {
    if(active){
        var Pop = getPathObj(['ms', 'ops', json.op]),
            Pstats = getPathObj(['stats']),
            Pagents = getPathObj(['agents'])
    Promise.all([Pop, Pstats, Pagents])
        .then(got => {
            let msop = JSON.parse(got[0]),
                stats = got[1],
                agents = got[2],
                ops = [],
                op = {
                    expiration: msop.expiration,
                    extensions: msop.extensions,
                    operations: msop.operations,
                    ref_block_num: msop.ref_block_num,
                    ref_block_prefix: msop.ref_block_prefix,
                }
            if(signedBy(op, json.sig, agents)){
                msop.signatures.push(json.sig)
                if(msop.signatures.length === stats.auth_at){
                    //broadcast tx
                    if(config.username === config.leader){ //fall thru to different account? maybe orered by stake?
                        broadcast(msop)
                            .then(r=>console.log('Multi-Sig Send Success\n', r))
                            .catch(e=>console.log('Multi-Sig Send Failure\n', e))
                    }
                    //move op to queue and enforce //edge case: account update increases weight before broadcast... sigs will be added to the msop and the enforcement should catch it later.
                    // edge case: pull bad signatures out of op.
                    msop.chron = chronAssign(json.block_num + 30, {
                        block: json.block_num + 30,
                        op: 'ms_send',
                        attempts: JSON.stringify([config.leader]),
                        txid: json.op
                    })
                }
                ops.push({ type: 'put', path: ['ms', 'ops', json.op], data: JSON.stringify(msop) })
                store.batch(ops, pc);
            } else {
                pc[0](pc[2])
            }
        })
        .catch(e => { console.log(e); });
    } else {
        pc[0](pc[2])
    }
}

exports.ms_signed = (json, from, active, pc) => {
    if(active && from === config.msaccount){
        store.batch([{type: 'del', path:['ms', 'ops', json.op]}], pc)
    } else {
        pc[0](pc[2])
    }
}

/*
(async () => {
  // Pulling transaction data
  //const trx = await client.database.getTransaction({ block_num: args[0], id: args[1] });

  // New signature object from transaction signature
  //const sig = Signature.fromString(trx.signatures[0]);

  // Recreting transaction message
  const op = {
    expiration: trx.expiration,
    extensions: trx.extensions,
    operations: trx.operations,
    ref_block_num: trx.ref_block_num,
    ref_block_prefix: trx.ref_block_prefix,
  };

  const digest = cryptoUtils.transactionDigest(msg);

  // Finding public key of the private that was used to sign
  const key = (new Signature(sig.data, sig.recovery)).recover(digest);

  const publicKey = key.toString();

  // Finding owner of that public key
  //const [owner] = await client.database.call('get_key_references', [[publicKey]]);

  console.log(`Public Key: ${publicKey}`);
  console.log(`Owner: ${owner}`);
})();
*/