const { store, TXID } = require("./index");
const { renderNFTtoDiscord, postToDiscord } = require('./discord')
const { add, addMT, burn, chronAssign, hashThis } = require('./lil_ops')
const config = require('./config')
const stringify = require('json-stable-stringify');
exports.sortBuyArray = (array, key) => array.sort(function(a, b) {
    return b[key] - a[key];
})

const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97, 101, 103, 107, 109, 113, 127, 131, 137, 139, 149, 151, 157, 163, 167, 173, 179, 181, 191, 193, 197, 199, 211, 223, 227, 229, 233, 239, 241, 251, 257, 263, 269, 271, 277, 281, 283, 293, 307, 311, 313, 317, 331, 337, 347, 349, 353, 359, 367, 373, 379, 383, 389, 397, 401, 409, 419, 421, 431, 433, 439, 443, 449, 457, 461, 463, 467, 479, 487, 491, 499, 503, 509, 521, 523, 541, 547, 557, 563, 569, 571, 577, 587, 593, 599, 601, 607, 613, 617, 619, 631, 641, 643, 647, 653, 659, 661, 673, 677, 683, 691, 701, 709, 719, 727, 733, 739, 743, 751, 757, 761, 769, 773, 787, 797, 809, 811, 821, 823, 827, 829, 839, 853, 857, 859, 863, 877, 881, 883, 887, 907, 911, 919, 929, 937, 941, 947, 953, 967, 971, 977, 983, 991, 997, 1009, 1013, 1019, 1021, 1031, 1033, 1039, 1049, 1051, 1061, 1063, 1069, 1087, 1091, 1093, 1097, 1103, 1109, 1117, 1123, 1129, 1151, 1153, 1163, 1171, 1181, 1187, 1193, 1201, 1213, 1217, 1223, 1229, 1231, 1237, 1249, 1259, 1277, 1279, 1283, 1289, 1291, 1297, 1301, 1303, 1307, 1319, 1321, 1327, 1361, 1367, 1373, 1381, 1399, 1409, 1423, 1427, 1429, 1433, 1439, 1447, 1451, 1453, 1459, 1471, 1481, 1483, 1487, 1489, 1493, 1499, 1511, 1523, 1531, 1543, 1549, 1553, 1559, 1567, 1571, 1579, 1583, 1597, 1601, 1607, 1609, 1613, 1619, 1621, 1627, 1637, 1657, 1663, 1667, 1669, 1693, 1697, 1699, 1709, 1721, 1723, 1733, 1741, 1747, 1753, 1759, 1777, 1783, 1787, 1789, 1801, 1811, 1823, 1831, 1847, 1861, 1867, 1871, 1873, 1877, 1879, 1889, 1901, 1907, 1913, 1931, 1933, 1949, 1951, 1973, 1979, 1987, 1993, 1997, 1999, 2003, 2011, 2017, 2027, 2029, 2039, 2053, 2063, 2069, 2081, 2083, 2087, 2089, 2099, 2111, 2113, 2129, 2131, 2137, 2141, 2143, 2153, 2161, 2179, 2203, 2207, 2213, 2221, 2237, 2239, 2243, 2251, 2267, 2269, 2273, 2281, 2287, 2293, 2297, 2309, 2311, 2333, 2339, 2341, 2347, 2351, 2357, 2371, 2377, 2381, 2383, 2389, 2393, 2399, 2411, 2417, 2423, 2437, 2441, 2447, 2459, 2467, 2473, 2477, 2503, 2521, 2531, 2539, 2543, 2549, 2551, 2557, 2579, 2591, 2593, 2609, 2617, 2621, 2633, 2647, 2657, 2659, 2663, 2671, 2677, 2683, 2687, 2689, 2693, 2699, 2707, 2711, 2713, 2719, 2729, 2731, 2741, 2749, 2753, 2767, 2777, 2789, 2791, 2797, 2801, 2803, 2819, 2833, 2837, 2843, 2851, 2857, 2861, 2879, 2887, 2897, 2903, 2909, 2917, 2927, 2939, 2953, 2957, 2963, 2969, 2971, 2999, 3001, 3011, 3019, 3023, 3037, 3041, 3049, 3061, 3067, 3079, 3083, 3089, 3109, 3119, 3121, 3137, 3163, 3167, 3169, 3181, 3187, 3191, 3203, 3209, 3217, 3221, 3229, 3251, 3253, 3257, 3259, 3271, 3299, 3301, 3307, 3313, 3319, 3323, 3329, 3331, 3343, 3347, 3359, 3361, 3371, 3373, 3389, 3391, 3407, 3413, 3433, 3449, 3457, 3461, 3463, 3467, 3469, 3491, 3499, 3511, 3517, 3527, 3529, 3533, 3539, 3541, 3547, 3557, 3559, 3571, 3581, 3583, 3593, 3607, 3613, 3617, 3623, 3631, 3637, 3643, 3659, 3671, 3673, 3677, 3691, 3697, 3701, 3709, 3719, 3727, 3733, 3739, 3761, 3767, 3769, 3779, 3793, 3797, 3803, 3821, 3823, 3833, 3847, 3851, 3853, 3863, 3877, 3881, 3889, 3907, 3911, 3917, 3919, 3923, 3929, 3931, 3943, 3947, 3967, 3989, 4001, 4003, 4007, 4013, 4019, 4021, 4027, 4049, 4051, 4057, 4073, 4079, 4091, 4093, 4099, 4111, 4127, 4129, 4133, 4139, 4153, 4157, 4159, 4177, 4201, 4211, 4217, 4219, 4229, 4231, 4241, 4243, 4253, 4259, 4261, 4271, 4273, 4283, 4289, 4297, 4327, 4337, 4339, 4349, 4357, 4363, 4373, 4391, 4397, 4409, 4421, 4423, 4441, 4447, 4451, 4457, 4463, 4481, 4483, 4493, 4507, 4513, 4517, 4519, 4523, 4547, 4549, 4561, 4567, 4583, 4591, 4597, 4603, 4621, 4637, 4639, 4643, 4649, 4651, 4657, 4663, 4673, 4679, 4691, 4703, 4721, 4723, 4729, 4733, 4751, 4759, 4783, 4787, 4789, 4793, 4799, 4801, 4813, 4817, 4831, 4861, 4871, 4877, 4889, 4903, 4909, 4919, 4931, 4933, 4937, 4943, 4951, 4957, 4967, 4969, 4973, 4987, 4993, 4999, 5003, 5009, 5011, 5021, 5023, 5039, 5051, 5059, 5077, 5081, 5087, 5099, 5101, 5107, 5113, 5119, 5147, 5153, 5167, 5171, 5179, 5189, 5197, 5209, 5227, 5231, 5233, 5237, 5261, 5273, 5279, 5281, 5297, 5303, 5309, 5323, 5333, 5347, 5351, 5381, 5387, 5393, 5399, 5407, 5413, 5417, 5419, 5431, 5437, 5441, 5443, 5449, 5471, 5477, 5479, 5483, 5501, 5503, 5507, 5519, 5521, 5527, 5531, 5557, 5563, 5569, 5573, 5581, 5591, 5623, 5639, 5641, 5647, 5651, 5653, 5657, 5659, 5669, 5683, 5689, 5693, 5701, 5711, 5717, 5737, 5741, 5743, 5749, 5779, 5783, 5791, 5801, 5807, 5813, 5821, 5827, 5839, 5843, 5849, 5851, 5857, 5861, 5867, 5869, 5879, 5881, 5897, 5903, 5923, 5927, 5939, 5953, 5981, 5987, 6007, 6011, 6029, 6037, 6043, 6047, 6053, 6067, 6073, 6079, 6089, 6091, 6101, 6113, 6121, 6131, 6133, 6143, 6151, 6163, 6173, 6197, 6199, 6203, 6211, 6217, 6221, 6229, 6247, 6257, 6263, 6269, 6271, 6277, 6287, 6299, 6301, 6311, 6317, 6323, 6329, 6337, 6343, 6353, 6359, 6361, 6367, 6373, 6379, 6389, 6397, 6421, 6427, 6449, 6451, 6469, 6473, 6481, 6491, 6521, 6529, 6547, 6551, 6553, 6563, 6569, 6571, 6577, 6581, 6599, 6607, 6619, 6637, 6653, 6659, 6661, 6673, 6679, 6689, 6691, 6701, 6703, 6709, 6719, 6733, 6737, 6761, 6763, 6779, 6781, 6791, 6793, 6803, 6823, 6827, 6829, 6833, 6841, 6857, 6863, 6869, 6871, 6883, 6899, 6907, 6911, 6917, 6947, 6949, 6959, 6961, 6967, 6971, 6977, 6983, 6991, 6997, 7001, 7013, 7019, 7027, 7039, 7043, 7057, 7069, 7079, 7103, 7109, 7121, 7127, 7129, 7151, 7159, 7177, 7187, 7193, 7207, 7211, 7213, 7219, 7229, 7237, 7243, 7247, 7253, 7283, 7297, 7307, 7309, 7321, 7331, 7333, 7349, 7351, 7369, 7393, 7411, 7417, 7433, 7451, 7457, 7459, 7477, 7481, 7487, 7489, 7499, 7507, 7517, 7523, 7529, 7537, 7541, 7547, 7549, 7559, 7561, 7573, 7577, 7583, 7589, 7591, 7603, 7607, 7621, 7639, 7643, 7649, 7669, 7673, 7681, 7687, 7691, 7699, 7703, 7717, 7723, 7727, 7741, 7753, 7757, 7759, 7789, 7793, 7817, 7823, 7829, 7841, 7853, 7867, 7873, 7877, 7879, 7883, 7901, 7907, 7919, 7927, 7933, 7937, 7949, 7951, 7963, 7993, 8009, 8011, 8017, 8039, 8053, 8059, 8069, 8081, 8087, 8089, 8093, 8101, 8111, 8117, 8123, 8147, 8161, 8167, 8171, 8179, 8191, 8209, 8219, 8221, 8231, 8233, 8237, 8243, 8263, 8269, 8273, 8287, 8291, 8293, 8297, 8311, 8317, 8329, 8353, 8363, 8369, 8377, 8387, 8389, 8419, 8423, 8429, 8431, 8443, 8447, 8461, 8467, 8501, 8513, 8521, 8527, 8537, 8539, 8543, 8563, 8573, 8581, 8597, 8599, 8609, 8623, 8627, 8629, 8641, 8647, 8663, 8669, 8677, 8681, 8689, 8693, 8699, 8707, 8713, 8719, 8731, 8737, 8741, 8747, 8753, 8761, 8779, 8783, 8803, 8807, 8819, 8821, 8831, 8837, 8839, 8849, 8861, 8863, 8867, 8887, 8893, 8923, 8929, 8933, 8941, 8951, 8963, 8969, 8971, 8999, 9001, 9007, 9011, 9013, 9029, 9041, 9043, 9049, 9059, 9067, 9091, 9103, 9109, 9127, 9133, 9137, 9151, 9157, 9161, 9173, 9181, 9187, 9199, 9203, 9209, 9221, 9227, 9239, 9241, 9257, 9277, 9281, 9283, 9293, 9311, 9319, 9323, 9337, 9341, 9343, 9349, 9371, 9377, 9391, 9397, 9403, 9413, 9419, 9421, 9431, 9433, 9437, 9439, 9461, 9463, 9467, 9473, 9479, 9491, 9497, 9511, 9521, 9533, 9539, 9547, 9551, 9587, 9601, 9613, 9619, 9623, 9629, 9631, 9643, 9649, 9661, 9677, 9679, 9689, 9697, 9719, 9721, 9733, 9739, 9743, 9749, 9767, 9769, 9781, 9787, 9791, 9803, 9811, 9817, 9829, 9833, 9839, 9851, 9857, 9859, 9871, 9883, 9887, 9901, 9907, 9923, 9929, 9931, 9941, 9949, 9967, 9973]
exports.primes = primes

