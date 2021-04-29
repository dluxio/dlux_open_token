const config = require('./../config')
const { store, GetNodeOps, newOps, unshiftOp, pushOp, spliceOp } = require('./../index')
const { getPathNum } = require('./../getPathNum')
const { getPathObj } = require('./../getPathObj')
const { add, addCol, addGov, release, deletePointer, credit, chronAssign, forceCancel, hashThis, isEmpty } = require('./../lil_ops')
const { postToDiscord } = require('./../discord')

exports.dex_buy = (json, from, active, pc) => {
    let Pbal = getPathNum(['balances', from]),
        Pfound = getPathObj(['contracts', json.for, json.contract.split(':')[1]]),
        PhiveVWMA = getPathObj(['stats', 'HiveVWMA']),
        PhbdVWMA = getPathObj(['stats', 'HbdVWMA'])
    Promise.all([Pbal, Pfound, PhiveVWMA, PhbdVWMA])
        .then(function(v) {
            var bal = v[0],
                found = v[1],
                hiveVWMA = v[2],
                hbdVWMA = v[3],
                type = 'hive',
                agent
            if (found.hbd)
                type = 'hbd'
            if (found.auths)
                agent = found.auths[0][1][1].to
            if (found.amount && active && bal >= found.amount) {
                var PbalFor = getPathNum(['balances', found.from]),
                    PBook = getPathObj(['dex', type, 'buyOrders'])
                Promise.all([PbalFor, PBook])
                    .then(function(v) {
                        console.log({ v })
                        var fromBal = v[0],
                            Book = v[1],
                            ops = [],
                            highest = 0,
                            lil_ops = []
                        for (i in Book) {
                            if (parseFloat(i.split(":")[0]) > highest) {
                                highest = parseFloat(i.split(":")[0])
                            }
                        }
                        if (bal > found.amount && parseFloat(found.rate) >= parseFloat(highest) * 0.99 && Book.hasOwnProperty(json.contract)) {
                            bal -= found.amount
                            fromBal += found.amount
                            found.buyer = from
                            var hisE = {
                                rate: found.rate,
                                block: json.block_num,
                                amount: found.amount
                            }
                            hiveTimeWeight = 1 - ((json.block_num - hiveVWMA.block) * 0.000033)
                            hbdTimeWeight = 1 - ((json.block_num - hbdVWMA.block) * 0.000033)
                            if (hiveTimeWeight < 0) { hiveTimeWeight = 0 }
                            if (hbdTimeWeight < 0) { hbdTimeWeight = 0 }
                            if (type == 'hbd') {
                                hbdVWMA = {
                                    rate: parseFloat(((found.rate * found.amount) + (parseFloat(hbdVWMA.rate) * hbdVWMA.vol * hbdTimeWeight)) / (found.amount + (hbdVWMA.vol * hbdTimeWeight))).toFixed(6),
                                    block: json.block_num,
                                    vol: parseInt(found.amount + (hbdVWMA.vol * hbdTimeWeight))
                                }
                                lil_ops.push(forceCancel(hbdVWMA.rate, 'hbd', json.block_num))
                            } else {
                                hiveVWMA = {
                                    rate: parseFloat(((found.rate * found.amount) + (parseFloat(hiveVWMA.rate) * hiveVWMA.vol * hiveTimeWeight)) / (found.amount + (hiveVWMA.vol * hiveTimeWeight))).toFixed(6),
                                    block: json.block_num,
                                    vol: parseInt(found.amount + (hiveVWMA.vol * hiveTimeWeight))
                                }
                                lil_ops.push(forceCancel(hiveVWMA.rate, 'hive', json.block_num))
                            }
                            if (found.hive) {
                                const msg = `@${from}| purchased ${parseFloat(found.hive / 1000).toFixed(3)} HIVE with ${parseFloat(found.amount / 1000).toFixed(3)} ${config.TOKEN} via DEX`
                                if (config.hookurl) postToDiscord(msg)
                                ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg })
                                found.auths[2] = [agent, [
                                    "transfer",
                                    {
                                        "from": agent,
                                        "to": from,
                                        "amount": (found.hive / 1000).toFixed(3) + ' HIVE',
                                        "memo": `${json.contract.split(':')[1]} by ${found.from} purchased with ${parseFloat(found.amount / 1000).toFixed(3)} ${config.TOKEN}`
                                    }
                                ]]
                            } else {
                                const msg = `@${from}| purchased ${parseFloat(found.hbd / 1000).toFixed(3)} HBD via DEX`
                                if (config.hookurl) postToDiscord(msg)
                                ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg })
                                found.auths[2] = [agent, [
                                    "transfer",
                                    {
                                        "from": agent,
                                        "to": from,
                                        "amount": (found.hbd / 1000).toFixed(3) + ' HBD',
                                        "memo": `${json.contract.split(':')[1]} by ${found.from} fulfilled with ${parseFloat(found.amount / 1000).toFixed(3)} ${config.TOKEN}`
                                    }
                                ]]
                            }
                            lil_ops.push(chronAssign(json.block_num + 200, { op: 'check', agent: found.auths[0][0], txid: found.txid + ':dispute', acc: found.from, id: found.escrow_id.toString() }))
                            Promise.all(lil_ops)
                                .then(empty => {
                                    ops = [
                                        ops[0],
                                        { type: 'put', path: ['contracts', json.for, json.contract.split(':')[1]], data: found },
                                        { type: 'put', path: ['escrow', found.auths[0][0], found.txid + ':dispute'], data: found.auths[0][1] },
                                        { type: 'put', path: ['balances', from], data: bal },
                                        { type: 'put', path: ['balances', found.from], data: fromBal },
                                        { type: 'put', path: ['stats', 'HbdVWMA'], data: hbdVWMA },
                                        { type: 'put', path: ['stats', 'HiveVWMA'], data: hiveVWMA, },
                                        { type: 'put', path: ['dex', type, 'tick'], data: json.contract.split(':')[0] },
                                        { type: 'put', path: ['dex', type, 'his', `${hisE.block}:${json.contract.split(':')[1]}`], data: hisE },
                                        { type: 'del', path: ['dex', type, 'buyOrders', `${json.contract}`] }
                                    ]
                                    if (process.env.npm_lifecycle_event == 'test') pc[2] = ops
                                    store.batch(ops, pc)
                                })
                                .catch(e => { console.log(e) })
                        } else {
                            const msg = `@${from}| has insuficient liquidity to purchase ${found.txid}`
                            if (config.hookurl) postToDiscord(msg)
                            ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg })
                            if (process.env.npm_lifecycle_event == 'test') pc[2] = ops
                            store.batch(ops, pc)
                        }
                    })
            }
        })
}

