const config = require('./../config')
const { store } = require('./../index')
const { postToDiscord } = require('./../discord')

exports.delegate_vesting_shares = (json, pc) => {
    var ops = []
    json.vesting_shares = denaier(json.vesting_shares)
    const vests = parseInt(parseFloat(json.vesting_shares) * 1000000)
    if (json.delegatee == config.delegation && vests) {
        ops.push({ type: 'put', path: ['delegations', json.delegator], data: vests })
        const msg = `@${json.delegator}| has delegated ${vests} vests to @${config.delegation}`
        if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
        ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg })
    } else if (json.delegatee == config.delegation && !vests) {
        ops.push({ type: 'del', path: ['delegations', json.delegator] })
        const msg = `@${json.delegator}| has removed delegation to @${config.delegation}`
        if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
        ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg })
    }
    store.batch(ops, pc)
}

function denaier(obj){
    if (typeof obj == 'string')return obj
    else return parseFloat(obj.amount / 1000000).toFixed(6)
}