function isEmpty(obj) {
    for (var key in obj) {
        if (obj.hasOwnProperty(key)) return false;
    }
    return true
}

const NFT = {
    place : function(item, account, string){
        if (string.indexOf(`_${account},`) >= 0){
            return string.slice(0, string.indexOf(`_${account},`)) + '_' + item + string.slice(string.indexOf(`_${account},`))
        } else {
            return string + item + '_' + account + ','
        }
    },
    move : function (item, to, string){
        const index = string.indexOf(item + '_')
        const itemsAndOwner = string.slice(string.lastIndexOf(',', index)).split(',')[1].split('_')
        var newString = ''
        if(itemsAndOwner.length == 2){
            newString = string.replace(`${item}_${itemsAndOwner[1]},`, '')
        } else {
            newString = string.replace(`${item}_`, '')
        }
        if (newString.indexOf(`_${to},`) >= 0){
            return newString.slice(0, newString.indexOf(`_${to},`)) + '_' + item + newString.slice(newString.indexOf(`_${to},`))
        } else {
            return newString + item + '_' + to + ','
        }

    },
    delete : function(item, string){
        const index = string.indexOf(item)
        const itemsAndOwner = string.slice(string.lastIndexOf(',', index)).split(',')[0].split('_')
        var newString = ''
        if(itemsAndOwner.length == 2){
            newString = string.replace(`${item}_${itemsAndOwner[1]},`, '')
        } else {
            newString = string.replace(`${item}_`, '')
        }
        if (newString.indexOf('_D,') >= 0){
            return newString.slice(0, newString.indexOf('_D,')) + '_' + item + newString.slice(newString.indexOf('_D,'))
        } else {
            return newString + item + '_D,'
        }
    },
    last : function(number, string){
        const last = string.split(',')[0]
        return string.replace(last, Base64.fromNumber(number))
    },
    mintOp : function (promies, delkey, num, b, rand) {
        return new Promise((resolve, reject) => {
            const seed = parseInt(rand.slice(0, 12), 16)
            console.log({rand, seed})
            Promise.all(promies).then(mem => {
                var set = mem[0],
                    nft
                if (set.i === "0")NFT.finalizeFee(set.f)
                const max = Base64.toNumber(set.m)
                const len = set.m.split('').length
                const min = Base64.toNumber(set.o)
                const total = max - min
                var select = seed % total
                var selected = Base64.fromNumber(min + select)
                var inserted = false
                if(set.u){
                    while (!inserted) {
                        while (selected.split('').length < len) {selected = '0' + selected}
                        if (set.u.indexOf(`${selected}_`) == -1) {
                            set.u = NFT.place(selected, b.for, set.u)
                            inserted = true
                        } else {
                            select = (select + 1) % total
                            selected = Base64.fromNumber(min + select)
                        }
                    }
                } else {
                    while (selected.split('').length < len) {selected = '0' + selected}
                    set.u = `${selected}_${b.for},`
                }
                switch (set.t) {
                    case 4:
                        nft = {
                            s: `${Base64.fromNumber(num -1 )},,`
                        }
                    break;
                    default:
                        nft = {
                            s: `${Base64.fromNumber(num -1 )},`
                        }
                }
                set.i = Base64.fromNumber(Base64.toNumber(set.i) + 1)
                let ops = []
                ops.push({type:'put', path:['nfts', b.for, `${b.set}:${selected}`], data: nft})
                ops.push({type:'put', path:['sets', b.set], data: set})
                ops.push({type: 'put', path: ['feed', `${num}:vop_${delkey.split(':')[1]}`], data: `${b.for} minted ${selected} from the ${b.set} set.` })
                if(config.hookurl)renderNFTtoDiscord(set.s, selected, b.for, b.set)
                TXID.store(`${b.for} minted ${selected} from the ${b.set} set.`, `${num}:${b.txid}`)
                ops.push({ type: 'del', path: ['chrono', delkey] })
                store.batch(ops, [resolve, reject])
            })
        })
    },
    AHEOp : function (promies, delkey, num, b) {
        return new Promise((resolve, reject) => { //NEEDS no bids
            Promise.all(promies)
                .then(mem => {
                    let listing = mem[0],
                        set = mem[1],
                        ops = [],
                        promises = []
                    // const fee = parseInt(listing.b /100); add('n', fee); listingb = listing.b - fee;
                    nft = listing.nft
                    const last_modified = nft.s.split(',')[0]
                    nft.s.replace(last_modified, Base64.fromNumber(num)) //update last modified
                    if(listing.b){ //winner
                        promises = distro('AH', listing.o, listing.b, set.r, set.a, set.ra, set.n)
                        if(b.item.split(':')[0] != 'Qm') set.u = NFT.move(b.item.split(':')[1], listing.f, set.u)//update set
                        else set.u = listing.f
                        ops.push({ type: 'put', path: ['nfts', listing.f, b.item], data: nft }) //update nft
                        const msg = `Auction of ${listing.o}'s ${b.item} has ended for ${parseFloat(listing.b / 1000).toFixed(3)} ${config.TOKEN} to ${listing.f}`
                        ops.push({ type: 'put', path: ['feed', `${num}:vop_${delkey.split(':')[1]}`], data: msg })
                        if(config.hookurl)postToDiscord(msg, `${num}:vop_${delkey.split(':')[1]}`)
                    } else { //no bidders
                        const msg = `Auction of ${listing.o}'s ${b.item} has ended with no bidders`
                        ops.push({ type: 'put', path: ['feed', `${num}:vop_${delkey.split(':')[1]}`], data: msg })
                        if(config.hookurl)postToDiscord(msg, `${num}:vop_${delkey.split(':')[1]}`)
                        if(b.item.split(':')[0] != 'Qm') set.u = NFT.move(b.item.split(':')[1], listing.o, set.u)//update set
                        else set.u = listing.o
                        ops.push({ type: 'put', path: ['nfts', listing.o, b.item], data: nft })
                    }
                    if (b.item.split(':')[0] != 'Qm') ops.push({ type: 'put', path: ['sets', b.item.split(':')[0]], data: set }) //update set
                    else ops.push({ type: 'put', path: ['sets', `Qm${b.item.split(':')[1]}`], data: set })
                    ops.push({ type: 'del', path: ['chrono', delkey] })
                    ops.push({ type: 'del', path: ['ah', b.item] })
                    if(promises.length)Promise.all(promises).then(empty=>{store.batch(ops, [resolve, reject,'waiting'])})
                    else store.batch(ops, [resolve, reject,'not waiting'])
                })
                .catch(e => { console.log(e) })
        })
    },
    AHHEOp : function (promies, delkey, num, b, ts) {
        return new Promise((resolve, reject) => { //NEEDS no bids
            Promise.all(promies)
                .then(mem => {
                    let listing = mem[0],
                        set = mem[1],
                        ops = [],
                        promises = [],
                    // const fee = parseInt(listing.b /100); add('n', fee); listingb = listing.b - fee;
                        nft = listing.nft
                    const last_modified = nft.s.split(',')[0]
                    nft.s.replace(last_modified, Base64.fromNumber(num)) //update last modified
                    if(listing.b){ //winner
                        let royalties = parseInt(listing.b * (set.r / 10000))
                        let fee = parseInt(listing.b * (config.hive_service_fee / 10000))
                        let total = listing.b - royalties - fee
                        const Transfer = ['transfer',
                            {
                                from: config.msaccount,
                                to: listing.o,
                                amount: parseFloat(total/1000).toFixed(3) + ` ${listing.h}`,
                                memo: `${b.item} sold at auction.`
                            }]
                        if(royalties){
                            DEX.buyDluxFromDex(royalties, listing.h, num, `roy_${delkey.split(':')[1]}`, `n:${set.n}`, ts, 'royalty')
                            .then(empty=>{
                                DEX.buyDluxFromDex(fee, listing.h, num, `fee_${delkey.split(':')[1]}`, `rn`, ts, 'fee')
                                .then(emp=>{
                                    finish()
                                })
                            })
                        } else {
                            DEX.buyDluxFromDex(fee, listing.h, num, `fee_${delkey.split(':')[1]}`, `rn`, ts)
                            .then(emp=>{
                                finish()
                            })
                        }
                        function finish(){
                            if(b.item.split(':')[0] != 'Qm') set.u = NFT.move(b.item.split(':')[1], listing.f, set.u)//update set
                            else set.u = listing.f
                            ops.push({ type: 'put', path: ['nfts', listing.f, b.item], data: nft }) //update nft
                            const msg = `Auction of ${listing.o}'s ${b.item} has ended for ${parseFloat(listing.b / 1000).toFixed(3)} ${listing.h} to ${listing.f}`
                            ops.push({ type: 'put', path: ['feed', `${num}:vop_${delkey.split(':')[1]}`], data: msg })
                            ops.push({ type: 'put', path: ['msa', `${num}:vop_${delkey.split(':')[1]}`], data: stringify(Transfer) })
                            if(config.hookurl)postToDiscord(msg, `${num}:vop_${delkey.split(':')[1]}`)
                            if (b.item.split(':')[0] != 'Qm') ops.push({ type: 'put', path: ['sets', b.item.split(':')[0]], data: set }) //update set
                            else ops.push({ type: 'put', path: ['sets', `Qm${b.item.split(':')[1]}`], data: set })
                            ops.push({ type: 'del', path: ['chrono', delkey] })
                            ops.push({ type: 'del', path: ['ahh', b.item] })
                            store.batch(ops, [resolve, reject,'bidders'])
                        }
                    } else { //no bidders
                        const msg = `Auction of ${listing.o}'s ${b.item} has ended with no bidders`
                        ops.push({ type: 'put', path: ['feed', `${num}:vop_${delkey.split(':')[1]}`], data: msg })
                        if(config.hookurl)postToDiscord(msg, `${num}:vop_${delkey.split(':')[1]}`)
                        if(b.item.split(':')[0] != 'Qm') set.u = NFT.move(b.item.split(':')[1], listing.o, set.u)//update set
                        else set.u = listing.o
                        ops.push({ type: 'put', path: ['nfts', listing.o, b.item], data: nft })
                        if (b.item.split(':')[0] != 'Qm') ops.push({ type: 'put', path: ['sets', b.item.split(':')[0]], data: set }) //update set
                        else ops.push({ type: 'put', path: ['sets', `Qm${b.item.split(':')[1]}`], data: set })
                        ops.push({ type: 'del', path: ['chrono', delkey] })
                        ops.push({ type: 'del', path: ['ahh', b.item] })
                        store.batch(ops, [resolve, reject,'no bidders'])
                    }
                })
                .catch(e => { console.log(e) })
        })
    },
    AMEOp : function (promies, delkey, num, b) {
        return new Promise((resolve, reject) => {
            Promise.all(promies)
                .then(mem => {
                    let listing = mem[0],
                        set = mem[1],
                        ops = [],
                        promises = []
                    // const fee = parseInt(listing.b /100); add('n', fee); listingb = listing.b - fee;
                    if(listing.b){ //winner
                        promises = distro('AH', listing.o, listing.b, set.r, set.a, set.ra, set.n)
                        addMT(['rnfts', b.item.split(':')[0], listing.f], 1)
                        const msg = `Auction of ${listing.o}'s ${b.item} mint token has ended for ${parseFloat(listing.b / 1000).toFixed(3)} ${config.TOKEN} to ${listing.f}`
                        ops.push({ type: 'put', path: ['feed', `${num}:vop_${delkey.split(':')[1]}`], data: msg })
                        if(config.hookurl)postToDiscord(msg, `${num}:vop_${delkey.split(':')[1]}`)
                    } else { //no bidders
                        const msg = `Auction of ${b.item} mint token has ended with no bidders`
                        ops.push({ type: 'put', path: ['feed', `${num}:vop_${delkey.split(':')[1]}`], data: msg })
                        if(config.hookurl)postToDiscord(msg, `${num}:vop_${delkey.split(':')[1]}`)
                        addMT(['rnfts', b.item.split(':')[0], listing.o], 1)
                    }
                    ops.push({ type: 'del', path: ['chrono', delkey] })
                    ops.push({ type: 'del', path: ['am', b.item] })
                    if(promises.length)Promise.all(promises).then(empty=>{store.batch(ops, [resolve, reject])})
                    else store.batch(ops, [resolve, reject])
                })
                .catch(e => { console.log(e) })
        })
    },
    DividendOp : function (promies, delkey, num, b) {
        return new Promise((resolve, reject) => {
            Promise.all(promies)
                .then(mem => {
                    let contract = mem[0],
                        set = mem[1],
                        sales = mem[2],
                        auc = mem[3],
                        ops = [],
                        promises = []
                    if(!contract.m)contract.m = {}
                    for(item in sales){
                        if(item.split(':')[0] == set.n){
                            contract.m[sales[item].o] = 0
                        }
                    }
                    for(item in auc){
                        if(item.split(':')[0] == set.n){
                            contract.m[auc[item].o] = 0
                        }
                    }
                    promises = divDistro(contract.b, set.u, contract.m, contract.s, contract.l) //balance, owners, movers, setname(for refund)
                    const msg = `Dividends of ${contract.s}'s ${contract.b? parseFloat(contract.b/Math.pow(10,config.precision)).toFixed(config.precision) : 0} ${config.TOKEN} have been distributed to ${promises.length} accounts`
                    promises.push(chronAssign(num + contract.p, {op:"div", set:contract.s}))
                    ops.push({ type: 'put', path: ['feed', `${num}:vop_${delkey.split(':')[1]}`], data: msg })
                    if(config.hookurl)postToDiscord(msg, `${num}:vop_${delkey.split(':')[1]}`)
                    ops.push({ type: 'del', path: ['chrono', delkey] })
                    ops.push({ type: 'del', path: ['div', contract.s, 'm'] })
                    if(promises.length)Promise.all(promises).then(empty=>{store.batch(ops, [resolve, reject])})
                    else store.batch(ops, [resolve, reject])
                    function divDistro(balance, owners, movers, setname, last) {
                        let accounts = owners.split(','),
                            tos = [],
                            items = [],
                            promies = [],
                            total = 0,
                            no = Object.keys(movers)
                        no.push('ls', 'D', 'ah', 't', 'hh')
                        if(accounts.length > 0)for(var i = 0; i < accounts.length; i++) {
                            const len = accounts[i].split('_').length - 1
                            const who = accounts[i].split('_')[len]
                            if(no.indexOf(who) == -1) {
                                tos.push(who)
                                items.push(len)
                                total += len
                            }
                        }
                        let cada = parseInt(balance / total)
                        let truco = balance % total
                        promies.push(addMT(['div', setname, 'b'], truco - balance))
                        promies.push(addMT(['div', setname, 'e'], cada))
                        promies.push(addMT(['div', setname, 'l'], cada - last))
                        for(var i = 0; i < items.length; i++) {
                            promies.push(add(tos[i] , cada * items[i]))
                        }

                        return promies
                    }
                })
                .catch(e => { console.log(e) })
        })
    },
    finalizeFee : function (fee) {
        const toNodes = parseInt(fee / 2)
        add('rn', toNodes)
        burn(fee - toNodes)
    }
}
exports.NFT = NFT

