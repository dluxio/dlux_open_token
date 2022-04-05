const config = require('./../config')

const { Base64, NFT, DEX } = require('./../helpers')
const { store, GetNodeOps, spliceOp, plasma } = require('./../index')
const { getPathObj, getPathNum } = require('./../getPathObj')
const { add, addCol, addGov, deletePointer, credit, chronAssign, hashThis, isEmpty, addMT } = require('./../lil_ops')
const { postToDiscord } = require('./../discord')
const stringify = require('json-stable-stringify');
const fetch = require('node-fetch');

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
        } else if (json.pair == 'HBD'){
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
        if(parseFloat(order.rate) < 0){
            order.type = "MARKET",
            delete order.rate
        }
        order[config.jsonTokenName] = parseInt(json[config.jsonTokenName])
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
            sell_loop: while(remaining){
                let price = dex.buyBook ? parseFloat(dex.buyBook.split('_')[0]) : dex.tick
                let item = dex.buyBook ? dex.buyBook.split('_')[1].split(',')[0] : ''
                console.log({json, item, price, order})
                if (item && (order.type == 'MARKET' || parseFloat(price) >= parseFloat(order.rate))){
                    let next = dex.buyOrders[`${price.toFixed(6)}:${item}`]
                    if(!next){
                        dex.buyBook = DEX.remove(item, dex.buyBook)
                        continue sell_loop
                    }
                    if (next.amount <= remaining){
                        if(next[order.pair]){
                            filled += next.amount
                            adds.push([next.from, next.amount - next.fee])
                            his[`${json.block_num}:${i}:${json.transaction_id}`] = {type: 'sell', t:Date.parse(json.timestamp + '.000Z'), block: json.block_num, base_vol: next.amount, target_vol: next[order.pair], target: order.pair, price: next.rate, id: json.transaction_id + i}
                            fee += next.fee //add the fees
                            remaining -= next.amount
                            dex.tick = price.toFixed(6)
                            pair += next[order.pair]
                            dex.buyBook = DEX.remove(item, dex.buyBook) //adjust the orderbook
                            delete dex.buyOrders[`${price.toFixed(6)}:${item}`]
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
                            ops.push({type: 'del', path: ['dex', order.pair, 'buyOrders', `${price.toFixed(6)}:${item}`]}) //remove the order
                            ops.push({type: 'del', path: ['contracts', next.from , item]}) //remove the contract
                            ops.push({type: 'del', path: ['chrono', next.expire_path]}) //remove the chrono
                        } else { 
                            fee += next.fee
                            fee += next.amount
                            dex.buyBook = DEX.remove(item, dex.buyBook)
                            delete dex.buyOrders[`${price.toFixed(6)}:${item}`]
                            ops.push({type: 'del', path: ['dex', order.pair, 'buyOrders', `${price.toFixed(6)}:${item}`]}) //remove the order
                            ops.push({type: 'del', path: ['contracts', next.from , item]}) //remove the contract
                            ops.push({type: 'del', path: ['chrono', next.expire_path]}) //remove the chrono
                        }
                    } else {
                        const thisfee = parseInt((remaining/next.amount)*next.fee)
                        const thistarget = parseInt((remaining/next.amount)*next[order.pair])
                        if(thistarget){
                            next.fee -= thisfee
                            next[order.pair] -= thistarget
                            next.amount -= remaining
                            filled += remaining
                            pair += thistarget
                            var partial = {
                                coin: thistarget,
                                token: remaining + thisfee
                            }
                            if(next.partial){
                                next.partial[`${json.transaction_id}`] = partial
                            } else {
                                next.partial = {
                                    [`${json.transaction_id}`]: partial
                                }
                            }
                            adds.push([next.from, remaining - thisfee])
                            dex.tick = price.toFixed(6)
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
                            dex.buyOrders[`${price.toFixed(6)}:${item}`] = next
                            remaining = 0
                        } else {
                            fee += remaining
                            remaining = 0
                        }
                    }
                } else {
                    console.log('else')
                    let txid = config.TOKEN + hashThis(from + json.transaction_id),
                        crate = typeof parseFloat(order.rate) == 'number' ? parseFloat(order.rate).toFixed(6) : dex.tick,
                        cfee = typeof stats.dex_fee == 'number' ? parseInt(parseInt(remaining) * parseFloat(stats.dex_fee)) : parseInt(parseInt(remaining) * 0.005),
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
                        type: `${order.pair}:sell`,
                        hive_id: json.transaction_id,
                    }
                    contract[order.pair] = parseInt(remaining * parseFloat(crate))
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
            var waitfor = [add('rn', fee)]
            for(var to in addops){
                waitfor.push(add(to, addops[to]))
            }
            const msg = `@${from}| Sell order confirmed.`
            if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
            ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg })
            ops.push({type: 'put', path: ['balances', from], data: bal})
            ops.push({type: 'put', path: ['dex', order.pair], data: dex})
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
                .catch(e=>console.log('error waitfor'))
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
    json = naizer(json)
    if (config.features.ico && json.to == config.mainICO && json.amount.nai == '@@000000021' && json.from != config.msaccount) { //the ICO disribution... should be in multi sig account
        const amount = parseInt(json.amount.amount)
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
                    if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
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
    } else if ((config.features.dex || config.features.nft) && json.to == config.msaccount && json.from != config.mainICO) {
        if (json.from == 'disregardfiat' && json.memo == 'IGNORE'){
            pc[0](pc[2])
        } else if(json.memo.split(' ').length > 1 && json.memo.split(' ')[0] == 'NFT'){
            /*
                    lth[`set:hash`]{
                        h,//millihive
                        b,//millihbd
                        q,//qty
                        d,//distro string
                        i:`${json.set}:${hash}`,//item for canceling
                        e:'pb:startdate_enddate,max:3',
                        s:'account1_1,account2_2,account3_1',
                        p,//pending sales 
                    }
            */
            let item = json.memo.split(' ')[1],
                setname = item.split(':')[0],
                Pset = getPathObj(['sets', setname]),
                Pstats = getPathObj(['stats']),
                Pitem = getPathObj(['lth', item])
            Promise.all([Pset, Pitem, Pstats]).then(mem =>{
                let set = mem[0],
                    listing = mem[1],
                    stats = mem[2],
                    amount = parseInt(json.amount.amount),
                    type = json.amount.nai == '@@000000021' ? 'HIVE' : 'HBD',
                    ops = [],
                    qty = 0,
                    refund_amount = amount,
                    transfers = [],
                    enf = enforce(listing.e),
                    allowed = 9999999,
                    whoBoughtIndex,
                    whoBoughtAmount = 0
                    stats.MSHeld[type] += refund_amount
                if(listing){
                    if(!listing.s)listing.s = ''
                    if(enf.max){
                        allowed = enf.max
                        whoBoughtIndex = listing.s.indexOf(`${json.from}_`)
                        if(whoBoughtIndex != -1){
                            whoBoughtAmount = parseInt(listing.s.split(`${json.from}_`)[1].split(',')[0])
                            allowed -= whoBoughtAmount
                        }
                    }
                    if(type == 'HIVE' && amount >= listing.h && listing.h != 0){
                        qty = parseInt(amount/listing.h)
                        refund_amount = amount % parseInt(listing.h)
                        if(qty > allowed){
                            tor = qty - allowed
                            qty = allowed
                            refund_amount += tor * listing.h
                        }
                    } else if (type == 'HBD' && amount >= listing.b && listing.b != 0){
                        qty = parseInt(amount/listing.b)
                        refund_amount = amount % parseInt(listing.b)
                        if(qty > allowed){
                            tor = qty - allowed
                            qty = allowed
                            refund_amount += tor * listing.b
                        }
                    }
                    if(enf.max && whoBoughtIndex != -1){
                        listing.s.replace(`${json.from}_${whoBoughtAmount}`, `${json.from}_${whoBoughtAmount + qty}`)
                    } else if (enf.max){
                        listing.s += `,${json.from}_${qty}`
                    }
                    listing.q -= qty
                    if(enf.max){
                        if(!listing.p)listing.p = 0
                        listing.p += qty
                    }
                    ops.push({type: 'put', path: ['lth', item], data: listing})
                    if(listing.q <= 0){
                        qty += listing.q
                        refund_amount += (listing.h * listing.q) + (listing.b * listing.q)
                        if(!listing.p)ops.push({type: 'del', path: ['lth', item]})
                    }
                    if(qty && !enf.pb){
                        addMT(['rnfts', setname, json.from], parseInt(qty))
                        transfers = [...buildSplitTransfers(qty*listing.h+qty*listing.b, type, listing.d, `${qty} ${setname}${qty>1?"'s":""} purchased - ${json.from}:${json.transaction_id.substr(0,8)}:`)]
                    } else if(qty && enf.pb){
                        addMT(['pcon', 'lth', listing.i, json.from], parseInt(qty))
                        postVerify(enf.pb, json.from, listing.i, 'lth')
                        transfers= []
                    }
                    if(refund_amount){
                        transfers.push(['transfer',{
                            to:json.from,
                            from: config.msaccount,
                            amount: parseFloat(refund_amount/1000).toFixed(3) + ` ${type}`,
                            memo: `Refund ${setname} mint token purchase:${json.transaction_id}:`
                        }])
                    }
                    for(var i = 0; i < transfers.length; i++){
                        ops.push({type: 'put', path: ['msa', `${i}:${json.transaction_id}:${json.block_num}`], data: stringify(transfers[i])})
                    }
                    const msg = `@${json.from}| bought ${qty} ${setname} token${qty>1?'s':''} with ${parseFloat(parseInt(amount) / 1000).toFixed(3)} ${type}`
                        if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                        ops.push({
                            type: 'put',
                            path: ['feed', `${json.block_num}:${json.transaction_id}`],
                            data: msg
                        })
                    ops.push({type: 'put', path: ['stats'], data: stats})
                    store.batch(ops, pc)
                } else {
                    ops.push({type: 'put', path: ['msa', `${i}:${json.transaction_id}:${json.block_num}`], data: stringify(['transfer',{
                            to:json.from,
                            from: config.msaccount,
                            amount: json.amount,
                            memo: `Refund: Item(s) not found.`
                        }])})
                    const msg = `@${json.from}| can't locate item(s). Refund in progress.`
                        if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                        ops.push({
                            type: 'put',
                            path: ['feed', `${json.block_num}:${json.transaction_id}`],
                            data: msg
                        })
                    store.batch(ops, pc)
                }
            })
        } else if(json.memo.split(' ').length > 1 && json.memo.split(' ')[0] == 'NFTtrade'){
            let item = json.memo.split(' ')[1],
                setname = item.split(":")[0],
                uid = item.split(':')[1],
                Pstats = getPathObj(['stats']),
                fnftp = getPathObj(['nfts', 't', item]),
                setp = getPathObj(['sets', setname])
            Promise.all([fnftp, setp, Pstats])
            .then(nfts => {
                var to, price, type, stats = nfts[2]
                try{ 
                    to = nfts[0].t.split('_')[1]
                    price = parseInt(nfts[0].t.split('_')[2])
                    type = nfts[0].t.split('_')[3]
                    stats.MSHeld[json.amount.nai == '@@000000021' ? 'HIVE' : 'HBD'] += parseInt(json.amount.amount)
                } catch (e){console.log(nfts[0])}
                if(nfts[0].s !== undefined && to == json.from && parseInt(json.amount.amount) == price && type == json.amount.nai == '@@000000021' ? 'HIVE' : 'HBD') {
                    let ops = [],
                        nft = nfts[0],
                        set = nfts[1]
                    let royalties = parseInt((price * set.r) / 10000)
                    let fee = parseInt((price * config.hive_service_fee) / 10000)
                    let total = price - royalties - fee
                    const Transfer = ['transfer',
                        {
                            from: config.msaccount,
                            to: nfts[0].t.split('_')[0],
                            amount: parseFloat(total/1000).toFixed(3) + ` ${type}`,
                            memo: `${item} traded to ${json.from}.`
                        }]
                    if(royalties){
                        DEX.buyDluxFromDex(royalties, type, json.block_num, `roy_${json.transaction_id}`, `n:${set.n}`, json.timestamp)
                        .then(empty=>{
                            DEX.buyDluxFromDex(fee, type, json.block_num, `fee_${json.transaction_id}`, `rn`, json.timestamp)
                            .then(emp=>{
                                finish(set, json, listing, uid, item, Transfer, nft, pc)
                            })
                        })
                    } else {
                        DEX.buyDluxFromDex(fee, type, json.block_num, `fee_${json.transaction_id}`, `rn`, json.timestamp)
                        .then(emp=>{
                            finish(set, json, listing, uid, item, Transfer, nft, pc)
                        })
                    }
                    function finish(set, json, listing, uid, item, Transfer, nft, promise){
                        var ops = []
                        nft.s = NFT.last(json.block_num, nft.s)
                        set.u = NFT.move(uid, json.from, set.u)
                        delete nft.t
                        ops.push({type:'put', path:['nfts', json.from,`${setname}:${uid}`], data: nft})
                        ops.push({type:'put', path:['sets', setname], data: set})
                        ops.push({type:'del', path:['nfts', 't', `${setname}:${uid}`]})
                        ops.push({ type: 'put', path: ['msa', `${json.block_num}:vop_${json.transaction_id}`], data: stringify(Transfer) })
                        // is there anything in the NFT that needs to be modified? owner, renter, 
                        let msg = `@${json.from} completed NFT: ${setname}:${uid} transfer`
                        if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                        ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg });
                        ops.push({type:'put', path:['stats'], data: stats})
                        store.batch(ops, promise)
                    }
                    
                } else {
                    const transfer = ['transfer',{ 
                                to: json.from,
                                from: config.msaccount,
                                amount: json.amount,
                                memo: `Failed trade. ${json.transaction_id.substr(0,8)}`
                            }]
                    var ops = []
                    ops.push({type:'put', path:['msa', `Failed:${setname}:${uid}:${json.transaction_id}`], data: stringify(transfer)})
                    let msg = `@${json.from} trade of ${setname}:${uid} didn't go well.`
                    if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                    ops.push({type:'put', path:['stats'], data: stats})
                    store.batch(ops, pc)
                }
            })
            .catch(e => { console.log(e); });
        } else if (json.memo.split(' ').length > 1 && json.memo.split(' ')[0] == 'NFTbid'){
            let item = json.memo.split(' ')[1],
                set = item.split(':')[0],
                uid = item.split(':')[1]
                ahp = getPathObj(['ahh', `${set}:${uid}`]),
                Pstats = getPathObj(['stats'])
                amount = parseInt(json.amount.amount)
                type = json.amount.nai == '@@000000021' ? 'HIVE' : 'HBD'
            Promise.all([ahp, Pstats])
            .then(mem => {
                var stats = mem[1]
                stats.MSHeld[json.amount.nai == '@@000000021' ? 'HIVE' : 'HBD'] += parseInt(json.amount.amount)
                if(mem[0].h == type){ // && json.from != mem[0].f){ //check for item and type
                    var listing = mem[0]
                    if(listing.b){
                        if (amount > listing.b){
                            const transfer = ['transfer',{ 
                                to: listing.f,
                                from: config.msaccount,
                                amount: parseFloat(listing.b/1000).toFixed(3) + ` ${type}`,
                                memo: `Outbid on ${set}:${uid}. ${json.transaction_id.substr(0,8)}`
                            }]
                            var ops = []
                            ops.push({type:'put', path:['stats'], data: stats})
                            ops.push({type:'put', path:['msa', `Outbid:${set}:${uid}:${json.transaction_id}`], data: stringify(transfer)})
                            listing.f = json.from
                            listing.b = amount
                            listing.c++
                            ops.push({type:'put', path:['ahh', `${set}:${uid}`], data: listing})
                            let msg = `@${json.from} bid ${parseFloat(amount/1000).toFixed(3)} ${type} on ${set}:${uid}'s auction`
                            if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                            ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg });
                            store.batch(ops, pc)
                        } else {
                            const transfer = ['transfer',{ 
                                to: json.from,
                                from: config.msaccount,
                                amount: json.amount,
                                memo: `Underbid on ${set}:${uid}. ${json.transaction_id.substr(0,8)}`
                            }]
                            var ops = []
                            ops.push({type:'put', path:['stats'], data: stats})
                            ops.push({type:'put', path:['msa', `Underbid:${set}:${uid}:${json.transaction_id}`], data: stringify(transfer)})
                            let msg = `@${json.from} hasn't outbid on ${set}:${uid}`
                            if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                            store.batch(ops, pc)
                        }
                    } else if (amount >= listing.p){
                        listing.f = json.from
                        listing.b = amount
                        listing.c = 1
                        var ops = []
                        ops.push({type:'put', path:['stats'], data: stats})
                        ops.push({type:'put', path:['ahh', `${set}:${uid}`], data: listing})
                        let msg = `@${json.from} bid ${parseFloat(amount/1000).toFixed(3)} ${type} on ${set}:${uid}'s auction`
                        if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                        ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg });
                        store.batch(ops, pc)
                    } else {
                        const transfer = ['transfer',{ 
                                to: json.from,
                                from: config.msaccount,
                                amount: json.amount,
                                memo: `Underbid on ${set}:${uid}. ${json.transaction_id.substr(0,8)}`
                            }]
                        var ops = []
                        ops.push({type:'put', path:['stats'], data: stats})
                        ops.push({type:'put', path:['msa', `Underbid:${set}:${uid}:${json.transaction_id}`], data: stringify(transfer)})
                        let msg = `@${json.from} hasn't outbid on ${set}:${uid}`
                        if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                        store.batch(ops, pc)
                    }
                } else {
                    const transfer = ['transfer',{ 
                                to: json.from,
                                from: config.msaccount,
                                amount: json.amount,
                                memo: `Underbid on ${set}:${uid}. ${json.transaction_id.substr(0,8)}`
                            }]
                    var ops = []
                    ops.push({type:'put', path:['stats'], data: stats})
                    ops.push({type:'put', path:['msa', `Underbid:${set}:${uid}:${json.transaction_id}`], data: stringify(transfer)})
                    let msg = `@${json.from} bid on ${set}:${uid} didn't go well.`
                    if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                    store.batch(ops, pc)
                }
            })
            .catch(e => { console.log(e); })
        } else if (json.memo.split(' ').length > 1 && json.memo.split(' ')[0] == 'NFTbuy'){
            let item = json.memo.split(' ')[1],
                setname = item.split(':')[0],
                uid = item.split(':')[1],
                lsp = getPathObj(['ls', `${setname}:${uid}`]),
                setp = getPathObj(['sets', setname]),
                Pstats = getPathObj(['stats'])
                amount = parseInt(json.amount.amount)
                type = json.amount.nai == '@@000000021' ? 'HIVE' : 'HBD'
            Promise.all([lsp, setp, Pstats])
            .then(mem => {
                var stats = mem[2]
                stats.MSHeld[type] += amount
                if(mem[0].h == type && json.from != mem[0].o && amount == mem[0].p){ //check for item and type
                    let listing = mem[0],
                        set = mem[1],
                        ops = [],
                        promises = [],
                    // const fee = parseInt(listing.b /100); add('n', fee); listingb = listing.b - fee;
                        nft = listing.nft
                    const last_modified = nft.s.split(',')[0]
                    nft.s.replace(last_modified, Base64.fromNumber(json.block_num)) //update last modified
                    let royalties = parseInt((listing.p * set.r) / 10000)
                    let fee = parseInt((listing.p * config.hive_service_fee) / 10000)
                    let total = listing.p - royalties - fee
                    const Transfer = ['transfer',
                        {
                            from: config.msaccount,
                            to: listing.o,
                            amount: parseFloat(total/1000).toFixed(3) + ` ${listing.h}`,
                            memo: `${item} sold to ${json.from}.`
                        }]
                    if(royalties){
                        DEX.buyDluxFromDex(royalties, listing.h, json.block_num, `roy_${json.transaction_id}`, `n:${set.n}`, json.timestamp)
                        .then(empty=>{
                            DEX.buyDluxFromDex(fee, listing.h, json.block_num, `fee_${json.transaction_id}`, `rn`, json.timestamp)
                            .then(emp=>{
                                finish(set, json, listing, uid, item, Transfer, nft, pc)
                            })
                        })
                    } else {
                        DEX.buyDluxFromDex(fee, listing.h, json.block_num, `fee_${json.transaction_id}`, `rn`, json.timestamp)
                        .then(emp=>{
                            finish(set, json, listing, uid, item, Transfer, nft, pc)
                        })
                    }
                    function finish(set, json, listing, uid, item, Transfer, nft, promise){
                        var ops = []
                        ops.push({type:'put', path:['stats'], data: stats})
                        if(set != 'Qm') set.u = NFT.move(uid, json.from, set.u)//update set
                        else set.u = json.from
                        ops.push({ type: 'put', path: ['nfts', json.from, item], data: nft }) //update nft
                        const msg = `Sell of ${listing.o}'s ${item} finalized for ${Transfer[1].amount} to ${json.from}`
                        ops.push({ type: 'put', path: ['feed', `${json.block_num}:vop_${json.transaction_id}`], data: msg })
                        ops.push({ type: 'put', path: ['msa', `${json.block_num}:vop_${json.transaction_id}`], data: stringify(Transfer) })
                        if(config.hookurl)postToDiscord(msg, `${json.block_num}:vop_${json.transaction_id}`)
                        if (set != 'Qm') ops.push({ type: 'put', path: ['sets', set.n], data: set }) //update set
                        else ops.push({ type: 'put', path: ['sets', `Qm${uid}`], data: set })
                        ops.push({ type: 'del', path: ['ls', item] })
                        store.batch(ops, promise)
                    }
                } else {
                    const transfer = ['transfer',{ 
                                to: json.from,
                                from: config.msaccount,
                                amount: parseFloat(listing.b/1000).toFixed(3) + ` ${type}`,
                                memo: `Failed to buy ${setname}:${uid}. ${json.transaction_id.substr(0,8)}`
                            }]
                    var ops = []
                    ops.push({type:'put', path:['stats'], data: stats})
                    ops.push({type:'put', path:['msa', `FailedBuy:${set}:${uid}:${json.transaction_id}`], data: stringify(transfer)})
                    let msg = `@${json.from} buy of ${set}:${uid} didn't go well.`
                    if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                    store.batch(ops, pc)
                }
            })
            .catch(e => { console.log(e); })
        } else {
            //console.log(json)
            let order = {
                type: 'LIMIT'
            },
                path = '',
                waiting = Promise.resolve(''),
                contract = ''
            try {order = JSON.parse(json.memo)} catch (e) {}
            if (!order.rate) {
                order.type = 'MARKET'
                order.rate = 0
            } else {
                order.type = 'LIMIT'
                order.rate = parseFloat(order.rate).toFixed(6)
            }
            if(parseFloat(order.rate) < 0){
                order.type = 'MARKET'
                order.rate = 0
            }
            order.pair = json.amount.nai == '@@000000021' ? 'hive' : 'hbd'
            order.amount = parseInt(json.amount.amount)
            //console.log({order})
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
                        if(typeof order.rate != 'string') order.rate = dex.tick
                        stats.MSHeld[json.amount.nai == '@@000000021' ? 'HIVE' : 'HBD'] += parseInt(json.amount.amount)
                    while (remaining){
                        i++
                        var price = dex.sellBook ? parseFloat(dex.sellBook.split('_')[0]).toFixed(6) : ''
                        let item = ''
                        if(price)item = dex.sellBook.split('_')[1].split(',')[0]
                        else price = dex.tick
                        console.log('Matching...',{order,price,item})
                        if (item && (order.pair == 'hbd' || (order.pair == 'hive' && (price <= stats.icoPrice/1000 || !config.features.ico))) && ( order.type == 'MARKET' || (order.type == 'LIMIT' && order.rate >= price))) {
                            var next = dex.sellOrders?.[`${price}:${item}`]
                            console.log('Matched order', {next})
                            if (next && next[order.pair] <= remaining){
                                if (next[order.pair]){
                                    console.log('Partial Fill')
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
                                    ops.push({type: 'put', path: ['msa', `${item}:${json.transaction_id}:${i}`], data: stringify(transfer)}) //send HIVE out via MS
                                    ops.push({type: 'del', path: ['dex', order.pair, 'sellOrders', `${price}:${item}`]}) //remove the order
                                    ops.push({type: 'del', path: ['contracts', next.from , item]}) //remove the contract
                                    ops.push({type: 'del', path: ['chrono', next.expire_path]}) //remove the chrono
                                } else {
                                    console.log('Only fees left...')
                                    fee += next.fee
                                    fee += next.amount
                                    dex.sellBook = DEX.remove(item, dex.sellBook) //adjust the orderbook
                                    delete dex.sellOrders[`${price}:${item}`]
                                    ops.push({type: 'del', path: ['dex', order.pair, 'sellOrders', `${price}:${item}`]}) //remove the order
                                    ops.push({type: 'del', path: ['contracts', next.from , item]}) //remove the contract
                                    ops.push({type: 'del', path: ['chrono', next.expire_path]}) //remove the chrono
                                }
                            } else if(!next && dex.sellBook.indexOf(item) > -1) {
                                console.log('Sell Book Error:', dex.sellBook)
                                dex.sellBook = DEX.remove(item, dex.sellBook)
                            } else {
                                console.log('Filled')
                                next[order.pair] = next[order.pair] - remaining // modify the contract
                                const tokenAmount = parseInt(remaining / parseFloat(next.rate))
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
                                ops.push({type: 'put', path: ['msa', `${item}:${json.transaction_id}:${i}`], data: stringify(transfer)}) //send HIVE out via MS
                                //ops.push({type: 'put', path: ['dex', order.pair, 'sellOrders', `${price.toFixed(6)}:${item}`], data: next}) //update the order
                                ops.push({type: 'put', path: ['contracts', next.from , item], data: next}) //update the contract
                            }
                        } else {
                            if (config.features.ico && order.pair == 'hive' && ( order.type == 'MARKET' || (order.type == 'LIMIT' && order.rate >= stats.icoPrice/1000 ))){
                                console.log('ICO')
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
                                    ops.push({ type: 'put', path: ['stats'], data: stats })
                                    store.batch(ops, pc)
                                }
                            } else {
                                console.log('Building contract')
                                const txid = config.TOKEN + hashThis(json.from + json.transaction_id),
                                    crate = parseFloat(order.rate) > 0 ? order.rate : dex.tick,
                                    toRefund = maxAllowed(stats, dex.tick, remaining, crate)
                                    remaining = remaining - toRefund
                                    console.log({toRefund, remaining})
                                const hours = 720,
                                    expBlock = json.block_num + (hours * 1200)
                                if (toRefund){
                                    const transfer = [
                                        "transfer",
                                        {
                                            "from": config.msaccount,
                                            "to": json.from,
                                            "amount": parseFloat(toRefund/1000).toFixed(3) + ' ' + order.pair.toUpperCase(),
                                            "memo": `Partial refund due to collateral limits ${json.from}:${json.transaction_id}`
                                        }
                                    ]
                                    ops.push({type: 'put', path: ['msa', `Refund@${json.from}:${json.transaction_id}:${json.block_num}`], data: stringify(transfer)})
                                }
                                contract = {
                                    txid,
                                    from: json.from,
                                    hive: 0,
                                    hbd: 0,
                                    fee: 0,
                                    amount: 0,
                                    rate: crate,
                                    block: json.block_num,
                                    type: `${order.pair}:buy`,
                                    hive_id: json.transaction_id,
                                }
                                contract.amount = parseInt(remaining / crate)
                                cfee = parseFloat(stats.dex_fee) > 0 ? parseInt(parseInt(contract.amount) * parseFloat(stats.dex_fee)) + 1 : parseInt(contract.amount * 0.005) + 1,
                                contract[order.pair] = remaining
                                if(remaining){
                                    dex.buyBook = DEX.insert(txid, crate, dex.buyBook, 'buy')
                                    path = chronAssign(expBlock, {
                                        block: expBlock,
                                        op: 'expire',
                                        from: json.from,
                                        txid
                                    })
                                remaining = 0
                                }
                                console.log({contract})
                            }
                        }
                    }
                    let msg = ''
                    if(remaining == order.amount){
                        msg = `@${json.from} set a buy order at ${contrate.rate}.`
                        
                    } else if (json.from != 'rn') {
                        msg = `@${json.from} | order recieved.`
                        waiting = add('rn', fee)
                    } else {
                        console.log({fee})
                        msg = `@${json.from} | order recieved.`
                        bal += fee
                    }
                    if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                    ops.push({type: 'put', path: ['balances', json.from], data: bal})
                    ops.push({type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}.${i++}`], data: msg})
                    if(Object.keys(his).length)ops.push({type: 'put', path: ['dex', order.pair, 'his'], data: his})
                    if(!path){
                        Promise.all([waiting]).then(empty=>{
                            ops.push({type: 'put', path: ['dex', order.pair], data: dex})
                            ops.push({ type: 'put', path: ['stats'], data: stats })
                            if (process.env.npm_lifecycle_event == 'test') pc[2] = ops
                            store.batch(ops, pc) 
                        })
                    } else {
                        Promise.all([path,waiting]).then(expPath => {
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
                            ops.push({ type: 'put', path: ['stats'], data: stats })
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
                ops.push({ type: 'put', path: ['stats'], data: stats })
                store.batch(ops, pc)
            }
        }
    } else if (config.features.dex && json.from == config.msaccount){
        var Pmss = getPathObj(['mss']),
            Pstats = getPathObj(['stats'])
        
        Promise.all([Pmss, Pstats]).then(mem => {
            var mss = mem[0],
                stats = mem[1]
                stats.MSHeld[json.amount.nai == '@@000000021' ? 'HIVE' : 'HBD'] -= parseInt(json.amount.amount)
            var ops = [{ type: 'put', path: ['stats'], data: stats }]
            for (var block in mss){
                if(block.split(':').length < 2 && mss[block].indexOf(json.memo) > 0){
                    ops.push({type:'del', path:['mss', `${block}`]})
                    ops.push({type:'del', path:['mss', `${block}:sigs`]})
                    break
                }
            }
            store.batch(ops,pc)
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
                    const msg = `@${json.from}| sent @${json.to} ${nai(json.amount)} for ${json.memo.split(' ')[0]}`
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
        var q = []
        if (typeof json.txid == 'string') {
            q.push(json.txid)
        } else {
            pc[0](pc[2])
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
                                if (e) { pc[0](pc[2]) } else if (isEmpty(a)) { console.log('Nothing here' + b.txid) } else {
                                    release(from, b.txid, json.block_num, json.transaction_id).then(y => pc[0](pc[2])).catch(e=>{rej(e)})
                                }
                            })
                            break
                        case 'hbd:sell':
                            store.get(['dex', 'hbd', 'sellOrders', `${b.rate}:${b.txid}`], function(e, a) {
                                if (e) { pc[0](pc[2]) } else if (isEmpty(a)) { console.log('Nothing here' + b.txid) } else {
                                    release(from, b.txid, json.block_num, json.transaction_id).then(y => pc[0](pc[2])).catch(e=>{rej(e)})
                                }
                            })
                            break
                        case 'hive:buy':
                            store.get(['dex', 'hive', 'buyOrders', `${b.rate}:${b.txid}`], function(e, a) {
                                if (e) { pc[0](pc[2]) } else if (isEmpty(a)) { console.log('Nothing here' + b.txid) } else {
                                    release(from, b.txid, json.block_num, json.transaction_id).then(y => pc[0](pc[2])).catch(e=>{rej(e)})
                                }
                            })
                            break
                        case 'hbd:buy':
                            store.get(['dex', 'hbd', 'buyOrders', `${b.rate}:${b.txid}`], function(e, a) {
                                if (e) { pc[0](pc[2]) } else if (isEmpty(a)) { console.log('Nothing here' + b.txid) } else {
                                    release(from, b.txid, json.block_num, json.transaction_id).then(y => pc[0](pc[2])).catch(e=>{rej(e)})
                                }
                            })
                            break
                        default:
                            pc[0](pc[2])
                    }
                } else {
                    pc[0](pc[2])
                    console.log(e)
                }
            })
        }
    } else {
        pc[0](pc[2])
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

function enforce(str){
    str = str || ''
    let enforce = {},
        arr = str.split(',')
    for(let i = 0; i < arr.length; i++){
        let s = arr[i].split(':')
        enforce[s[0]] = arr[i].replace(`${s[0]}:`, '')
    }
    return enforce
} 

/*
function postVerify(str, from, loc){
    fetch("https://api.hive.blog", {
        body: `{"jsonrpc":"2.0", "method":"bridge.get_account_posts", "params":{"sort":"posts", "account": "${from}", "limit": 25}, "id":1}`,
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        method: "POST"
    })
    .then(res => res.json()).then(json => {
        var valid = false
        for(var i = 0; i < json.result.length; i++){
            if(new Date(`${json.result[i].created}.000Z`).getTime() > new Date(`${str.split('_')[0]}:00.000Z`).getTime() && new Date(`${json.result[i].created}.000Z`).getTime() < new Date(`${str.split('_')[1]}:00.000Z`).getTime()){
                    valid = true
                    break 
            }
        }
        if (plasma.oracle){
            plasma.oracle[`${loc}:${from}`] = 'lth:' + valid
        } else {
            plasma.oracle = {}
            plasma.oracle[`${loc}:${from}`] = 'lth:' + valid
        }
    })
}
*/
const release = (from, txid, bn, tx_id) => {
    return new Promise((resolve, reject) => {
        store.get(['contracts', from, txid], function(er, a) {
            if (er) { console.log(er); } else {
                var ops = [];
                switch (a.type) {
                    case 'hive:sell':
                        store.get(['dex', 'hive'], function(e, res) {
                            
                            if (e) { console.log(e); } else if (isEmpty(res)) { console.log('Nothing here' + a.txid); } else {
                                r = res.sellOrders[`${a.rate}:${a.txid}`]
                                res.sellBook = DEX.remove(a.txid, res.sellBook)
                                ops.push({ type: 'put', path: ['dex', 'hive', 'sellBook'], data: res.sellBook });
                                add(r.from, r.amount).then(empty => {
                                    ops.push({ type: 'del', path: ['contracts', from, txid] });
                                    ops.push({ type: 'del', path: ['chrono', a.expire_path] });
                                    ops.push({ type: 'del', path: ['dex', 'hive', 'sellOrders', `${a.rate}:${a.txid}`] });
                                    if(tx_id && config.hookurl){postToDiscord(`@${from} has canceled ${txid}`, `${bn}:${tx_id}`)}
                                    store.batch(ops, [resolve, reject]);
                                }).catch(e => { reject(e); });
                            }
                        });
                        break;
                    case 'hbd:sell':
                        store.get(['dex', 'hbd'], function(e, res) {
                            if (e) { console.log(e); } else if (isEmpty(res)) { console.log('Nothing here' + a.txid); } else {
                                r = res.sellOrders[`${a.rate}:${a.txid}`]
                                res.sellBook = DEX.remove(a.txid, res.sellBook)
                                ops.push({ type: 'put', path: ['dex', 'hbd', 'sellBook'], data: res.sellBook });
                                add(r.from, r.amount).then(empty => {
                                    ops.push({ type: 'del', path: ['contracts', from, txid] });
                                    ops.push({ type: 'del', path: ['chrono', a.expire_path] });
                                    ops.push({ type: 'del', path: ['dex', 'hbd', 'sellOrders', `${a.rate}:${a.txid}`] });
                                    if(tx_id && config.hookurl){postToDiscord(`@${from} has canceled ${txid}`, `${bn}:${tx_id}`)}
                                    store.batch(ops, [resolve, reject]);
                                }).catch(e => { reject(e); });

                            }
                        });
                        break;
                    case 'hive:buy':
                        store.get(['dex', 'hive'], function(e, res) {
                            if (e) { console.log(e); } else if (isEmpty(res)) { console.log('Nothing here' + a.txid); } else {
                                r = res.buyOrders[`${a.rate}:${a.txid}`]
                                res.buyBook = DEX.remove(a.txid, res.buyBook)
                                ops.push({ type: 'put', path: ['dex', 'hive', 'buyBook'], data: res.buyBook });
                                a.cancel = true;
                                const Transfer = [
                                    "transfer",
                                    {
                                        "from": config.msaccount,
                                        "to": a.from,
                                        "amount": parseFloat(a.hive/1000).toFixed(3) + ' HIVE',
                                        "memo": `Canceled DLUX buy ${a.txid}`
                                    }
                                ]
                                ops.push({type: 'put', path: ['msa', `refund@${a.from}:${a.txid}:${bn}`], data: stringify(Transfer)})
                                ops.push({ type: 'del', path: ['contracts', from, a.txid]});
                                ops.push({ type: 'del', path: ['dex', 'hive', 'buyOrders', `${a.rate}:${a.txid}`] });
                                if(tx_id && config.hookurl){postToDiscord(`@${from} has canceled ${txid}`, `${bn}:${tx_id}`)}
                                store.batch(ops, [resolve, reject]);
                            }
                        });
                        break;
                    case 'hbd:buy':
                        store.get(['dex', 'hbd'], function(e, res) {
                            if (e) {
                                console.log(e);
                            } else if (isEmpty(res)) {
                                console.log('Nothing here' + a.txid);
                            } else {
                                r = res.buyOrders[`${a.rate}:${a.txid}`]
                                res.buyBook = DEX.remove(a.txid, res.buyBook)
                                ops.push({ type: 'put', path: ['dex', 'hbd', 'buyBook'], data: res.buyBook });
                                a.cancel = true;
                                const Transfer = [
                                    "transfer",
                                    {
                                        "from": config.msaccount,
                                        "to": a.from,
                                        "amount": parseFloat(a.hbd/1000).toFixed(3) + ' HBD',
                                        "memo": `Canceled DLUX buy ${a.txid}`
                                    }
                                ]
                                ops.push({type: 'put', path: ['msa', `refund@${a.from}:${a.txid}:${bn}`], data: stringify(Transfer)})
                                ops.push({ type: 'del', path: ['contracts', from, a.txid]});
                                ops.push({ type: 'del', path: ['dex', 'hbd', 'buyOrders', `${a.rate}:${a.txid}`] });
                                if(tx_id && config.hookurl){postToDiscord(`@${from} has canceled ${txid}`, `${bn}:${tx_id}`)}
                                store.batch(ops, [resolve, reject]);
                            }
                        });
                        break;
                    default:
                        resolve();
                }
            }
        });
    })
}
exports.release = release

//change stats to msheld {}

exports.margins = function(bn) {
    return new Promise((resolve, reject) => {
        var Pstats = getPathObj(['stats']),
            Pdex = getPathObj(['dex']),
            Pmsa = getPathObj(['msa']),
            Pmss = getPathObj(['mss'])
        Promise.all([Pstats, Pdex, Pmsa, Pmss]).then(mem =>{
            var stats = mem[0],
                dex = mem[1],
                msa = mem[2],
                mss = mem[3]
            if(Object.keys(msa).length)for (var x in msa){
                if(typeof msa[x] == 'string')msa[x].split('amount\":\"').forEach(y => {
                    const amount = y.split('\"')[0],
                        type = amount.split(' ')[1],
                        mt = parseInt(parseFloat(amount.split(' ')[0]) * 1000)
                    if(type == 'HIVE'){
                        stats.MSHeld.HIVE -= mt
                    } else if (type == 'HBD'){
                        stats.MSHeld.HBD -= mt
                    }
                })
            }
            if(Object.keys(mss).length)for (var x in mss){
                if(typeof mss[x] == 'string')mss[x].split('amount\":\"').forEach(y => {
                    const amount = y.split('\"')[0],
                        type = amount.split(' ')[1],
                        mt = parseInt(parseFloat(amount.split(' ')[0]) * 1000)
                    if(type == 'HIVE'){
                        stats.MSHeld.HIVE -= mt
                    } else if (type == 'HBD'){
                        stats.MSHeld.HBD -= mt
                    }
                })
            }
            var allowedHive = parseInt(stats.multiSigCollateral * parseFloat(dex.hive.tick)),
                allowedHBD = parseInt(stats.multiSigCollateral * parseFloat(dex.hbd.tick)),
                changed = []
                promises = []
                if(stats.MSHeld.HIVE > allowedHive)console.log(stats.MSHeld.HIVE , {allowedHive})
                if(stats.MSHeld.HIVE > allowedHive){
                    var p = dex.hive.buyBook.split(','),
                        price = p[p.length - 1].split('_')[0],
                        items = p[p.length - 1].split('_')
                    for(var i = 1; i < items.length; i++){
                        if(dex.hive.buyOrders[`${price}:${items[i]}`])promises.push(release(dex.hive.buyOrders[`${price}:${items[i]}`].from, items[i], bn, `${bn}_hive_collateral_vop`))
                        else {
                            changed.push([items[i], 'hive'])
                        }
                    }
                }
            if(stats.MSHeld.HBD > allowedHBD){
                var p = dex.hbd.buyBook.split(','),
                    price = p[p.length - 1].split('_')[0],
                    items = p[p.length - 1].split('_')
                for(var i = 1; i < items.length; i++){
                    if(dex.hbd.buyOrders[`${price}:${items[i]}`])promises.push(release(dex.hbd.buyOrders[`${price}:${items[i]}`].from, items[i], bn, `${bn}_hbd_collateral_vop`))
                    else {
                        changed.push([items[i], 'hbd'])
                    }
                }
            }
            if(promises.length > 0){
                Promise.all(promises).then(() => {
                    if(!changed.length)resolve('Pruned')
                    else removeItems(changed, resolve)
                })
            } else {
                if(!changed.length)resolve('No pruning')
                else removeItems(changed, resolve)
            }
        })
    })
}

function removeItems (arr, p){
    let phive = getPathObj(['dex', 'hive', 'buyBook']),
        phbd = getPathObj(['dex', 'hbd', 'buyBook'])
    Promise.all([phive, phbd]).then(mem => {
        var hive = mem[0],
            hbd = mem[1]
        for(var i = 0; i < arr.length; i++){
            console.log('Cleaned: ', arr[i][0])
            if(arr[i][1] == 'hive')hive = DEX.remove(arr[i][0], hive)
            if(arr[i][1] == 'hbd')hbd = DEX.remove(arr[i][0], hbd)
        }
        store.batch([{type: 'put', path: ['dex', 'hive', 'buyBook'], data: hive},{type: 'put', path: ['dex', 'hbd', 'buyBook'], data: hbd}], [p, 'error', 'Pruned'])
    })
}

function nai (obj){
    return `${parseFloat(obj.amount.amount/Math.pow(10, obj.precision))} ${obj.amount.nai == '@@000000021' ? 'HIVE' : 'HBD'}`
}
function naizer(obj){
    if(typeof obj.amount != 'string')return obj
    else{
        const nai = obj.amount.split(' ')[1] == 'HIVE' ? '@@000000021' : '@@000000013'
        const amount = parseInt(parseFloat(obj.amount.split(' ')[0])*1000).toString()
        const precision = 3
        obj.amount ={
            amount,
            nai,
            precision
        }
        return obj
    }

}

function maxAllowed(stats, tick, remaining, crate) {
    const max = stats.safetyLimit * tick * (1 - ((crate/tick) * (stats.dex_slope/100))) * (stats.dex_max/100)
    return max > remaining ? 0 : parseInt(remaining - max)
}