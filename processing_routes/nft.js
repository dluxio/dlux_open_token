const config = require('./../config')
const { store, unshiftOp } = require('./../index')
const { chronAssign, add, hashThis, addMT } = require('./../lil_ops')
const { getPathObj } = require('../getPathObj')
const { postToDiscord } = require('./../discord')
const { Base64, primes, NFT } = require('./../helpers')
const { getPathNum } = require('../getPathNum')
const { set } = require('@hiveio/hive-js/lib/auth/serializer/src/types')

/*
json { set, uid}
*/
exports.nft_pfp = function(json, from, active, pc) {
    let fnftp = getPathObj(['nfts', from, `${json.set}:${json.uid}`])
    Promise.all([fnftp])
    .then(nfts => {
        console.log(nfts[0])
        if(nfts[0].s !== undefined) {
            let ops = [],
                nft = nfts[0]
            ops.push({type:'put', path:['pfps', from], data: `${json.set}:${json.uid}`}) 
            let msg = `@${from}| Set ${json.set}:${json.uid} to their pfp`
            if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
            ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg });
            store.batch(ops, pc)
        } else {
            if (config.hookurl) postToDiscord(`@${from} doesn't own NFT: ${json.uid}`)
            pc[0](pc[2])
        }
    })
    .catch(e => { console.log(e); });
}