exports.dex_hive_sell = (json, from, active, pc) => {
    let buyAmount = parseInt(json.hive),
        PfromBal = getPathNum(['balances', from]),
        PhiveVWMA = getPathObj(['stats', 'HiveVWMA'])
    Promise.all([PfromBal, PhiveVWMA]).then(a => {
        let b = a[0],
            hiveVWMA = a[1],
            ops = []
        rate = parseFloat((buyAmount) / parseInt(json[config.jsonTokenName])).toFixed(6)
        let hours = parseInt(json.hours) || 1
        if (hours > 120) { hours = 120 }
        const expBlock = json.block_num + (hours * 1200)
        if (json[config.jsonTokenName] <= b && json[config.jsonTokenName] >= 4 && typeof buyAmount == 'number' && allowedPrice(hiveVWMA.rate, rate) && active) {
            var txid = config.TOKEN + hashThis(from + json.transaction_id)
            let fee = parseInt(json[config.jsonTokenName] * 0.0025) + 3
            const contract = {
                txid,
                type: 'ss',
                co: from,
                from: from,
                hive: buyAmount,
                hbd: 0,
                fee,
                amount: parseInt(json[config.jsonTokenName]),
                rate: parseFloat((buyAmount) / (json[config.jsonTokenName])).toFixed(6),
                block: json.block_num
            }
            var path = chronAssign(expBlock, {
                block: expBlock,
                op: 'expire',
                from: from,
                txid
            })
            Promise.all([path])
                .then(r => {
                    contract.expire_path = r[0]
                    const msg = `@${from}| has placed order ${txid} to sell ${parseFloat(json[config.jsonTokenName] / 1000).toFixed(3)} for ${parseFloat(json.hive / 1000).toFixed(3)} HIVE`
                    if (config.hookurl) postToDiscord(msg)
                    ops = [
                        { type: 'put', path: ['dex', 'hive', 'sellOrders', `${contract.rate}:${contract.txid}`], data: contract },
                        { type: 'put', path: ['balances', from], data: b - contract.amount },
                        { type: 'put', path: ['contracts', from, contract.txid], data: contract },
                        { type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg }
                    ]
                    if (process.env.npm_lifecycle_event == 'test') pc[2] = ops
                    store.batch(ops, pc)
                })
                .catch((e) => console.log(e))
        } else {
            const msg = `@${from}| tried to place an order to sell ${parseFloat(json[config.jsonTokenName] / 1000).toFixed(3)} for ${parseFloat(json.hive / 1000).toFixed(3)} HIVE`
            if (config.hookurl) postToDiscord(msg)
            ops = [{ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg }]
            if (process.env.npm_lifecycle_event == 'test') pc[2] = ops
            store.batch(ops, pc)
        }
    }).catch(e => {
        console.log(e)
        pc[0]()
    })
}

exports.dex_hbd_sell = (json, from, active, pc) => {
    let buyAmount = parseInt(json.hbd),
        PfromBal = getPathNum(['balances', from]),
        PhbdHis = getPathObj(['stats', 'HbdVWMA'])
    Promise.all([PfromBal, PhbdHis]).then(a => {
            let b = a[0],
                hbdVWMA = a[1],
                rate = parseFloat((buyAmount) / (json[config.jsonTokenName])).toFixed(6)
            let hours = parseInt(json.hours) || 1
            if (hours > 120) { hours = 120 }
            const expBlock = json.block_num + (hours * 1200)
            if (json[config.jsonTokenName] <= b && json[config.jsonTokenName] >= 4 && typeof buyAmount == 'number' && allowedPrice(hbdVWMA.rate, rate) && active) {
                var txid = config.TOKEN + hashThis(from + json.transaction_id)
                let fee = parseInt(json[config.jsonTokenName] * 0.0025) + 3
                const contract = {
                    txid,
                    type: 'ds',
                    from: from,
                    hive: 0,
                    co: from,
                    hbd: buyAmount,
                    fee,
                    amount: json[config.jsonTokenName],
                    rate,
                    block: json.block_num
                }
                var path = chronAssign(expBlock, {
                    block: expBlock,
                    op: 'expire',
                    from: from,
                    txid
                })
                Promise.all([path])
                    .then((r) => {
                        contract.expire_path = r[0]
                        const msg = `@${from}| has placed order ${txid} to sell ${parseFloat(json[config.jsonTokenName] / 1000).toFixed(3)} for ${parseFloat(json.hbd / 1000).toFixed(3)} HBD`
                        if (config.hookurl) postToDiscord(msg)
                        let ops = [
                            { type: 'put', path: ['dex', 'hbd', 'sellOrders', `${contract.rate}:${contract.txid}`], data: contract },
                            { type: 'put', path: ['balances', from], data: b - contract.amount },
                            { type: 'put', path: ['contracts', from, contract.txid], data: contract },
                            { type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg }
                        ]
                        if (process.env.npm_lifecycle_event == 'test') pc[2] = ops
                        store.batch(ops, pc)
                    })
                    .catch((e) => console.log(e))
            } else {
                const msg = `@${from}| tried to place an order to sell ${parseFloat(json[config.jsonTokenName] / 1000).toFixed(3)} for ${parseFloat(json.hbd / 1000).toFixed(3)} HBD`
                if (config.hookurl) postToDiscord(msg)
                let ops = [{ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg }]
                if (process.env.npm_lifecycle_event == 'test') pc[2] = ops
                store.batch(ops, pc)
            }
        })
        .catch(e => {
            pc[0]()
            console.log(e)
        })
}

