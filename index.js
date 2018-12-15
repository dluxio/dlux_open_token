var steem = require('dsteem');
var steemState = require('steem-state');
var steemTransact = require('steem-transact');
var readline = require('readline');
var fs = require('fs');
var ipfsApi = require('ipfs-api');
const args = require('minimist')(process.argv.slice(2));
const express = require('express')
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});
var agreements
const app = express()
const ENV = process.env;
const port = ENV.PORT || 3000;
const key = ENV.KEY || '';
const username = ENV.ACCOUNT || 'dlux-io';
const NODEDOMAIN = ENV.DOMAIN
const BIDRATE = ENV.BIDRATE

app.get('/', (req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify({stats: state.stats, node: username}, null, 3))
});
app.get('/@:username', (req, res, next) => {
  let username = req.params.username
  let bal = state.balances[username] || 0
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify({balance: bal}, null, 3))
});
app.get('/stats', (req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify({stats: state.stats, node: username}, null, 3))
});
app.get('/markets', (req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify({markets: state.markets, node: username}, null, 3))
});
app.listen(port, () => console.log(`DLUX token API listening on port ${port}!\nAvailible commands:\n/@username =>Balance\n/stats\n/markets`))

var stateStoreFile = './state.json';  // You can replace this with the location you want to store the file in, I think this will work best for heroku and for testing.

const resteemAccount = 'dlux-io';
const resteemReward = 10000;
var startingBlock = 28573000;
// /\ and \/ are placeholders. They will act as the genesis state if no file is found.


const prefix = 'dlux_token_';
const streamMode = args.mode || 'irreversible';
console.log("Streaming using mode", streamMode);
const clientURL = ENV.APIURL || 'https://api.steemit.com'
var client = new steem.Client(clientURL);
var processor;

var state = {
  balances: {
    ra: 0, //reward_account
    rb: 0, //reward_budget for PRs and Bounties ... falls over to content
    rc: 0, //reward_content for distribution to steem content and it's curators
    rd: 0, //reward_delegation for distribution to delegators paid ever 25.2 hours on daily block
    re: 0, //reward_earn for distribution over powered up dlux
    ri: 0, //reward_ipfs for IPFS distribution
    rr: 0, //reward_relays for relays
    rn: 0, //reward_nodes
    rm: 0, //reward_marketing
    'dlux-io': 1000000000,
    shredz7: 100000000,
    disregardfiat: 1290171349,
    eastmael: 2642016222,
    elgeko: 1541678003,
    gabbagallery: 154048506,
    cryptoandzen: 8369556042,
    markegiles: 1265289344,
    whatsup: 354120048,
    'd-pend': 115971555,
    flash07: 14835383,
    onealfa: 330684833,
    kriptonik: 3104373601,
    gabbynhice: 68813922,
    ackza: 15274875,
    pangoli: 240608640,
    fyrstikken: 2876970756,
    angelveselinov: 13871442,
    michelios: 765105426,
    masterthematrix: 300536624,
    taskmaster4450: 156782489,
    direwolf: 1457368339,
    jznsamuel: 117465501,
    'bobby.madagascar': 696447002,
    itstime: 251729602,
    igster: 134001604,
    deybacsi: 1414164,
    protegeaa: 404618025,
    gattino: 53820121,
    mannacurrency: 23483466,
    seareader1: 58685485,
    pocketrocket: 11454529,
    preparedwombat: 297184599,
    jasnusface: 228763194,
    nataboo: 228763194,
    j85063: 9932060,
    'b-s': 285971204,
    theycallmedan: 257417213,
    tkept260: 1867087764,
    runicar: 230367193,
    lanmower: 46531849,
    acidyo: 246416131,
    tarazkp: 576249052,
    juvyjabian: 471523821,
    stackin: 18253402,
    dera123: 151322740,
    rovill: 137550227
  },
  powered: {
    disregardfiat: {
      liquid: 5000,
      powered: 5000,
      totalPowered: 5000,
      delegatedOut: {
        markegiles: 5000
      },
      delegatedIn: {
        markegiles: 5000
      },
      liquidating: {
      }
    },
    markegiles: {
      liquid: 5000,
      powered: 5000,
      delegatedOut: {
        disregardfiat: 5000
      },
      delegatedIn: {
        disregardfiat: 5000
      }
    }
  },
  chrono: {
  },
  stats: {
    hashLastIBlock: '',
    lastBlock: 0,
    tokenSupply: 100000000000,
    interestRate: 2100000,
    nodeRate: 10000,
    IPFSRate: 20000,
    relayRate: 10000,
    budgetRate: 20000,
    maxBudget: 1000000000,
    savingsRate: 10000,
    marketingRate: 10000,
    delegationRate: 10000,
    currationRate: 25000,
    exchangeRate: {
      steemDlux: '',
      btcDlux: '',
      ethDlux: '',
      usdDlux: ''
    }
  },
  dex: {
    buyBook: {

    },
    sellBook: {

    }
  },
  runners: {
    'dlux-io': {
      self: 'dlux-io',
      domain: 'https://dlux-token.herokuapp.com',
      bidRate: 10000,
      report: {}
    },
    'disregardfiat': {
      self: 'disregardfiat',
      domain: 'https://dlux-token-peer.herokuapp.com',
      bidRate: 10000,
      report: {}
    }
  },
  markets: {
    node: {
      'dlux-io': {
        self: 'dlux-io',
        domain: 'https://dlux-token.herokuapp.com',
        bidRate: 10000
      },
      'disregardfiat': {
        self: 'disregardfiat',
        domain: 'https://dlux-token-peer.herokuapp.com',
        bidRate: 10000
      }
    },
    ipfs: {
      'dlux-io': {
        self: 'dlux-io',
        domain: 'https://ipfs.dlux.io',
        bidRate: 20000,
      }
    },
    relay: {
      'dlux-io': {
        self: 'dlux-io',
        domain: 'https://chat.dlux.io',
        bidRate: 10000
      }
    },
    contributors: {
      'disregardfiat': {
        self: 'disregardfiat',
        bidRate: 1
      },
      'markegiles': {
        self: 'markegiles',
        bidRate: 1
      }
    }
  }
}

