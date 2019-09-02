const steem = require('dsteem');
const steemjs = require('steem');
const steemState = require('./processor');
const IPFS = require('ipfs-api'); //consensus and auto restarts
const ipfs = new IPFS({ //public gateway for uploads and downloads
    host: 'ipfs.infura.io',
    port: 5001,
    protocol: 'https'
});
const express = require('express')
const cors = require('cors')
const config = require('./config');
const VERSION = 'v0.0.1wip'
const api = express()
var http = require('http').Server(api);
const wif = steemClient.auth.toWif(config.username, config.activeKey, 'active')
const prefix = 'ACTDAO_';  //custom json prefix
const multiname = 'dac.escrow'; //claimed multisig account
const streamMode = args.mode || 'irreversible';
console.log("Streaming using mode", streamMode);
var client = new steem.Client(config.clientURL);
var processor;

//force https for heroku
var https_redirect = function(req, res, next) {
    if (process.env.NODE_ENV === 'production') {
        if (req.headers['x-forwarded-proto'] != 'https') {
            return res.redirect('https://' + req.headers.host + req.url);
        } else {
            return next();
        }
    } else {
        return next();
    }
};
api.use(https_redirect);
api.use(cors())

//state dump while building...
api.get('/', (req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(state, null, 3))
});
//api.listen(port, () => console.log(`DLUX token API listening on port ${port}!\nAvailible commands:\n/@username =>Balance\n/stats\n/markets`))
http.listen(config.port, function() {
    console.log(`ACT API listening on port ${config.port}`);
});

//node actions out of consensus
var plasma = {
  agents:{},//polling consolidation
  bot: {},
  mss: {},
  stats:{
    bu: 0,
    bi: 0,
    bl: []    
  },
  run: false
}

// constructor for agents
class Agent {
  constructor(account, domain, low, rrate, num) {
    this.a = account;
    this.d = domain; //api
    this.l = low; // lowest price accepted
    this.r = rrate; //release rate of inventory
    this.i = 0; //inventory -> populated by calls
    this.ir = 0; //inventory redeemed
    this.j = 0; //jsons sent for verification
    this.p = '' //Public Active Key
    this.h = 0; //last hash reported
    this.g = 0; //good standing
    this.hb = 0; //last block reported - online indicator
    this.bot = {}; //transactions expected
    this.x = {}; //negatives/automated flags
    this.pi = {}; //place for polling inventory
    this.pp = {}; //place for polling public key
    this.o = 0 //owner flag
    this.est = num //joined dac date
  }
}


var recents = []
//auto starts ... polls recent ipfs posted from node account
steemjs.api.getAccountHistory(config.username, -1, 100, function(err, result) {
  if (err){
    console.log(err)
    startWith(sh)
  } else {
    let ebus = result.filter( tx => tx[1].op[1].id === 'ACTDAO_report' )
    for(i=ebus.length -1;i>=0;i--){
      if(JSON.parse(ebus[i][1].op[1].json).stateHash !== null)var recents.push(JSON.parse(ebus[i][1].op[1].json).stateHash)
    }
    if(recents.length){ //build a list to pull from IPFS starting with most recent
        const mostRecent = recents.shift()
        console.log('Most recent backup: ' + mostRecent)
        startWith(mostRecent, recents)
    } else {
        startWith(config.ec)
    }
  }
});