exports.escrow_approve = (json, pc) => {
    //need to build checks for approving denies, and cleanup as well.
    store.get(['escrow', json.escrow_id.toString(), json.from], function(e, a) {
        console.log(a, Object.keys(a).length)
        if (!e && Object.keys(a).length) {
            store.get(['contracts', a.for, a.contract], function(e, b) {
                if (e) { console.log(e1) }
                if (Object.keys(b).length) {
                    var c = b
                    console.log(c)
                    var dataOps = [],
                        lil_ops = []
                    if (json.approve && c.buyer) {
                        if (json.who == json.agent) {
                            c.approveAgent = true
                            store.put(['contracts', a.for, a.contract, 'approveAgent'], true, function() {
                                store.get(['contracts', a.for, a.contract, 'approve_to'], function(e, t) {
                                    if (t) {
                                        console.log('to then agent' + t)
                                        c.approve_to = true
                                        lil_ops.push(chronAssign(json.block_num + 200, { op: 'check', agent: c.auths[0][0], txid: c.txid + ':dispute', acc: c.from, id: c.escrow_id.toString() }))
                                        dataOps.push({ type: 'put', path: ['escrow', c.auths[0][0], c.txid + ':dispute'], data: c.auths[0][1] })
                                    }
                                    dataOps.push({ type: 'del', path: ['escrow', json.who, c.txid + ':buyApproveA'] })
                                    if (json.who == config.username) {
                                        let NodeOps = GetNodeOps()
                                        for (var i = 0; i < NodeOps.length; i++) {
                                            if (NodeOps[i][1][1].from == json.from && NodeOps[i][1][1].escrow_id == json.escrow_id && NodeOps[i][1][0] == 'escrow_approve') {
                                                spliceOp(i)
                                            }
                                        }
                                        //delete plasma.pending[c.txid + ':buyApproveA']
                                    }
                                    const msg = `@${json.who}| approved escrow for ${json.from}`
                                    if (config.hookurl) postToDiscord(msg)
                                    dataOps.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg })
                                    dataOps.push({ type: 'put', path: ['contracts', a.for, a.contract], data: c })
                                    lil_ops.push(credit(json.who))
                                    Promise.all(lil_ops)
                                        .then(empty => {
                                            if (process.env.npm_lifecycle_event == 'test') pc[2] = ops
                                            store.batch(dataOps, pc)
                                        })
                                        .catch(e => { console.log(e) })
                                })
                            })
                        } else if (json.who == json.to) {
                            c.approve_to = true
                            store.put(['contracts', a.for, a.contract, 'approve_to'], true, function() {
                                store.get(['contracts', a.for, a.contract, 'approveAgent'], function(e, t) {
                                    if (t) {
                                        console.log('agent then to' + t)
                                        c.approveAgent = true
                                        lil_ops.push(chronAssign(json.block_num + 200, { op: 'check', agent: c.auths[0][0], txid: c.txid + ':dispute', acc: c.from, id: c.escrow_id.toString() }))
                                        dataOps.push({ type: 'put', path: ['escrow', c.auths[0][0], c.txid + ':dispute'], data: c.auths[0][1] })

                                    }
                                    dataOps.push({ type: 'del', path: ['escrow', json.who, c.txid + ':buyApproveT'] })
                                    if (json.who == config.username) {
                                        let NodeOps = GetNodeOps()
                                        for (var i = 0; i < NodeOps.length; i++) {
                                            if (NodeOps[i][1][1].from == json.from && NodeOps[i][1][1].escrow_id == json.escrow_id && NodeOps[i][1][0] == 'escrow_approve') {
                                                spliceOp(i)
                                            }
                                        }
                                        //delete plasma.pending[c.txid + ':buyApproveT']
                                    }
                                    console.log(a.contract, c)
                                    const msg = `@${json.who}| approved escrow for ${json.from}`
                                    if (config.hookurl) postToDiscord(msg)
                                    dataOps.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg })
                                    dataOps.push({ type: 'put', path: ['contracts', a.for, a.contract], data: c })
                                    lil_ops.push(credit(json.who))
                                    Promise.all(lil_ops)
                                        .then(empty => {
                                            if (process.env.npm_lifecycle_event == 'test') pc[2] = dataOps
                                            store.batch(dataOps, pc)
                                        })
                                        .catch(e => { console.log(e) })
                                })
                            })
                        }
                    } else if (json.approve && json.who == json.to && c.type) { //no contract update... update approvals?
                        const msg = `@${json.who}| approved escrow for ${json.from}`
                        if (config.hookurl) postToDiscord(msg)
                        dataOps.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg })
                        dataOps.push({ type: 'del', path: ['escrow', json.who, c.txid + ':listApproveT'] })
                        if (json.who == config.username) {
                            let NodeOps = GetNodeOps()
                            for (var i = 0; i < NodeOps.length; i++) {
                                if (NodeOps[i][1][1].from == json.from && NodeOps[i][1][1].escrow_id == json.escrow_id && NodeOps[i][1][0] == 'escrow_approve') {
                                    spliceOp(i)
                                }
                            }
                            //delete plasma.pending[c.txid + ':listApproveT']
                        }
                        c.approve_to = true
                        if (c.approveAgent) {
                            if (parseFloat(c.hive) > 0) {
                                //contract.type = 'sb'
                                const msg = `@${c.eo}| signed a ${parseFloat(c.hive / 1000).toFixed(3)} HIVE buy order for ${parseFloat(c.amount /1000).toFixed(3)} ${config.TOKEN}`
                                if (config.hookurl) postToDiscord(msg)
                                dataOps.push({ type: 'put', path: ['feed', `${json.block_num}:${c.txid}`], data: msg })
                                dataOps.push({ type: 'put', path: ['dex', 'hive', 'buyOrders', `${c.rate}:${c.txid}`], data: c })
                            } else if (parseFloat(c.hbd) > 0) {
                                //contract.type = 'db'
                                const msg = `@${c.eo}| signed a ${parseFloat(c.hbd / 1000).toFixed(3)} HBD buy order for ${parseFloat(c.amount /1000).toFixed(3)} ${config.TOKEN}`
                                if (config.hookurl) postToDiscord(msg)
                                dataOps.push({ type: 'put', path: ['feed', `${json.block_num}:${c.txid}`], data: msg })
                                dataOps.push({ type: 'put', path: ['dex', 'hbd', 'buyOrders', `${c.rate}:${c.txid}`], data: c })
                            }
                        }
                        dataOps.push({ type: 'put', path: ['contracts', a.for, a.contract], data: c })
                        lil_ops.push(credit(json.who))
                        Promise.all(lil_ops)
                            .then(empty => {
                                if (process.env.npm_lifecycle_event == 'test') pc[2] = dataOps
                                store.batch(dataOps, pc)
                            })
                            .catch(e => { console.log(e) })
                    } else if (json.approve && json.who == json.agent && c.type) { //no contract update... update list approvals, maybe this is where to pull collateral?
                        const msg = `@${json.who}| approved escrow for ${json.from}`
                        if (config.hookurl) postToDiscord(msg)
                        dataOps.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg })
                        dataOps.push({ type: 'del', path: ['escrow', json.who, c.txid + ':listApproveA'] })
                        if (json.who == config.username) {
                            let NodeOps = GetNodeOps()
                            for (var i = 0; i < NodeOps.length; i++) {
                                if (NodeOps[i][1][1].from == json.from && NodeOps[i][1][1].escrow_id == json.escrow_id && NodeOps[i][1][0] == 'escrow_approve') {
                                    spliceOp(i)
                                }
                            }
                            //delete plasma.pending[c.txid + ':listApproveA']
                        }
                        c.approveAgent = true
                        if (c.approve_to) {
                            if (parseFloat(c.hive) > 0) {
                                //contract.type = 'sb'
                                const msg = `@${c.eo}| signed a ${parseFloat(c.hive / 1000).toFixed(3)} HIVE buy order for ${parseFloat(c.amount/1000).toFixed(3)}`
                                if (config.hookurl) postToDiscord(msg)
                                dataOps.push({ type: 'put', path: ['feed', `${json.block_num}:${c.txid}`], data: msg })
                                dataOps.push({ type: 'put', path: ['dex', 'hive', 'buyOrders', `${c.rate}:${c.txid}`], data: c })
                            } else if (parseFloat(c.hbd) > 0) {
                                //contract.type = 'db'
                                const msg = `@${c.eo}| signed a ${parseFloat(c.hbd / 1000).toFixed(3)} HBD buy order for ${parseFloat(c.amount/1000).toFixed(3)}`
                                if (config.hookurl) postToDiscord(msg)
                                dataOps.push({ type: 'put', path: ['feed', `${json.block_num}:${c.txid}`], data: msg })
                                dataOps.push({ type: 'put', path: ['dex', 'hbd', 'buyOrders', `${c.rate}:${c.txid}`], data: c })
                            }
                        }
                        dataOps.push({ type: 'put', path: ['contracts', a.for, a.contract], data: c })
                        lil_ops.push(credit(json.who))
                        Promise.all(lil_ops)
                            .then(empty => {
                                if (process.env.npm_lifecycle_event == 'test') pc[2] = dataOps
                                store.batch(dataOps, pc)
                            })
                            .catch(e => { console.log(e) })
                    } else if (!json.approve && c.note == 'denied transaction' && json.who == json.agent) {
                        dataOps.push({ type: 'del', path: ['contracts', a.for, a.contract] }) //some more logic here to clean memory... or check if this was denies for colateral reasons
                        dataOps.push({ type: 'del', path: ['escrow', json.agent, `${json.from}/${json.escrow_id}:denyA`] })
                        dataOps.push({ type: 'del', path: ['escrow', '.' + json.to, `${json.from}/${json.escrow_id}:denyT`] })
                        dataOps.push({ type: 'del', path: ['escrow', json.to, `${json.from}/${json.escrow_id}:denyT`] }) //try to prevent some errors from cascading to more burns
                        dataOps.push({ type: 'del', path: ['escrow', c.escrow_id, c.from] })
                        lil_ops.push(credit(json.who))
                        Promise.all(lil_ops)
                            .then(empty => {
                                if (process.env.npm_lifecycle_event == 'test') pc[2] = dataOps
                                store.batch(dataOps, pc)
                            })
                            .catch(e => { console.log(e) })
                    } else if (!json.approve && c.note == 'denied transaction' && json.who == json.to) {
                        console.log('Out of order deny, odd but OK...')
                        dataOps.push({ type: 'del', path: ['contracts', a.for, a.contract] }) //some more logic here to clean memory... or check if this was denies for colateral reasons
                        dataOps.push({ type: 'del', path: ['escrow', json.to, `${json.from}/${json.escrow_id}:denyT`] })
                        dataOps.push({ type: 'del', path: ['escrow', json.agent, `${json.from}/${json.escrow_id}:denyA`] })
                        dataOps.push({ type: 'del', path: ['escrow', c.escrow_id, c.from] })
                        lil_ops.push(credit(json.who))
                        Promise.all(lil_ops)
                            .then(empty => {
                                if (process.env.npm_lifecycle_event == 'test') pc[2] = dataOps
                                store.batch(dataOps, pc)
                            })
                            .catch(e => { console.log(e) })
                    } else {
                        pc[0](pc[2])
                    }
                }
            })
        }
    })
}

