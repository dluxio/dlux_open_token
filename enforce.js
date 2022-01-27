const { getPathObj, getPathNum } = require("./getPathObj");
const { store } = require("./index");
const { chronAssign, penalty, add, nodeUpdate, deletePointer, addCol, addGov } = require('./lil_ops')

function enforce(agent, txid, pointer, block_num) {
    console.log('Enforce params:', agent, txid, pointer);
    return new Promise((resolve, reject) => {
        Pop = getPathObj(['escrow', agent, txid]);
        Ppointer = getPathObj(['escrow', pointer.id, pointer.acc]);
        PtokenSupply = getPathNum(['stats', 'tokenSupply']);
        Promise.all([Pop, Ppointer, PtokenSupply])
            .then(r => {
                var enforced_op = r[0],
                    point_to_contract = r[1]
                console.log('enforce:', { enforced_op }, 'pointer:', { point_to_contract });
                if (Object.keys(enforced_op).length) {
                    let op = txid.split(":")[1],
                        id = txid.split(":")[0],
                        ops = [];
                    getPathObj(['contracts', point_to_contract.for, point_to_contract.contract])
                        .then(c => {
                            var i = 0;
                            for (item in c) {
                                i++;
                            }
                            var lil_ops = [];
                            let co = c.co;
                            if (i) {
                                switch (op) {
                                    case 'denyA':
                                        getPathObj(['escrow', '.' + c.to, `${c.from}/${c.escrow_id}:denyT`])
                                            .then(toOp => {
                                                chronAssign(block_num + 200, { op: 'denyT', agent: c.to, txid: `${c.from}/${c.escrow_id}:denyT`, acc: pointer.acc, id: pointer.id });
                                                penalty(c.agent, c.col)
                                                    .then(col => {
                                                        c.recovered = col;
                                                        lil_ops = [
                                                            add('rn', col),
                                                            nodeUpdate(c.agent, 'strike', col)
                                                        ];
                                                        ops.push({ type: 'put', path: ['escrow', c.to, `${c.from}/${c.escrow_id}:denyT`], data: toOp });
                                                        ops.push({ type: 'del', path: ['escrow', c.agent, `${c.from}/${c.escrow_id}:denyA`] });
                                                        ops.push({ type: 'del', path: ['escrow', '.' + c.to, `${c.from}/${c.escrow_id}:denyT`] });
                                                        ops.push({ type: 'put', path: ['contracts', pointed_contract.for, pointed_contract.contract], data: c });
                                                        ops.push({ type: 'put', path: ['feed', `${block_num}:${txid}`], data: `@${c.agent} failed to make a timely transaction and has forfieted ${parseFloat(col / 1000).toFixed(3)} DLUX` });
                                                    })
                                                    .catch(e => { reject(e); });
                                                ops = [];
                                            })
                                            .catch(e => { reject(e); });
                                        break;
                                    case 'denyT':
                                        penalty(c.to, c.col)
                                            .then(col => {
                                                const returnable = col + c.recovered;
                                                console.log(returnable, col, c.recovered);
                                                ops.push({ type: 'put', path: ['feed', `${block_num}:${txid}`], data: `@${c.to} failed to make a timely transaction and has forfieted ${parseFloat(col / 1000).toFixed(3)} DLUX` });
                                                ops.push({ type: 'del', path: ['contracts', pointed_contract.for, pointed_contract.contract] }); //some more logic here to clean memory... or check if this was denies for colateral reasons
                                                ops.push({ type: 'del', path: ['escrow', c.to, `${c.from}/${c.escrow_id}:denyT`] });
                                                lil_ops = [
                                                    deletePointer(pointer.id, pointer.acc),
                                                    nodeUpdate(c.to, 'strike', col)
                                                ];
                                                if (col > parseInt(c.col / 4)) {
                                                    lil_ops.push(add(c.from, parseInt(c.col / 4)));
                                                    lil_ops.push(add('rn', parseInt(col - parseInt(c.col / 4))));
                                                } else if (c.recovered > parseInt(c.col / 4)) {
                                                    lil_ops.push(add(c.from, parseInt(c.col / 4)));
                                                    lil_ops.push(add('rn', parseInt(col - parseInt(c.col / 4))));
                                                } else if (returnable <= parseInt(c.col / 4)) {
                                                    lil_ops.push(add(c.from, returnable));
                                                    lil_ops.push(add('rn', parseInt(-c.recovered)));
                                                } else {
                                                    lil_ops.push(add(c.from, parseInt(c.col / 4)));
                                                    lil_ops.push(add('rn', parseInt(col - c.recovered)));
                                                }
                                            })
                                            .catch(e => { reject(e); });
                                        break;
                                    case 'dispute':
                                        ops.push({ type: 'put', path: ['feed', `${block_num}:${txid}`], data: `@${c.tagent} failed to make a timely transaction and has forfieted collateral` });
                                        ops.push({ type: 'del', path: ['escrow', agent, txid] });
                                        ops.push({ type: 'del', path: ['chrono', c.expire_path] });
                                        ops.push({ type: 'del', path: ['contracts', co, id] });
                                        ops.push({ type: 'put', path: ['stats', 'tokenSupply'], data: s - parseInt(c.escrow / 4) });
                                        lil_ops = [
                                            addGov(c.agent, parseInt(c.escrow / 2)),
                                            add(c.eo, parseInt(c.escrow / 4) - c.fee),
                                            add(c.agent, parseInt(c.fee / 3)),
                                            add('rn', c.fee - parseInt(c.fee / 3)),
                                            addCol(c.agent, -parseInt(c.escrow / 2)),
                                            addCol(c.tagent, -parseInt(c.escrow / 2)),
                                            deletePointer(pointer.id, pointer.acc),
                                            nodeUpdate(c.tagent, 'strike', parseInt(c.escrow / 4))
                                        ]; //strike recorded
                                        break;
                                    case 'buyApproveT':
                                        ops.push({ type: 'put', path: ['feed', `${block_num}:${txid}`], data: `@${c.tagent} failed to make a timely transaction` });
                                        ops.push({ type: 'del', path: ['escrow', agent, txid] });
                                        ops.push({ type: 'del', path: ['chrono', c.expire_path] });
                                        ops.push({ type: 'del', path: ['contracts', co, id] });
                                        ops.push({ type: 'put', path: ['stats', 'tokenSupply'], data: s - parseInt(c.escrow / 4) });
                                        lil_ops = [
                                            addGov(c.agent, parseInt(c.escrow / 2)),
                                            addCol(c.agent, -parseInt(c.escrow / 2)),
                                            addCol(c.tagent, -parseInt(c.escrow / 2)),
                                            add(c.agent, parseInt(c.fee / 3)),
                                            add('rn', c.fee - parseInt(c.fee / 3)),
                                            add(c.eo, parseInt(c.escrow / 4)),
                                            deletePointer(pointer.id, pointer.acc),
                                            nodeUpdate(c.tagent, 'strike', parseInt(c.escrow / 4))
                                        ];
                                        break;
                                    case 'buyApproveA':
                                        ops.push({ type: 'put', path: ['feed', `${block_num}:${txid}`], data: `@${c.agent} failed to make a timely transaction` });
                                        ops.push({ type: 'del', path: ['escrow', agent, txid] });
                                        ops.push({ type: 'del', path: ['chrono', c.expire_path] });
                                        ops.push({ type: 'del', path: ['contracts', co, id] });
                                        ops.push({ type: 'put', path: ['stats', 'tokenSupply'], data: s - parseInt(c.escrow / 4) });
                                        lil_ops = [
                                            addGov(c.tagent, parseInt(c.escrow / 2)),
                                            addCol(c.agent, -parseInt(c.escrow / 2)),
                                            addCol(c.tagent, -parseInt(c.escrow / 2)),
                                            add(c.tagent, parseInt(c.fee / 3)),
                                            add('rn', c.fee - parseInt(c.fee / 3)),
                                            add(c.eo, parseInt(c.escrow / 4)),
                                            deletePointer(pointer.id, pointer.acc),
                                            nodeUpdate(c.agent, 'strike', parseInt(c.escrow / 4))
                                        ];
                                        break;
                                    case 'listApproveT':
                                        ops.push({ type: 'put', path: ['feed', `${block_num}:${txid}`], data: `@${c.tagent} failed to make a timely transaction` });
                                        ops.push({ type: 'del', path: ['escrow', agent, txid] });
                                        ops.push({ type: 'del', path: ['chrono', c.expire_path] });
                                        ops.push({ type: 'del', path: ['contracts', co, id] });
                                        ops.push({ type: 'put', path: ['stats', 'tokenSupply'], data: s - parseInt(c.escrow / 4) });
                                        lil_ops = [
                                            addGov(c.agent, parseInt(c.escrow / 2)),
                                            add(c.eo, parseInt(c.escrow / 4)),
                                            add(c.agent, parseInt(c.fee / 3)),
                                            add('rn', c.fee - parseInt(c.fee / 3)),
                                            addCol(c.agent, -parseInt(c.escrow / 2)),
                                            addCol(c.tagent, -parseInt(c.escrow / 2)),
                                            deletePointer(pointer.id, pointer.acc),
                                            nodeUpdate(c.tagent, 'strike', parseInt(c.escrow / 4))
                                        ];
                                        break;
                                    case 'listApproveA':
                                        ops.push({ type: 'put', path: ['feed', `${block_num}:${txid}`], data: `@${c.agent} failed to make a timely transaction` });
                                        ops.push({ type: 'del', path: ['escrow', agent, txid] });
                                        ops.push({ type: 'del', path: ['chrono', c.expire_path] });
                                        ops.push({ type: 'del', path: ['contracts', co, id] });
                                        ops.push({ type: 'put', path: ['stats', 'tokenSupply'], data: s - parseInt(c.escrow / 4) });
                                        lil_ops = [
                                            addGov(c.tagent, parseInt(c.escrow / 2)),
                                            add(c.eo, parseInt(c.escrow / 4)),
                                            add(c.tagent, parseInt(c.fee / 3)),
                                            add('rn', c.fee - parseInt(c.fee / 3)),
                                            addCol(c.agent, -parseInt(c.escrow / 2)),
                                            addCol(c.tagent, -parseInt(c.escrow / 2)),
                                            deletePointer(pointer.id, pointer.acc),
                                            nodeUpdate(c.agent, 'strike', parseInt(c.escrow / 4))
                                        ];
                                        break;
                                    case 'release':
                                        ops.push({ type: 'put', path: ['feed', `${block_num}:${txid}`], data: `@${c.agent} failed to make a timely transaction and has forfieted collateral` });
                                        ops.push({ type: 'del', path: ['escrow', agent, txid] });
                                        ops.push({ type: 'del', path: ['chrono', c.expire_path] });
                                        ops.push({ type: 'del', path: ['contracts', co, id] });
                                        ops.push({ type: 'put', path: ['stats', 'tokenSupply'], data: s - parseInt(c.escrow / 4) });
                                        lil_ops = [
                                            addGov(c.tagent, parseInt(c.escrow / 2)),
                                            add(c.eo, parseInt(c.escrow / 4)),
                                            add(c.tagent, parseInt(c.fee / 3)),
                                            add('rn', c.fee - parseInt(c.fee / 3)),
                                            deletePointer(pointer.id, pointer.acc),
                                            nodeUpdate(c.agent, 'strike', parseInt(c.escrow / 4))
                                        ];
                                        break;
                                    case 'transfer':
                                        ops.push({ type: 'put', path: ['feed', `${block_num}:${txid}`], data: `@${c.tagent} failed to make a timely transaction and has forfieted collateral` });
                                        ops.push({ type: 'del', path: ['escrow', agent, txid] });
                                        ops.push({ type: 'del', path: ['chrono', c.expire_path] });
                                        ops.push({ type: 'del', path: ['contracts', co, id] });
                                        ops.push({ type: 'put', path: ['stats', 'tokenSupply'], data: s - parseInt(c.escrow / 2) });
                                        lil_ops = [
                                            add(c.eo, parseInt(c.escrow / 2)),
                                            add('rn', parseInt(c.fee / 3)),
                                            addCol(c.tagent, -parseInt(c.escrow)),
                                            deletePointer(pointer.id, pointer.acc),
                                            nodeUpdate(c.tagent, 'strike', parseInt(c.escrow / 4))
                                        ];
                                        break;
                                    case 'cancel':
                                        ops.push({ type: 'put', path: ['feed', `${block_num}:${txid}`], data: `@${c.tagent} failed to make a timely transaction and has forfieted collateral` });
                                        ops.push({ type: 'del', path: ['escrow', agent, txid] });
                                        ops.push({ type: 'del', path: ['chrono', c.expire_path] });
                                        ops.push({ type: 'del', path: ['contracts', co, id] });
                                        ops.push({ type: 'put', path: ['stats', 'tokenSupply'], data: s - parseInt(c.escrow / 4) });
                                        lil_ops = [
                                            addGov(c.agent, parseInt(c.escrow / 2)),
                                            add(c.eo, parseInt(c.escrow / 4)),
                                            addCol(c.agent, -parseInt(c.escrow / 2)),
                                            addCol(c.tagent, -parseInt(c.escrow / 2)),
                                            deletePointer(pointer.id, pointer.acc),
                                            nodeUpdate(c.tagent, 'strike', parseInt(c.escrow / 4))
                                        ];
                                        break;
                                    default:
                                        console.log(`Unknown Op: ${op}`);
                                        resolve();
                                }
                            }
                            waitfor(lil_ops)
                                .then(empty => {
                                    store.batch(ops, [resolve, reject]);
                                })
                                .catch(e => { reject(e); });
                        })
                        .catch(e => {
                            reject(e);
                        });
                } else {
                    resolve();
                }
            })
            .catch(e => {
                reject(e);
            });
    });
}
exports.enforce = enforce;

function waitfor(promises_array) {
    return new Promise((resolve, reject) => {
        Promise.all(promises_array)
            .then(r => {
                for (i = 0; i < r.length; i++) {
                    console.log(r[i])
                    if (r[i].consensus) {
                        plasma.consensus = r[1].consensus
                    }
                }
                resolve(1)
            })
            .catch(e => { reject(e) })
    })
}