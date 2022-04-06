const config = require('./config');
const { getPathObj, getPathNum } = require("./getPathObj");
const { store } = require("./index");
const { isEmpty, addMT } = require('./lil_ops')
const { sortBuyArray } = require('./helpers');
const stringify = require('json-stable-stringify');

//the daily post, the inflation point for tokennomics
function dao(num) {
    return new Promise((resolve, reject) => {
        let post = `## ${config.TOKEN} DAO REPORT\n`,
            news = '',
            daops = [],
            Pnews = new Promise(function(resolve, reject) {
                store.get(['postQueue'], function(err, obj) {
                    if (err) {
                        reject(err);
                    } else {
                        var news = isEmpty(obj) ? '' : '*****\n### News from Humans!\n';
                        for (var title in obj) { //postQueue[title].{title,text}
                            news = news + `#### ${title}\n`;
                            news = news + `${obj[title].text}\n\n`;
                        }
                        resolve(news);
                    }
                });
            }),
            Pbals = getPathObj(['balances']),
            Pcbals = getPathObj(['cbalances'])
            Prunners = getPathObj(['runners']),
            Pnodes = getPathObj(['markets', 'node']),
            Pstats = getPathObj(['stats']),
            Pdelegations = getPathObj(['delegations']),
            Pico = getPathObj(['ico']),
            Pdex = getPathObj(['dex']),
            Pbr = getPathObj(['br']),
            Ppbal = getPathNum(['pow', 't']),
            Pnomen = getPathObj(['nomention']),
            Pposts = getPathObj(['posts']),
            Pfeed = getPathObj(['feed']),
            Ppaid = getPathObj(['paid']),
            Prnfts = getPathObj(['rnfts']);
            Pgov = getPathObj(['gov']);
            Pdistro = Distro()
        Promise.all([Pnews, Pbals, Prunners, Pnodes, Pstats, Pdelegations, Pico, Pdex, Pbr, Ppbal, Pnomen, Pposts, Pfeed, Ppaid, Prnfts, Pdistro, Pcbals, Pgov]).then(function(v) {
            daops.push({ type: 'del', path: ['postQueue'] });
            daops.push({ type: 'del', path: ['br'] });
            daops.push({ type: 'del', path: ['rolling'] });
            daops.push({ type: 'del', path: ['ico'] });
            news = v[0] + '*****\n';
            const header = post + news;
            var bals = v[1],
                cbals = v[16],
                gov = v[17],
                runners = v[2],
                mnode = v[3],
                stats = v[4],
                deles = v[5],
                ico = v[6],
                dex = v[7],
                br = v[8],
                powBal = v[9],
                nomention = v[10],
                cpost = v[11],
                feedCleaner = v[12],
                paidCleaner = v[13],
                rnftsCleaner = v[14];
                dist = v[15]
            for(var i = 0; i < dist.length;i++){
                if(dist[i][0].split('div:')[1]){
                    addMT(['div', dist[i][0].split('div:')[1], 'b'], dist[i][1] )
                } else {
                    cbals[dist[i][0]] ? cbals[dist[i][0]] += dist[i][1] : cbals[dist[i][0]] = dist[i][1]
                }
            }
            feedKeys = Object.keys(feedCleaner);
            paidKeys = Object.keys(paidCleaner);
            for(var set in rnftsCleaner){
                rnftKeys = Object.keys(rnftsCleaner[set]);
                for (var rnfti = 0; rnfti < rnftKeys.length; rnfti++) {
                    if (rnftsCleaner[set][rnftKeys[rnfti]] == 0) {
                        daops.push({ type: 'del', path: ['rnfts', set, rnftKeys[rnfti]] });
                    }
                }
            }
            for (feedi = 0; feedi < feedKeys.length; feedi++) {
                if (feedKeys[feedi].split(':')[0] < num - 30240) {
                    daops.push({ type: 'del', path: ['feed', feedKeys[feedi]] });
                }
            }
            for (paidi = 0; paidi < paidKeys.length; paidi++) {
                console.log(paidKeys[paidi])
                if (parseInt(paidKeys[paidi]) < num - 30240) {
                    console.log(paidKeys[paidi])
                    daops.push({ type: 'del', path: ['paid', paidKeys[paidi].toString()] });
                }
            }
            news = news;
            var i = 0,
                j = 0,
                b = 0,
                t = 0;
            t = parseInt(bals.ra);
            for (var node in runners) { //node rate
                b = parseInt(b) + parseInt(mnode[node].marketingRate) || 2500;
                j = parseInt(j) + parseInt(mnode[node].bidRate) || 2500;
                i++;
                console.log(b, j, i);
            }
            if (!i) {
                b = mnode[config.leader].marketingRate;
                j = mnode[config.leader].bidRate;
                i++;
            }
            stats.marketingRate = parseInt(b / i);
            stats.nodeRate = parseInt(j / i);
            post = `![${config.TOKEN} Advert](${config.adverts[num.toString().split('').reduce((a, c) => parseInt(a) + c, 0) % config.adverts.length]})\n#### Daily Accounting\n`;
            post = post + `Total Supply: ${parseFloat(parseInt(stats.tokenSupply) / 1000).toFixed(3)} ${config.TOKEN}\n* ${parseFloat(parseInt(stats.tokenSupply - powBal - (bals.ra + bals.rc + bals.rd + bals.ri + bals.rn + bals.rm)) / 1000).toFixed(3)} ${config.TOKEN} liquid\n`;
            post = post + `* ${parseFloat(parseInt(powBal) / 1000).toFixed(3)} ${config.TOKEN} Powered up for Voting\n`;
            post = post + `* ${parseFloat(parseInt(bals.ra + bals.rc + bals.rd + bals.ri + bals.rn + bals.rm) / 1000).toFixed(3)} ${config.TOKEN} in distribution accounts\n`;
            post = post + `${parseFloat(parseInt(t) / 1000).toFixed(3)} ${config.TOKEN} has been generated today. 5% APY.\n${parseFloat(stats.marketingRate / 10000).toFixed(4)} is the marketing rate.\n${parseFloat(stats.nodeRate / 10000).toFixed(4)} is the node rate.\n`;
            console.log(`DAO Accounting In Progress:\n${t} has been generated today\n${stats.marketingRate} is the marketing rate.\n${stats.nodeRate} is the node rate.`);
            bals.rn += parseInt(t * parseInt(stats.nodeRate) / 10000);
            bals.ra = parseInt(bals.ra) - parseInt(t * parseInt(stats.nodeRate) / 10000);
            bals.rm += parseInt(t * stats.marketingRate / 10000);
            if(stats.marketingRate)post = post + `${parseFloat(parseInt(t * stats.marketingRate / 10000) / 1000).toFixed(3)} ${config.TOKEN} moved to Marketing Allocation.\n`;
            if (bals.rm > 1000000000) {
                bals.rc += bals.rm - 1000000000;
                console.log('1000000000 reached: ', bals.rm - 1000000000, ' moved to rc');
                post = post + `${parseFloat((bals.rm - 1000000000) / 1000).toFixed(3)} moved from Marketing Allocation to Content Allocation due to Marketing Holdings Cap of 1,000,000.000 ${config.TOKEN}\n`;
                bals.rm = 1000000000;
            }
            bals.ra = parseInt(bals.ra) - parseInt(t * stats.marketingRate / 10000);
            
            i = 0, j = 0;
            if(bals.rm)post = post + `${parseFloat(parseInt(bals.rm) / 1000).toFixed(3)} ${config.TOKEN} is in the Marketing Allocation.\n##### Node Rewards for Elected Reports and Escrow Transfers\n`;
            console.log(num + `:${bals.rm} is availible in the marketing account\n${bals.rn} ${config.TOKEN} set aside to distribute to nodes`);
            for (var node in mnode) { //tally the wins
                j = j + parseInt(mnode[node].wins);
            }
            b = bals.rn;

            function _atfun(node) {
                if (nomention[node]) {
                    return '@_';
                } else {
                    return '@';
                }
            }
            var newOwners = {}, dexfeea = 0, dexfeed = 1, dexmaxa = 0, dexslopea = 0, dexmaxd = 1, dexsloped = 1
            if(j){
                for (var node in mnode) { //and pay them
                    const wins = mnode[node].wins
                    newOwners[node] = {wins}
                    mnode[node].tw = mnode[node].tw > 0 ? mnode[node].tw + wins : wins
                    mnode[node].wins = 0
                    mnode[node].ty = mnode[node].ty > 0 ? mnode[node].ty + mnode[node].yays : mnode[node].yays
                    mnode[node].yays = 0
                    const gbal = gov[node] || 0
                    mnode[node].g = gbal
                    const feevote = mnode[node].bidRate > 1000 || mnode[node].bidRate < 0 || typeof mnode[node].bidRate != 'number' ? 1000 : mnode[node].bidRate
                    const dmvote = typeof mnode[node].dm != 'number' ? 10000 : mnode[node].dm
                    const dsvote = typeof mnode[node].ds != 'number' ? 0 : mnode[node].ds
                    mnode[node].ds = dsvote
                    mnode[node].dm = dmvote
                    dexfeea += parseInt(wins * gbal * feevote);
                    dexfeed += parseInt(wins * gbal * 1000);
                    dexmaxa += parseInt(wins * gbal * dmvote);
                    dexmaxd += parseInt(wins * gbal * 10000);
                    dexslopea += parseInt(wins * gbal * dsvote);
                    dexsloped += parseInt(wins * gbal * 10000);
                    i = parseInt(wins / j * b);
                    cbals[node] = cbals[node] ? cbals[node] += i : cbals[node] = i;
                    bals.rn -= i;
                    const _at = _atfun(node);
                    if (i) {
                        post = post + `* ${_at}${node} awarded ${parseFloat(i / 1000).toFixed(3)} ${config.TOKEN} for ${wins} credited transaction(s)\n`;
                        console.log(num + `:@${node} awarded ${parseFloat(i / 1000).toFixed(3)} ${config.TOKEN} for ${wins} credited transaction(s)`);
                    }
                }
            }
            stats.dex_fee = parseFloat((dexfeea / dexfeed)/100).toFixed(5);
            stats.dex_max = parseFloat((dexmaxa / dexmaxd)*100).toFixed(2);
            stats.dex_slope = parseFloat((dexslopea / dexsloped)*100).toFixed(2);
            for(var node in newOwners){
                newOwners[node].g = runners[node]?.g ? runners[node].g : 0;
            }
            var up_op = accountUpdate( stats, mnode, pick(newOwners) )
            function pick(noobj){
                var top = 0
                var topwin = 0
                var tops = []
                for (var node in noobj){
                    if(noobj[node].g > top){
                        top = noobj[node].g 
                    }
                    if(noobj[node].wins > topwin){
                        topwin = noobj[node].wins
                    }
                    if(noobj[node].wins)tops.push(noobj[node].g )
                }
                tops.sort((a,b)=>{return b-a})
                var thresh = tops[parseInt(tops.length/2) - 1]
                var sorting = [], out = []
                for (var node in noobj){
                    if(noobj[node].g >= thresh && noobj[node].wins >= (topwin * 90 / 100)){
                        sorting.push({node, g: noobj[node].g})
                    }
                }
                sorting.sort((a,b)=>{return b.g - a.g})
                for (var i = 0; i < sorting.length; i++){
                    out.push(sorting[i].node)
                }
                return out
            }
            bals.rd += parseInt(t * stats.delegationRate / 10000); // 10% to delegators
            if(config.features.delegate){
                post = post + `### ${parseFloat(parseInt(bals.rd) / 1000).toFixed(3)} ${config.TOKEN} set aside for @${config.delegation} delegators\n`;
                bals.ra -= parseInt(t * stats.delegationRate / 10000);
                b = bals.rd;
                j = 0;
                console.log(num + `:${b} ${config.TOKEN} to distribute to delegators`);
                for (i in deles) { //count vests
                    j += deles[i];
                }
                for (i in deles) { //reward vests
                    k = parseInt(b * deles[i] / j);
                    cbals[i] ? cbals[i] += k : cbals[i] = k;
                    bals.rd -= k;
                    const _at = _atfun(i);
                    post = post + `* ${parseFloat(parseInt(k) / 1000).toFixed(3)} ${config.TOKEN} for ${_at}${i}'s ${parseFloat(deles[i] / 1000000).toFixed(1)} Mvests.\n`;
                    console.log(num + `:${k} ${config.TOKEN} awarded to ${i} for ${deles[i]} VESTS`);
                }
                stats[`${config.jsonTokenName}PerDel`] = parseFloat(k / j).toFixed(6);
            }
            if(config.features.ico){
                post = post + `*****\n ## ICO Status\n`;
                if (bals.ri < 100000000 && stats.tokenSupply < 100000000000) {
                    stats.icoRound++;
                    if (bals.ri == 0) {
                        stats.tokenSupply += 100000000;
                        bals.ri = 100000000;
                        var ago = num - stats.outOnBlock,
                            dil = ' seconds';
                        if (ago !== num) {
                            bals.rl = parseInt(ago / 30240 * 50000000);
                            bals.ri = 100000000 - parseInt(ago / 30240 * 50000000);
                            stats.icoPrice = stats.icoPrice * (1 + (ago / 30240) / 2);
                        }
                        if (ago > 20) {
                            dil = ' minutes';
                            ago = parseFloat(ago / 20)
                                .toFixed(1);
                        } else {
                            ago = ago * 3;
                        }
                        if (ago > 60) {
                            dil = ' hours';
                            ago = parseFloat(ago / 60)
                                .toFixed(1);
                        }
                        post = post + `### We sold out ${ago}${dil}\nThere are now ${parseFloat(bals.ri / 1000).toFixed(3)} ${config.TOKEN} for sale from @${config.mainICO} for ${parseFloat(stats.icoPrice / 1000).toFixed(3)} HIVE each.\n`;
                    } else {
                        var left = bals.ri;
                        stats.tokenSupply += 100000000 - left;
                        bals.ri = 100000000;
                        stats.icoPrice = stats.icoPrice - (left / 1000000000); //10% max decrease
                        if (stats.icoPrice < 1000)
                            stats.icoPrice = 1000;
                        post = post + `### We Sold out ${100000000 - left} today.\nThere are now ${parseFloat(bals.ri / 1000).toFixed(3)} ${config.TOKEN} for sale from @${config.mainICO} for ${parseFloat(stats.icoPrice / 1000).toFixed(3)} HIVE each.\n`;
                    }
                } else {
                    post = post + `### We have ${parseFloat(parseInt(bals.ri - 100000000) / 1000).toFixed(3)} ${config.TOKEN} left for sale at ${parseFloat(stats.icoPrice / 1000).toFixed(3)} HIVE in our Pre-ICO. Send your HIVE to @${config.mainICO} to own a piece of the community.\n`;
                }
                if (bals.rl) {
                    var dailyICODistrobution = bals.rl,
                        y = 0;
                    for (i = 0; i < ico.length; i++) {
                        for (var node in ico[i]) {
                            y += ico[i][node];
                        }
                    }
                    post = post + `### ICO Over Auction Results:\n${parseFloat(bals.rl / 1000).toFixed(3)} ${config.TOKEN} was set aside from today's ICO to divide between people who didn't get a chance at fixed price tokens and donated ${parseFloat(y / 1000).toFixed(3)} HIVE today.\n`;
                    for (i = 0; i < ico.length; i++) {
                        for (var node in ico[i]) {
                            cbals[node] ? cbals[node] += parseInt(ico[i][node] / y * bals.rl) : cbals[node] = parseInt(ico[i][node] / y * bals.rl);
                            dailyICODistrobution -= parseInt(ico[i][node] / y * bals.rl);
                            post = post + `* @${node} awarded  ${parseFloat(parseInt(ico[i][node] / y * bals.rl) / 1000).toFixed(3)} ${config.TOKEN} for ICO auction\n`;
                            console.log(num + `:${node} awarded  ${parseInt(ico[i][node] / y * bals.rl)} ${config.TOKEN} for ICO auction`);
                            if (i == ico.length - 1) {
                                cbals[node] ? cbals[node] += dailyICODistrobution : cbals[node] = dailyICODistrobution
                                post = post + `* @${node} awarded  ${parseFloat(parseInt(dailyICODistrobution) / 1000).toFixed(3)} ${config.TOKEN} for ICO auction\n`;
                                console.log(num + `:${node} given  ${dailyICODistrobution} remainder`);
                            }
                        }
                    }
                    bals.rl = 0;
                    ico = [];
                }
            }
            var vol = 0,
                volhbd = 0,
                vols = 0,
                his = [],
                hisb = [],
                hi = {},
                hib = {};
            if(config.features.dex){
                for (var int in dex.hive.his) {
                    if (dex.hive.his[int].block < num - 60480) {
                        his.push(dex.hive.his[int]);
                        daops.push({ type: 'del', path: ['dex', 'hive', 'his', int] });
                    } else {
                        vol = parseInt(parseInt(dex.hive.his[int].base_vol) + vol);
                        vols = parseInt(parseInt(dex.hive.his[int].target_vol) + vols);
                    }
                }
                for (var int in dex.hbd.his) {
                    if (dex.hbd.his[int].block < num - 60480) {
                        hisb.push(dex.hbd.his[int]);
                        daops.push({ type: 'del', path: ['dex', 'hbd', 'his', int] });
                    } else {
                        vol = parseInt(parseInt(dex.hbd.his[int].amount) + vol);
                        volhbd = parseInt(parseInt(dex.hbd.his[int].target_vol)  + volhbd);
                    }
                }
                if (his.length) {
                    hi.o = parseFloat(his[0].price); // open, close, top bottom, dlux, volumepair
                    hi.c = parseFloat(his[his.length - 1].price);
                    hi.t = 0;
                    hi.b = hi.o;
                    hi.d = 0;
                    hi.v = 0;
                    for (var int = 0; int < his.length; int++) {
                        if (hi.t < parseFloat(his[int].price)) {
                            hi.t = parseFloat(his[int].price);
                        }
                        if (hi.b > parseFloat(his[int].price)) {
                            hi.b = parseFloat(his[int].price);
                        }

                        hi.v += parseInt(his[int].target_vol);
                        hi.d += parseInt(his[int].base_vol);
                    }
                    if (!dex.hive.days)
                        dex.hive.days = {};
                    dex.hive.days[num] = hi;
                }
                if (hisb.length) {
                    hib.o = parseFloat(hisb[0].price); // open, close, top bottom, dlux, volumepair
                    hib.c = parseFloat(hisb[hisb.length - 1].price);
                    hib.t = 0;
                    hib.b = hib.o;
                    hib.v = 0;
                    hib.d = 0;
                    for (var int = 0; int < hisb.length; int++) {
                        if (hib.t < parseFloat(hisb[int].price)) {
                            hib.t = parseFloat(hisb[int].price);
                        }
                        if (hib.b > parseFloat(hisb[int].price)) {
                            hib.b = parseFloat(hisb[int].price);
                        }
                        hib.v += parseInt(hisb[int].target_vol);
                        hib.d += parseInt(hisb[int].base_vol);
                    }
                    if (!dex.hbd.days)
                        dex.hbd.days = {};
                    dex.hbd.days[num] = hib;
                }
                let liqt = parseInt((bal.rm/365)*(stats.liq_reward/100))
                if (liqt > 0){
                    let liqa = 0
                    for (var acc in dex.liq){
                        liqa += parseInt(dex.liq[acc])
                    }
                    for (var acc in dex.liq){
                        thisd = parseInt(liqt*(dex.liq[acc]/liqa))
                        if(!bal[acc])bal[acc] = 0
                        bal[acc] += thisd
                        bal.rm -= thisd
                    }
                }
                delete dex.liq
                daops.push({type: 'del', path: ['dex', 'liq']})
                post = post + `*****\n### DEX Report\n#### Prices:\n* ${parseFloat(dex.hive.tick).toFixed(3)} HIVE per ${config.TOKEN}\n* ${parseFloat(dex.hbd.tick).toFixed(3)} HBD per ${config.TOKEN}\n#### Daily Volume:\n* ${parseFloat(vol / 1000).toFixed(3)} ${config.TOKEN}\n* ${parseFloat(vols / 1000).toFixed(3)} HIVE\n* ${parseFloat(parseInt(volhbd) / 1000).toFixed(3)} HBD\n*****\n`;
            }
            stats.movingWeight.dailyPool = bals.ra
            if(config.features.pob){
                console.log('POB allocation. RC start: ', bals.rc)
                bals.rc = bals.rc + bals.ra;
                console.log('POB allocation. RC end: ', bals.rc)
            } else bals.rn = bals.rn + bals.ra
            bals.ra = 0
            var q = 0,
                r = bals.rc;
            for (var i in br) {
                q += br[i].post.totalWeight;
            }
            console.log({br})
            var contentRewards = ``,
                vo = [];
            if (Object.keys(br).length) {
                bucket = parseInt(bals.rc / 200);
                bals.rc = bals.rc - bucket;
                contentRewards = `#### Top Paid Posts\n`;
                const compa = bucket;
                for (var i in br) {
                    var dif = bucket;
                    for (var j in br[i].post.voters) {
                        bals[br[i].post.author] += parseInt((br[i].post.voters[j].weight * 2 / q * 3) * compa);
                        cbals[br[i].post.author] ? cbals[br[i].post.author] += parseInt((br[i].post.voters[j].weight * 2 / q * 3) * compa) : cbals[br[i].post.author] = parseInt((br[i].post.voters[j].weight * 2 / q * 3) * compa);
                        bucket -= parseInt((br[i].post.voters[j].weight / q * 3) * compa);
                        cbals[br[i].post.voters[j].from] ? cbals[br[i].post.voters[j].from] += parseInt((br[i].post.voters[j].weight / q * 3) * compa) : cbals[br[i].post.voters[j].from] = parseInt((br[i].post.voters[j].weight / q * 3) * compa);
                        bucket -= parseInt((br[i].post.voters[j].weight * 2 / q * 3) * compa);
                    }
                    vo.push(br[i].post);
                    cpost[i] = {
                        v: br[i].post.voters.length,
                        d: parseFloat(parseInt(dif - bucket) / 1000).toFixed(3),
                    };
                    cpost[`s/${br[i].post.author}/${br[i].post.permlink}`] = cpost[i];
                    delete cpost[i];
                    contentRewards = contentRewards + `* [${br[i].post.title || `${config.TOKEN} Content`}](https://www.${config.mainFE}/@${br[i].post.author}/${br[i].post.permlink}) by @${br[i].post.author} awarded ${parseFloat(parseInt(dif - bucket) / 1000).toFixed(3)} ${config.TOKEN}\n`;
                }
                console.log({bucket})
                bals.rc += bucket;
                contentRewards = contentRewards + `\n*****\n`;
            }
            tw = 0,
                ww = 0,
                ii = 100, //max number of votes
                hiveVotes = '';
            for (var po = 0; po < vo.length; po++) {
                tw = tw + vo[po].totalWeight;
            }
            ww = parseInt(tw / 100000);
            vo = sortBuyArray(vo, 'totalWeight');
            if (vo.length < ii)
                ii = vo.length;
            for (var oo = 0; oo < ii; oo++) {
                var weight = parseInt(ww * vo[oo].totalWeight);
                if (weight > 10000)
                    weight = 10000;
                daops.push({
                    type: 'put',
                    path: ['escrow', config.delegation, `vote:${vo[oo].author}:${vo[oo].permlink}`],
                    data: [
                        "vote", {
                            "voter": config.delegation,
                            "author": vo[oo].author,
                            "permlink": vo[oo].permlink,
                            "weight": weight
                        }
                    ]
                });
                cpost[`s/${vo[oo].author}/${vo[oo].permlink}`].b = weight;
                hiveVotes = hiveVotes + `* [${vo[oo].title || `${config.TOKEN} Content`}](https://www.${config.mainFE}/@${vo[oo].author}/${vo[oo].permlink}) by @${vo[oo].author} | ${parseFloat(weight / 100).toFixed(2)}% \n`;
            }
            const footer = `[Visit ${config.mainFE}](https://${config.mainFE})\n[Visit our DEX/Wallet](https://${config.mainFE}/dex)\n[Learn how to use ${config.TOKEN}](https://github.com/dluxio/dluxio/wiki)\n[Stop @ Mentions - HiveSigner](https://hivesigner.com/sign/custom-json?authority=posting&required_auths=0&id=${config.prefix}nomention&json=%7B%22nomention%22%3Atrue%7D)\n${config.footer}`;
            if (hiveVotes)
                hiveVotes = `#### Community Voted ${config.TOKEN} Posts\n` + hiveVotes + `*****\n`;
            post = header + contentRewards + hiveVotes + post + footer;
            var op = ["comment",
                {
                    "parent_author": "",
                    "parent_permlink": config.tag,
                    "author": config.leader,
                    "permlink": config.tag + num,
                    "title": `${config.TOKEN} DAO | Block Report ${num}`,
                    "body": post,
                    "json_metadata": JSON.stringify({
                        tags: [config.tag]
                    })
                }
            ];
            if(up_op)daops.push({ type: 'put', path: ['mso', `${num}:ac`], data: stringify(['account_update', up_op]) });
            daops.push({ type: 'put', path: ['dex'], data: dex });
            daops.push({ type: 'put', path: ['stats'], data: stats });
            daops.push({ type: 'put', path: ['balances'], data: bals });
            daops.push({ type: 'put', path: ['cbalances'], data: cbals });
            daops.push({ type: 'put', path: ['posts'], data: cpost });
            daops.push({ type: 'put', path: ['markets', 'node'], data: mnode });
            daops.push({ type: 'put', path: ['delegations'], data: deles });
            if(config.features.daily)daops.push({ type: 'put', path: ['escrow', config.leader, 'comment'], data: op });
            for (var i = daops.length - 1; i >= 0; i--) {
                if (daops[i].type == 'put' && Object.keys(daops[i].data).length == 0 && typeof daops[i].data != 'number' && typeof daops[i].data != 'string') {
                    daops.splice(i, 1);
                }
            }
            for (var bali in bals) {
                if(bals[bali] == 0 && bali.length > 2) {
                    daops.push({ type: 'del', path: ['balances', bali] });
                }
            }
            store.batch(daops, [resolve, reject, num]);
        });
    });
}