exports.escrow_dispute = (json, pc) => {
    getPathObj(['escrow', json.escrow_id.toString(), json.from])
        .then(a => {
            console.log(a)
            getPathObj(['contracts', a.for, a.contract]) //probably put a contract.status for validity checks
                .then(c => {
                    if (Object.keys(c).length == 0) {
                        console.log(c, json)
                        pc[0](pc[2]) //contract not found continue
                    } else { // no validity checks? where does collateral get fixed -- no contract update
                        let lil_ops = [
                            chronAssign(json.block_num + 200, { op: 'check', agent: c.auths[2][0], txid: c.txid + ':release', acc: c.from, id: c.escrow_id.toString() }),
                            credit(json.who)
                        ]
                        Promise.all(lil_ops)
                            .then(empty => {
                                const msg = `@${json.who}| authorized ${json.agent} for ${c.txid}`
                                if (config.hookurl) postToDiscord(msg)
                                ops = [
                                    { type: 'put', path: ['escrow', c.auths[1][0], c.txid + ':release'], data: c.auths[1][1] },
                                    { type: 'put', path: ['contracts', a.for, a.contract], data: c },
                                    { type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg },
                                    { type: 'del', path: ['escrow', json.who, c.txid + `:dispute`] }
                                ]
                                if (process.env.npm_lifecycle_event == 'test') pc[2] = ops
                                store.batch(ops, pc)
                            })
                            .catch(e => { console.log(e) })
                    }
                })
                .catch(e => { console.log(e) })
        })
        .catch(e => { console.log(e) })
}

exports.escrow_release = (json, pc) => {
    getPathObj(['escrow', json.escrow_id.toString(), json.from])
        .then(a => {
            getPathObj(['contracts', a.for, a.contract])
                .then(c => {
                    if (Object.keys(c).length && c.auths[2]) {
                        let lil_ops = [
                            addGov(json.agent, parseInt(c.escrow / 2)),
                            addCol(json.agent, -parseInt(c.escrow / 2)),
                            add(json.agent, parseInt(c.fee / 3)),
                            add('rn', parseInt(c.fee / 3) + c.fee - (parseInt(c.fee / 3) * 3)),
                            chronAssign(json.block_num + 200, { op: 'check', agent: c.auths[2][0], txid: c.txid + ':transfer', acc: c.from, id: c.escrow_id.toString() }),
                            credit(json.who)
                        ]
                        c.escrow = parseInt(c.escrow / 2)
                        Promise.all(lil_ops)
                            .then(empty => {
                                const msg = `@${json.who}| released funds for @${json.to} for ${c.txid}`
                                if (config.hookurl) postToDiscord(msg)
                                ops = [
                                    { type: 'put', path: ['escrow', c.auths[2][0], c.txid + ':transfer'], data: c.auths[2][1] },
                                    { type: 'put', path: ['contracts', a.for, a.contract], data: c },
                                    { type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg },
                                    { type: 'del', path: ['escrow', json.who, c.txid + `:release`] }
                                ]
                                if (process.env.npm_lifecycle_event == 'test') pc[2] = ops
                                store.batch(ops, pc)
                            })
                            .catch(e => { console.log(e) })
                    } else if (c.cancel && json.receiver == c.from) {
                        let lil_ops = [
                            addGov(json.agent, parseInt(c.escrow / 2)),
                            addGov(json.to, parseInt(c.escrow / 2)),
                            addCol(json.agent, -parseInt(c.escrow / 2)),
                            addCol(json.to, -parseInt(c.escrow / 2)),
                            deletePointer(c.escrow_id, a.for),
                            credit(json.who)
                        ]
                        Promise.all(lil_ops)
                            .then(empty => {
                                const msg = `@${json.from}| canceled ${c.txid}`
                                if (config.hookurl) postToDiscord(msg)
                                let ops = [
                                    { type: 'del', path: ['contracts', a.for, a.contract], data: c },
                                    { type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg },
                                    { type: 'del', path: ['chrono', c.expire_path] },
                                    { type: 'del', path: ['escrow', json.who, c.txid + `:cancel`] }
                                ]
                                if (process.env.npm_lifecycle_event == 'test') pc[2] = ops
                                store.batch(ops, pc)
                            })
                            .catch(e => { console.log(e) })
                    } else {
                        pc[0](pc[2])
                    }
                })
                .catch(e => { console.log(e) })
        })
        .catch(e => { console.log(e) })
}

