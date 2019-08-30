const ENV = process.env;

const username = ENV.account || '';
const activeKey = ENV.active || '';
const memoKey = ENV.memo || '';
const NODEDOMAIN = ENV.domain || '';
const port = ENV.PORT || 3000;
const clientURL = ENV.API_URL || 'https://api.steemit.com'
const ec = ENV.starting_hash || ''
const auto = ENV.account_creator || true //automates purchasing ACTs with RCs
const low = ENV.low_price || 1 //lowest sell price for ACTs
const fee = ENV.escrow_fee || 1 //lowest escrow fee accepted
const rrate = ENV.release_rate || 2000 //maximum percent of ACTs to redeem/sell per day
const rcmin = ENV.rc_min || 2000 //lowest RC balance the auto ACT purchaser will achieve
const fut = ENV.futures || false //willing to engage in ACT futures
const futmax = ENV.futures_max || 31536000 //max time a futures contract will be held before liquidated in blocks

let config = {
    username, activeKey, memoKey, NODEDOMAIN, ec, port, clientURL, agent, low, fee, rrate, rcmin, fut, futmax
};

module.exports = config;