const Chron = {
    govDownOp : function (promies, from, delkey, num, id, b) {
        return new Promise((resolve, reject) => {
            Promise.all(promies)
                .then(bals => {
                    let lbal = bals[0],
                        tgov = bals[1],
                        gbal = bals[2],
                        ops = []
                    if (gbal - b.amount < 0) {
                        b.amount = gbal
                    }
                    ops.push({ type: 'put', path: ['balances', from], data: lbal + b.amount })
                    ops.push({ type: 'put', path: ['gov', from], data: gbal - b.amount })
                    ops.push({ type: 'put', path: ['gov', 't'], data: tgov - b.amount })
                    ops.push({ type: 'put', path: ['feed', `${num}:vop_${id}`], data: `@${b.by}| ${parseFloat(b.amount/1000).toFixed(3)} ${config.TOKEN} withdrawn from governance.` })
                    ops.push({ type: 'del', path: ['chrono', delkey] })
                    ops.push({ type: 'del', path: ['govd', b.by, delkey] })
                    store.batch(ops, [resolve, reject])
                })
                .catch(e => { console.log(e) })
        })
    },
    powerDownOp : function (promies, from, delkey, num, id, b) {
        return new Promise((resolve, reject) => {
            Promise.all(promies)
                .then(bals => {
                    let lbal = bals[0],
                        tpow = bals[1],
                        pbal = bals[2],
                        ops = []
                    if (pbal - b.amount < 0) {
                        b.amount = pbal
                    }
                    ops.push({ type: 'put', path: ['balances', from], data: lbal + b.amount })
                    ops.push({ type: 'put', path: ['pow', from], data: pbal - b.amount })
                    ops.push({ type: 'put', path: ['pow', 't'], data: tpow - b.amount })
                    ops.push({ type: 'put', path: ['feed', `${num}:vop_${id}`], data: `@${b.by}| powered down ${parseFloat(b.amount/1000).toFixed(3)} ${config.TOKEN}` })
                    ops.push({ type: 'del', path: ['chrono', delkey] })
                    ops.push({ type: 'del', path: ['powd', b.by, delkey] })
                    store.batch(ops, [resolve, reject])
                })
                .catch(e => { console.log(e) })
        })
    },
    postRewardOP : function (l, num, id, delkey) {
        return new Promise((resolve, reject) => {
            store.get(['posts', `${l.author}/${l.permlink}`], function(e, b) {
                let ops = []
                let totals = {
                    totalWeight: 0,
                    linearWeight: 0
                }
                for (vote in b.votes) {
                    totals.totalWeight += b.votes[vote].v
                    linearWeight = parseInt(b.votes[vote].v * ((201600 - (b.votes[vote].b - b.block)) / 201600))
                    totals.linearWeight += linearWeight
                    b.votes[vote].w = linearWeight
                }
                let half = parseInt(totals.totalWeight / 2)
                totals.curationTotal = half
                totals.authorTotal = totals.totalWeight - half
                b.t = totals
                ops.push({
                    type: 'put',
                    path: ['pendingpayment', `${b.author}/${b.permlink}`],
                    data: b
                })
                ops.push({ type: 'del', path: ['chrono', delkey] })
                ops.push({ type: 'put', path: ['feed', `${num}:vop_${id}`], data: `@${b.author}| Post:${b.permlink} voting expired.` })
                ops.push({ type: 'del', path: ['posts', `${b.author}/${b.permlink}`] })
                store.batch(ops, [resolve, reject])
            })
        })
    },
    postVoteOP : function(l, delkey) {
        return new Promise((resolve, reject) => {
            store.get(['posts', `${l.author}/${l.permlink}`], function(e, b) {
                let ops = []
                let totalWeight = 0
                for (vote in b.votes) {
                    totalWeight += b.votes[vote].v
                }
                b.v = totalWeight
                if (b.v > 0) {
                    ops.push({
                        type: 'put',
                        path: ['pendingvote', `${l.author}/${l.permlink}`],
                        data: b
                    })
                }
                ops.push({ type: 'del', path: ['chrono', delkey] })
                store.batch(ops, [resolve, reject])
            })
        })
    }
}
exports.Chron = Chron