exports.transfer = (json, pc) => {
    store.get(['escrow', json.from, json.memo.split(' ')[0] + ':transfer'], function(e, a) {
        var ops = []
        if (!e && !isEmpty(a)) {
            let auth = true,
                terms = Object.keys(a[1])
            for (i = 0; i < terms.length; i++) {
                if (json[terms[i]] !== a[1][terms[i]]) {
                    auth = false
                }
            }
            console.log('authed ' + auth)
            if (auth) {
                const msg = `@${json.from}| sent @${json.to} ${json.amount} for ${json.memo.split(' ')[0]}`
                if (config.hookurl) postToDiscord(msg)
                ops.push({
                    type: 'put',
                    path: ['feed', `${json.block_num}:${json.transaction_id}`],
                    data: msg
                })
                let addr = json.memo.split(' ')[0],
                    co = json.memo.split(' ')[2],
                    cp = getPathObj(['contracts', co, addr]),
                    sp = getPathObj(['contracts', json.to, addr]),
                    gp = getPathNum(['gov', json.from])
                Promise.all([cp, gp, sp])
                    .then(ret => {
                        let d = ret[1],
                            c = ret[0]
                        if (!c.escrow_id) {
                            c = ret[2]
                            co = c.co
                        }
                        eo = c.buyer,
                            g = c.escrow
                        if (c.type === 'sb' || c.type === 'db')
                            eo = c.from
                        console.log(c)
                        let lil_ops = [
                            addGov(json.from, parseInt(c.escrow)),
                            addCol(json.from, -parseInt(c.escrow)),
                            add(json.from, parseInt(c.fee / 3)),
                            deletePointer(c.escrow_id, eo),
                            credit(json.from)
                        ]
                        console.log(json.from, parseInt(c.fee / 3))
                        ops.push({ type: 'del', path: ['escrow', json.from, addr + ':transfer'] })
                        ops.push({ type: 'del', path: ['contracts', co, addr] })
                        ops.push({ type: 'del', path: ['chrono', c.expire_path] })
                        if (json.from == config.username) {
                            //delete plasma.pending[i + ':transfer']
                            let NodeOps = GetNodeOps()
                            for (var i = 0; i < NodeOps.length; i++) {
                                if (NodeOps[i][1][1].from == json.from && NodeOps[i][1][1].to == json.to && NodeOps[i][1][0] == 'transfer' && NodeOps[i][1][1].hive_amount == json.hive_amount && NodeOps[i][1][1].hbd_amount == json.hbd_amount) {
                                    spliceOp(i)
                                }
                            }
                        }
                        Promise.all(lil_ops).then(empty => {
                                if (process.env.npm_lifecycle_event == 'test') pc[2] = ops
                                store.batch(ops, pc)
                            })
                            .catch(e => { reject(e) })
                    })
                    .catch(e => { console.log(e) })
            } else {
                pc[0](pc[2])
            }
        }
    })
    if (json.to == config.mainICO && json.amount.split(' ')[1] == 'HIVE') { //the ICO disribution... should be in multi sig account
        const amount = parseInt(parseFloat(json.amount) * 1000)
        var purchase,
            Pstats = getPathObj(['stats']),
            Pbal = getPathNum(['balances', json.from]),
            Pinv = getPathNum(['balances', 'ri'])
        Promise.all([Pstats, Pbal, Pinv]).then(function(v) {
            var stats = v[0],
                b = v[1],
                i = v[2],
                ops = []
            if (!stats.outOnBlock) {
                purchase = parseInt(amount / stats.icoPrice * 1000)
                if (purchase < i) {
                    i -= purchase
                    b += purchase
                    const msg = `@${json.from}| bought ${parseFloat(purchase / 1000).toFixed(3)} ${config.TOKEN} with ${parseFloat(amount / 1000).toFixed(3)} HIVE`
                    if (config.hookurl) postToDiscord(msg)
                    ops = [{ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg },
                        { type: 'put', path: ['balances', json.from], data: b },
                        { type: 'put', path: ['balances', 'ri'], data: i }
                    ]
                    if (process.env.npm_lifecycle_event == 'test') pc[2] = ops
                    store.batch(ops, pc)

                } else {
                    b += i
                    const left = purchase - i
                    stats.outOnBlock = json.block_num
                    const msg = `@${json.from}| bought ALL ${parseFloat(parseInt(purchase - left)).toFixed(3)} ${config.TOKEN} with ${parseFloat(parseInt(amount) / 1000).toFixed(3)} HIVE. And bid in the over-auction`
                    if (config.hookurl) postToDiscord(msg)
                    ops = [
                        { type: 'put', path: ['ico', `${json.block_num}`, json.from], data: parseInt(amount * left / purchase) },
                        { type: 'put', path: ['balances', json.from], data: b },
                        { type: 'put', path: ['balances', 'ri'], data: 0 },
                        { type: 'put', path: ['stats'], data: stats },
                        { type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg }
                    ]
                    if (process.env.npm_lifecycle_event == 'test') pc[2] = ops
                    store.batch(ops, pc)
                }
            } else {
                const msg = `@${json.from}| bought ALL ${parseFloat(parseInt(purchase - left)).toFixed(3)} ${config.TOKEN} with ${parseFloat(parseInt(amount) / 1000).toFixed(3)} HIVE. And bid in the over-auction`
                if (config.hookurl) postToDiscord(msg)
                ops = [
                    { type: 'put', path: ['ico', `${json.block_num}`, json.from], data: parseInt(amount) },
                    { type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg }
                ]
                if (process.env.npm_lifecycle_event == 'test') pc[2] = ops
                store.batch(ops, pc)
            }
        })
    } else {
        pc[0](pc[2])
    }
}

exports.dex_clear = (json, from, active, pc) => {
    if (active) {
        var q = []
        if (typeof json.txid == 'string') {
            q.push(json.txid)
        } else {
            q = json.txid
        }
        for (i = 0; i < q.length; i++) {
            store.get(['contracts', from, q[i]], function(e, a) {
                if (!e) {
                    var b = a
                    switch (b.type) {
                        case 'ss':
                            store.get(['dex', 'hive', 'sellOrders', `${b.rate}:${b.txid}`], function(e, a) {
                                if (e) { console.log(e) } else if (isEmpty(a)) { console.log('Nothing here' + b.txid) } else {
                                    release(from, b.txid, json.block_num)
                                }
                            })
                            break
                        case 'ds':
                            store.get(['dex', 'hbd', 'sellOrders', `${b.rate}:${b.txid}`], function(e, a) {
                                if (e) { console.log(e) } else if (isEmpty(a)) { console.log('Nothing here' + b.txid) } else {
                                    release(from, b.txid, json.block_num)
                                }
                            })
                            break
                        case 'sb':
                            store.get(['dex', 'hive', 'buyOrders', `${b.rate}:${b.txid}`], function(e, a) {
                                if (e) { console.log(e) } else if (isEmpty(a)) { console.log('Nothing here' + b.txid) } else {
                                    release(from, b.txid, json.block_num)
                                }
                            })
                            break
                        case 'db':
                            store.get(['dex', 'hbd', 'buyOrders', `${b.rate}:${b.txid}`], function(e, a) {
                                if (e) { console.log(e) } else if (isEmpty(a)) { console.log('Nothing here' + b.txid) } else {
                                    release(from, b.txid, json.block_num)
                                }
                            })
                            break
                        default:

                    }
                } else {
                    console.log(e)
                }
            })
        }
    }
}

