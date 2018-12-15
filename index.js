var steem = require('dsteem');
var steemState = require('steem-state');
var steemTransact = require('steem-transact');
var readline = require('readline');
var fs = require('fs');
var ipfsApi = require('ipfs-api');
const express = require('express');
var dex = require('./dex');
var utils = require('./utils');

const args = require('minimist')(process.argv.slice(2));

const ENV = process.env;
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const app = express()
const port = ENV.PORT || 3000;

app.get('/@:username', (req, res, next) => {
  let username = req.params.username
  res.send({balance: state.balances[username]})
});
app.listen(port, () => console.log(`DLUX token API listening on port ${port}!`))

var stateStoreFile = './state.json';  // You can replace this with the location you want to store the file in, I think this will work best for heroku and for testing.

const resteemAccount = ENV.RESTEEM_ACCOUNT || 'dlux-io';
const resteemReward = ENV.RESTEEM_REWARD || 10000;
var startingBlock = ENV.STARTINGBLOCK || 28587649;     // PUT A RECENT BLOCK HERE -- GENESIS BLOCK
// /\ and \/ are placeholders. They will act as the genesis state if no file is found.
const dexConfig = {

};

const username = ENV.ACCOUNT || 'dlux-io';
const key = ENV.KEY;

const prefix = ENV.PREFIX || 'dlux_token_';
const streamMode = args.mode || 'irreversible';

console.log("Streaming using mode", streamMode);

const clientURL = ENV.APIURL || 'https://api.steemit.com'
var client = new steem.Client(clientURL);
var processor;

var state = {
  balances: {
    ra: 47500,
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
  dex: {
    buy_orders: {},
    sell_orders: {},
    pending_transfers: {}
  }
}

function getState() {
  return state;
}

function setState(newState) {
  state = newState;
}

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
    if(json.to && typeof json.to === 'string' && utils.isInteger(json.amount) && json.amount >= 0 && state.balances[from] && state.balances[from] >= json.amount) {

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

  processor = dex.create(processor, dexConfig, getState, setState);

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

    if(num % 100 === 0) {

      saveState(function() {
        console.log('Saved state.')
      });
    }
  });

  processor.onStreamingStart(function() {
    console.log("At real time.")
  });

  processor.start();


  var transactor = steemTransact(client, steem, prefix);

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
    } else if(split[0] === 'buy') {
      dex.createBuy(transactor, username, key, parseInt(split[1]), parseInt(split[2]));
      console.log('Placing order...');
    } else {
      console.log("Invalid command.");
    }
  });
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