function startWith(hash, recents) {
    var arr = recents || []
    updateBlacklist() //out of consensus
    if (hash) {
        console.log(`Attempting to start from IPFS save state ${hash}`);
        ipfs.cat(hash, (err, file) => {
            if (!err) {
                var data = JSON.parse(file.toString()) //build some intial condistions for blockstreaming
                plasma.stats.bi = data[0]
                plasma.stats.bu = hash
                state = data[1]
                startApp();
            } else { //fall through
                if(arr.length){const notRecent = arr.shift()}
                console.log('Retrival failed, trying: ' + notRecent)
                if(notRecent && arr.length){
                    startWith(notRecent, arr)
                } else if(notRecent) {
                    startWith(notRecent)
                } else {
                    startWith()
                }
            }
        });
    } else { //initial conditions
        state = {
          accounts: {},
          agents: {},
          bot: [],
          contracts:{},
          feed: {},
          market:{
            aq:[],
            dq:[],
          },
          queue: [],
          stats: {
            bu: sh,
            bi: 36010000,
            auths: 1,
            thresh: 1,
            inv:[
              {i:0,p:1200}
            ],
            di: [
              {p:400,i:0}
            ], //delegation inventory
            auth: {}, //accounts holding authority
            msi: {},
            msp: {},
            sigs: []
          },
          tx: {},
        }
        plasma.stats.bi = 36010000
        startApp()
    }
}