exports.escrow_transfer = (json, pc) => {
    console.log(json)
    var ops, dextx, seller, contract, isAgent, isDAgent, dextxamount, meta, done = 0,
        type = 'hive',
        hours
    try {
        dextx = JSON.parse(json.json_meta).dextx
        dextxamount = parseInt(dextx[config.jsonTokenName])
        hours = JSON.parse(json.json_meta).hours || parseInt(dextx.hours)
    } catch (e) {}
    if (!hours) { hours = 1 }
    if (hours > 120) { hours = 120 }
    try {
        meta = JSON.parse(json.json_meta).contract
        contract = meta.split(':')[1]
    } catch (e) {}
    try {
        seller = JSON.parse(json.json_meta).for
    } catch (e) {}
    const now = Date.parse(json.timestamp) //this needs to be based on the time in the signed block... or replays will fail
        //const until = now.setHours(now.getHours())
    const check = Date.parse(json.ratification_deadline)
    const eexp = Date.parse(json.escrow_expiration)
    const timer = eexp - now
    let etime = false
    let btime = false
    if (timer > 518400000) { etime = true } //6 days 
    if (timer > 20000000) { btime = true } //6 hours
    let PfromBal = getPathNum(['balances', json.from]),
        PtoBal = getPathNum(['gov', json.to]),
        PagentBal = getPathNum(['gov', json.agent]),
        PtoCol = getPathNum(['col', json.to]),
        PagentCol = getPathNum(['col', json.agent]),
        PtoNode = getPathObj(['markets', 'node', json.to]),
        PagentNode = getPathObj(['markets', 'node', json.agent]),
        Pcontract = getPathObj(['contracts', seller, contract]),
        Phivevwma = getPathObj(['stats', 'HiveVWMA']),
        Phbdvwma = getPathObj(['stats', 'HbdVWMA'])
    Promise.all([PfromBal, PtoBal, PtoNode, PagentNode, Pcontract, Phbdvwma, Phivevwma, PagentBal, PtoCol, PagentCol]).then(function(v) {
        var fromBal = v[0],
            toBal = v[1],
            toNode = v[2],
            agentNode = v[3],
            contract = v[4] || {},
            hbdVWMA = v[5],
            hiveVWMA = v[6],
            agentBal = v[7],
            toCol = v[8],
            agentCol = v[9]
        isAgent = (toNode.lastGood >= json.block_num - 200)
        isDAgent = (agentNode.lastGood >= json.block_num - 200)
        buy = contract.amount
            //console.log(typeof buy === 'number', parseInt(json.hive_amount) / 1000 == buy, contract.type == 'ss', parseInt(json.hbd_amount) * 1000 == buy, contract.type == 'ds', isAgent, isDAgent, btime)
        if (typeof buy === 'number' && isAgent && isDAgent && btime) { //{txid, from: from, buying: buyAmount, amount: json[config.jsonTokenName], [json[config.jsonTokenName]]:buyAmount, rate:parseFloat((json[config.jsonTokenName])/(buyAmount)).toFixed(6), block:current, partial: json.partial || true
            if (contract.hive == parseInt(parseFloat(json.hive_amount) * 1000) && contract.hbd == parseInt(parseFloat(json.hbd_amount) * 1000) && btime) {
                if (contract.hbd) { type = 'hbd' }
                getPathObj(['dex', type, 'sellOrders'])
                    .then(Book => {
                        let lowest = 999999999
                        for (i in Book) {
                            if (parseFloat(i.split(":")[0]) < lowest) {
                                lowest = parseFloat(i.split(":")[0])
                            }
                        }
                        if (parseFloat(contract.rate) <= parseFloat(lowest * 1.01) && toBal >= (contract.amount * 2) && agentBal >= (contract.amount * 2)) {
                            toBal -= (contract.amount * 2) // collateral withdraw of dlux
                            agentBal -= (contract.amount * 2) //collateral withdrawl of dlux
                            toCol += (contract.amount * 2) // collateral withdraw of dlux
                            agentCol += (contract.amount * 2) //collateral withdrawl of dlux
                            fromBal += contract.amount - contract.fee // collateral held and therefore instant purchase
                            contract.escrow = (contract.amount * 4)
                            contract.agent = json.agent
                            contract.tagent = json.to
                            contract.buyer = json.from
                            contract.eo = json.from
                            contract.from = json.from
                            contract.escrow_id = json.escrow_id
                            contract.approveAgent = false
                            contract.approve_to = false
                            var hisE = {
                                    rate: contract.rate,
                                    block: json.block_num,
                                    amount: contract.amount
                                },
                                samount,
                                lil_ops = []
                            hiveTimeWeight = 1 - ((json.block_num - hiveVWMA.block) * 0.000033)
                            hbdTimeWeight = 1 - ((json.block_num - hbdVWMA.block) * 0.000033)
                            if (hiveTimeWeight < 0) { hiveTimeWeight = 0 }
                            if (hbdTimeWeight < 0) { hbdTimeWeight = 0 }
                            if (type = 'hive') {
                                samount = `${parseFloat(contract.hive / 1000).toFixed(3)} HIVE`
                                hiveVWMA = {
                                    rate: parseFloat(((contract.rate * contract.amount) + (parseFloat(hiveVWMA.rate) * hiveVWMA.vol * hiveTimeWeight)) / (contract.amount + (hiveVWMA.vol * hiveTimeWeight))).toFixed(6),
                                    block: json.block_num,
                                    vol: parseInt(contract.amount + (hiveVWMA.vol * hiveTimeWeight))
                                }
                                lil_ops.push(forceCancel(hiveVWMA.rate, 'hive', json.block_num))
                            } else {
                                samount = `${parseFloat(contract.hbd / 1000).toFixed(3)} HBD`
                                hbdVWMA = {
                                    rate: parseFloat(((contract.rate * contract.amount) + (parseFloat(hbdVWMA.rate) * hbdVWMA.vol * hbdTimeWeight)) / (contract.amount + (hbdVWMA.vol * hbdTimeWeight))).toFixed(6),
                                    block: json.block_num,
                                    vol: parseInt(contract.amount + (hbdVWMA.vol * hbdTimeWeight))
                                }
                                lil_ops.push(forceCancel(hbdVWMA.rate, 'hbd', json.block_num))
                            }
                            contract.pending = [
                                [json.to, [
                                    "escrow_approve",
                                    {
                                        "from": json.from,
                                        "to": json.to,
                                        "agent": json.agent,
                                        "who": json.to,
                                        "escrow_id": json.escrow_id,
                                        "approve": true
                                    }
                                ]],
                                [json.agent, [
                                    "escrow_approve",
                                    {
                                        "from": json.from,
                                        "to": json.to,
                                        "agent": json.agent,
                                        "who": json.agent,
                                        "escrow_id": json.escrow_id,
                                        "approve": true
                                    }
                                ]]
                            ]
                            contract.auths = [
                                [json.to, [
                                    "escrow_dispute",
                                    {
                                        "from": json.from,
                                        "to": json.to,
                                        "agent": json.agent,
                                        "who": json.to,
                                        "escrow_id": json.escrow_id
                                    }
                                ]],
                                [json.agent, [
                                    "escrow_release",
                                    {
                                        "from": json.from,
                                        "to": json.to,
                                        "agent": json.agent,
                                        "who": json.agent,
                                        "receiver": json.to,
                                        "escrow_id": json.escrow_id,
                                        "hbd_amount": json.hbd_amount,
                                        "hive_amount": json.hive_amount
                                    }
                                ]],
                                [json.to, [
                                    "transfer",
                                    {
                                        "from": json.to,
                                        "to": contract.co,
                                        "amount": samount,
                                        "memo": `${contract.txid} by ${contract.from} purchased with ${parseFloat(contract.amount / 1000).toFixed(3)} ${config.TOKEN}`
                                    }
                                ]]
                            ]
                            lil_ops.push(chronAssign(json.block_num + 200, { op: 'check', agent: contract.pending[1][0], txid: contract.txid + ':buyApproveA', acc: json.from, id: json.escrow_id.toString() }))
                            lil_ops.push(chronAssign(json.block_num + 200, { op: 'check', agent: contract.pending[0][0], txid: contract.txid + ':buyApproveT', acc: json.from, id: json.escrow_id.toString() }))
                            const msg = `@${json.from}| has bought ${meta}: ${parseFloat(contract.amount / 1000).toFixed(3)} for ${samount}`
                            if (config.hookurl) postToDiscord(msg)
                            ops = [
                                { type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg }, //fix this for types
                                { type: 'put', path: ['contracts', seller, meta.split(':')[1]], data: contract },
                                { type: 'put', path: ['escrow', contract.pending[0][0], contract.txid + ':buyApproveT'], data: contract.pending[0][1] },
                                { type: 'put', path: ['escrow', contract.pending[1][0], contract.txid + ':buyApproveA'], data: contract.pending[1][1] },
                                { type: 'put', path: ['escrow', json.escrow_id.toString(), json.from], data: { 'for': seller, 'contract': meta.split(':')[1] } },
                                { type: 'put', path: ['balances', json.from], data: fromBal },
                                { type: 'put', path: ['gov', json.to], data: toBal },
                                { type: 'put', path: ['gov', json.agent], data: agentBal },
                                { type: 'put', path: ['col', json.to], data: toCol },
                                { type: 'put', path: ['col', contract.agent], data: agentCol },
                                { type: 'put', path: ['dex', type, 'tick'], data: contract.rate },
                                { type: 'put', path: ['stats', 'HbdVWMA'], data: hbdVWMA },
                                { type: 'put', path: ['stats', 'HiveVWMA'], data: hiveVWMA },
                                { type: 'put', path: ['dex', type, 'his', `${hisE.block}:${json.transaction_id}`], data: hisE },
                                { type: 'del', path: ['dex', type, 'sellOrders', `${contract.rate}:${contract.txid}`] }
                            ]
                            Promise.all(lil_ops)
                                .then(empty => {
                                    if (process.env.npm_lifecycle_event == 'test') pc[2] = ops
                                    store.batch(ops, pc)
                                })
                                .catch(e => { console.log(e) })
                        } else {
                            console.log(parseFloat(contract.rate) <= parseFloat(lowest * 1.01), toBal >= (contract.amount * 2), agentBal >= (contract.amount * 2))
                            var ops = deny(json, hiveVWMA, hbdVWMA)
                            if (process.env.npm_lifecycle_event == 'test') pc[2] = ops
                            store.batch(ops, pc)
                        }
                    })
                    .catch(e => console.log(e))
            } else {
                var ops = deny(json, hiveVWMA, hbdVWMA)
                if (process.env.npm_lifecycle_event == 'test') pc[2] = ops
                store.batch(ops, pc)
            }
        } else if (toBal > (dextxamount * 2) && agentBal > (dextxamount * 2) && typeof dextxamount === 'number' && dextxamount > 4 && isAgent && isDAgent && btime) {
            var txid = config.TOKEN + hashThis(`${json.from}${json.transaction_id}`),
                rate = parseFloat(parseInt(parseFloat(json.hive_amount) * 1000) / dextx[config.jsonTokenName]).toFixed(6),
                allowed = false
            if (!parseFloat(rate)) {
                rate = parseFloat(parseInt(parseFloat(json.hbd_amount) * 1000) / dextx[config.jsonTokenName]).toFixed(6)
                allowed = allowedPrice(hbdVWMA.rate, rate)
            } else {
                allowed = allowedPrice(hiveVWMA.rate, rate)
            }
            if (allowed) {
                ops = [{
                            type: 'put',
                            path: ['escrow', json.agent, txid + ':listApproveA'],
                            data: [
                                "escrow_approve",
                                {
                                    "from": json.from,
                                    "to": json.to,
                                    "agent": json.agent,
                                    "who": json.agent,
                                    "escrow_id": json.escrow_id,
                                    "approve": true
                                }
                            ]
                        },
                        {
                            type: 'put',
                            path: ['escrow', json.to, txid + ':listApproveT'],
                            data: [
                                "escrow_approve",
                                {
                                    "from": json.from,
                                    "to": json.to,
                                    "agent": json.agent,
                                    "who": json.to,
                                    "escrow_id": json.escrow_id,
                                    "approve": true
                                }
                            ]
                        },
                        {
                            type: 'put',
                            path: ['escrow', json.escrow_id.toString(), json.from],
                            data: { 'for': json.from, contract: txid }
                        }
                    ],
                    auths = [
                        [json.to, [
                            "escrow_dispute",
                            {
                                "from": json.from,
                                "to": json.to,
                                "agent": json.agent,
                                "who": json.to,
                                "escrow_id": json.escrow_id
                            }
                        ]],
                        [json.agent, [
                            "escrow_release",
                            {
                                "from": json.from,
                                "to": json.to,
                                "agent": json.agent,
                                "who": json.agent,
                                "receiver": json.to,
                                "escrow_id": json.escrow_id,
                                "hbd_amount": json.hbd_amount,
                                "hive_amount": json.hive_amount
                            }
                        ]]
                    ],
                    reject = [json.to, [
                        "escrow_release",
                        {
                            "from": json.from,
                            "to": json.to,
                            "agent": json.agent,
                            "who": json.to,
                            "receiver": json.from,
                            "escrow_id": json.escrow_id,
                            "hbd_amount": json.hbd_amount,
                            "hive_amount": json.hive_amount
                        }
                    ]]
                let fee = parseInt(json[config.jsonTokenName] * 0.0025) + 3
                contract = {
                    txid,
                    from: json.from,
                    hive: parseInt(parseFloat(json.hive_amount) * 1000),
                    hbd: parseInt(parseFloat(json.hbd_amount) * 1000),
                    fee,
                    amount: dextx[config.jsonTokenName],
                    rate,
                    block: json.block_num,
                    escrow_id: json.escrow_id,
                    eo: json.from,
                    escrow: (dextx[config.jsonTokenName] * 4),
                    agent: json.agent,
                    tagent: json.to,
                    fee: fee,
                    approvals: 0,
                    auths,
                    reject
                }
                if (parseFloat(json.hive_amount) > 0) {
                    contract.type = 'sb'
                } else if (parseFloat(json.hbd_amount) > 0) {
                    contract.type = 'db'
                }
                let exp_block = json.block_num + (1200 * hours)
                let lil_ops = [
                    chronAssign(json.block_num + 200, { op: 'check', agent: json.agent, txid: txid + ':listApproveA', acc: json.from, id: json.escrow_id.toString() }),
                    chronAssign(json.block_num + 200, { op: 'check', agent: json.to, txid: txid + ':listApproveT', acc: json.from, id: json.escrow_id.toString() }),
                    chronAssign(exp_block, {
                        block: exp_block,
                        op: 'expire',
                        from: json.from,
                        txid
                    })
                ]
                Promise.all(lil_ops)
                    .then(expire_paths => {
                        contract.expire_path = expire_paths[2]
                        ops.push({ type: 'put', path: ['gov', json.to], data: toBal - (dextxamount * 2) })
                        ops.push({ type: 'put', path: ['gov', json.agent], data: agentBal - (dextxamount * 2) })
                        ops.push({ type: 'put', path: ['col', json.to], data: toCol + (dextxamount * 2) })
                        ops.push({ type: 'put', path: ['col', json.agent], data: agentCol + (dextxamount * 2) })
                        ops.push({ type: 'put', path: ['contracts', json.from, txid], data: contract })
                        if (process.env.npm_lifecycle_event == 'test') {
                            pc[2] = ops
                        }
                        store.batch(ops, pc)
                    })
            } else {
                console.log(toBal > (dextxamount * 2), agentBal > (dextxamount * 2), typeof dextxamount === 'number', dextxamount > 0, isAgent, isDAgent, btime, 'buy checks')
                var ops = []
                const msg = `@${json.from}| requested a trade outside of price curbs.`
                if (config.hookurl) postToDiscord(msg)
                ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg })
                ops.push({
                    type: 'put',
                    path: ['escrow', json.agent, `${json.from}/${json.escrow_id}:denyA`],
                    data: [
                        "escrow_approve",
                        {
                            "from": json.from,
                            "to": json.to,
                            "agent": json.agent,
                            "who": json.agent,
                            "escrow_id": json.escrow_id,
                            "approve": false
                        }
                    ]
                })
                ops.push({
                    type: 'put',
                    path: ['escrow', '.' + json.to, `${json.from}/${json.escrow_id}:denyT`],
                    data: [
                        "escrow_approve",
                        {
                            "from": json.from,
                            "to": json.to,
                            "agent": json.agent,
                            "who": json.to,
                            "escrow_id": json.escrow_id,
                            "approve": false
                        }
                    ]
                })
                ops.push({
                    type: 'put',
                    path: ['escrow', json.escrow_id.toString(), json.from],
                    data: {
                        for: json.from,
                        contract: json.escrow_id.toString()
                    }
                })
                var coll = 0
                if (parseFloat(json.hbd_amount) > 0) {
                    coll = parseInt(4 * parseFloat(hbdVWMA.rate) * parseFloat(json.hbd_amount) * 1000)
                } else {
                    coll = parseInt(4 * parseFloat(hiveVWMA.rate) * parseFloat(json.hive_amount) * 1000)
                }
                ops.push({
                    type: 'put',
                    path: ['contracts', json.from, json.escrow_id.toString()],
                    data: {
                        note: 'denied transaction',
                        from: json.from,
                        to: json.to,
                        agent: json.agent,
                        escrow_id: json.escrow_id.toString(),
                        col: coll
                    }
                })
                chronAssign(json.block_num + 200, { op: 'denyA', agent: json.agent, txid: `${json.from}/${json.escrow_id}:denyA`, acc: json.from, id: json.escrow_id.toString() })
                    .then(empty => {
                        if (process.env.npm_lifecycle_event == 'test') pc[2] = ops
                        store.batch(ops, pc)
                    })
                    .catch(e => { console.log(e) })
            }
        } else if (isDAgent && isAgent) {
            var ops = deny(json, hiveVWMA, hbdVWMA)
            if (process.env.npm_lifecycle_event == 'test') pc[2] = ops
            store.batch(ops, pc)
        } else {
            if (process.env.npm_lifecycle_event == 'test') pc[2] = 'fail_thru'
            pc[0](pc[2])
        }
    }).catch(function(e) { console.log('Failed Escrow:' + e) })
}

