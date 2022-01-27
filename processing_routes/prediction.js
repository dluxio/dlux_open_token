const config = require('./../config')
const { store } = require("./../index");
const { getPathObj, getPathNum } = require("./../getPathObj");
const { postToDiscord } = require('./../discord')

// the oracle problem is notoriously dificult, several options exist but this is an
// attempt to acquire the wisdom of the crowd in a dlux fashion
// this is an attempt to make a predection market using sports scores

/*
exports.pm_make = (json, from, active, pc) => {
    if (active) {
        let promise_from_bal = getPathNum(['balances', from])
        let promise_stats = getPathObj(['stats'])
        Promise.all([promise_from_bal, promise_stats])
            .then(ret => {
                let from_bal = ret[0],
                    stats = ret[1],
                    ops = [];
                if (from_bal > stats.pm.fee) {
                    if (typeof json.a.n == "string" && typeof json.b.n == "string" && typeof json.a.h == "number" && typeof json.b.h == "number" && )
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

exports.pm_place = (json, from, active, pc) => {
    if (active) {
        let promise_from_bal = getPathNum(['balances', from])
        let promise_stats = getPathObj(['stats'])
        Promise.all([promise_from_bal, promise_stats])
            .then(ret => {
                let from_bal = ret[0],
                    stats = ret[1],
                    ops = [];
                if (from_bal > stats.pm.fee) {
                    if (typeof json.a.n == "string" && typeof json.b.n == "string" && typeof json.a.h == "number" && typeof json.b.h == "number" && )
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

exports.pm_settle = (json, from, active, pc) => {
    if (active) {
        let promise_from_bal = getPathNum(['balances', from])
        let promise_stats = getPathObj(['stats'])
        Promise.all([promise_from_bal, promise_stats])
            .then(ret => {
                let from_bal = ret[0],
                    stats = ret[1],
                    ops = [];
                if (from_bal > stats.pm.fee) {
                    if (typeof json.a.n == "string" && typeof json.b.n == "string" && typeof json.a.h == "number" && typeof json.b.h == "number" && )
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

exports.pm_ = (json, from, active, pc) => {
    if (active) {
        let promise_from_bal = getPathNum(['balances', from])
        let promise_stats = getPathObj(['stats'])
        Promise.all([promise_from_bal, promise_stats])
            .then(ret => {
                let from_bal = ret[0],
                    stats = ret[1],
                    ops = [];
                if (from_bal > stats.pm.fee) {
                    if (typeof json.a.n == "string" && typeof json.b.n == "string" && typeof json.a.h == "number" && typeof json.b.h == "number" && )
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
*/
/*
{
    a:{
        n: "Name of Team : string",
        h: "handicap : int"
    },
    b:{
        n: "Name of Team : string",
        h: "handicap : int"
    },
    c:{
        s: "sport/league",
        t: "Scheduled match time", //block number ?
        l: "last bet", //block number ?
        r: "Ratification Time" //blocknum -> a week after?
        f: int -> "failure path" // 0-release no fault, 1-lottery of witnesses, 2-repoll, 3-repoll+ext
        c:  "category"
    }
}
*/