function startApp() {
    processor = steemState(client, steem, plasma.stats.bi, 10, prefix, streamMode); 


    processor.onOperation('create_claimed_account', function(json) {
      //see if need to pay
      //adjust inventories
    });
    
    processor.onOperation('claim_account', function(json) {
      if (state.agents[json.creator] != null){ //adjust inventories
        state.agents[json.creator].i++
        console.log(`${json.creator} claimed an ACT`)
      }
    });

    processor.onOperation('delegate_vesting_shares', function(json) {
       // delegation for profit sharing?
       // delegation for claims schedule payouts
       // see if need to cancel schedule payment
    });

    processor.on('node_add', function(json, from, active) { //auto joining the DAC
        if (active){
            var low = json.low, rrate = json.rrate
            if(parseInt(low) > 3000){low = 3000}
            else if(parseInt(low) <= 3000){}
            else {low = 0}
            if(parseInt(rrate) > 2000){rrate = 2000}
            else if(parseInt(rrate) >= 0){}
            else {rrate = 0}
            state.agents[from] = new Agent(from, json.domain, low, rrate, json.block_num)
            getAccounts([from],'init')
        }
    });

    processor.on('node_update', function(json, from, active) { //update prices
        if (active && state.agents[json.from] != null) {
            var low = json.low, rrate = json.rrate
            if(parseInt(low) > 3000){low = 3000}
            else if(parseInt(low) <= 3000){}
            else {low = 0}
            state.agents[json.from].l = low
            if(parseInt(rrate) > 2000){rrate = 2000}
            else if(parseInt(rrate) >= 0){}
            else {rrate = 0}
            state.agents[json.from].r = rrate
            state.agents[json.from].d = json.domain
        }
    });

    processor.on('report', function(json, from, active) {
        if (active){
          state.agents[from].h = json.stateHash
          state.agents[from].hb = json.block_num
          if(json.polls.length){
            for(i=0;i<json.polls.length;i++){
              state.agents[json.polls[i].split(':')[0]].pi[from] = json.polls[i].split(':')[1]//invtory of ACT
              state.agents[json.polls[i].split(':')[0]].pp[from] = json.polls[i].split(':')[2]//Pubic Active Key
            }
          }
          if (state.stats.auth[from] != null){
            state.stats.msp[from] = json.msi
          }
        }
    });

    processor.on('multisig', function(json, from, active) { //delete last q
        if (active && from == multiname){
          state.tx = []
        }
    });

    processor.onOperation('account_update', function(json) {
      //if dao update weights and auth accounts
      state.stats.auths = {}
      for (i=0;i<json.owners.length;i++){ //json
        state.stats.auth[json.owner.key_auths[i][0]] = 1
        
      }
      //if agent 
      //result[i].active.key_auths[0][0
    });
       
    processor.onOperation('transfer', function(json) {
      if(json.to == multiname){
        //buying accounts
        var const = JSON.parse(json.memo)
        var errortext = 'Incorrect price.', creator, delegator
        if((parseInt(parseFloat(json.amount)*1000) == state.stats.inv[0].p || parseInt(parseFloat(json.amount)*1000) == state.stats.inv[1].p)&& json.amount.split(' ')[1] == 'STEEM'){
          errortext = ''
        }
        if(state.market.aq.length){
          creator = state.market.aq.shift()
        } else {
          errorText = 'There are no more account availible. Try again later.'
        }
        if(state.market.dq.length){
          delegator = state.market.dq.shift()
        } else {
          errorText = 'There are no more account availible. Try again later.'
        }
        if (!looksRight(info.o) && !looksRight(info.p) && !looksRight(info.a) && !looksRight(info.m)){
          errortext = 'Public keys invalid'
        }
        if (info.req == 'now' && !errortext){
          const buildAccountOp = [
                "create_claimed_account",
                {
                  "creator": creator,
                  "new_account_name": info.n,
                  "owner": {
                    "weight_threshold": 1,
                    "account_auths": [],
                    "key_auths": [
                      [
                        info.o,
                        1
                      ]
                    ]
                  },
                  "active": {
                    "weight_threshold": 1,
                    "account_auths": [],
                    "key_auths": [
                      [
                        info.a,
                        1
                      ]
                    ]
                  },
                  "posting": {
                    "weight_threshold": 1,
                    "account_auths": [],
                    "key_auths": [
                      [
                        info.p,
                        1
                      ]
                    ]
                  },
                  "memo_key": info.m,
                  "json_metadata": JSON.stringify({for:json.from,cost:json.amount})
                }
              ]
              if (state.agents[creator].bot[json.block_num + 20] == null){
                state.agents[creator].bot[json.block_num + 20] = [buildAccountOp]
              } else {
                state.agents[creator].bot[json.block_num + 20].push(buildAccountOp)
              }
              const delOp = [
                  "delegate_vesting_shares",
                  {
                    "delegator": delegator,
                    "delegatee": info.n,
                    "vesting_shares": {
                      "amount": "30000000",//this right?
                      "precision": 6,
                      "nai": "@@000000037"
                    }
                  }
                ]
              if (state.agents[delegator].bot[json.block_num + 30] == null){
                state.agents[delegator].bot[json.block_num + 30] = [delOp]
              } else {
                state.agents[delegator].bot[json.block_num + 30].push(delOp)
              }
              const actOpPay = [
                  "transfer",
                  {
                    "to": creator,
                    "from": multiname,
                    "amount": parseFloat(parseFloat(json.amount) - 0.295) + ' STEEM',
                    "memo": `Thank you for creating @${info.n}`
                  }
                ]
              const delOpPay = [
                  "transfer",
                  {
                    "to": delegator,
                    "from": multiname,
                    "amount": '0.295 STEEM',
                    "memo": `Thank you for creating @${info.n}`
                  }
                ] 
              state.feed[`${json.block_num}:${json.transaction_id}`] = `@${json.from} paid ${json.amount} to create @${info.n}. @${creator}/@${delegator} responsible.`
          } else {
            const refundOp = [
                "transfer",
                {
                  "to": json.from,
                  "from": json.to,
                  "amount": json.amount,
                  "memo": `The was an error is creating your new account:${errortext}`
                }
              ]
              state.bot.push(refundOp)
              state.feed[`${json.block_num}:${json.transaction_id}`] = `@${json.from} is being refunded.`
          }
          state.bot.push(refundOp)
        //buying account tokens
      } else if (json.from == multiname){
        //verify payments
      }
      
    });

    processor.onBlock(function(num, block) {

        })
        if (num % 100 === 0 && !processor.isStreaming()) {
          plasma.agents = {}
        }
        if (num % 28800 === 0) { //time for daily magic
            dao(num)
        }
        if (num % 100 === 0 && processor.isStreaming()) {
          plasma.agents = {}
          plasma.run = true
        }
        if (num % 100 === 0) {
            tally(processor.isStreaming());
        }
        if (num % 100 === 1 && processor.isStreaming()) {
            const blockState = Buffer.from(JSON.stringify([num, state]))
            ipfsSaveState(num, blockState)
        }


    processor.onStreamingStart(function() {

    });

    processor.start();
}

