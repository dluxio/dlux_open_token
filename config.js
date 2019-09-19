const ENV = process.env;

const username = ENV.account || '';
const activeKey = ENV.active || '';
const memoKey = ENV.memo || '';
const NODEDOMAIN = ENV.domain || '';
const port = ENV.PORT || 3000;
const clientURL = ENV.API_URL || 'https://api.steemit.com'
const ec = ENV.starting_hash || ''
const ec_ovr = ENV.replay_ovr || 0
const auto = ENV.account_creator || true //automates purchasing ACTs with RCs
const low = ENV.low_price || 1 //lowest sell price for ACTs
const rrate = ENV.release_rate || 2000 //maximum percent of ACTs to redeem/sell per day
const rcmin = ENV.rc_min || 2000 //lowest RC balance the auto ACT purchaser will achieve
const autoclaim = ENV.auto_claim_act || true
const del = ENV.del || true //willing to delegate SP
const delmax = ENV.del_max || 2500 //max percent of SP willing to delegate
const delprice = ENV.del_price || 'market'
const delshare = ENV.del_share || true //future implementation
const bl = ENV.bl || 'https://raw.githubusercontent.com/themarkymark-steem/buildawhaleblacklist/master/blacklist.txt'

let config = {
    username, activeKey, memoKey, NODEDOMAIN, ec, port, clientURL, low, rrate, rcmin,autoclaim, del, delprice, delmax, delshare, bl
};

module.exports = config;