/*
json:{
    set: 'dlux',
    uid: 'aa',
    to: 'somebody'
}
*/
exports.nft_transfer = function(json, from, active, pc) {
    let fnftp = getPathObj(['nfts', from, `${json.set}:${json.uid}`]),
        setp = getPathObj(['sets', json.set]); //to balance promise
    Promise.all([fnftp, setp])
    .then(nfts => {
        console.log(nfts[0].s !== undefined , !nfts[0].l , active)
        if(nfts[0].s !== undefined && !nfts[0].l && active) {
            let ops = [],
                set = nfts[1],
                nft = nfts[0]
            nft.s = NFT.last(json.block_num, nft.s) //change last modified
            set.u = NFT.move(json.uid, json.to, set.u)
            ops.push({type:'put', path:['nfts', json.to, `${json.set}:${json.uid}`], data: nft})
            ops.push({type:'del', path:['nfts', from, `${json.set}:${json.uid}`]})
            ops.push({type:'put', path:['sets', json.set], data: set})
            // is there anything in the NFT that needs to be modified? owner, renter, 
            let msg = `@${from}| Sent ${json.set}:${json.uid} to @${json.to}`
            if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
            ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg });
            store.batch(ops, pc)
        } else {
            if (config.hookurl) postToDiscord(`@${from} doesn't own NFT: ${json.nft_id}`)
            pc[0](pc[2])
        }
    })
    .catch(e => { console.log(e); });
}
/*
json:{
    set: 'dlux',
    uid: 'aa',
    to: 'somebody',
    price: 1000
}
*/
//build a contract with payment price and expiration
exports.nft_reserve_transfer = function(json, from, active, pc) {
    let fnftp = getPathObj(['nfts', from, `${json.set}:${json.uid}`]),
        setp = getPathObj(['sets', json.set]); //to balance promise
    Promise.all([fnftp, setp])
    .then(nfts => {
        if(nfts[0].s !== undefined && !nfts[0].l && active) {
            let ops = [],
                nft = nfts[0],
                set = nfts[1]
            nft.s = NFT.last(json.block_num, nft.s)
            set.u = NFT.move(json.uid, 't', set.u)
            nft.t = `${from}_${json.to}_${json.price}`
            ops.push({type:'put', path:['nfts', 't', `${json.set}:${json.uid}`], data: nft})
            ops.push({type:'put', path:['sets', json.set], data: set})
            ops.push({type:'del', path:['nfts', from, `${json.set}:${json.uid}`]})
            // is there anything in the NFT that needs to be modified? owner, renter, 
            let msg = `@${from}| Reserved NFT: ${json.set}:${json.uid} for @${json.to}`
            if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
            ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg });
            store.batch(ops, pc)
        } else {
            if (config.hookurl) postToDiscord(`@${json.to} doesn't own NFT: ${json.set}:${json.uid}`)
            pc[0](pc[2])
        }
    })
    .catch(e => { console.log(e); });
}
/*
json:{
    set: 'dlux',
    uid: 'aa'
}
*/
//fulfil nft transfer via complete payment
exports.nft_reserve_complete  = function(json, from, active, pc) {
    let fnftp = getPathObj(['nfts', 't', `${json.set}:${json.uid}`]),
        setp = getPathObj(['sets', json.set]), //to balance promise
        balp = getPathNum(['balances', from])
    Promise.all([fnftp, setp, balp])
    .then(nfts => {
        const price = parseInt(nfts[0].t.split('_')[2])
        if(nfts[0].s !== undefined && nfts[0].t.split('_')[1] == from && active && nfts[2] >= price) {
            let ops = [],
                nft = nfts[0],
                set = nfts[1]
            nft.s = NFT.last(json.block_num, nft.s)
            set.u = NFT.move(json.uid, from, set.u)
            const royalty = parseInt((price * 10000)/set.r)
            add(set.a, royalty)
            add(nft[0].t.split('_')[0], price - royalty)
            add(from, -price)
            delete nft.t
            ops.push({type:'put', path:['nfts', from,`${json.set}:${json.uid}`], data: nft})
            ops.push({type:'put', path:['sets', json.set], data: set})
            ops.push({type:'del', path:['nfts', 't', `${json.set}:${json.uid}`]})
            // is there anything in the NFT that needs to be modified? owner, renter, 
            let msg = `@${from} completed NFT: ${json.set}:${json.uid} transfer`
            if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
            ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg });
            store.batch(ops, pc)
        } else {
            if (config.hookurl) postToDiscord(`Can't find NFT: ${json.set}:${json.uid} in pending transfers`)
            pc[0](pc[2])
        }
    })
    .catch(e => { console.log(e); });
}
/*
json:{
    set: 'dlux',
    uid: 'AA'
}
*/
//cancel nft transfer by deleteing the contract and placing the NFT back in 
exports.nft_transfer_cancel  = function(json, from, active, pc) {
    let fnftp = getPathObj(['nfts', 't', `${json.set}:${json.uid}`]),
        setp = getPathObj(['sets', json.set]); //to balance promise
    Promise.all([fnftp, setp])
    .then(nfts => {
        if((nft[0].t.split('_')[1] == from || nft[0].t.split('_')[0] == from) && active) {
            let ops = []
                nft = nfts[0],
                set = nfts[1]
            nft.s = NFT.last(json.block_num, nft.s)
            set.u = NFT.move(json.uid, nft[0].t.split('_')[0], set.u)
            delete nft.t
            ops.push({type:'put', path:['nfts', nft[0].t.split('_')[0],`${json.set}:${json.uid}`], data: nft})
            ops.push({type:'put', path:['sets', json.set], data: set})
            ops.push({type:'del', path:['nfts', 't', `${json.set}:${json.uid}`]})
            // is there anything in the NFT that needs to be modified? owner, renter, 
            let msg = `@${from} canceled NFT: ${json.set}:${json.uid} transfer`
            if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
            ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg });
            store.batch(ops, pc)
        } else {
            if (config.hookurl) postToDiscord(`Can't find NFT: ${json.set}:${json.uid} in pending transfers`)
            pc[0](pc[2])
        }
    })
    .catch(e => { console.log(e); });
}
/*
json:{
    set: 'dlux',
    uid: 'AA'
}
*/
exports.nft_delete  = function(json, from, active, pc) {
    let fnftp = getPathObj(['nfts', from, `${json.set}:${json.uid}`]),
        setp = getPathObj(['sets', json.set]); //to balance promise
    Promise.all([fnftp, setp])
    .then(nfts => {
        if(nfts[0].s && !nfts[0].l && active) {
            let ops = [],
                //nft = nfts[0],
                set = nfts[1]
            set.u = NFT.delete(json.uid, set.u)
            if(set.d)set.d++
            else set.d = 1
            add(from, set.b)
            ops.push({type:'put', path:['sets', json.set], data: set})
            ops.push({type:'del', path:['nfts', from, `${json.set}:${json.uid}`]})
            // is there anything in the NFT that needs to be modified? owner, renter, 
            let msg = `@${from} deleted NFT: ${json.set}:${json.uid}, recieved ${parseFloat(set.b/1000).toFixed(3)} ${config.TOKEN}`
            if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
            ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg });
            store.batch(ops, pc)
        } else {
            if (config.hookurl) postToDiscord(`Can't find NFT: ${json.set}:${json.uid} in pending transfers`)
            pc[0](pc[2])
        }
    })
    .catch(e => { console.log(e); });
}
/*
json:nft_define: {
"name":"dlux",
"type": 1,
"script": "QmPsxgySUZibuojuUWCMQJpT2uZhijY4Cf7tuJKR8gpZqq",
"permlink": "disregardfiat/nft-announcement",
"start": "00",
"end": "==",
"royalty": 100,
"handling": "svg",
"max_fee": 10000000,
"bond": 1000, //A burn value that can be preloaded into the contract
}
*/
exports.nft_define = function(json, from, active, pc) {
    if (active && from == 'disregardfiat'){
        switch (json.type){
            case 1:
                let statsp = getPathObj(['stats']),
                    balp = getPathNum(['balances', from]),
                    setp = getPathObj(['sets', json.name])
                Promise.all([statsp, balp, setp])
                    .then(mem => {
                        if(Object.keys(mem[2]).length || json.name === 'Qm'){ //set exists?
                            console.log('set exists')
                            pc[0](pc[2])
                        } else {
                            byte_count = 39 // average account bytes x2 plus formatting
                            const name_counter = json.name.split('')
                            byte_count += name_counter.length
                            const start_num = Base64.toNumber(json.start)
                            const end_num = Base64.toNumber(json.end)
                            const total_num = end_num - start_num + 1
                            const id_counter = json.end.split('')
                            byte_count += id_counter.length * 2
                            if(total_num){ //checks for error in set size
                                const byte_cost = mem[0].nft_byte_cost
                                var bond = json.bond || 0
                                if(typeof bond !== 'number') bond = 0
                                const fee = (byte_cost * byte_count * total_num) + mem[0].nft_fee_1 + (total_num * bond)
                                if(json.max_fee >= fee && mem[1] >= fee){
                                    let set = { //5 plus set name bytes
                                        "a":from, //the account that pays the set fee, --23 bytes
                                        "s":json.script, //build app hash --53bytes
                                        "i":"0", //issued counter for IDs -6bytes
                                        "m":Base64.fromNumber(end_num), //max issue -6-10bytes
                                        "o":Base64.fromNumber(start_num), //start id -10-16bytes
                                        "n":json.name, 
                                        "r":json.royalty || 0, 
                                        "t":1, // type
                                        "e":json.handling, //encoding
                                        "p":json.permlink, //link
                                        "b":bond, //burn value
                                        "f":fee - (total_num * bond) //fee
                                    }
                                    const ops = []
                                    ops.push({type:'put', path:['balances', from], data: mem[1] - fee})
                                    ops.push({type:'put', path:['sets', json.name], data: set})
                                    ops.push({type:'put', path:['rnfts', json.name, from], data: total_num})
                                    let msg = `@${from} defined ${json.name} NFT set. ${parseFloat(fee/1000).toFixed(3)} ${config.TOKEN} paid`
                                    if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                                    ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg });
                                    store.batch(ops, pc)
                                } else {
                                    console.log('fee exceeded')
                                    pc[0](pc[2])
                                }
                            } else {
                                console.log('set size 0')
                                pc[0](pc[2])
                            }
                        }
                    })
                    .catch(e => { console.log(e); });
                break;
            default:
                pc[0](pc[2])
        }
    }

}

