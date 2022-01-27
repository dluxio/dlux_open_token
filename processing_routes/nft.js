const config = require('./../config')
const { store, unshiftOp } = require('./../index')
const { chronAssign, add, hashThis, addMT } = require('./../lil_ops')
const { getPathObj, getPathNum } = require('../getPathObj')
const { postToDiscord } = require('./../discord')
const { Base64, primes, NFT, distro } = require('./../helpers')
const stringify = require('json-stable-stringify');
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
        if(nfts[0].s !== undefined && !nfts[0].l && active && json.to != from) {
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
            let type = 'TOKEN'
            if(json?.type.toUpperCase() == 'HIVE')type = 'HIVE'
            else if(json?.type.toUpperCase() == 'HBD')type = 'HBD'
            nft.t = `${from}_${json.to}_${json.price}_${type}`
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
        var to, price, type
        try{ to = nfts[0].t.split('_')[1];price = parseInt(nfts[0].t.split('_')[2]), type = nfts[0].t.split('_')[3]} catch (e){console.log(nfts[0])}
        if(nfts[0].s !== undefined && to == from && active && nfts[2] >= price && type == 'TOKEN') {
            let ops = [],
                nft = nfts[0],
                set = nfts[1]
            nft.s = NFT.last(json.block_num, nft.s)
            set.u = NFT.move(json.uid, from, set.u)
            let promises = distro(from, to, price, set.r, set.a, set.ra, json.set)
            delete nft.t
            ops.push({type:'put', path:['nfts', from,`${json.set}:${json.uid}`], data: nft})
            ops.push({type:'put', path:['sets', json.set], data: set})
            ops.push({type:'del', path:['nfts', 't', `${json.set}:${json.uid}`]})
            // is there anything in the NFT that needs to be modified? owner, renter, 
            let msg = `@${from} completed NFT: ${json.set}:${json.uid} transfer`
            if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
            ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg });
            Promise.all(promises).then(empty => {store.batch(ops, pc) })
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
        var to, by
        try{to=nfts[0].t.split('_')[1];by=nfts[0].t.split('_')[0]}catch(e){}
        if(nfts[0].s && (to == from || by == from) && active) {
            let ops = [],
                nft = nfts[0],
                set = nfts[1]
            nft.s = NFT.last(json.block_num, nft.s)
            set.u = NFT.move(json.uid, by, set.u)
            delete nft.t
            ops.push({type:'put', path:['nfts', by,`${json.set}:${json.uid}`], data: nft})
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
"total": 4096,
"royalty": 100,
"handling": "svg",
"max_fee": 10000000,
"bond": 1000, //A burn value that can be preloaded into the contract
}