exports.dao = dao;

function Distro(){
    return new Promise ((resolve, reject)=>{
        let Pbals = getPathObj(['balances']),
        Psets = getPathObj(['sets']),
        Pdiv = getPathObj(['div'])
        Promise.all([Pbals, Psets, Pdiv]).then(mem =>{
            let ops = [],
                bals = mem[0],
                sets = mem[1],
                div = mem[2],
                out = []
            for(var acc in bals) {
                if(acc.split('n:')[1]) {
                    out = [...out, ...preadd(bals[acc], sets[acc.split(':')[1]]), [acc, - bals[acc]]]
                }
            }
            out.sort((a, b) => a[0] - b[0])
            for(var i = 0; i < out.length - 1; i++) {
                if (out[i][0] == out[i + 1][0]) {
                    out[i+1][1] = out[i][1] + out[i+1][1]
                    out.splice(i, 1)
                    i--
                }
            }
            resolve(out)
        })
    })
    function preadd (bal, set){
        if(set.ra){
            let ret = [],
                accounts = set.ra.split(',')
                out = 0
            for (var i = 0; i < accounts.length - 1; i++) {
                t = parseInt((bal*accounts[i].split('_')[1])/10000)
                out += t
                ret.push([accounts[i].split('_')[0] == 'd' ? `div:${set.n}` : accounts[i].split('_')[0], t])
            }
            ret.push([accounts[accounts.length - 1].split('_')[0] == 'd' ? `div:${set.n}` : accounts[i].split('_')[0], bal - out])
            return ret
        } else {
            return [[set.a, bal]]
        }
    }
}

