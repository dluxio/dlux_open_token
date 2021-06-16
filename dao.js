const config = require('./config');
const { getPathNum } = require("./getPathNum");
const { getPathObj } = require("./getPathObj");
const { store } = require("./index");
const { isEmpty } = require('./lil_ops')
const { sortBuyArray } = require('./helpers')

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
                    Ppaid = getPathObj(['paid']);
                Promise.all([Pnews, Pbals, Prunners, Pnodes, Pstats, Pdelegations, Pico, Pdex, Pbr, Ppbal, Pnomen, Pposts, Pfeed, Ppaid]).then(function(v) {
                            daops.push({ type: 'del', path: ['postQueue'] });
                            daops.push({ type: 'del', path: ['br'] });
                            daops.push({ type: 'del', path: ['rolling'] });
                            daops.push({ type: 'del', path: ['ico'] });
                            news = v[0] + '*****\n';
                            const header = post + news;
                            var bals = v[1],
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
                                paidCleaner = v[12]
                            feedKeys = Object.keys(feedCleaner);
                            paidKeys = Object.keys(paidCleaner);
                            for (feedi = 0; feedi < feedKeys.length; feedi++) {
                                if (feedKeys[feedi].split(':')[0] < num - 30240) {
                                    daops.push({ type: 'del', path: ['feed', feedKeys[feedi]] });
                                }
                            }
                            for (paidi = 0; paidi < paidKeys.length; paidi++) {
                                console.log(paidKeys[paidi])
                                if (parseInt(paidKeys[paidi]) < num - 30240) {
                                    console.log(paidKeys[paidi])
                                    daops.push({ type: 'del', path: ['paid', paidKeys[paidi]] });
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
                            post = `![${config.TOKEN} Advert](https://camo.githubusercontent.com/954558e3ca2d68e0034cae13663d9807dcce3fcf/68747470733a2f2f697066732e627573792e6f72672f697066732f516d64354b78395548366a666e5a6748724a583339744172474e6b514253376359465032357a3467467132576f50)\n#### Daily Accounting\n`;
                            post = post + `Total Supply: ${parseFloat(parseInt(stats.tokenSupply) / 1000).toFixed(3)} ${config.TOKEN}\n* ${parseFloat(parseInt(stats.tokenSupply - powBal - (bals.ra + bals.rb + bals.rc + bals.rd + bals.re + bals.ri + bals.rr + bals.rn + bals.rm)) / 1000).toFixed(3)} ${config.TOKEN} liquid\n`;
                            post = post + `* ${parseFloat(parseInt(powBal) / 1000).toFixed(3)} ${config.TOKEN} Powered up for Voting\n`;
                            post = post + `* ${parseFloat(parseInt(bals.ra + bals.rb + bals.rc + bals.rd + bals.re + bals.ri + bals.rr + bals.rn + bals.rm) / 1000).toFixed(3)} ${config.TOKEN} in distribution accounts\n`;
                            post = post + `${parseFloat(parseInt(t) / 1000).toFixed(3)} ${config.TOKEN} has been generated today. 5% APY.\n${parseFloat(stats.marketingRate / 10000).toFixed(4)} is the marketing rate.\n${parseFloat(stats.nodeRate / 10000).toFixed(4)} is the node rate.\n`;
                            console.log(`DAO Accounting In Progress:\n${t} has been generated today\n${stats.marketingRate} is the marketing rate.\n${stats.nodeRate} is the node rate.`);
                            bals.rn += parseInt(t * parseInt(stats.nodeRate) / 10000);
                            bals.ra = parseInt(bals.ra) - parseInt(t * parseInt(stats.nodeRate) / 10000);
                            bals.rm += parseInt(t * stats.marketingRate / 10000);
                            post = post + `${parseFloat(parseInt(t * stats.marketingRate / 10000) / 1000).toFixed(3)} ${config.TOKEN} moved to Marketing Allocation.\n`;
                            if (bals.rm > 1000000000) {
                                bals.rc += bals.rm - 1000000000;
                                post = post + `${parseFloat((bals.rm - 1000000000) / 1000).toFixed(3)} moved from Marketing Allocation to Content Allocation due to Marketing Holdings Cap of 1,000,000.000 ${config.TOKEN}\n`;
                                bals.rm = 1000000000;
                            }
                            bals.ra = parseInt(bals.ra) - parseInt(t * stats.marketingRate / 10000);

                            i = 0, j = 0;
                            post = post + `${parseFloat(parseInt(bals.rm) / 1000).toFixed(3)} ${config.TOKEN} is in the Marketing Allocation.\n##### Node Rewards for Elected Reports and Escrow Transfers\n`;
                            console.log(num + `:${bals.rm} is availible in the marketing account\n${bals.rn} ${config.TOKEN} set asside to distribute to nodes`);
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
                            for (var node in mnode) { //and pay them
                                i = parseInt(mnode[node].wins / j * b);
                                if (bals[node]) {
                                    bals[node] += i;
                                } else {
                                    bals[node] = i;
                                }
                                bals.rn -= i;
                                const _at = _atfun(node);
                                if (i) {
                                    post = post + `* ${_at}${node} awarded ${parseFloat(i / 1000).toFixed(3)} ${config.TOKEN} for ${mnode[node].wins} credited transaction(s)\n`;
                                    console.log(num + `:@${node} awarded ${parseFloat(i / 1000).toFixed(3)} ${config.TOKEN} for ${mnode[node].wins} credited transaction(s)`);
                                }
                                mnode[node].wins = 0;
                            }
                            bals.rd += parseInt(t * stats.delegationRate / 10000); // 10% to delegators
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
                                if (bals[i] === undefined) {
                                    bals[i] = 0;
                                }
                                bals[i] += k;
                                bals.rd -= k;
                                const _at = _atfun(i);
                                post = post + `* ${parseFloat(parseInt(k) / 1000).toFixed(3)} ${config.TOKEN} for ${_at}${i}'s ${parseFloat(deles[i] / 1000000).toFixed(1)} Mvests.\n`;
                                console.log(num + `:${k} ${config.TOKEN} awarded to ${i} for ${deles[i]} VESTS`);
                            }
                            stats.dluxPerDel = parseFloat(k / j).toFixed(6);
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
                                        if (!bals[node]) {
                                            bals[node] = 0;
                                        }
                                        bals[node] += parseInt(ico[i][node] / y * bals.rl);
                                        dailyICODistrobution -= parseInt(ico[i][node] / y * bals.rl);
                                        post = post + `* @${node} awarded  ${parseFloat(parseInt(ico[i][node] / y * bals.rl) / 1000).toFixed(3)} ${config.TOKEN} for ICO auction\n`;
                                        console.log(num + `:${node} awarded  ${parseInt(ico[i][node] / y * bals.rl)} ${config.TOKEN} for ICO auction`);
                                        if (i == ico.length - 1) {
                                            bals[node] += dailyICODistrobution;
                                            post = post + `* @${node} awarded  ${parseFloat(parseInt(dailyICODistrobution) / 1000).toFixed(3)} ${config.TOKEN} for ICO auction\n`;
                                            console.log(num + `:${node} given  ${dailyICODistrobution} remainder`);
                                        }
                                    }
                                }
                                bals.rl = 0;
                                ico = [];
                            }
                            var vol = 0,
                                volhbd = 0,
                                vols = 0,
                                his = [],
                                hisb = [],
                                hi = {},
                                hib = {};
                            for (var int in dex.hive.his) {
                                if (dex.hive.his[int].block < num - 30240) {
                                    his.push(dex.hive.his[int]);
                                    daops.push({ type: 'del', path: ['dex', 'hive', 'his', int] });
                                } else {
                                    vol = parseInt(parseInt(dex.hive.his[int].amount) + vol);
                                    vols = parseInt(parseInt(parseInt(dex.hive.his[int].amount) * parseFloat(dex.hive.his[int].rate)) + vols);
                                }
                            }
                            for (var int in dex.hbd.his) {
                                if (dex.hbd.his[int].block < num - 30240) {
                                    hisb.push(dex.hbd.his[int]);
                                    daops.push({ type: 'del', path: ['dex', 'hbd', 'his', int] });
                                } else {
                                    vol = parseInt(parseInt(dex.hbd.his[int].amount) + vol);
                                    volhbd = parseInt(parseInt(parseInt(dex.hbd.his[int].amount) * parseFloat(dex.hbd.his[int].rate)) + volhbd);
                                }
                            }
                            if (his.length) {
                                hi.o = parseFloat(his[0].rate); // open, close, top bottom, dlux, volumepair
                                hi.c = parseFloat(his[his.length - 1].rate);
                                hi.t = 0;
                                hi.b = hi.o;
                                hi.d = 0;
                                hi.v = 0;
                                for (var int = 0; int < his.length; int++) {
                                    if (hi.t < parseFloat(his[int].rate)) {
                                        hi.t = parseFloat(his[int].rate);
                                    }
                                    if (hi.b > parseFloat(his[int].rate)) {
                                        hi.b = parseFloat(his[int].rate);
                                    }

                                    hi.v += parseInt(parseInt(his[int].amount) * parseInt(his[int].rate));
                                    hi.d += parseInt(his[int].amount);
                                }
                                if (!dex.hive.days)
                                    dex.hive.days = {};
                                dex.hive.days[num] = hi;
                            }
                            if (hisb.length) {
                                hib.o = parseFloat(hisb[0].rate); // open, close, top bottom, dlux, volumepair
                                hib.c = parseFloat(hisb[hisb.length - 1].rate);
                                hib.t = 0;
                                hib.b = hib.o;
                                hib.v = 0;
                                hib.d = 0;
                                for (var int = 0; int < hisb.length; int++) {
                                    if (hib.t < parseFloat(hisb[int].rate)) {
                                        hib.t = parseFloat(hisb[int].rate);
                                    }
                                    if (hib.b > parseFloat(hisb[int].rate)) {
                                        hib.b = parseFloat(hisb[int].rate);
                                    }
                                    hib.v += parseInt(parseInt(hisb[int].amount) * parseInt(hisb[int].rate));
                                    hib.d += parseInt(hisb[int].amount);
                                }
                                if (!dex.hbd.days)
                                    dex.hbd.days = {};
                                dex.hbd.days[num] = hib;
                            }
                            console.log(stats);
                            post = post + `*****\n### DEX Report\n#### Volume Weighted Prices:\n* ${parseFloat(stats.HiveVWMA.rate).toFixed(3)} HIVE per ${config.TOKEN}\n* ${parseFloat(stats.HbdVWMA.rate).toFixed(3)} HBD per ${config.TOKEN}\n#### Daily Volume:\n* ${parseFloat(vol / 1000).toFixed(3)} ${config.TOKEN}\n* ${parseFloat(vols / 1000).toFixed(3)} HIVE\n* ${parseFloat(parseInt(volhbd) / 1000).toFixed(3)} HBD\n*****\n`;
                            stats.movingWeight.dailyPool = bals.ra
                            bals.rc = bals.rc + bals.ra;
                            bals.ra = 0;
                            var q = 0,
                                r = bals.rc;
                            for (var i in br) {
                                q += br[i].post.totalWeight;
                            }
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
                                        bucket -= parseInt((br[i].post.voters[j].weight / q * 3) * compa);
                                        bals[br[i].post.voters[j].from] += parseInt((br[i].post.voters[j].weight / q * 3) * compa);
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
            const footer = `[Visit ${config.mainFE}](https://www.${config.mainFE})\n[Visit our DEX/Wallet](https://www.${config.mainFE}/dex)\n[Learn how to use ${config.TOKEN}](https://github.com/dluxio/dluxio/wiki)\n[Stop @ Mentions - HiveSigner](https://hivesigner.com/sign/custom-json?authority=posting&required_auths=0&id=${config.prefix}nomention&json=%7B%22nomention%22%3Atrue%7D)\n${config.footer}`;
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
            console.log(op);
            daops.push({ type: 'put', path: ['dex'], data: dex });
            daops.push({ type: 'put', path: ['stats'], data: stats });
            daops.push({ type: 'put', path: ['balances'], data: bals });
            daops.push({ type: 'put', path: ['posts'], data: cpost });
            daops.push({ type: 'put', path: ['markets', 'node'], data: mnode });
            daops.push({ type: 'put', path: ['delegations'], data: deles });
            daops.push({ type: 'put', path: ['escrow', config.leader, 'comment'], data: op });
            for (var i = daops.length - 1; i >= 0; i--) {
                if (daops[i].type == 'put' && Object.keys(daops[i].data).length == 0 && typeof daops[i].data != 'number' && typeof daops[i].data != 'string') {
                    daops.splice(i, 1);
                }
            }
            store.batch(daops, [resolve, reject]);
        });
    });
}

exports.dao = dao;