{
"name":"PM",
"type": 3,
"script": "QmPsxgySUZibuojuUWCMQJpT2uZhijY4Cf7tuJKR8gpZqq",
"permlink": "disregardfiat/nft-announcement",
"weight": 6,
"total": 10,
"outs": [account", "array"],
"handling": "html",
"max_fee": 10000000,
"open_block": 0, 
"close_block": 0,
"bond": 1000, //Endowment
"pool": 1000, 
}
*/
exports.nft_define = function(json, from, active, pc) {
if (active){
    let statsp = getPathObj(['stats']),
        balp = getPathObj(['balances']),
        setp = getPathObj(['sets', json.name])
    Promise.all([statsp, balp, setp])
    .then(mem => {
        switch (json.type){
            case 4: // executable and additional option
                if(Object.keys(mem[2]).length || json.name === 'Qm'){ //set exists?
                    console.log('set exists')
                    pc[0](pc[2])
                } else if(typeof json.exe_size == 'number' && typeof json.opt_size == 'number'){
                    console.log('Bad Json Options')
                    pc[0](pc[2])
                } else {
                    byte_count = 39 // average account bytes x2 plus formatting
                    const name_counter = json.name.split('')
                    byte_count += name_counter.length
                    byte_count += json.exe_size + 1
                    byte_count += json.opt_size + 1
                    const start_num = Base64.toNumber(json.start)
                    const end_num = Base64.toNumber(json.end)
                    var total_num = parseInt(json.total) || (end_num - start_num + 1)
                    if (json.total && json.total > (end_num - start_num + 1)){total_num = (end_num - start_num + 1)}
                    const id_counter = json.end.split('')
                    byte_count += id_counter.length * 2
                    if(total_num){ //checks for error in set size
                        const byte_cost = mem[0].nft_byte_cost
                        var bond = parseInt(json.bond) || 0
                        if(typeof bond !== 'number') bond = 0
                        const fee = (byte_cost * byte_count * total_num) + mem[0].nft_fee_1 + (total_num * bond)
                        if(json.max_fee >= fee && mem[1][from] >= fee){
                            let set = { //5 plus set name bytes
                                "a":from, //the account that pays the set fee, --23 bytes
                                "s":json.script, //build app hash --53bytes
                                "i":"0", //issued counter for IDs -6bytes
                                "m":Base64.fromNumber(end_num), //max issue -6-10bytes
                                "o":Base64.fromNumber(start_num), //start id -10-16bytes
                                "n":json.name,
                                "nl":json.long_name || json.name,
                                "r":json.royalty || 0, 
                                "t":4, // type
                                "x":json.exe_size, //executable size
                                "y":json.opt_size, //option size
                                "e":json.handling, //encoding
                                "p":json.permlink, //link
                                "b":bond, //burn value
                                "f":fee - (total_num * bond) //fee
                            }
                            const ops = []
                            ops.push({type:'put', path:['balances', from], data: mem[1][from] - fee})
                            ops.push({type:'put', path:['sets', json.name], data: set})
                            ops.push({type:'put', path:['rnfts', json.name, from], data: total_num})
                            let msg = `@${from} defined ${json.name} NFT set. ${parseFloat(fee/1000).toFixed(3)} ${config.TOKEN} paid`
                            if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                            ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg });
                            store.batch(ops, pc)
                        } else {
                            console.log({byte_cost, byte_count, total_num, fee})
                            let msg = `Cost ${parseFloat(fee/1000).toFixed(3)}. Exceeded Max Fee of(${parseFloat(json.max_fee/1000).toFixed(3)})`
                            if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                            pc[0](pc[2])
                        }
                    } else {
                        console.log('set size 0')
                        pc[0](pc[2])
                    }
                }
                break;
            case 3: //additional option
                if(Object.keys(mem[2]).length || json.name === 'Qm'){ //set exists?
                    console.log('set exists')
                    pc[0](pc[2])
                } else if(typeof json.opt_size == 'number'){
                    console.log('Bad Json Options')
                    pc[0](pc[2])
                } else {
                    byte_count = 39 // average account bytes x2 plus formatting
                    const name_counter = json.name.split('')
                    byte_count += name_counter.length
                    byte_count += json.opt_size + 1
                    const start_num = Base64.toNumber(json.start)
                    const end_num = Base64.toNumber(json.end)
                    var total_num = parseInt(json.total) || (end_num - start_num + 1)
                    if (json.total && json.total > (end_num - start_num + 1)){total_num = (end_num - start_num + 1)}
                    const id_counter = json.end.split('')
                    byte_count += id_counter.length * 2
                    if(total_num){ //checks for error in set size
                        const byte_cost = mem[0].nft_byte_cost
                        var bond = parseInt(json.bond) || 0
                        if(typeof bond !== 'number') bond = 0
                        const fee = (byte_cost * byte_count * total_num) + mem[0].nft_fee_1 + (total_num * bond)
                        if(json.max_fee >= fee && mem[1][from] >= fee){
                            let set = { //5 plus set name bytes
                                "a":from, //the account that pays the set fee, --23 bytes
                                "s":json.script, //build app hash --53bytes
                                "i":"0", //issued counter for IDs -6bytes
                                "m":Base64.fromNumber(end_num), //max issue -6-10bytes
                                "o":Base64.fromNumber(start_num), //start id -10-16bytes
                                "n":json.name,
                                "nl":json.long_name || json.name,
                                "r":json.royalty || 0, 
                                "t":3, // type
                                "e":json.handling, //encoding
                                "y":json.opt_size, //option size
                                "p":json.permlink, //link
                                "b":bond, //burn value
                                "f":fee - (total_num * bond) //fee
                            }
                            const ops = []
                            ops.push({type:'put', path:['balances', from], data: mem[1][from] - fee})
                            ops.push({type:'put', path:['sets', json.name], data: set})
                            ops.push({type:'put', path:['rnfts', json.name, from], data: total_num})
                            let msg = `@${from} defined ${json.name} NFT set. ${parseFloat(fee/1000).toFixed(3)} ${config.TOKEN} paid`
                            if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                            ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg });
                            store.batch(ops, pc)
                        } else {
                            console.log({byte_cost, byte_count, total_num, fee})
                            let msg = `Cost ${parseFloat(fee/1000).toFixed(3)}. Exceeded Max Fee of(${parseFloat(json.max_fee/1000).toFixed(3)})`
                            if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                            pc[0](pc[2])
                        }
                    } else {
                        console.log('set size 0')
                        pc[0](pc[2])
                    }
                }
                break;
            case 2: //executable option
                if(Object.keys(mem[2]).length || json.name === 'Qm'){ //set exists?
                    console.log('set exists')
                    pc[0](pc[2])
                } else if(typeof json.exe_size == 'number'){
                    console.log('Bad Json Options')
                    pc[0](pc[2])
                } else {
                    byte_count = 39 // average account bytes x2 plus formatting
                    const name_counter = json.name.split('')
                    byte_count += name_counter.length
                    byte_count += json.exe_size + 1
                    const start_num = Base64.toNumber(json.start)
                    const end_num = Base64.toNumber(json.end)
                    var total_num = parseInt(json.total) || (end_num - start_num + 1)
                    if (json.total && json.total > (end_num - start_num + 1)){total_num = (end_num - start_num + 1)}
                    const id_counter = json.end.split('')
                    byte_count += id_counter.length * 2
                    if(total_num){ //checks for error in set size
                        const byte_cost = mem[0].nft_byte_cost
                        var bond = parseInt(json.bond) || 0
                        if(typeof bond !== 'number') bond = 0
                        const fee = (byte_cost * byte_count * total_num) + mem[0].nft_fee_1 + (total_num * bond)
                        if(json.max_fee >= fee && mem[1][from] >= fee){
                            let set = { //5 plus set name bytes
                                "a":from, //the account that pays the set fee, --23 bytes
                                "s":json.script, //build app hash --53bytes
                                "i":"0", //issued counter for IDs -6bytes
                                "m":Base64.fromNumber(end_num), //max issue -6-10bytes
                                "o":Base64.fromNumber(start_num), //start id -10-16bytes
                                "n":json.name,
                                "nl":json.long_name || json.name,
                                "r":json.royalty || 0, 
                                "t":2, // type
                                "e":json.handling, //encoding
                                "x":json.exe_size, //executable size
                                "p":json.permlink, //link
                                "b":bond, //burn value
                                "f":fee - (total_num * bond) //fee
                            }
                            const ops = []
                            ops.push({type:'put', path:['balances', from], data: mem[1][from] - fee})
                            ops.push({type:'put', path:['sets', json.name], data: set})
                            ops.push({type:'put', path:['rnfts', json.name, from], data: total_num})
                            let msg = `@${from} defined ${json.name} NFT set. ${parseFloat(fee/1000).toFixed(3)} ${config.TOKEN} paid`
                            if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                            ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg });
                            store.batch(ops, pc)
                        } else {
                            console.log({byte_cost, byte_count, total_num, fee})
                            let msg = `Cost ${parseFloat(fee/1000).toFixed(3)}. Exceeded Max Fee of(${parseFloat(json.max_fee/1000).toFixed(3)})`
                            if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                            pc[0](pc[2])
                        }
                    } else {
                        console.log('set size 0')
                        pc[0](pc[2])
                    }
                }
                break;    
            case 1:
                if(Object.keys(mem[2]).length || json.name === 'Qm'){ //set exists?
                    console.log('set exists')
                    pc[0](pc[2])
                } else {
                    byte_count = 39 // average account bytes x2 plus formatting
                    const name_counter = json.name.split('')
                    byte_count += name_counter.length
                    const start_num = Base64.toNumber(json.start)
                    const end_num = Base64.toNumber(json.end)
                    var total_num = parseInt(json.total) || (end_num - start_num + 1)
                    if (json.total && json.total > (end_num - start_num + 1)){total_num = (end_num - start_num + 1)}
                    const id_counter = json.end.split('')
                    byte_count += id_counter.length * 2
                    if(total_num){ //checks for error in set size
                        const byte_cost = mem[0].nft_byte_cost
                        var bond = parseInt(json.bond) || 0
                        if(typeof bond !== 'number') bond = 0
                        const fee = (byte_cost * byte_count * total_num) + mem[0].nft_fee_1 + (total_num * bond)
                        if(json.max_fee >= fee && mem[1][from] >= fee){
                            let set = { //5 plus set name bytes
                                "a":from, //the account that pays the set fee, --23 bytes
                                "s":json.script, //build app hash --53bytes
                                "i":"0", //issued counter for IDs -6bytes
                                "m":Base64.fromNumber(end_num), //max issue -6-10bytes
                                "o":Base64.fromNumber(start_num), //start id -10-16bytes
                                "n":json.name,
                                "nl":json.long_name || json.name,
                                "r":json.royalty || 0, 
                                "t":1, // type
                                "e":json.handling, //encoding
                                "p":json.permlink, //link
                                "b":bond, //burn value
                                "f":fee - (total_num * bond) //fee
                            }
                            const ops = []
                            ops.push({type:'put', path:['balances', from], data: mem[1][from] - fee})
                            ops.push({type:'put', path:['sets', json.name], data: set})
                            ops.push({type:'put', path:['rnfts', json.name, from], data: total_num})
                            let msg = `@${from} defined ${json.name} NFT set. ${parseFloat(fee/1000).toFixed(3)} ${config.TOKEN} paid`
                            if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                            ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg });
                            store.batch(ops, pc)
                        } else {
                            console.log({byte_cost, byte_count, total_num, fee})
                            let msg = `Cost ${parseFloat(fee/1000).toFixed(3)}. Exceeded Max Fee of(${parseFloat(json.max_fee/1000).toFixed(3)})`
                            if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                            pc[0](pc[2])
                        }
                    } else {
                        console.log('set size 0')
                        pc[0](pc[2])
                    }
                }
                break;
            default:
                pc[0](pc[2])
        }
        })
    .catch(e => { console.log(e); });
} else {
    pc[0](pc[2])
}
}