/*
json:{
    set: "dlux"
}
*/
exports.nft_mint = function(json, from, active, pc) {
    let rnftp = getPathNum(['rnfts', json.set, from])
    Promise.all([rnftp])
        .then(nfts => {
            if(nfts[0] > 0 && active) {
                chronAssign(json.block_num + 1, {op:"mint", set:json.set, for: from})
                let ops = []
                ops.push({type:'put', path:['rnfts', json.set, from], data: nfts[0] - 1})
                let msg = `@${from} Redeemed a ${json.set} Mint Token`
                if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg });
                store.batch(ops, pc)
            } else {
                pc[0](pc[2])
            }
        })
        .catch(e => { console.log(e); });
}
/*
json:{
    set: 'dlux',
    uid: 'AA',
    price: 1000,
    now: 10000, //not implemented
    time: 7 //integer days
}
*/
exports.nft_auction = function(json, from, active, pc) {
    let fnftp = getPathObj(['nfts', from, `${json.set}:${json.uid}`]), //zoom in?
        ahp = getPathObj(['ah']), //needed?
        setp = getPathObj(['sets', json.set])
        if(json.set == `Qm`) setp = getPathObj(['sets', `Qm${json.uid}`])
    Promise.all([fnftp, ahp, setp])
        .then(mem => {
            if (mem[0].s && !mem[0].l && active){
                var ah = mem[1], nft = mem[0], set = mem[2]
                var p = json.price || 1000,
                    n = json.now || '',
                    t = json.time || 7
                    if(typeof t != "number" || t > 30 || t < 1 )t = 7
                    if(typeof p != "number" || p < 1)p = 1000
                    if(typeof n != "number" || n <= p) n = ''
                const e = json.block_num + (t * 1200 * 24),
                    ep = chronAssign(e, {op:"ahe", item:`${json.set}:${json.uid}`, block: e}) //auction house expire vop
                ep.then(exp => {
                    var listing = {
                            p, //starting price
                            n, //buy it now price
                            t, //time in days
                            e, //expires
                            i:`${json.set}:${json.uid}`, //can this be a name?
                            q: exp, //expire path / vop
                            o: from,
                            c: 0
                        }
                    if(json.uid.split(':')[0] != 'Qm') set.u = NFT.move(json.uid, 'ah', set.u)//update set
                    else set.u = 'ah'
                    var last_modified = nft.s.split(',')[0], ops = []  //last modified is the first item in the string
                    nft.s.replace(last_modified, Base64.fromNumber(json.block_num)) //update the modified block
                    listing.nft = nft //place the nft in the listing
                    ah[`${json.set}:${json.uid}`] = listing //place the listing in the AH
                    ops.push({type:'put', path:['ah'], data: ah})
                    ops.push({type:'del', path:['nfts', from, `${json.set}:${json.uid}`]})
                    if (json.set == 'Qm') ops.push({type:'put', path:['sets', `Qm${json.uid}`], data: set})
                    else ops.push({type:'put', path:['sets', json.set], data: set})
                    let msg = `@${from} Listed ${json.set}:${json.uid} for auction`
                    if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                    ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg });
                    store.batch(ops, pc)
                })
            } else if (!active){
                let msg = `@${from} tried to auction with out signing ACTIVE`
                if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                pc[0](pc[2])
            } else {
                let msg = `@${from} doesn't own ${json.set}:${json.uid}`
                if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                pc[0](pc[2])
            }
        })
        .catch(e => { console.log(e); });
}
/*
json:{
    set: 'dlux',
    uid: 'AA',
    bid: 1000
}
*/
exports.nft_bid = function(json, from, active, pc) {
    let balp = getPathNum(['balances', from]),
        ahp = getPathObj(['ah', `${json.set}:${json.uid}`])
    Promise.all([balp, ahp])
        .then(mem => {
            if(active && mem[1].e && mem[0] >= json.bid_amount){ //check for item and liquid sufficient for bid
                var listing = mem[1],
                    bal = mem[0]
                if(listing.b){
                    if (json.bid_amount > listing.b){
                        add(listing.f, listing.b) //return the previous high bidders tokens
                        .then(empty => {
                            if(from == listing.f)bal = bal + listing.b
                            listing.f = from
                            listing.b = json.bid_amount
                            listing.c++
                            bal = bal - json.bid_amount
                            var ops = []
                            ops.push({type:'put', path:['ah', `${json.set}:${json.uid}`], data: listing})
                            ops.push({type:'put', path:['balances', from], data: bal})
                            let msg = `@${from} bid ${parseFloat(json.bid_amount/1000).toFixed(3)} ${config.TOKEN} on ${json.set}:${json.uid}'s auction`
                            if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                            ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg });
                            store.batch(ops, pc)
                        })
                    } else {
                        let msg = `@${from} hasn't outbid on ${json.set}:${json.uid}`
                        if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                        pc[0](pc[2])
                    }
                } else if (json.bid_amount >= listing.p){
                    listing.f = from
                    listing.b = json.bid_amount
                    listing.c = 1
                    bal = bal - json.bid_amount
                    var ops = []
                    ops.push({type:'put', path:['ah', `${json.set}:${json.uid}`], data: listing})
                    ops.push({type:'put', path:['balances', from], data: bal})
                    let msg = `@${from} bid ${parseFloat(json.bid_amount/1000).toFixed(3)} ${config.TOKEN} on ${json.set}:${json.uid}'s auction`
                    if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                    ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg });
                    store.batch(ops, pc)
                } else {
                    var ops = []
                    let msg = `@${from} hasn't outbid on ${json.set}:${json.uid}`
                    if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                    ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg });
                    store.batch(ops, pc)
                }
            } else {
                let msg = `@${from}'s bid on ${json.set}:${json.uid} didn't go well`
                if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                pc[0](pc[2])
            }
        })
    .catch(e => { console.log(e); });
}

