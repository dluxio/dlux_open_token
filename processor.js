module.exports = function(client, steem, currentBlockNumber=1, blockComputeSpeed=1000, prefix='', mode='latest') {
  var onCustomJsonOperation = {};  // Stores the function to be run for each operation id.
  var onOperation = {};

  var onNewBlock = function() {};
  var onStreamingStart = function() {};

  var isStreaming;

  var stream;

  var stopping = false;
  var stopCallback;


  // Returns the block number of the last block on the chain or the last irreversible block depending on mode.
  function getHeadOrIrreversibleBlockNumber(callback) {
    client.database.getDynamicGlobalProperties().then(function(result) {
      if(mode === 'latest') {
        callback(result.head_block_number);
      } else {
        callback(result.last_irreversible_block_num);
      }
    })
  }

  function isAtRealTime(callback) {
    getHeadOrIrreversibleBlockNumber(function(result) {
      if(currentBlockNumber >= result) {
        callback(true);
      } else {
        callback(false);
      }
    })
  }

  function beginBlockComputing() {
    function computeBlock() {

      var blockNum = currentBlockNumber;// Helper variable to prevent race condition
                                        // in getBlock()
      client.database.getBlock(blockNum)
        .then((result) => {
          processBlock(result, blockNum)
          .then(r=>{
            currentBlockNumber++;
            if(!stopping) {
              isAtRealTime(function(result) {
                if(!result) {
                  setTimeout(computeBlock, blockComputeSpeed);
                } else {
                  beginBlockStreaming();
                }
              })
            } else {
              setTimeout(stopCallback,1000);
            }
          })
          .catch(e=>{console.log(e)})
        })
        .catch((err) => {
          throw err;
        })
    }

    computeBlock();
  }

  function beginBlockStreaming() {
    isStreaming = true;
    onStreamingStart();
    if(mode === 'latest') {
      stream = client.blockchain.getBlockStream({mode: steem.BlockchainMode.Latest});
    } else {
      stream = client.blockchain.getBlockStream();
    }
    stream.on('data', function(block) {
      var blockNum = parseInt(block.block_id.slice(0,8), 16);
      if(blockNum >= currentBlockNumber) {
        processBlock(block, blockNum);
        currentBlockNumber = blockNum+1;
      }
    })
    stream.on('end', function() {
      console.error("Block stream ended unexpectedly. Restarting block computing.")
      beginBlockComputing();
    })
    stream.on('error', function(err) {
      throw err;
    })
  }

  
  function transactional(ops, i, pc, num, block){
    console.log(ops)
    if(ops.length){
      doOp(ops[i], pc)
      .then(v=>{
        console.log(i)
        if (ops.length > i + 1){
          transactional(ops, i+1)
        } else {
          onNewBlock(num, block, pc)
          .then(r=>{
            r[0]()
          })
          .catch(e=>{console.log(e)})
        }
      })
      .catch(e=>{console.log(e);pc[1](e)})
    } else {
      onNewBlock(num, block, pc)
      .then(r=>{
        console.log('here')
        r[0]()
      })
      .catch(e=>{pc[1](e)})
    }
  
  
  function doOp(op){
      return new Promise((resolve, reject)=>{
        if(op.length == 4){
          onCustomJsonOperation[op[0]](op[1], op[2], op[3],[resolve,reject])
        } else if (op.length == 2){
          onOperation[op[0]](op[1],[resolve,reject]);
        }
      })
  }
}
  
  function processBlock(block, num) {
    return new Promise((resolve, reject)=>{
    
      var transactions = block.transactions;

      let ops = []
      for(var i = 0; i < transactions.length; i++) {
        for(var j = 0; j < transactions[i].operations.length; j++) {
          var op = transactions[i].operations[j];
          if(op[0] === 'custom_json') {
            if(typeof onCustomJsonOperation[op[1].id] === 'function') {
              var ip = JSON.parse(op[1].json),
                  from = op[1].required_posting_auths[0],
                  active = false
              ip.transaction_id = transactions[i].transaction_id
              ip.block_num = transactions[i].block_num
              if(!from){from = op[1].required_auths[0];active=true}
              ops.push([op[1].id, ip, from, active])//onCustomJsonOperation[op[1].id](ip, from, active);
            }
          } else if(onOperation[op[0]] !== undefined) {
            op[1].transaction_id = transactions[i].transaction_id
            op[1].block_num = transactions[i].block_num
            ops.push([op[0], op[1]])//onOperation[op[0]](op[1]);
          }
        }
      }
      transactional(ops,0, [resolve, reject], num, block)
    })
  }

  return {
    /*
      Determines a state update to be called when a new operation of the id
        operationId (with added prefix) is computed.
    */
    on: function(operationId, callback) {
      onCustomJsonOperation[prefix + operationId] = callback;
    },

    onOperation: function(type, callback) {
      onOperation[type] = callback;
    },

    onNoPrefix: function(operationId, callback) {
      onCustomJsonOperation[operationId] = callback;
    },

    /*
      Determines a state update to be called when a new block is computed.
    */
    onBlock: function(callback) {
      onNewBlock = callback;
    },

    start: function() {
      beginBlockComputing();
      isStreaming = false;
    },

    getCurrentBlockNumber: function() {
      return currentBlockNumber;
    },

    isStreaming: function() {
      return isStreaming;
    },

    onStreamingStart: function(callback) {
      onStreamingStart = callback;
    },

    stop: function(callback) {
      if(isStreaming){
        stopping = true;
        stream.pause();
        setTimeout(callback,1000);
      } else {
        stopping = true;
        stopCallback = callback;
      }
    }
  }
}