var dappStates = {}
var plasma = {}
var transactor = steemTransact(client, steem, prefix);

if(fs.existsSync(stateStoreFile)) {
  var data = fs.readFileSync(stateStoreFile, 'utf8');
  var json = JSON.parse(data);
  startingBlock = json[0];
  state = json[1];
  startApp();
} else {
  console.log('No state store file found. Starting from the genesis block+state');
  startApp();
}




function startApp() {
  processor = steemState(client, steem, startingBlock, 10, prefix, streamMode);


  processor.on('send', function(json, from) {
    if(json.to && typeof json.to === 'string' && typeof json.amount === 'number' && (json.amount | 0) === json.amount && json.amount >= 0 && state.balances[from] && state.balances[from] >= json.amount) {

      if(state.balances[json.to] === undefined) {
        state.balances[json.to] = 0;
      }

      state.balances[json.to] += json.amount;
      state.balances[from] -= json.amount;
      console.log('Send occurred from', from, 'to', json.to, 'of', json.amount, 'tokens.')
    } else {
      console.log('Invalid send operation from', from)
    }
  });

  processor.on('node_add', function(json, from) {
    if(json.domain && typeof json.domain === 'string') {
      state.markets.node[from].domain = json.domain;
      state.markets.node[from].self = from;
      state.markets.node[from].bidRate = json.bidRate || 10000;
      console.log(`@${from} has bidded the steem-state node ${json.domain} at ${json.bidRate}`)
    } else {
      console.log('Invalid steem-state node operation from', from)
    }
  });

  processor.on('node_delete', function(json, from) {
    delete state.markets.node[from].domain
    delete state.markets.node[from].bidRate
    console.log(`@${from} has deleted their steem-state node`)
  });

  processor.on('ipfs_add', function(json, from) {
    if(json.domain && typeof json.domain === 'string') {
      state.markets.ipfs[from].domain = json.domain;
      state.markets.ipfs[from].self = from;
      state.markets.ipfs[from].bidRate = json.bidRate || 20000;
      console.log(`@${from} has bidded the ipfs node ${json.domain} at ${json.bidRate}`)
    } else {
      console.log('Invalid ipfs node operation from', from)
    }
  });

  processor.on('ipfs_delete', function(json, from) {
    delete state.markets.ipfs[from].domain
    delete state.markets.ipfs[from].bidRate
    console.log(`@${from} has deleted their ipfs node`)
  });

  processor.on('relay_add', function(json, from) {
    if(json.domain && typeof json.domain === 'string') {
      state.markets.relay[from].domain = json.domain;
      state.markets.relay[from].self = from;
      state.markets.relay[from].bidRate = json.bidRate || 10000;
      console.log(`@${from} has bidded the relay ${json.domain} at ${json.bidRate}`)
    } else {
      console.log('Invalid relay operation from', from)
    }
  });

  processor.on('relay_delete', function(json, from) {
    delete state.markets.relay[from].domain
    delete state.markets.relay[from].bidRate
    console.log(`@${from} has deleted their relay`)
  });

  processor.on('report', function(json, from) {
    var cfrom, domain
    try {
      cfrom = state.markets.node[from].self
      domain = state.markets.node[from].domain
    }
    catch (err) {
    }
    if (from === cfrom && domain) {
      console.log(`@${from} has posted a report`)
    } else {
      if (from === username && NODEDOMAIN) {
        console.log(`@${from} has posted a spurious report and in now attempting to register`)
        transactor.json(username, key, 'node_add', {
          domain: NODEDOMAIN,
          bidRate: BIDRATE
        }, function(err, result) {
          if(err) {
            console.error(err);
          }
        })
      }
      console.log(`@${from} has posted a spurious report`)
    }
  });

  processor.onNoPrefix('follow', function(json, from) {  // Follow id includes both follow and resteem.
    if(json[0] === 'reblog') {
      if(json[1].author === resteemAccount && state.balances[from] !== undefined && state.balances[from] > 0) {
        state.balances[from] += resteemReward;
        state.balances[resteemAccount] -= resteemReward;
        console.log('Resteem reward of', resteemReward,'given to', from);
      }
    }
  });

  processor.onBlock(function(num, block) {
    if(num % 100 === 0 && !processor.isStreaming()) {
      client.database.getDynamicGlobalProperties().then(function(result) {
        console.log('At block', num, 'with', result.head_block_number-num, 'left until real-time.')
      });
    }
    if(num % 100 === 5 && processor.isStreaming()) {
      check();
    }
    if(num % 100 === 70 && processor.isStreaming()) {
      report();
    }
    if((num - 20000) % 30240  === 0 && processor.isStreaming()) { //time for daily magic
      dao();
    }
    if(num % 100 === 0) {
      tally();
      saveState(function() {
        console.log('Saved state.')
      });
    }
  });

  processor.onStreamingStart(function() {
    console.log("At real time.")
  });

  processor.start();

  rl.on('line', function(data) {
    var split = data.split(' ');

    if(split[0] === 'balance') {
      var user = split[1];
      var balance = state.balances[user];
      if(balance === undefined) {
        balance = 0;
      }
      console.log(user, 'has', balance, 'tokens')
    } else if(split[0] === 'send') {
      console.log('Sending tokens...')
      var to = split[1];

      var amount = parseInt(split[2]);

      transactor.json(username, key, 'send', {
        to: to,
        amount: amount
      }, function(err, result) {
        if(err) {
          console.error(err);
        }
      })
    } else if(split[0] === 'exit') {
      exit();
    } else if(split[0] === 'state') {
      console.log(JSON.stringify(state, null, 2));
    } else {
      console.log("Invalid command.");
    }
  });
}