function allowedPrice(volume_weighted_price, rate) {
    volume_weighted_price_number = parseFloat(volume_weighted_price)
    rate_number = parseFloat(rate)
    if (rate_number > (volume_weighted_price_number * 0.8) && rate_number < (volume_weighted_price_number * 1.2)) {
        return true
    } else {
        return false
    }
}

function deny(json, hiveVWMA, hbdVWMA) {
    var ops = []
        //console.log(toBal > (dextxamount * 2), agentBal > (dextxamount * 2), typeof dextxamount === 'number', dextxamount > 0, isAgent, isDAgent, btime, 'buy checks')
    const msg = `@${json.from}| improperly attempted to use the escrow network. Attempting escrow deny.`
    if (config.hookurl) postToDiscord(msg)
    ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg })
    ops.push({
        type: 'put',
        path: ['escrow', json.agent, `${json.from}/${json.escrow_id}:denyA`],
        data: [
            "escrow_approve",
            {
                "from": json.from,
                "to": json.to,
                "agent": json.agent,
                "who": json.agent,
                "escrow_id": json.escrow_id,
                "approve": false
            }
        ]
    })
    ops.push({
        type: 'put',
        path: ['escrow', '.' + json.to, `${json.from}/${json.escrow_id}:denyT`],
        data: [
            "escrow_approve",
            {
                "from": json.from,
                "to": json.to,
                "agent": json.agent,
                "who": json.to,
                "escrow_id": json.escrow_id,
                "approve": false
            }
        ]
    })
    ops.push({
        type: 'put',
        path: ['escrow', json.escrow_id.toString(), json.from],
        data: {
            for: json.from,
            contract: json.escrow_id.toString()
        }
    })
    var coll = 0
    if (parseFloat(json.hbd_amount) > 0) {
        coll = parseInt(4 * parseFloat(hbdVWMA.rate) * parseFloat(json.hbd_amount) * 1000)
    } else {
        coll = parseInt(4 * parseFloat(hiveVWMA.rate) * parseFloat(json.hive_amount) * 1000)
    }
    ops.push({
        type: 'put',
        path: ['contracts', json.from, json.escrow_id.toString()],
        data: {
            note: 'denied transaction',
            from: json.from,
            to: json.to,
            agent: json.agent,
            escrow_id: json.escrow_id.toString(),
            col: 0
        }
    })
    chronAssign(json.block_num + 200, { op: 'denyA', agent: json.agent, txid: `${json.from}/${json.escrow_id}:denyA`, acc: json.from, id: json.escrow_id.toString() })
    return ops
}