exports.Distro = Distro;

function Liquidity(){
    return new Promise ((resolve, reject)=>{
        let Pmarket = getPathObj(['dex'])
        Promise.all([Pmarket]).then(mem =>{
            let m = mem[0],
                hiveh = parseFloat(m.hive.buyBook.split('_')[0]),
                hbdh = parseFloat(m.hbd.buyBook.split('_')[0]),
                awards = {}
            if(!m.liq)m.liq = {}
            for (var item in m.hive.buyOrders){
                const acc = m.hive.buyOrders[item].from
                if(!awards[acc]) awards[acc] = 0
                awards[acc] += parseInt((parseFloat(m.hive.buyOrders[item].rate)/hiveh)*m.hive.buyOrders[item].hive)
            }
            for (var item in m.hbd.buyOrders){
                const acc = m.hbd.buyOrders[item].from
                if(!awards[acc]) awards[acc] = 0
                awards[acc] += parseInt((parseFloat(m.hbd.buyOrders[item].rate)/hbdh)*m.hbd.buyOrders[item].hbd)
            }
            for(var acc in awards) {
                if(!m.liq[acc])m.liq[acc] = 0
                m.liq[acc] += awards[acc]
            }
            if(Object.keys(m.liq).length)store.batch([{type: 'put', path: ['dex', 'liq'], data: m.liq}],[resolve, reject, 'liq_compound'])
            else resolve('no liq')
        })
    })
}
exports.Liquidity = Liquidity;