exports.nft_sell = function(json, from, active, pc) {
    let fnftp = getPathObj(['nfts', from, `${json.set}:${json.uid}`]),
        ahp = getPathObj(['ls']),
        setp = getPathObj(['sets', json.set])
        if(json.set == `Qm`) setp = getPathObj(['sets', `Qm${json.uid}`])
    Promise.all([fnftp, ahp, setp])
    .then(mem => {
        if (mem[0].s && !mem[0].l && active){
                var ls = mem[1], nft = mem[0], set = mem[2]
                var p = json.price || 1000
                    var listing = {
                            p, //starting price
                            i:`${json.set}:${json.uid}`,
                            o: from
                        }
                    if(json.uid.split(':')[0] != 'Qm') set.u = NFT.move(json.uid, 'ls', set.u)//update set
                    else set.u = 'ls'
                    var last_modified = nft.s.split(',')[0], ops = []  //last modified is the first item in the string
                    nft.s.replace(last_modified, Base64.fromNumber(json.block_num)) //update the modified block
                    listing.nft = nft //place the nft in the listing
                    ls[`${json.set}:${json.uid}`] = listing //place the listing in the AH
                    ops.push({type:'put', path:['ls'], data: ls})
                    ops.push({type:'del', path:['nfts', from, `${json.set}:${json.uid}`]})
                    if (json.set == 'Qm') ops.push({type:'put', path:['sets', `Qm${json.uid}`], data: set})
                    else ops.push({type:'put', path:['sets', json.set], data: set})
                    let msg = `@${from} Listed ${json.set}:${json.uid} for sale`
                    if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                    ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg });
                    store.batch(ops, pc)
            } else if (!active){
                let msg = `@${from} tried to sell with out signing ACTIVE`
                if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                pc[0](pc[2])
            } else {
                let msg = `@${from} doesn't own ${json.set}:${json.uid}`
                if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                pc[0](pc[2])
            }
    })
    .catch(e => { console.log(e); });
}