const Base64 = {

    glyphs :
    "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+=",
    fromNumber : function(number) {
        if (isNaN(Number(number)) || number === null ||
            number === Number.POSITIVE_INFINITY)
            throw "The input is not valid";
        if (number < 0)
            throw "Can't represent negative numbers now"
        var char;
        var residual = Math.floor(number);
        var result = '';
        while (true) {
            char = residual % 64
            result = this.glyphs.charAt(char) + result;
            residual = Math.floor(residual / 64);
            if (residual == 0)
                break;
            }
        return result;
    },

    toNumber : function(chars) {
        var result = 0;
        chars = chars.split('');
        for (var e = 0; e < chars.length; e++) {
            result = (result * 64) + this.glyphs.indexOf(chars[e]);
        }
        return result;
    },

    fromFlags : function (flags){ // array [1,0,1,1,0,0,1]
        var result = 0
        var last = 1
        for(var i = 0; i < flags.length; i++){
            result = result + ( last * flags[i] )
            last = last * 2
        }
        return this.fromNumber(result)
    },

    toFlags : function (chars) {
        var result = []
        chars = chars.split('');
        for (j = 0; j < chars.length; j++) {
            for (var i = 32; i >= 1; i = i/2){
                if (this.glyphs.indexOf(chars[j]) >= i){
                    result.unshift(1)
                    chars[j] = this.glyphs[this.glyphs.indexOf(chars[j]) - i]
                } else {
                    result.unshift(0)
                }
            }
        }
        return result
    }
}
exports.Base64 = Base64