/*
json:{
    set: "dlux"
}
*/
// only useful until first mint
exports.nft_define_delete = function(json, from, active, pc) {
let statsp = getPathObj(['stats']),
    balp = getPathNum(['balances', from]),
    setp = getPathObj(['sets', json.set])
Promise.all([statsp, balp, setp])
    .then(mem => {
    if (active){
        switch (mem[2].t){
            case 1:
                if(Object.keys(mem[2]).length && mem[2].a == from && mem[2].i === "0"){ //set exists?
                    ops.push({type:'put', path:['balances', from], data: mem[1] + mem[2].f})
                    ops.push({type:'del', path:['sets', json.set]})
                    ops.push({type:'del', path:['rnfts', json.set]})
                    let msg = `@${from} undefined ${json.set} NFT set. ${parseFloat(mem[2].f/1000).toFixed(3)} ${config.TOKEN} refunded`
                    if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                    ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg });
                    store.batch(ops, pc)
                }else {
                    console.log('set size 0')
                    pc[0](pc[2])
                }
                break;
            default:
                pc[0](pc[2])
        }
    } else {
        pc[0](pc[2])
    }
})
.catch(e => { console.log(e); });
}

exports.nft_mint = function(json, from, active, pc) {
    let rnftp = getPathNum(['rnfts', json.set, from])
    Promise.all([rnftp])
        .then(nfts => {
            if(nfts[0] > 0 && active) {
                chronAssign(json.block_num + 1, {op:"mint", set:json.set, for: from, txid: json.transaction_id})
                let ops = []
                ops.push({type:'put', path:['rnfts', json.set, from], data: nfts[0] - 1})
                let msg = `@${from} Redeemed a ${json.set} Mint Token`
                //if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
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
        setp = getPathObj(['sets', json.set]),
        divp = getPathObj(['div', json.set])
        if(json.set == `Qm`) setp = getPathObj(['sets', `Qm${json.uid}`])
    Promise.all([fnftp, ahp, setp, divp])
        .then(mem => {
            if (mem[0].s && !mem[0].l && active){
                var ah = mem[1], nft = mem[0], set = mem[2], div = mem[3]
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
                    if(div && div.p)ops.push({type:'put', path:['div', json.set, 'm', from], data: 0})
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
    price: 1000,
    type: 'HIVE', //or 'HBD'
    now: 10000, //not implemented
    time: 7 //integer days (max 7 days)
}
*/
exports.nft_hauction = function(json, from, active, pc) {
    let fnftp = getPathObj(['nfts', from, `${json.set}:${json.uid}`]), //zoom in?
        ahp = getPathObj(['ahh']), //needed?
        setp = getPathObj(['sets', json.set]),
        divp = getPathObj(['div', json.set])
        if(json.set == `Qm`) setp = getPathObj(['sets', `Qm${json.uid}`])
    Promise.all([fnftp, ahp, setp, divp])
        .then(mem => {
            if (mem[0].s && !mem[0].l && active){
                var ah = mem[1], nft = mem[0], set = mem[2], div = mem[3]
                var p = json.price || 1000,
                    n = json.now || '',
                    t = json.time || 7
                    h = json.type.toUpperCase() == 'HBD' ? 'HBD' : 'HIVE'
                    if(typeof t != "number" || t > 7 || t < 1 )t = 7
                    if(typeof p != "number" || p < 1)p = 1000
                    if(typeof n != "number" || n <= p) n = ''
                const e = json.block_num + (t * 1200 * 24),
                    ep = chronAssign(e, {op:"ahhe", item:`${json.set}:${json.uid}`, block: e}) //auction house expire vop
                ep.then(exp => {
                    var listing = {
                            p, //starting price
                            h,
                            n, //buy it now price
                            t, //time in days
                            e, //expires
                            i:`${json.set}:${json.uid}`, //can this be a name?
                            q: exp, //expire path / vop
                            o: from,
                            c: 0
                        }
                    if(json.uid.split(':')[0] != 'Qm') set.u = NFT.move(json.uid, 'hh', set.u)//update set
                    else set.u = 'hh'
                    var last_modified = nft.s.split(',')[0], ops = []  //last modified is the first item in the string
                    nft.s.replace(last_modified, Base64.fromNumber(json.block_num)) //update the modified block
                    listing.nft = nft //place the nft in the listing
                    ah[`${json.set}:${json.uid}`] = listing //place the listing in the AH
                    if(div && div.p)ops.push({type:'put', path:['div', json.set, 'm', from], data: 0})
                    ops.push({type:'put', path:['ahh'], data: ah})
                    ops.push({type:'del', path:['nfts', from, `${json.set}:${json.uid}`]})
                    if (json.set == 'Qm') ops.push({type:'put', path:['sets', `Qm${json.uid}`], data: set})
                    else ops.push({type:'put', path:['sets', json.set], data: set})
                    let msg = `@${from} Listed ${json.set}:${json.uid} for ${h} auction`
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
                    if (json.bid_amount > listing.b && from != listing.f){
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
        setp = getPathObj(['sets', json.set]),
        divp = getPathObj(['div', json.set])
        if(json.set == `Qm`) setp = getPathObj(['sets', `Qm${json.uid}`])
    Promise.all([fnftp, ahp, setp, divp])
    .then(mem => {
        if (mem[0].s && !mem[0].l && active){
                var ls = mem[1], nft = mem[0], set = mem[2], div = mem[3], h = config.TOKEN
                if(json?.type.toUpperCase() == 'HIVE')h = 'HIVE'
                else if (json?.type.toUpperCase() == 'HBD')h = 'HBD'
                var p = json.price || 1000
                    var listing = {
                            p, //starting price
                            i:`${json.set}:${json.uid}`,
                            o: from,
                            h
                        }
                    if(json.uid.split(':')[0] != 'Qm') set.u = NFT.move(json.uid, 'ls', set.u)//update set
                    else set.u = 'ls'
                    var last_modified = nft.s.split(',')[0], ops = []  //last modified is the first item in the string
                    nft.s.replace(last_modified, Base64.fromNumber(json.block_num)) //update the modified block
                    listing.nft = nft //place the nft in the listing
                    ls[`${json.set}:${json.uid}`] = listing //place the listing in the AH
                    if(div && div.p)ops.push({type:'put', path:['div', json.set, 'm', from], data: 0})
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
        let listing = mem[1]
        if(mem[1].p <= mem[0] && listing?.h != 'HIVE' && listing?.h != 'HBD' && active && from != listing.o){
            let nft = mem[1].nft, set = mem[2], listing = mem[1]
            var last_modified = nft.s.split(',')[0], ops = []  //last modified is the first item in the string
            nft.s.replace(last_modified, Base64.fromNumber(json.block_num)) //update the modified block
            if(json.uid.split(':')[0] != 'Qm') set.u = NFT.move(json.uid, from, set.u)//update set
            else set.u = from
            let promises = distro(from, listing.o, listing.p, set.r, set.a, set.ra, json.set)
            ops.push({type:'put', path:['nfts', from, `${json.set}:${json.uid}`], data: nft})
            ops.push({type:'del', path:['ls', `${json.set}:${json.uid}`]})
            if (json.set == 'Qm') ops.push({type:'put', path:['sets', `Qm${json.uid}`], data: set})
            else ops.push({type:'put', path:['sets', json.set], data: set})
            let msg = `@${from} bought ${json.set}:${json.uid}`
            if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
            ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg });
            Promise.all(promises).then(empty=>{store.batch(ops, pc)})
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
        let qty = parseInt(json.qty) || 1
        if (mts >= qty && active){
            let ops = []
            ops.push({type:'put', path:['rnfts', json.set, json.to], data: mem[1] + qty})
            ops.push({type:'put', path:['rnfts', json.set, from], data: mts - qty})
            let msg = `@${from} transfered ${qty} ${json.set} mint token to ${json.to}`
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

/*
json = {
    set: 'dlux',
    period: 28800 //time in blocks (3 seconds) => 28800 is 24 hours
}
*/

exports.nft_div = function(json, from, active, pc) {
    let promises = [getPathObj(['sets', json.set]), getPathObj(['div', json.set])]
    Promise.all(promises)
    .then(mem => {
        let set = mem[0], div = mem[1]
        if (set.a >= from && active && !div.p && json.period > 28800 && json.period < 864001){
            let ops = []
            chronAssign(num + parseInt(json.period), {set:json.set, op: 'div'})
            ops.push({ type: 'put', path: ['div', json.set], data: {p:json.period,s:json.set} });
            let msg = `@${from} established a dividend for ${json.set}`
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

exports.nft_update_exe = function(json, from, active, pc) {
    let promises = [getPathObj(['sets', json.set]), getPathObj(['nfts', from, `${json.set}:${json.uid}`])]
    Promise.all(promises)
    .then(mem => {
        let set = mem[0], 
            nft = mem[1],
            allowed = false
        if (json.exe && !json.exe.split(',')[1] && set.t == 2 && nft.s && json.exe.length <= set.x){
            nft.s = `${nft.s.split(',')[0]},${json.exe}`
            allowed = true
        } else if (json.exe && !json.exe.split(',')[1] && set.t == 4 && nft.s && json.exe.length <= set.x){
            nft.s = `${nft.s.split(',')[0]},${json.exe},${nft.s.split(',')[2]}`
            allowed = true
        }
        if (allowed && active){
            let ops = []
            ops.push({ type: 'put', path: ['nfts', from, `${json.set}:${json.uid}`], data: nft });
            let msg = `@${from} modified ${json.set}:${json.uid}`
            if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
            ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg });
            store.batch(ops, pc)
        } else {
            let msg = `@${from} can't modify ${json.set}:${json.uid}`
            if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
            pc[0](pc[2])
        }
    })
    .catch(e => { console.log(e); });
}

exports.nft_update_opt = function(json, from, active, pc) {
    let promises = [getPathObj(['sets', json.set]), getPathObj(['nfts', from, `${json.set}:${json.uid}`])]
    Promise.all(promises)
    .then(mem => {
        let set = mem[0], 
            nft = mem[1],
            allowed = false
        if (json.opt && !json.opt.split(',')[1] && set.t == 3 && nft.s && json.opt.length <= set.y){
            nft.s = `${nft.s.split(',')[0]},${json.opt}`
            allowed = true
        } else if (json.opt && !json.opt.split(',')[1] && set.t == 4 && nft.s && json.opt.length <= set.y){
            nft.s = `${nft.s.split(',')[0]},${nft.s.split(',')[1]},${json.opt}`
            allowed = true
        }
        if (allowed && active){
            let ops = []
            ops.push({ type: 'put', path: ['nfts', from, `${json.set}:${json.uid}`], data: nft });
            let msg = `@${from} modified ${json.set}:${json.uid}`
            if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
            ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg });
            store.batch(ops, pc)
        } else {
            let msg = `@${from} can't modify ${json.set}:${json.uid}`
            if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
            pc[0](pc[2])
        }
    })
    .catch(e => { console.log(e); });
}

/*
json = {
    set: 'dlux',
    distro: 'account_5000,d_5000' // splits current royalties 50% to account and 50% to dividends distrobution
}
*/

exports.nft_add_roy = function(json, from, active, pc) {
    let promises = [getPathObj(['sets', json.set]),getPathObj(['balances'])]
    Promise.all(promises)
    .then(mem => {
        let set = mem[0], bals = mem[1], failed = true, d
        if (json.distro){ //string verification
            let pairs = json.distro.split(','),
                total = 0
                failed = false
            for (let i = 0; i < pairs.length; i++){
                total += parseInt(pairs[i].split('_')[1])
                if(!bals[pairs[i].split('_')[0]] && pairs[i].split('_')[0] != 'd'){
                    failed = true
                    console.log(pairs[i], bals[pairs[i].split('_')[0]] , pairs[i].split('_')[0] != 'd')
                }
            }
            if(!failed && total === 10000){
                d = json.distro
            }
        }
        if (((set.a == from && !set.ra) || set.ra.indexOf(`${from}_` >= 0)) && active && !failed) {
            let ops = [],
            amount = 0, running = 0
            if (set.ra){
                let rs = set.ra.split(',')
                for (let i = 0; i < rs.length; i++){
                    if (rs[i].split('_')[0] == from){
                        amount = parseInt(rs[i].split('_')[1])
                        break
                    }
                }
                running = amount
                let newd = d.split(',')
                for (let i = 0; i < newd.length; i++){
                    ry = parseInt(newd[i].split('_')[1])
                    rz = (amount/10000 * ry)
                    if(i == newd.length - 1)rz = running
                    d.replace(`${newd[i].split('_')[0]}_${newd[i].split('_')[1]}`, `${newd[i].split('_')[0]}_${rz}`)
                    running -= rz
                }
                newd = d.split(',')
                newra = set.ra.split(',')
                newd.concat(newra)
                newd.sort()
                for (let i = 0; i < newd.length - 1; i++){
                    if(newd[i].split('_')[0] == newd[i+1].split('_')[0]){
                        newd[i+1] = `${newd[i].split('_')[0]}_${parseInt(newd[i+1].split('_')[1]) + parseInt(newd[i].split('_')[1])}`
                        newd.splice(i, 1)
                    }
                }
                d = newd.join(',')
            } else {
                set.ra = d
            }
            ops.push({ type: 'put', path: ['sets', json.set, 'ra'], data: set.ra });
            let msg = `@${from} changed their royalties for ${json.set}`
            if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
            ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg });
            store.batch(ops, pc)
        } else {
            let msg = `@${from} doesn't own ${json.set} royalties`
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
        var rnft = mem[0], uid = hashThis(`${from}:${json.set}:${json.block_num}`)
        if(rnft && active) {
            let ops = [],
                listing = {
                    i: `${json.set}:${uid}`,
                    t: `${from}_${json.to}_${json.price}`
                }
            ops.push({type:'put', path:['fts', 't', `${json.set}:${uid}`], data: listing})
            ops.push({type:'put', path:['rnfts', json.set, from], data: rnft - 1})
            let msg = `@${from}| Reserved Mint Token: ${json.set}:${uid} for @${json.to}`
            if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
            ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg });
            store.batch(ops, pc)
        } else {
            if (config.hookurl) postToDiscord(`@${json.to} doesn't own a ${json.set} Mint Token`)
            pc[0](pc[2])
        }
    })
    .catch(e => { console.log(e); });
}

exports.ft_escrow_complete = function(json, from, active, pc) {
    let fnftp = getPathObj(['fts', 't', `${json.set}:${json.uid}`]),
        setp = getPathObj(['sets', json.set]), //to balance promise
        balp = getPathNum(['balances', from])
    Promise.all([fnftp, setp, balp])
    .then(nfts => {
        var to, price
        try{ to = nfts[0].t.split('_')[1];price = parseInt(nfts[0].t.split('_')[2])} catch (e){console.log(nfts[0])}
        if(nfts[0].t !== undefined && to == from && active && nfts[2] >= price) {
            let ops = [],
                nft = nfts[0],
                set = nfts[1]
            let promises = distro(from, to, price, set.r, set.a, set.ra, json.set)
            addMT(['rnfts', json.set, from],1)
            ops.push({type:'del', path:['fts', 't', `${json.set}:${json.uid}`]})
            // is there anything in the NFT that needs to be modified? owner, renter, 
            let msg = `@${from} completed ${json.set} mint token transfer`
            if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
            ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg });
            Promise.all(promises).then(empty=>{store.batch(ops, pc)})
        } else {
            if (config.hookurl) postToDiscord(`Can't find Mint Token: ${json.set}:${json.uid} in pending transfers`)
            pc[0](pc[2])
        }
    })
    .catch(e => { console.log(e); });
}

/*
json = {
set,
uid //contract id
}
*/

exports.ft_escrow_cancel = function(json, from, active, pc) {
    let fnftp = getPathObj(['fts', 't', `${json.set}:${json.uid}`]),
        setp = getPathObj(['sets', json.set]); //to balance promise
    Promise.all([fnftp, setp])
    .then(nfts => {
        var to, by
        try{to=nfts[0].t.split('_')[1];by=nfts[0].t.split('_')[0]}catch(e){}
        if((to == from || by == from) && active) {
            let ops = []
            addMT(['rnfts', json.set, by], 1)
            ops.push({type:'del', path:['fts', 't', `${json.set}:${json.uid}`]})
            // is there anything in the NFT that needs to be modified? owner, renter, 
            let msg = `@${from} canceled mint token transfer`
            if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
            ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg });
            store.batch(ops, pc)
        } else {
            if (config.hookurl) postToDiscord(`Can't find Mint Token: ${json.set}:${json.uid} in pending transfers`)
            pc[0](pc[2])
        }
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
                    var ops = []
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

/*
json = {
    hive:1000, //1.000 Hive || hbd: 1000 // 1.000 HBD
    quantity: 4096, //4096 NFTs
    set: 'dlux', //set tokens to sell
    distro: 'account1_5000,acc2_5000' //must add to 10000
}
*/

exports.fts_sell_h = function(json, from, active, pc) {
    let fnftp = getPathNum(['rnfts', json.set, from]),
        ltp = getPathObj(['lth']),
        Pbal = getPathObj(['balances']),
        h = parseInt(json.hive) || 0, 
        b = parseInt(json.hbd) || 0,
        q = parseInt(json.quantity),
        e= json.enforce || false
        d = `${from}_10000`,
        failed = false
    Promise.all([fnftp, ltp, Pbal])
    .then(mem => {
        if (mem[0] >= q && active){
                var ls = mem[1], 
                    nft = mem[0],
                    bals = mem[2]
                if (json.distro){ //string verification
                    let pairs = json.distro.split(','),
                        total = 0
                    for (let i = 0; i < pairs.length; i++){
                        total += parseInt(pairs[i].split('_')[1])
                        if(!bals[pairs[i].split('_')[0]])failed = true
                    }
                    if(!failed && total === 10000){
                        d = json.distro
                    }
                }
                if(h)b=0 //refund fountian prevent 
                var hash = hashThis(`${from}:${json.set}:${json.block_num}`),
                    listing = {
                        h,//millihive
                        b,//millihbd
                        q,//qty
                        d,//distro string,
                        o: from,//seller
                        i:`${json.set}:${hash}`,//item for canceling
                        e //enforce
                    }
                ls[`${json.set}:${hash}`] = listing //place the listing in the AH
                var ops = []
                ops.push({type:'put', path:['lth'], data: ls})
                ops.push({type:'put', path:['rnfts', json.set, from], data: nft - q})
                let msg = `@${from} Listed ${json.set} mint tokens for hive/hbd sale`
                if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg });
                store.batch(ops, pc)
            } else if (!active){
                let msg = `@${from} tried to sell with out signing ACTIVE`
                if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                pc[0](pc[2])
            } else {
                let msg = `@${from} doesn't own enough ${json.set} mint tokens`
                if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                pc[0](pc[2])
            }
    })
    .catch(e => { console.log(e); });
}

/*
{
set,
uid, //contract name
}
*/

exports.fts_sell_hcancel = function(json, from, active, pc) {
    let lsp = getPathObj(['lth', `${json.set}:${json.uid}`]),
        pco = getPathObj(['pcon', 'lth', `${json.set}:${json.uid}`])
    Promise.all([lsp, pco])
    .then(mem => {
        const listing = mem[0],
            pending = mem[1],
            i = 0
        if(active && from == mem[0].o){
            let ops = []
            for(var item in pending){
            var transfers = [...buildSplitTransfers(pending[item]*listing.h+pending[item]*listing.b, listing.h ? 'HIVE' : 'HBD', listing.d, `${json.set} mint token sale - ${item}:${i}:${json.block_num}`)]
                    addMT(['rnfts', json.set, item], parseInt(pending[item]))
                    for(var j = 0; j < transfers.length; j++){
                        ops.push({type: 'put', path: ['msa', `${i}:${j}:vop:${json.block_num}`], data: stringify(transfers[j])})
                    }
                    ops.push({type:'del',path:['pcon','lth', `${json.set}:${json.uid}`, item]})
                }
            addMT(['rnfts', json.set, from], mem[0].q)
            ops.push({type:'del', path:['lth', `${json.set}:${json.uid}`]})
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

exports.ft_buy = function(json, from, active, pc) {
    console.log('ft_buy', {json})
    let fbalp = getPathNum(['balances', from]),
        lsp = getPathObj(['lt', `${json.set}:${json.uid}`]), //needed?
        setp = getPathObj(['sets', json.set])
    Promise.all([fbalp, lsp, setp])
    .then(mem => {
        var price = 'high',
        listing = mem[1]
        try {price = mem[1].p}catch(e){}
        if(price <= mem[0] && active && mem[1].o != from){
            let set = mem[2],
                promises = distro(from, listing.o, price, set.r, set.a, set.ra, json.set)
            let ops = []
            addMT(['rnfts', json.set, from], 1)
            ops.push({type:'put', path:['balances', from], data: mem[0] - price})
            ops.push({type:'del', path:['lt', `${json.set}:${json.uid}`]})
            let msg = `@${from} bought ${json.set}:${json.uid} mint token`
            if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
            ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg });
            Promise.all(promises).then(empty => {store.batch(ops, pc)})
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
            let ops = []
            addMT(['rnfts', json.set, from], 1)
            ops.push({type:'del', path:['lt', `${json.set}:${json.uid}`]})
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
        let fnftp = getPathNum(['rnfts', `${json.set}`, from]), //zoom in?
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
                        },
                        ops = []
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
                    if (json.bid_amount > listing.b && listing.f != from){
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