exports.nft_buy = function(json, from, active, pc) {
    let fbalp = getPathNum(['balances', from]),
        lsp = getPathObj(['ls', `${json.set}:${json.uid}`]), //needed?
        setp = getPathObj(['sets', json.set])
        if(json.set == `Qm`) setp = getPathObj(['sets', `Qm${json.uid}`])
    Promise.all([fbalp, lsp, setp])
    .then(mem => {
        if(mem[1].p <= mem[0] && active){
            let nft = mem[1].nft, set = mem[2], listing = mem[1]
            var last_modified = nft.s.split(',')[0], ops = []  //last modified is the first item in the string
            nft.s.replace(last_modified, Base64.fromNumber(json.block_num)) //update the modified block
            if(json.uid.split(':')[0] != 'Qm') set.u = NFT.move(json.uid, from, set.u)//update set
            else set.u = from
            let per = set.r || 0
            let royalty = parseInt((per / 10000)* listing.p)
            add(set.a, royalty)
            .then(empty =>{
                add(listing.o, listing.p - royalty)
                ops.push({type:'put', path:['balances', from], data: mem[0] - listing.p})
                ops.push({type:'put', path:['nfts', from, `${json.set}:${json.uid}`], data: nft})
                ops.push({type:'del', path:['ls', `${json.set}:${json.uid}`]})
                if (json.set == 'Qm') ops.push({type:'put', path:['sets', `Qm${json.uid}`], data: set})
                else ops.push({type:'put', path:['sets', json.set], data: set})
                let msg = `@${from} bought ${json.set}:${json.uid}`
                if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg });
                store.batch(ops, pc)
            })
        } else {
            let msg = `@${from} can't afford to buy: ${json.set}:${json.uid}, or signed with posting key`
            if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
            pc[0](pc[2])
        }
    })
    .catch(e => { console.log(e); });
}