function distro(payingAccount, recievingAccount, price, royalty_per, author, royaltyString, setname){
    let per = royalty_per || 0,
        royalty = parseInt((per / 10000) * price),
        adjust = [ payingAccount, recievingAccount],
        amounts = [-price, price - royalty],
    promises = []
    if(payingAccount == 'AH'){
        adjust = [ recievingAccount]
        amounts = [price - royalty]
    }
    if (royalty){
        if (royaltyString){
            let royalties = royaltyString.split(','),
                remaining = royalty
            for (var i = royalties.length - 1; i >= 0; i--){
                let to = royalties[i].split('_')[0],
                    share = parseInt(royalty * (parseInt(royalties[i].split('_')[1]) / 10000))
                if(i==0) share = remaining
                if(adjust.indexOf(to) == -1){
                    adjust.push(to)
                    amounts.push(share)
                } else {
                    amounts[adjust.indexOf(to)] += share
                }
                remaining -= share
            }
        } else {
            if(adjust.indexOf(author) == -1){
                adjust.push(author)
                amounts.push(royalty)
            } else {
                amounts[adjust.indexOf(author)] += royalty
            }
        }
    }
    for (var i = 0; i < adjust.length; i++) {
        if(adjust[i] != 'd')promises.push(add(adjust[i], amounts[i]))
        else promises.push(addMT(['div', setname, 'b'], amounts[i]))
    }
    return promises
}

