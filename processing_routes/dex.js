const config = require('./../config')
const { store, GetNodeOps, spliceOp } = require('./../index')
const { getPathObj, getPathNum } = require('./../getPathObj')
const { DEX, release } = require('./../helpers')
const { add, addCol, addGov, deletePointer, credit, chronAssign, hashThis, isEmpty, addMT } = require('./../lil_ops')
const { postToDiscord } = require('./../discord')
const stringify = require('json-stable-stringify');

exports.dex_sell = (json, from, active, pc) => {
    let PfromBal = getPathNum(['balances', from]),
        PStats = getPathObj(['stats']),
        PSB = getPathObj(['dex', 'hive']),
        order = {}
        if(parseInt(json.hive)){
            order.type = 'LIMIT'
            order.target = parseInt(json.hive)
            order.rate = parseFloat( parseInt(json.hive) / parseInt(json[config.jsonTokenName]) ).toFixed(6)
            order.pair = 'hive'
        } else if(parseInt(json.hbd)){
            PSB = getPathObj(['dex', 'hbd'])
            order.type = 'LIMIT'
            order.pair = 'hbd'
            order.target = parseInt(json.hbd)
            order.rate = parseFloat( parseInt(json.hbd) / parseInt(json[config.jsonTokenName]) ).toFixed(6)
        } else if (json.pair = 'HBD'){
            PSB = getPathObj(['dex', 'hbd'])
            order.type = 'MARKET'
            order.pair = 'hbd'
        } else {
            order = {
                type: 'MARKET',
                pair: 'hive',
                amount: json[config.jsonTokenName]
            }
        }
        order[config.jsonTokenName] = parseInt(json[config.jsonTokenName])
        console.log(order)
    Promise.all([PfromBal, PStats, PSB]).then(a => {
        let bal = a[0],
            stats = a[1],
            dex = a[2],
            ops = [],
            adds = [],
            his = {},
            fee = 0,
            hours = parseInt(json.hours) || 720
        if (hours > 720) { hours = 720 }
        const expBlock = json.block_num + (hours * 1200)
        if (order[config.jsonTokenName] <= bal && order[config.jsonTokenName] >= 4 && active) {
            let remaining = json[config.jsonTokenName],
                filled = 0,
                pair = 0,
                i = 0,
                path = 0,
                contract = ''
            while(remaining){
                let price = parseFloat(dex.buyBook.split('_')[0])
                let item
                if(price)item = dex.buyBook.split('_')[1].split(',')[0]
                if (item && (order.type == 'MARKET' || parseFloat(price) >= order.rate)){
                    let next = dex.buyOrders[`${price}:${item}`]
                    console.log({price, item, next})
                    if (next.amount <= remaining){
                            filled += next.amount
                            adds.push([next.from, next.amount - next.fee])
                            his[`${json.block_num}:${i}:${json.transaction_id}`] = {type: 'sell', t:Date.parse(json.timestamp + '.000Z'), block: json.block_num, base_vol: next.amount, target_vol: next[order.pair], target: order.pair, price: next.rate, id: json.transaction_id + i}
                            fee += next.fee //add the fees
                            remaining -= next.amount
                            dex.tick = price
                            pair += next[order.pair]
                            dex.buyBook = DEX.remove(item, dex.buyBook) //adjust the orderbook
                            console.log(dex.buyBook)
                            delete dex.buyOrders[`${price}:${item}`]
                            const transfer = [
                                    "transfer",
                                    {
                                        "from": config.msaccount,
                                        "to": from,
                                        "amount": parseFloat(next[order.pair]/1000).toFixed(3) + ' ' + order.pair.toUpperCase(),
                                        "memo": `Filled ${item}:${json.transaction_id}`
                                    }
                                ]
                            let msg = `@${from} sold ${parseFloat(parseInt(next.amount)/1000).toFixed(3)} ${config.TOKEN} with ${parseFloat(parseInt(next[order.pair])/1000).toFixed(3)} ${order.pair.toUpperCase()} to ${next.from} (${item})`
                            ops.push({type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}.${i}`], data: msg})
                            ops.push({type: 'put', path: ['msa', `${item}:${json.transaction_id}:${json.block_num}`], data: stringify(transfer)}) //send HIVE out via MS
                            ops.push({type: 'del', path: ['dex', order.pair, 'buyOrders', `${price}:${item}`]}) //remove the order
                            ops.push({type: 'del', path: ['contracts', next.from , item]}) //remove the contract
                            ops.push({type: 'del', path: ['chrono', next.expire_path]}) //remove the chrono

                        } else {
                            const thisfee = parseInt((remaining/next.amount)*next.fee)
                            const thistarget = parseInt((remaining/next.amount)*next[order.pair])
                            next.fee -= thisfee
                            next[order.pair] -= thistarget
                            next.amount -= remaining
                            filled += remaining
                            pair += thistarget
                            adds.push([next.from, remaining - thisfee])
                            dex.tick = price
                            his[`${json.block_num}:${i}:${json.transaction_id}`] = {type: 'sell', t:Date.parse(json.timestamp), block: json.block_num, base_vol: remaining, target_vol: thistarget + thisfee, target: order.pair, price: next.rate, id: json.transaction_id + i}
                            fee += thisfee
                            const transfer = [
                                    "transfer",
                                    {
                                        "from": config.msaccount,
                                        "to": from,
                                        "amount": parseFloat(thistarget/1000).toFixed(3) + ' ' + order.pair.toUpperCase(),
                                        "memo": `Partial Filled ${item}:${json.transaction_id}`
                                    }
                                ]
                            let msg = `@${from} sold ${parseFloat(parseInt(remaining)/1000).toFixed(3)} ${config.TOKEN} with ${parseFloat(parseInt(thistarget)/1000).toFixed(3)} ${order.pair.toUpperCase()} to ${next.from} (${item})`
                            ops.push({type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}.${i}`], data: msg})
                            ops.push({type: 'put', path: ['msa', `${item}:${json.transaction_id}:${json.block_num}`], data: stringify(transfer)}) //send HIVE out via MS
                            ops.push({type: 'put', path: ['contracts', next.from , item], data: next}) //remove the contract
                            dex.buyOrders[`${price}:${item}`] = next
                            remaining = 0
                        }
                } else {
                    const txid = config.TOKEN + hashThis(from + json.transaction_id),
                        cfee = parseInt(remaining * parseFloat(stats.dex_fee)),
                        crate = parseFloat((order.target - pair)/remaining).toFixed(6),
                        hours = 720
                    contract = {
                        txid,
                        from: from,
                        hive: 0,
                        hbd: 0,
                        fee: cfee,
                        amount: remaining,
                        rate: crate,
                        block: json.block_num,
                        type: `${order.pair}:sell`
                    }
                    contract[order.pair] = order.target - pair
                    dex.sellBook = DEX.insert(txid, crate, dex.sellBook, 'sell')
                    path = chronAssign(expBlock, {
                        block: expBlock,
                        op: 'expire',
                        from,
                        txid
                    })
                    remaining = 0
                }
                i++
            }
            var addops = {}
            for (var j = 0; j < adds.length; j++){
                if (addops[adds[j][0]]){
                    addops[adds[j][0]] += adds[j][1]
                } else {
                    addops[adds[j][0]] = adds[j][1]
                }
            }
            bal -= json[config.jsonTokenName]
            if (addops[from]){
                bal += addops[from]
                delete addops[from]
            }
            ops.push({type: 'put', path: ['balances', from], data: bal})
            var waitfor = [add('rn', fee)]
            for(var to in addops){
                waitfor.push(add(to, addops[to]))
            }
            ops.push({type: 'put', path: ['dex', order.pair], data: dex})
            var hiveTimeWeight = 1 - ((json.block_num - stats[`H${order.pair.substr(1)}VWMA`].block) * 0.000033)
            if (hiveTimeWeight < 0) hiveTimeWeight = 0
            stats[`H${order.pair.substr(1)}VWMA`] = {
                    rate: parseFloat((filled + (parseFloat(stats[`H${order.pair.substr(1)}VWMA`].rate) * stats[`H${order.pair.substr(1)}VWMA`].vol * hiveTimeWeight)) / (pair + (stats[`H${order.pair.substr(1)}VWMA`].vol * hiveTimeWeight))).toFixed(6),
                    block: json.block_num,
                    vol: parseInt(filled + (stats[`H${order.pair.substr(1)}VWMA`].vol * hiveTimeWeight))
                }
            ops.push({type: 'put', path: ['stats'], data: stats})
            if(Object.keys(his).length)ops.push({type: 'put', path: ['dex', order.pair, 'his'], data: his})
            if(path){
                Promise.all([path, ...waitfor])
                .then(expPath =>{
                    contract.expire_path = expPath[0]
                    ops.push({type: 'put', path: ['contracts', from , contract.txid], data: contract})
                    if(dex.sellOrders){
                        dex.sellOrders[`${contract.rate}:${contract.txid}`] = contract
                    } else {
                        dex.sellOrders = {[`${contract.rate}:${contract.txid}`]: contract}
                    }
                    let msg = `@${from} is selling ${parseFloat(parseInt(contract.amount)/1000).toFixed(3)} ${config.TOKEN} for ${parseFloat(parseInt(contract[order.pair])/1000).toFixed(3)} ${order.pair.toUpperCase()}(${contract.rate}:${contract.txid})`
                    ops.push({type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}.${i}`], data: msg})
                    if (process.env.npm_lifecycle_event == 'test') pc[2] = ops
                    store.batch(ops, pc)
                })
            } else {
                Promise.all([...waitfor])
                .then(nada =>{
                    if (process.env.npm_lifecycle_event == 'test') pc[2] = ops
                    store.batch(ops, pc)
                })
            }
        } else {
            const msg = `@${from}| tried to sell ${config.TOKEN} but sent an invalid order.`
            if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
            ops = [{ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg }]
            if (process.env.npm_lifecycle_event == 'test') pc[2] = ops
            store.batch(ops, pc)
        }
    }).catch(e => {
        console.log(e)
    })
}

exports.transfer = (json, pc) => {
    if (json.to == config.mainICO && json.amount.split(' ')[1] == 'HIVE' && json.from != config.msaccount) { //the ICO disribution... should be in multi sig account
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
                var hiveTimeWeight = 1 - ((json.block_num - stats.HiveVWMA.block) * 0.000033)
                if (hiveTimeWeight < 0) { hiveTimeWeight = 0 }
                hiveVWMA = {
                    rate: parseFloat((purchase + (parseFloat(stats.HiveVWMA.rate) * stats.HiveVWMA.vol * hiveTimeWeight)) / (purchase + (stats.HiveVWMA.vol * hiveTimeWeight))).toFixed(6),
                    block: json.block_num,
                    vol: parseInt(amount + (stats.HiveVWMA.vol * hiveTimeWeight))
                }
                //forceCancel(hiveVWMA.rate, 'hive', json.block_num)
                .then(empty => {
                    if (purchase < i) {
                        i -= purchase
                        b += purchase
                        const msg = `@${json.from}| bought ${parseFloat(purchase / 1000).toFixed(3)} ${config.TOKEN} with ${parseFloat(amount / 1000).toFixed(3)} HIVE`
                        if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                        ops = [{ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg },
                            { type: 'put', path: ['balances', json.from], data: b },
                            { type: 'put', path: ['balances', 'ri'], data: i },
                            { type: 'put', path: ['stats', 'HiveVWMA'], data: hiveVWMA }
                        ]
                        if (process.env.npm_lifecycle_event == 'test') pc[2] = ops
                        store.batch(ops, pc)
                    } else {
                        b += i
                        const left = purchase - i
                        stats.outOnBlock = json.block_num
                        stats.HiveVWMA = hiveVWMA
                        const msg = `@${json.from}| bought ALL ${parseFloat(parseInt(purchase - left)).toFixed(3)} ${config.TOKEN} with ${parseFloat(parseInt(amount) / 1000).toFixed(3)} HIVE. And bid in the over-auction`
                        if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
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
                })
                .catch(e => { console.log(e) })
            } else {
                const msg = `@${json.from}| bought ALL ${parseFloat(parseInt(purchase - left)).toFixed(3)} ${config.TOKEN} with ${parseFloat(parseInt(amount) / 1000).toFixed(3)} HIVE. And bid in the over-auction`
                if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                ops = [
                    { type: 'put', path: ['ico', `${json.block_num}`, json.from], data: parseInt(amount) },
                    { type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg }
                ]
                if (process.env.npm_lifecycle_event == 'test') pc[2] = ops
                store.batch(ops, pc)
            }
        })
    } else if (json.to == config.msaccount) {
        if(json.memo.split(' ')[0] == 'NFT'){
            /*
                    lth[`set:hash`]{
                        h,//millihive
                        b,//millihbd
                        q,//qty
                        d,//distro string
                        i:`${json.set}:${hash}`,//item for canceling
                    }
            */
            let item = json.memo.split(' ')[1],
                setname = item.split(':')[0],
                Pset = getPathObj(['set', setname]),
                Pitem = getPathObj(['lth', item])
            Promise.all([Pset, Pitem]).then(mem =>{
                let set = mem[0],
                    listing = mem[1],
                    amount = parseInt(json.amount.split(' ')[0] * 1000),
                    type = json.amount.split(' ')[1],
                    ops = [],
                    qty = 0,
                    refund_amount = amount,
                    transfers = []
                if(type == 'HIVE' && amount >= listing.h && listing.h != 0){
                    qty = parseInt(amount/listing.h)
                    refund_amount = amount % parseInt(listing.h)
                } else if (type == 'HBD' && amount >= listing.b && listing.b != 0){
                    qty = parseInt(amount/listing.b)
                    refund_amount = amount % parseInt(listing.b)
                }
                listing.q -= qty
                if(listing.q <= 0){
                    qty += listing.q
                    refund_amount += (listing.h * listing.q) + (listing.b * listing.q)
                    ops.push({type: 'del', path: ['lth', item]})
                } else {
                    ops.push({type: 'put', path: ['lth', item], data: listing})
                }
                if(qty)addMT(['rnfts', setname, json.from], qty)
                transfers = [...transfers, ...buildSplitTransfers(qty*listing.h+qty*listing.b, type, listing.d, `${setname} mint token sale - ${json.from}:${json.transaction_id.substr(0,8)}:`)]
                if(refund_amount){
                    transfers.push(['transfer',{
                        to:json.from,
                        from: config.msaccount,
                        amount: parseFloat(refund_amount/1000).toFixed(3) + ` ${type}`,
                        memo: `${qty?'Refund':'Partial refund'} ${setname} mint token purchase:${json.transaction_id}:`
                    }])
                }
                for(var i = 0; i < transfers.length; i++){
                    ops.push({type: 'put', path: ['msa', `${i}:${json.transaction_id}:${json.block_num}`], data: stringify(transfers[i])})
                }
                store.batch(ops, pc)
            })
        } else {
            let order = {
                type: 'LIMIT'
            },
                path = '',
                contract = ''
            try {order = JSON.parse(json.memo)} catch (e) {}
            if (!order.rate) {
                order.type = 'MARKET'
                order.rate = parseFloat(order.rate) || 0
            } else {
                order.type = 'LIMIT'
                order.rate = parseFloat(order.rate) || 0
            }
            order.pair = json.amount.split(' ')[1].toLowerCase()
            order.amount = parseInt(parseFloat(json.amount.split(' ')[0] * 1000))
            if (order.type == 'MARKET' || order.type == 'LIMIT') {
                let pDEX = getPathObj(['dex', order.pair]),
                    pBal = getPathNum(['balances', json.from]),
                    pInv = getPathNum(['balances', 'ri']),
                    pStats = getPathObj(['stats']);
                Promise.all([pDEX, pBal, pInv, pStats]).then(mem => {
                    let dex = mem[0],
                        bal = mem[1],
                        inv = mem[2],
                        stats = mem[3],
                        filled = 0,
                        remaining = order.amount,
                        ops = [],
                        his = {},
                        fee = 0,
                        i = 0
                    if (order.type == 'LIMIT' && order.rate == 0) {
                        order.rate = stats[`H${order.pair.substr(1)}VWMA`].rate
                        console.log('vwma', stats[`H${order.pair.substr(1)}VWMA`].rate)
                    }
                    order.rate = parseFloat(order.rate).toFixed(6)
                    while (remaining){
                        i++
                        const price = parseFloat(dex.sellBook.split('_')[0])
                        let item = ''
                        if(price)item = dex.sellBook.split('_')[1].split(',')[0]
                        console.log(price, item)
                        if (item && (price <= stats.icoPrice/1000) && ( order.type == 'MARKET' || (order.type == 'LIMIT' && order.rate <= price))) {
                            var next = dex.sellOrders[`${price.toFixed(6)}:${item}`]
                            console.log(next)
                            if (next[order.pair] <= remaining){
                                filled += next.amount - next.fee
                                bal += next.amount - next.fee //update the balance
                                fee += next.fee //add the fees
                                remaining -= next[order.pair]
                                dex.tick = next.rate
                                his[`${json.block_num}:${i}:${json.transaction_id}`] = {type: 'buy', t:Date.parse(json.timestamp), block: json.block_num, base_vol: next.amount, target_vol: next[order.pair], target: order.pair, price: next.rate, id: json.transaction_id + i}
                                dex.sellBook = DEX.remove(item, dex.sellBook) //adjust the orderbook
                                delete dex.sellOrders[`${price}:${item}`]
                                const transfer = [
                                        "transfer",
                                        {
                                            "from": config.msaccount,
                                            "to": next.from,
                                            "amount": parseFloat(next[order.pair]/1000).toFixed(3) + ' ' + order.pair.toUpperCase(),
                                            "memo": `Filled ${item}:${json.transaction_id}`
                                        }
                                    ]
                                let msg = `@${json.from} bought ${parseFloat(parseInt(next.amount)/1000).toFixed(3)} ${config.TOKEN} with ${parseFloat(parseInt(next[order.pair])/1000).toFixed(3)} ${order.pair.toUpperCase()} from ${next.from} (${item})`
                                ops.push({type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}.${i}`], data: msg})
                                if(Object.keys(his).length)ops.push({type: 'put', path: ['dex', order.pair, 'his'], data: his})
                                ops.push({type: 'put', path: ['msa', `${item}:${json.transaction_id}:${json.block_num}`], data: stringify(transfer)}) //send HIVE out via MS
                                ops.push({type: 'del', path: ['dex', order.pair, 'sellOrders', `${price}:${item}`]}) //remove the order
                                ops.push({type: 'del', path: ['contracts', next.from , item]}) //remove the contract
                                ops.push({type: 'del', path: ['chrono', next.expire_path]}) //remove the chrono

                            } else {
                                next[order.pair] = next[order.pair] - remaining // modify the contract
                                const tokenAmount = parseInt(parseFloat(next.rate) * remaining)
                                const feeAmount = parseInt((tokenAmount / next.amount) * next.fee)
                                filled += tokenAmount - feeAmount
                                bal += tokenAmount - feeAmount //update the balance
                                fee += feeAmount //add the fees
                                next.amount -= tokenAmount
                                next.fee -= feeAmount
                                his[`${json.block_num}:${i}:${json.transaction_id}`] = {type: 'buy', t:Date.parse(json.timestamp), block: json.block_num, base_vol: tokenAmount, target_vol: remaining, target: order.pair, price: next.rate, id: json.transaction_id + i}
                                if(!next.partial){
                                    next.partial = {[json.transaction_id]:{token: tokenAmount, coin: remaining}}
                                } else {
                                    next.partial[json.transaction_id] = {token: tokenAmount, coin: remaining}
                                }
                                dex.tick = next.rate
                                dex.sellOrders[`${price}:${item}`] = next
                                const transfer = [
                                        "transfer",
                                        {
                                            "from": config.msaccount,
                                            "to": next.from,
                                            "amount": parseFloat(remaining/1000).toFixed(3) + ' ' + order.pair.toUpperCase(),
                                            "memo": `Partial Filled ${item}:${json.transaction_id}`
                                        }
                                    ]
                                let msg = `@${json.from} bought ${parseFloat(parseInt(tokenAmount)/1000).toFixed(3)} ${config.TOKEN} with ${parseFloat(parseInt(remaining)/1000).toFixed(3)} ${order.pair.toUpperCase()} from ${next.from} (${item})`
                                remaining = 0
                                ops.push({type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}.${i}`], data: msg})
                                ops.push({type: 'put', path: ['balances', json.from], data: bal})
                                ops.push({type: 'put', path: ['dex', order.pair, 'his'], data: his})
                                ops.push({type: 'put', path: ['msa', `${item}:${json.transaction_id}:${json.block_num}`], data: stringify(transfer)}) //send HIVE out via MS
                                ops.push({type: 'put', path: ['dex', order.pair, 'sellOrders', `${price}:${item}`], data: next}) //update the order
                                ops.push({type: 'put', path: ['contracts', next.from , item], data: next}) //update the contract
                            }
                        } else {
                            if (order.pair == 'hive' && ( order.type == 'MARKET' || (order.type == 'LIMIT' && order.rate >= stats.icoPrice/1000 ))){
                                let purchase
                                const transfer = [
                                        "transfer",
                                        {
                                            "from": config.msaccount,
                                            "to": config.mainICO,
                                            "amount": parseFloat(remaining/1000).toFixed(3) + ' ' + order.pair.toUpperCase(),
                                            "memo": `ICO Buy from ${json.from}:${json.transaction_id}`
                                        }
                                    ]
                                ops.push({type: 'put', path: ['msa', `ICO@${json.from}:${json.transaction_id}:${json.block_num}`], data: stringify(transfer)}) //send HIVE out via MS
                                dex.tick = parseFloat(stats.icoPrice/1000).toFixed(6)
                                if (!stats.outOnBlock) {
                                    purchase = parseInt(remaining / stats.icoPrice * 1000)
                                    filled += purchase
                                    if (purchase < inv) {
                                        inv -= purchase
                                        bal += purchase
                                        his[`${json.block_num}:${i}:${json.transaction_id}`] = {type: 'buy', t:Date.parse(json.timestamp), block: json.block_num, base_vol: purchase, target_vol: remaining, target: order.pair, price: parseFloat(stats.icoPrice/1000).toFixed(6), id: json.transaction_id + i}
                                        const msg = `@${json.from}| bought ${parseFloat(purchase / 1000).toFixed(3)} ${config.TOKEN} with ${parseFloat(remaining / 1000).toFixed(3)} HIVE`
                                        ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}:${i}`], data: msg },
                                            { type: 'put', path: ['balances', 'ri'], data: inv })
                                    } else {
                                        bal += inv
                                        const left = purchase - inv
                                        stats.outOnBlock = json.block_num
                                        his[`${json.block_num}:${i}:${json.transaction_id}`] = {type: 'buy', t:Date.parse(json.timestamp), block: json.block_num, base_vol: inv, target_vol: remaining, target: order.pair, price: parseFloat(stats.icoPrice/1000).toFixed(6), id: json.transaction_id + i}
                                        const msg = `@${json.from}| bought ALL ${parseFloat(parseInt(purchase - left)).toFixed(3)} ${config.TOKEN} with ${parseFloat(parseInt(amount) / 1000).toFixed(3)} HIVE. And bid in the over-auction`
                                        ops.push({ type: 'put', path: ['ico', `${json.block_num}`, json.from], data: parseInt(amount * left / purchase) },
                                            { type: 'put', path: ['balances', 'ri'], data: 0 },
                                            { type: 'put', path: ['stats'], data: stats },
                                            { type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg })
                                    }
                                    remaining = 0
                                } else {
                                    const msg = `@${json.from}| bought ALL ${parseFloat(parseInt(purchase - left)).toFixed(3)} ${config.TOKEN} with ${parseFloat(parseInt(amount) / 1000).toFixed(3)} HIVE. And bid in the over-auction`
                                    if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                                    ops = [
                                        { type: 'put', path: ['ico', `${json.block_num}`, json.from], data: parseInt(amount) },
                                        { type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg }
                                    ]
                                    if (process.env.npm_lifecycle_event == 'test') pc[2] = ops
                                    store.batch(ops, pc)
                                }
                            } else {
                                const txid = config.TOKEN + hashThis(json.from + json.transaction_id),
                                    cfee = parseInt(remaining * parseFloat(stats.dex_fee)),
                                    crate = order.rate || stats[`H${order.pair.substr(1)}VWMA`].rate,
                                    hours = 720,
                                    expBlock = json.block_num + (hours * 1200)
                                contract = {
                                    txid,
                                    from: json.from,
                                    hive: 0,
                                    hbd: 0,
                                    fee: cfee,
                                    amount: 0,
                                    rate: crate,
                                    block: json.block_num,
                                    type: `${order.pair}:buy`
                                }
                                contract.amount = parseInt(remaining / crate)
                                contract[order.pair] = remaining
                                dex.buyBook = DEX.insert(txid, crate, dex.buyBook, 'buy')
                                path = chronAssign(expBlock, {
                                    block: expBlock,
                                    op: 'expire',
                                    from: json.from,
                                    txid
                                })
                                remaining = 0
                            }
                        }
                    }
                    let msg = ''
                    if(remaining == order.amount){
                        msg = `@${json.from} set a buy order at ${contrate.rate}.`
                        
                    } else {
                        var hiveTimeWeight = 1 - ((json.block_num - stats[`H${order.pair.substr(1)}VWMA`].block) * 0.000033)
                        if (hiveTimeWeight < 0) { hiveTimeWeight = 0 }
                        stats[`H${order.pair.substr(1)}VWMA`] = {
                                        rate: parseFloat((filled + (parseFloat(stats[`H${order.pair.substr(1)}VWMA`].rate) * stats[`H${order.pair.substr(1)}VWMA`].vol * hiveTimeWeight)) / (filled + (stats[`H${order.pair.substr(1)}VWMA`].vol * hiveTimeWeight))).toFixed(6),
                                        block: json.block_num,
                                        vol: parseInt(order.amount + (stats[`H${order.pair.substr(1)}VWMA`].vol * hiveTimeWeight))
                                    }
                        msg = `@${json.from} | order recieved.`
                        add('rn', fee)
                    }
                    if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                    ops.push({type: 'put', path: ['balances', json.from], data: bal})
                    ops.push({type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}.${i++}`], data: msg})
                    if(Object.keys(his).length)ops.push({type: 'put', path: ['dex', order.pair, 'his'], data: his})
                    if(!path){
                        ops.push({type: 'put', path: ['dex', order.pair], data: dex})
                        if (process.env.npm_lifecycle_event == 'test') pc[2] = ops
                        store.batch(ops, pc) 
                    } else {
                        Promise.all([path]).then(expPath => {
                            contract.expire_path = expPath[0]
                            ops.push({type: 'put', path: ['contracts', json.from , contract.txid], data: contract})
                            if(dex.buyOrders){
                                dex.buyOrders[`${contract.rate}:${contract.txid}`] = contract
                            } else {
                                dex.buyOrders = {[`${contract.rate}:${contract.txid}`]: contract}
                            }
                            let msg = `@${json.from} is buying ${parseFloat(parseInt(contract.amount)/1000).toFixed(3)} ${config.TOKEN} for ${parseFloat(parseInt(contract[order.pair])/1000).toFixed(3)} ${order.pair.toUpperCase()}(${contract.rate}:${contract.txid})`
                            ops.push({type: 'put', path: ['dex', order.pair], data: dex})
                            ops.push({type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}.${i}`], data: msg})
                            if (process.env.npm_lifecycle_event == 'test') pc[2] = ops
                            store.batch(ops, pc)
                        })
                    }
                })
            } else {
                const transfer = [
                        "transfer",
                        {
                            "from": config.msaccount,
                            "to": json.from,
                            "amount": json.amount,
                            "memo": `This doesn't appear to be formatted correctly to buy ${config.TOKEN}`
                        }
                    ]
                let msg = `@${json.from} sent a weird transaction to ${config.msaccount}: refunding`
                ops.push({type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}.${i}`], data: msg})
                ops.push({type: 'put', path: ['msa', `refund@${json.from}:${json.transaction_id}:${json.block_num}`], data: stringify(transfer)})
                store.batch(ops, pc)
            }
        }
    } else if (json.from == config.msaccount){
        getPathObj(['mss']).then(mss => {
            var done = false
            for (var block in mss){
                if(block.split(':').length < 2 && mss[block].indexOf(json.memo) > 0){
                    store.batch([{type:'del', path:['mss', `${block}`]}, {type:'del', path:['mss', `${block}:sigs`]}],pc)
                    done = true
                }
            }
            if (!done) {
                pc[0](pc[2])
            }
        })
    } else {
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
                    if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
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
            } else {
                pc[0](pc[2])
            }
        })
    }
}

exports.dex_clear = (json, from, active, pc) => {
    if (active) {
        var q = [],
            promises = []
        if (typeof json.txid == 'string') {
            q.push(json.txid)
        } 
        // else {
        //     q = json.txid
        // } //book string collision
        for (i = 0; i < q.length; i++) {
            store.get(['contracts', from, q[i]], function(e, a) {
                if (!e) {
                    var b = a
                    switch (b.type) {
                        case 'hive:sell':
                            store.get(['dex', 'hive', 'sellOrders', `${b.rate}:${b.txid}`], function(e, a) {
                                if (e) { console.log(e) } else if (isEmpty(a)) { console.log('Nothing here' + b.txid) } else {
                                    promises.push(new Promise ((res,rej)=>{release(from, b.txid, json.block_num, json.transaction_id).then(y => {res(y)}).catch(e=>{rej(e)})}))
                                }
                            })
                            break
                        case 'hbd:sell':
                            store.get(['dex', 'hbd', 'sellOrders', `${b.rate}:${b.txid}`], function(e, a) {
                                if (e) { console.log(e) } else if (isEmpty(a)) { console.log('Nothing here' + b.txid) } else {
                                    promises.push(new Promise ((res,rej)=>{release(from, b.txid, json.block_num, json.transaction_id).then(y => {res(y)}).catch(e=>{rej(e)})}))
                                }
                            })
                            break
                        case 'hive:buy':
                            store.get(['dex', 'hive', 'buyOrders', `${b.rate}:${b.txid}`], function(e, a) {
                                if (e) { console.log(e) } else if (isEmpty(a)) { console.log('Nothing here' + b.txid) } else {
                                    promises.push(new Promise ((res,rej)=>{release(from, b.txid, json.block_num, json.transaction_id).then(y => {res(y)}).catch(e=>{rej(e)})}))
                                }
                            })
                            break
                        case 'hbd:buy':
                            store.get(['dex', 'hbd', 'buyOrders', `${b.rate}:${b.txid}`], function(e, a) {
                                if (e) { console.log(e) } else if (isEmpty(a)) { console.log('Nothing here' + b.txid) } else {
                                    promises.push(new Promise ((res,rej)=>{release(from, b.txid, json.block_num, json.transaction_id).then(y => {res(y)}).catch(e=>{rej(e)})}))
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
        Promise.all(promises).then(empty => {pc[0](pc[2])}).catch(e=>{console.log(e)})
    }
}

function buildSplitTransfers(amount, pair, ds, memos){
    console.log({amount, pair, ds, memos})
    let tos = ds.split(',') || 0
    if (!tos)return []
    let ops = [],
        total = 0
    for(var i = tos.length - 1; i >= 0; i--) {
        let dis = parseInt((amount*parseInt(tos[i].split('_')[1])/10000))
        if(!i)dis = amount - total    
        total += dis
        ops.push(['transfer',{
            to: tos[i].split('_')[0],
            from: config.msaccount,
            amount: `${parseFloat(dis/1000).toFixed(3)} ${pair.toUpperCase()}`,
            memo: memos + `:${parseFloat(parseInt(tos[i].split('_')[1])/100).toFixed(2)}%`
        }])
    }
    return ops
}