exports.nft_sell_cancel = function(json, from, active, pc) {
    let lsp = getPathObj(['ls', `${json.set}:${json.uid}`]), //needed?
        setp = getPathObj(['sets', json.set])
        if(json.set == `Qm`) setp = getPathObj(['sets', `Qm${json.uid}`])
    Promise.all([lsp, setp])
    .then(mem => {
        if(active && from == mem[0].o){
            let nft = mem[0].nft, set = mem[1], listing = mem[0]
            var last_modified = nft.s.split(',')[0], ops = []  //last modified is the first item in the string
            nft.s.replace(last_modified, Base64.fromNumber(json.block_num)) //update the modified block
            if(json.uid.split(':')[0] != 'Qm') set.u = NFT.move(json.uid, from, set.u)//update set
            else set.u = from
            ops.push({type:'put', path:['nfts', from, `${json.set}:${json.uid}`], data: nft})
            ops.push({type:'del', path:['ls', `${json.set}:${json.uid}`]})
            if (json.set == 'Qm') ops.push({type:'put', path:['sets', `Qm${json.uid}`], data: set})
            else ops.push({type:'put', path:['sets', json.set], data: set})
            let msg = `@${from} canceled sell of ${json.set}:${json.uid}`
            if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
            ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg });
            store.batch(ops, pc)
        } else {
            let msg = `@${from} can't cancel: ${json.set}:${json.uid} with posting key`
            if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
            pc[0](pc[2])
        }
    })
    .catch(e => { console.log(e); });
}

/*
json:{
    set: 'dlux',
    to: 'somebody'
}
*/
exports.ft_transfer = function(json, from, active, pc) {
    let fnftp = getPathNum(['rnfts', json.set, from]),
        tnftp = getPathNum(['rnfts', json.set, json.to])
    Promise.all([fnftp, tnftp])
    .then(mem => {
        let mts = mem[0]
        if (mts > 0 && active){
            let ops = []
            ops.push({type:'put', path:['rnfts', json.set, json.to], data: mem[1] + 1})
            ops.push({type:'put', path:['rnfts', json.set, from], data: mts - 1})
            let msg = `@${from} transfered 1 ${json.set} mint token to ${json.to}`
            if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
            ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg });
            store.batch(ops, pc)

        } else {
            let msg = `@${from} doesn't own ${json.set}`
            if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
            pc[0](pc[2])
        }
    })
    .catch(e => { console.log(e); });
}
/*
json:{
    set: 'dlux',
    to: ['somebody','someother']
}
*/
exports.ft_airdrop = function(json, from, active, pc) {
    let promises = [getPathNum(['rnfts', json.set, from])]
    var toArray = [...new Set(json.to)]    
    for (var i = 0; i < toArray.length; i++){
            promises.push(getPathNum(['rnfts', json.set, toArray[i]]))
        }
    Promise.all(promises)
    .then(mem => {
        let mts = mem[0]
        if (mts >= toArray.length && active){
            let ops = []
            let string = ``
            for (var i = 1; i <= toArray.length; i++){
                ops.push({type:'put', path:['rnfts', json.set, toArray[i-1]], data: mem[i] + 1})
                string += `@${toArray[i-1]}, `
            }
            ops.push({type:'put', path:['rnfts', json.set, from], data: mts - toArray.length})
            let msg = `@${from} transfered ${toArray.length} ${json.set} mint tokens to ${string}`
            if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
            ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg });
            store.batch(ops, pc)

        } else {
            let msg = `@${from} doesn't own ${json.set}`
            if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
            pc[0](pc[2])
        }
    })
    .catch(e => { console.log(e); });
}