function accountUpdate(stats, nodes, arr){
    //get runners by gov balance
    //find highest three that also have a public key
    for (var i = 0; i < arr.length; i++) {
        if(!nodes[arr[i]].mskey){
        arr.splice(i, 1)
        i--
        }
    }
    var differrent = false
    var same = true
    var current = 0
    Object.keys(stats.ms.active_account_auths).forEach(function(key) {
        if(arr.indexOf(key) == -1) {
            same = false
            current++
        }
    })
    for (var i = 0; i < arr.length; i++) {
        if(stats.ms.active_account_auths[arr[i]] != 1)differrent = true
    }
    if((same && current >= 3) || !differrent || arr.length < 2)return
    if(arr.length > 3)arr = [arr[0], arr[1], arr[2]]
    var updateOp = {
    "account": config.msaccount,
    "active": {
      "weight_threshold": parseInt(arr.length/2 + 1),
      "account_auths": [],
      "key_auths": []
    },
    "owner": {
      "weight_threshold": parseInt(arr.length/2 + 1),
      "account_auths": [],
      "key_auths": []
    },
    "posting": {
      "weight_threshold": 1,
      "account_auths": [[config.leader, 1]],
      "key_auths": []
    },
    "memo_key": config.msPubMemo,
    "json_metadata": stringify(config.msmeta)
  }
  for (var i = 0; i < arr.length; i++) {
    updateOp.active.account_auths.push([arr[i], 1])
    updateOp.owner.key_auths.push([nodes[arr[i]].mskey, 1])
  }
  return updateOp
}