function exit(consensus) { //restart after failing consensus
    console.log(`Restarting with ${consensus}...`);
    processor.stop(function() {
      plasma = {
        agents:{},//polling consolidation
        bot: {},
        mss: {},
        stats:{
          bu: 0,
          bi: 0,
          bl: []    
        },
        run: false
      }
        startWith(consensus)
    });
}

function getAccounts(arr, reason){ //polling for ACT inv and Active Public Key
  try{
    if(arr.length && reason == 'init'){
      steemjs.api.getAccounts(arr, function(err, result) {
        for(i=0;i<result.length;i++){
          plasma.agents[result[i].name] = {i:result[i].pending_claimed_accounts,p:result[i].active.key_auths[0][0]} //not gonna find multi keys
          
        }
      })
    }  
  } catch(e){console.log(e)}
}

function dac(num) { //daily ownership by numbers of ACTs held
  updateBlacklist()
  var ok = Object.keys(state.feed) //clean the feed
  for(i=0;i<ok.length;i++){
    if(parseInt(ok[i].split(':')[0]) < parseInt(txid.split(':')[0]) - 86400){
      delete state.feed[ok[i]]
    }
  }
  var elect = [], spots = 1
  var candidates = Object.keys(state.agents) //election time
  var auths - Object.keys(state.stats.auth) //whos a signer
  for (i=0;i<auths.length;i++){
    candidates.splice(candidates.indexOf(auths[i],1,0)) //remove signers from candidacy
  }
  var bad = []
  for (i=0;i<auths.length;i++){
    if (!state.agents[auths[i]].g)bad.push(auths[i]) //start with signers in bad standing
  }
  var lowest = [0,''] //maybe set a minimum
  var highest = [999999999,'']
  function next(){
    for (i=0;i<auths.length;i++){
      if(state.agents[auths[i]].i > lowest[0]){lowest = [state.agents[auths[i]].i,auths[i]]}
    }
    for (i=0;i<candidates.length;i++){
      if(state.agents[candidates[i]].i < highest[0]){highest = [state.agents[candidates[i]].i,candidates[i]]}
    }
  }
  if(bad.length){
    spots = bad.length
    for (i=0;i<bad.length;i++){
      auths.splice(auths.indexOf(bad[i],1,0)) //remove bad auths from group
    }
  } //elect by ACTs held ... 1 promotion per day.
  for(i=0;i<spots;i++){
    next()
    elect.push(highest[1])
    candidates.splice(candidates.indexOf(highest[1],1,0))
  }
  if(auths.length < 11){
    updateAccount(auths,elect)
  } else if(lowest[0] < highest[0]){
    updateAccount(auths,elect)
  }
}