exports.ft_escrow = function(json, from, active, pc) {
    let rnftp = getPathNum(['rnfts', json.set, from])
    Promise.all([rnftp])
    .then(mem => {
        
    })
    .catch(e => { console.log(e); });
}

exports.ft_escrow_complete = function(json, from, active, pc) {
    let rnftp = getPathNum(['rnfts', json.set, from])
    Promise.all([rnftp])
    .then(mem => {
        
    })
    .catch(e => { console.log(e); });
}

exports.ft_escrow_cancel = function(json, from, active, pc) {
    let rnftp = getPathNum(['rnfts', json.set, from])
    Promise.all([rnftp])
    .then(mem => {
        
    })
    .catch(e => { console.log(e); });
}

exports.ft_sell = function(json, from, active, pc) {
    let fnftp = getPathObj(['rnfts', json.set, from]),
        ltp = getPathObj(['lt'])
    Promise.all([fnftp, ltp])
    .then(mem => {
        if (mem[0] && active){
                var ls = mem[1], nft = mem[0], hash = hashThis(`${from}:${json.set}:${json.block_num}`)
                var p = json.price || 1000
                    var listing = {
                            p, //starting price
                            i:`${json.set}:${hash}`,
                            o: from
                        }
                    ls[`${json.set}:${hash}`] = listing //place the listing in the AH
                    ops.push({type:'put', path:['lt'], data: ls})
                    ops.push({type:'put', path:['rnfts', json.set, from], data: nft - 1})
                    let msg = `@${from} Listed ${json.set} mint token for sale`
                    if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                    ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg });
                    store.batch(ops, pc)
            } else if (!active){
                let msg = `@${from} tried to sell with out signing ACTIVE`
                if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                pc[0](pc[2])
            } else {
                let msg = `@${from} doesn't own a ${json.set} mint token`
                if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                pc[0](pc[2])
            }
    })
    .catch(e => { console.log(e); });
}

exports.ft_buy = function(json, from, active, pc) {
    let fbalp = getPathNum(['balances', from]),
        lsp = getPathObj(['lt', `${json.set}:${json.uid}`]), //needed?
        setp = getPathObj(['sets', json.set])
    Promise.all([fbalp, lsp, setp])
    .then(mem => {
        if(mem[1].p <= mem[0] && active){
            let set = mem[2], listing = mem[1],
                per = set.r || 0
            let royalty = parseInt((per / 10000)* listing.p)
            add(set.a, royalty)
            .then(empty =>{
                add(listing.o, listing.p - royalty)
                addMT(['rnfts', json.set, from], 1)
                ops.push({type:'put', path:['balances', from], data: mem[0] - listing.p})
                ops.push({type:'del', path:['ls', `${json.set}:${json.uid}`]})
                let msg = `@${from} bought ${json.set}:${json.uid} mint token`
                if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg });
                store.batch(ops, pc)
            })
        } else {
            let msg = `@${from} can't afford to buy: ${json.set}:${json.uid}, or signed with posting key`
            if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
            pc[0](pc[2])
        }
    })
    .catch(e => { console.log(e); });
}

exports.ft_sell_cancel = function(json, from, active, pc) {
    let lsp = getPathObj(['lt', `${json.set}:${json.uid}`])
    Promise.all([lsp])
    .then(mem => {
        if(active && from == mem[0].o){
            addMT(['rnfts', json.set, from], 1)
            ops.push({type:'del', path:['ls', `${json.set}:${json.uid}`]})
            let msg = `@${from} canceled sell of ${json.set}:${json.uid}`
            if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
            ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg });
            store.batch(ops, pc)
        } else {
            let msg = `@${from} can't cancel: ${json.set}:${json.uid} with posting key`
            if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
            pc[0](pc[2])
        }
    })
    .catch(e => { console.log(e); });
}

