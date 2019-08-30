const steem = require('dsteem');
const steemjs = require('steem');
const steemState = require('./processor');
const IPFS = require('ipfs-api');
const ipfs = new IPFS({
    host: 'ipfs.infura.io',
    port: 5001,
    protocol: 'https'
});
const express = require('express')
const cors = require('cors')
const config = require('./config');
const VERSION = 'v0.0.1a'
const api = express()
var http = require('http').Server(api);
const wif = steemClient.auth.toWif(config.username, config.activeKey, 'active')
const prefix = 'ACT_';
const streamMode = args.mode || 'irreversible';
console.log("Streaming using mode", streamMode);
var client = new steem.Client(config.clientURL);
var processor;
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
api.get('/', (req, res, next) => {

});
//api.listen(port, () => console.log(`DLUX token API listening on port ${port}!\nAvailible commands:\n/@username =>Balance\n/stats\n/markets`))
http.listen(config.port, function() {
    console.log(`ACT API listening on port ${config.port}`);
});

var plasma = {
    bot: {},
    stats:{
        bu: 0,
        bi: 0
    },
    agents:{}
}

class Agent {
  constructor(account, domain, low, fee, rrate, future, futmax, delshare) {
    this.a = account; 
    this.d = domain; //api
    this.l = low; // lowest price accepted
    this.f = fee; //fee required for escrow
    this.r = rrate; //release rate of inventory
    this.c = future; // willing to hold futures/contracts
    this.cm = futmax; // max number of blocks to hold futures
    this.s = delshare; // shares profits to delegators automaticly
    this.i = 0; //inventory -> populated by calls
    this.ir = 0; //inventory redeemed
    this.ci = 0; //contracts redeemed
    this.e = 0; //escrow broadcasts
    this.j = 0; //jsons sent for verification
    this.x = {} //negatives/automated flags
  }
}

var recents = []
//auto starts
steemjs.api.getAccountHistory(username, -1, 100, function(err, result) {
  if (err){
    console.log(err)
    startWith(sh)
  } else {
    let ebus = result.filter( tx => tx[1].op[1].id === 'act_con_bu' )
    for(i=ebus.length -1;i>=0;i--){
      if(JSON.parse(ebus[i][1].op[1].json).stateHash !== null)var recents.push(JSON.parse(ebus[i][1].op[1].json).stateHash)
    }
    if(recents.length){
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
    if (hash) {
        console.log(`Attempting to start from IPFS save state ${hash}`);
        ipfs.cat(hash, (err, file) => {
            if (!err) {
                var data = JSON.parse(file.toString())
                plasma.stats.bi = data[0]
                plasma.stats.bu = hash
                state = data[1]
                startApp();
            } else {
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
    } else {
        state = {
          bot: {},
          stats: {
            bu: sh,
            bi: 36010000,
            inv:{}
          },
          queue: {},
          agents: {}
        }
        plasma.stats.bi = 36010000
        startApp()
    }
}


function startApp() {
    processor = steemState(client, steem, plasma.stats.bi, 10, prefix, streamMode);

    processor.onOperation('escrow_transfer', function(json) {
        
    });

    processor.onOperation('escrow_approve', function(json) {
      
    });

    processor.onOperation('escrow_dispute', function(json) {
     
    });

    processor.onOperation('escrow_release', function(json) {
       
    });
    
    processor.onOperation('delegate_vesting_shares', function(json) {
       // delegation for profit sharing
    });

    processor.on('node_add', function(json, from, active) {
        if (active){
            var low = json.low, fee = json.fee, rrate = json.rrate, future = json.future
            if(parseInt(low) > 3000){low = 3000}
            else if(parseInt(low) <= 3000){}
            else {low = 0}
            if(parseInt(fee) > 100){fee = 100}
            else if(parseInt(fee) <= 100){}
            else {fee = 0}
            if(parseInt(rrate) > 2000){rrate = 2000}
            else if(parseInt(rrate) >= 0){}
            else {rrate = 0}
            if(future)future=true
            state.agents = new Agent(from, json.domain, low, fee, rrate, json.future, json.futmax, json.delshare)
        }
    });

    processor.on('node_update', function(json, from, active) {
        if (active) {
            
        }
    });

    processor.on('report', function(json, from, active) {
        if (active){
        
        }
    });


    processor.onOperation('transfer', function(json) {
        
    });

    processor.onOperation('delegate_vesting_shares', function(json) {
      
    });

    processor.onBlock(function(num, block) {
        
        })
        if (num % 100 === 0 && !processor.isStreaming()) {
            
        }
        if (num % 100 === 5 && processor.isStreaming()) {
            check(num);
        }
        if (num % 100 === 50 && processor.isStreaming()) {
            report(num)
        }
        if (num % 28800 === 0) { //time for daily magic
            dao(num)
        }
        if (num % 100 === 0 && processor.isStreaming()) {
        
        }
        if (num % 100 === 0) {
            tally(num);
        }
        if (num % 100 === 1) {
            const blockState = Buffer.from(JSON.stringify([num, state]))
            ipfsSaveState(num, blockState)
        }
        

    processor.onStreamingStart(function() {

    });

    processor.start();
}

function exit(consensus) {
    console.log(`Restarting with ${consensus}...`);
    processor.stop(function() {
        startWith(consensus)
    });
}

function ipfsSaveState(blocknum, hashable) {
    ipfs.add(Buffer.from(JSON.stringify([blocknum, hashable]), 'ascii'), (err, IpFsHash) => {
        if (!err) {
            plasma.stats.bu = IpFsHash[0].hash
            plasma.stats.bi = blocknum
            console.log(blocknum + `:Saved:  ${IpFsHash[0].hash}`)
            if(Object.keys(plasma.bot).indexOf(`${parseInt(blocknum + 2)}`) >= 0){
              plasma.bot[parseInt(blocknum + 2)].push(['customJson', 'con_bu', {
                stateHash: plasma.stats.bu,
                block: blocknum
              }])
            } else {
              plasma.bot[parseInt(blocknum + 2)] = [['customJson', 'con_bu', {
                stateHash: plasma.stats.bu,
                block: blocknum
              }]]
            }
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
    }
}