function check() { //do this maybe cycle 5, gives 15 secs to be streaming behind
  plasma.markets = {
    nodes: {},
    ipfss: {},
    relays: {}
  }
  for (var account in state.markets.node) {
    var self = state.markets.node[account].self
    plasma.markets.nodes[self] = {
      self: self,
      agreement: false,
    }
    fetch(`${state.markets.node[self].domain}/stats`)
      .then(function(response) {
        return response.json();
      })
      .then(function(myJson) {
        console.log(JSON.stringify(myJson));
        if (state.stats.tokenSupply === myJson.stats.tokenSupply){
          plasma.markets.nodes[myJson.node].agreement = true
        }
      });
    }
}

function tally() {
  //count agreements and make the runners list, update market rate for node services
  var mint = parseInt(state.stats.tokenSupply/state.stats.interestRate)
  state.stats.tokenSupply += mint
  state.balances.ra += mint
}

function dao() {
  //disperses funds for delegation, as well as ICO bids
}

function report() {
  agreements = {}
  if (plasma.markets) {
    for (var node in plasma.markets.nodes){
      var self = plasma.markets.nodes[node].self;
      if (plasma.markets.nodes[self].agreement){
        agreements[self] = {
          node: self,
          agreement: true
        }
      }
    }
    for (var node in state.runners){
      var self = state.runners[node].self;
      if (agreements[self]) {
        agreements[self].top = true
      } else if (plasma.markets.nodes[self].agreement) {
        agreements[self] = {
          node: self,
          agreement: true
        }
      } else {
        agreements[self] = {
          node: self,
          agreement: false
        }
      }
    }
    transactor.json(username, key, 'report', {
        agreements
      }, function(err, result) {
        if(err) {
          console.error(err);
        }
    })//sum plasma and post a transaction
  }
}

function exit() {
  console.log('Exiting...');
  processor.stop(function() {
    saveState(function() {
      process.exit();
      console.log('Process exited.');
    });
  });
}

function saveState(callback) {
  var currentBlock = processor.getCurrentBlockNumber();
  fs.writeFileSync(stateStoreFile, JSON.stringify([currentBlock, state]));
  callback();
}