exports.ft_auction = function(json, from, active, pc) {
        let fnftp = getPathNum(['rnfts', from, `${json.set}`]), //zoom in?
        ahp = getPathObj(['am'])
    Promise.all([fnftp, ahp])
        .then(mem => {
            if (mem[0] && active){
                var ah = mem[1], nft = mem[0], hash = hashThis(`${from}:${json.set}:${json.block_num}`)
                var p = json.price || 1000,
                    n = json.now || '',
                    t = json.time || 7
                    if(typeof t != "number" || t > 30 || t < 1 )t = 7
                    if(typeof p != "number" || p < 1)p = 1000
                    if(typeof n != "number" || n <= p) n = ''
                const e = json.block_num + (t * 1200 * 24),
                    ep = chronAssign(e, {op:"ame", item:`${json.set}:${hash}`, block: e}) //auction house expire vop
                ep.then(exp => {
                    var listing = {
                            p, //starting price
                            n, //buy it now price
                            t, //time in days
                            e, //expires
                            i:`${json.set}:${hash}`, //can this be a name?
                            q: exp, //expire path / vop
                            o: from,
                            c: 0
                        }
                    ah[`${json.set}:${hash}`] = listing //place the listing in the AH
                    ops.push({type:'put', path:['am'], data: ah})
                    ops.push({type:'put', path:['rnfts', json.set, from], data: nft -1})
                    let msg = `@${from} Listed a ${json.set} mint token for auction`
                    if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                    ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg });
                    store.batch(ops, pc)
                })
            } else if (!active){
                let msg = `@${from} tried to auction with out signing ACTIVE`
                if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                pc[0](pc[2])
            } else {
                let msg = `@${from} doesn't own a ${json.set} mint token`
                if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                pc[0](pc[2])
            }
        })
        .catch(e => { console.log(e); });
}

exports.ft_bid = function(json, from, active, pc) {
    let balp = getPathNum(['balances', from]),
        ahp = getPathObj(['am', `${json.set}:${json.uid}`])
    Promise.all([balp, ahp])
        .then(mem => {
            if(active && mem[1].e && mem[0] >= json.bid_amount){ //check for item and liquid sufficient for bid
                var listing = mem[1],
                    bal = mem[0]
                if(listing.b){
                    if (json.bid_amount > listing.b){
                        add(listing.f, listing.b) //return the previous high bidders tokens
                        .then(empty => {
                            if(from == listing.f)bal = bal + listing.b
                            listing.f = from
                            listing.b = json.bid_amount
                            listing.c++
                            bal = bal - json.bid_amount
                            var ops = []
                            ops.push({type:'put', path:['am', `${json.set}:${json.uid}`], data: listing})
                            ops.push({type:'put', path:['balances', from], data: bal})
                            let msg = `@${from} bid ${parseFloat(json.bid_amount/1000).toFixed(3)} ${config.TOKEN} on ${json.set}:${json.uid}'s mint token auction`
                            if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                            ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg });
                            store.batch(ops, pc)
                        })
                    } else {
                        let msg = `@${from} hasn't outbid on ${json.set}:${json.uid}`
                        if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                        pc[0](pc[2])
                    }
                } else {
                    listing.f = from
                    listing.b = json.bid_amount
                    listing.c = 1
                    bal = bal - json.bid_amount
                    var ops = []
                    ops.push({type:'put', path:['am', `${json.set}:${json.uid}`], data: listing})
                    ops.push({type:'put', path:['balances', from], data: bal})
                    let msg = `@${from} bid ${parseFloat(json.bid_amount/1000).toFixed(3)} ${config.TOKEN} on ${json.set}:${json.uid}'s mint token auction`
                    if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                    ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg });
                    store.batch(ops, pc)
                }
            } else {
                let msg = `@${from}'s bid on ${json.set}:${json.uid} didn't go well`
                if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                pc[0](pc[2])
            }
        })
    .catch(e => { console.log(e); });
}