exports.distro = distro

const DEX = {
    insert : function ( item, price, string = '', type) {
        let price_location = string ? string.indexOf(price) : -1
        if (price_location === -1) {
            let prices = string.split(',')
            if (string !== ''){
                for (var i = 0; i < prices.length; i++) {
                    if(type != 'buy'){
                        if (parseFloat(prices[i].split('_')[0]) > parseFloat(price)) {
                            prices.splice(i, 0, price + '_' + item )
                            return prices.join(',')
                        }
                    } else {
                        if (parseFloat(prices[i].split('_')[0]) < parseFloat(price)) {
                            prices.splice(i, 0, price + '_' + item )
                            return prices.join(',')
                        }
                    }
                }
                return string + ',' + price + '_' + item
            } else {
                return price + '_' + item
            }
        } else {
            let insert_location = string.indexOf(',', price_location)
            if (insert_location === -1) {
                return string + '_' + item
            } else {
                return string.substring(0, insert_location) + '_' + item + string.substring(insert_location)
            }
        }
    },
    remove : function ( item, string) {
        if (string.indexOf(item + '_') > -1) {
            return string.replace(`${item}_`, '')
        } else {
            let item_location = string.indexOf('_' + item)
            let lowerThan = string.substring(0, item_location)
            let greaterThan = string.substring(item_location).replace(`_${item}`, '')
            let prices = lowerThan.split(',')
            if(prices[prices.length - 1].split('_').length >= 2){
                return string.replace(`_${item}`, '')
            } else {
                prices.pop()
                let str = prices.join(',') + greaterThan
                if (!prices.length) return greaterThan.substr(1) || ''
                else if (str.substr(0,1) == ',') return str.substr(1)
                else if (str != string)return str
                else return string
            }
        }
    },
    buyDluxFromDex : (amount, type, num, txid, to, timestamp, memo = '') =>{
        return new Promise((resolve, reject) => {
            require('./processing_routes/dex').transfer({
                from: to,
                to: config.msaccount,
                amount: {
                    amount,
                    precision: 3,
                    nai: type == 'HIVE' ? '@@000000021' : '@@000000013'
                },
                memo,
                block_num: num,
                transaction_id: txid,
                timestamp
            }, [resolve, reject, memo])
        })
    }
}
exports.DEX = DEX

const Watchdog = {
    current : 0,
    timeout: 180000, // 120 seconds to init with up to 288 blocks
    monitor : function(){
        if(!this.current)console.log('Watchdog: Monitoring...')
        setTimeout(() => {
            if(this.current == TXID.blocknumber){
                console.log('Watchdog: TIMEOUT')
                require('process').exit(3)
            } else if(!this.current){
                this.timeout = 30000
                this.current = TXID.blocknumber
                this.monitor()
            } else {
                this.current = TXID.blocknumber
                this.monitor()
            }
        }, this.timeout)
    }
}

exports.Watchdog = Watchdog