function tally(num, streaming) { //consensus determining
  var pagents = Object.keys(state.stats.auths), freeze = true, agents = []
  for(i=0;i<pagents.length;i++){
    if(state.agents[pagents[i]].hb == num - 99){
      agents.push(pagents[i])
    }
    if(state.agents[pagents[i]].est > num - 199){
      if(state.agents[pagents[i]].est > num - 99){
        //wait
      } else {
        var pollKeys = Object.keys(state.agents[pagents[i]].pi)
        var pollKeysP = Object.keys(state.agents[pagents[i]].pp)
        var pr = {}, pc = 0
        var prp = {}, ppc = 0
        for(j=0;j<pollKeys.length;j++){
          pc++
          if(pr[state.agents[pagents[i]].pi[pollKeys[j]]] == null) {
            pr[state.agents[pagents[i]].pi[pollKeys[j]]] = 1
          } else {
            pr[state.agents[pagents[i]].pi[pollKeys[j]]]++
          }
        }
        for(j=0;j<pollKeys.length;j++){
          ppc++
          if(prp[state.agents[pagents[i]].pp[pollKeysP[j]]] == null) {
            prp[state.agents[pagents[i]].pp[pollKeysP[j]]] = 1
          } else {
            prp[state.agents[pagents[i]].pp[pollKeysP[j]]]++
          }
        }
        var pa = Object.keys(pr)
        for (j=0;j<pa.length;j++){
          if(pr[pa] >2*pc/3){
            state.agents[pagents[i]].i = pr[pa]
            state.agents[pagents[i]].g = 1
          }
        }
        var pap = Object.keys(prp)
        for (j=0;j<pap.length;j++){
          if(prp[pap] >2*pc/3){
            state.agents[pagents[i]].p = pr[pa]
          }
        }
      }
    }
  }
  var hashes = {}
  var count = 0
  for (i=0;i<agents.length;i++){
    if(hashes[state.agents[agents[i]].h] == null){
      hashes[state.agents[agents[i]].h] = 1
      count++
    } else {
      hashes[state.agents[agents[i]].h]++
      count++
    }
  }
  var candidates = Object.keys(hashes)
  for (i=0;i<candidates.length;i++){
    var gold = ''
    if(hashes[candidates[i]] >= count*2/3){
      freeze = false
      gold = candidates[i]
      var u = Object.keys(state.agents)
      for (j=0;j<u.length;j++){
        if(state.agents[u[j]].h == gold){
          state.agents[u[j]].j++
          if (state.agents[u[j]].x.sync_error){
            delete state.agents[u[j]].x.sync_error
          }
        } else {
          state.agents[u[j]].x.sync_error = true
        }
      }
      if (streaming && plasma.stats.bu != gold){
        exit(gold)
      }
      break;
    }
  }
  //sign ops here
  var botOpKeys = Object.keys(state.bot), ops = []
  if(state.stats.auth[config.username] != null && botOpKeys.length){
    for(i=0;i<botOpKeys.length;i++){
      ops.push(state.bot[botOpKeys[i]].op)
    }
    ops.push([
      "custom_json",
      {
        "required_auths": [multiname],
        "required_posting_auths": [],
        "id": prefix + "multisig",
        "json": ops.length + 1
      }
    ])
    var tx ={
      state.stats.msi.exp,
      [],
      ops,
      state.stats.msi.rbn,
      state.stats.msi.rbp
    }
    var stx = client.broadcast.sign(tx, steem.PrivateKey.from(config.activeKey))
    plasma.sig = stx.signatures[0]
    stx.signatures = []
    state.tx = stx
  }
  //chose next op headers here
  var msps = Object.keys(state.stats.msp)//stats.msp to msi
  var mscounts = {}
  for (i=0;i<msps.length;i++){  //what the auths think the next multisig information aught to be
    if(mscounts.rbn[state.stats.msp[msps[i]].rbn] == null){
      mscounts.rbn[state.stats.msp[msps[i]].rbn] = {c:1,rbp:state.stats.msp[msps[i]].rbp,rbn:state.stats.msp[msps[i]].rbn}
    } else {
      mscounts.rbn[state.stats.msp[msps[i]].rbn].c++
    }
    if(mscounts.exp[state.stats.msp[msps[i]].exp] == null){
      mscounts.exp[state.stats.msp[msps[i]].exp] = {c:1,exp:state.stats.msp[msps[i]].exp}
    } else {
      mscounts.exp[state.stats.msp[msps[i]].exp].c++
    }
  }
  var theChosenExp = [0,{}],theChosenBn = [0,{}], pE = Object.keys(mscounts.exp), pB = Object.keys(mscounts.rbn)
  for (i=0;i<pE.length;i++){
    if(mscounts.exp[pE[i]].c > theChosenExp[0]){
      theChosenExp = [mscounts.exp[pE[i]].c,mscounts.exp[pE[i]]]
    }
  }
  for (i=0;i<pB.length;i++){
    if(mscounts.rbn[pB[i]].c > theChosenBn[0]){
      theChosenBn = [mscounts.rbn[pB[i]].c,mscounts.rbn[pB[i]]]
    }
  }
  state.stats.msp = {}
  state.stats.msi ={
    rbn: theChosenBn[1].rbn,
    rbp: theChosenBn[1].rbp,
    exp: theChosenExp[1].exp
  }
}

