var utils = require('./utils');

function create(processor, config, getState, setState) {
  processor.on('dex_buy', function(json, from) {
    var state = getState();
    if(utils.isInteger(json.tokens) && utils.isInteger(json.rate) && json.tokens % 1000 === 0 && (!state.dex || !state.dex.buy_orders || !state.dex.buy_orders[from])) {
      console.log('A buy order has been created from', from, 'for', json.tokens, 'tokens at', json.rate/1000, 'STEEM per token.');

      state.dex.buy_orders[from] = {
        tokens: json.tokens,
        rate: json.rate
      };
    } else {
      console.log('Invalid buy order operation from', from);
    }
    setState(state);
  });

  return processor;
}

function createBuy(transactor, account, key, amount, rate) {

  transactor.json(account, key, 'dex_buy', {
    tokens: amount,
    rate: rate
  }, function(err, result) {
    if(err) {
      console.error(err);
    }
  });
}

module.exports = {
  create: create,
  createBuy: createBuy,
  //createSell: createSell
};