function updateAccount(cur,ele){ //build account update transaction and determin weights 
  
}

function updateBlacklist(){
    fetch(`${config.bl}`)
            .then(function(response) {
                return response.json();
            })
            .then(function(text) {
                var arr = text.split('\n')
                plasma.blacklist = arr
                ipfs.add(Buffer.from(text, 'ascii'), (err, IpFsHash) => {
                    if (!err) {
                        plasma.stats.bl = IpFsHash[0].hash
                    } else {
                        console.log('IPFS Error', err)
                    }
                })
            })
            .catch(function(e){
                console.log(e)
            })
}

//see if public keys look good
function looksRight(pub){
  if(typeof pub == 'string' && pub.length == 53 && pub.splice(0,3) == 'STM'){return true}
  else {return false}
}

//poll for time and blockheader and prefix to build deterministic txs for multisig
function ipfsSaveState(blocknum, hashable) {
    ipfs.add(Buffer.from(JSON.stringify([blocknum, hashable]), 'ascii'), (err, IpFsHash) => {
        if (!err) {
            plasma.stats.bu = IpFsHash[0].hash
            plasma.stats.bi = blocknum
            var poll = []
            var pollKeys = Object.keys(plasma.agents)
            if(pollKeys.length){
              for(i=0;i<pollKeys.length;i++){
                poll.push(`${pollKeys[i]}:${plasma.agents[pollKeys[i]].i}:${plasma.agents[pollKeys[i]].p}`)
              }
            }
            plasma.agents = {}
            var msi = {}
            console.log(blocknum + `:Saved:  ${IpFsHash[0].hash}`)
            client.database.getDynamicGlobalProperties()
                .then(function(result) {
                  msi.rbn = result.head_block_number & 0xFFFF;
                  msi.rbp = Buffer.from(result.head_block_id, 'hex').readUInt32LE(4);
                  msi.exp = new Date(Date.now() + 540000).toISOString().slice(0, -7); //9 minutes
                  msi.exp = msi.exp + '00'
                  if(Object.keys(plasma.bot).indexOf(`${parseInt(blocknum + 2)}`) >= 0){
                    plasma.bot[parseInt(blocknum + 2)].push(['customJson', 'con_bu', {
                      stateHash: plasma.stats.bu,
                      block: blocknum,
                      blackHash: plasma.stats.bl,
                      polls: poll,
                      msi: msi,
                      sig: plasma.sig
                    }])
                  } else {
                    plasma.bot[parseInt(blocknum + 2)] = [['customJson', 'con_bu', {
                      stateHash: plasma.stats.bu,
                      block: blocknum,
                      blackHash: plasma.stats.bl,
                      polls: poll,
                      msi: msi,
                      sig: plasma.sig
                    }]]
                  }
                  delete plasma.sig
                });
        } else {
            console.log('IPFS Error', err)
        }
    })
};


var bot = {
    customJson: function(id, json, callback) {
        if(json.block > processor.getCurrentBlockNumber() - 100){
        steemjs.broadcast.json({
            required_auths: [username],
            required_posting_auths: [],
            id: prefix + id,
            json: JSON.stringify(json),
        }, wif).then(
            result => {
                console.log('Signed ${json}')
                delete plasma.bot[parseInt(json.block + 2)]
            },
            error => {
                console.log('Error sending customJson')
            }
        )}
    },
    sign: function(op, callback) {
        client.broadcast.sendOperations(op, wif).then(
            function(result) {
              console.log('signed')
            },
            function(error) {
                console.log(error)
            }
        );
    },
    send: function(op, callback) { //multis
        client.broadcast.send(op).then(
            function(result) {
              console.log('signed')
            },
            function(error) {
                console.log(error)
            }
        );
    }
}
