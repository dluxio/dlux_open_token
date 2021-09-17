const fetch = require('node-fetch');
const { Base64 } = require('./helpers');
module.exports = function(client, steem, currentBlockNumber = 1, blockComputeSpeed = 1000, prefix = '', mode = 'latest', cycleapi) {
    var onCustomJsonOperation = {}; // Stores the function to be run for each operation id.
    var onOperation = {};

    var onNewBlock = function() {};
    var onStreamingStart = function() {};

    var isStreaming;
    var block_header;
    var stream;

    var stopping = false;
    var stopCallback;


    // Returns the block number of the last block on the chain or the last irreversible block depending on mode.
    function getHeadOrIrreversibleBlockNumber(callback) {
        client.database.getDynamicGlobalProperties().then(function(result) {
            if (mode === 'latest') {
                callback(result.head_block_number);
            } else {
                callback(result.last_irreversible_block_num);
            }
        })
    }

    function getVops (bn){
        return new Promise((resolve, reject) => {
            fetch(client.currentAddress, {
                body: `{"jsonrpc":"2.0", "method":"condenser_api.get_ops_in_block", "params":[${bn},true], "id":1}`,
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                method: "POST"
            })
            .then(res => res.json())
            .then(json => {
                resolve(json.result)
            })
            .catch(err => {reject(err)})
        });
    }

    function isAtRealTime(callback) {
        getHeadOrIrreversibleBlockNumber(function(result) {
            if (currentBlockNumber >= result) {
                callback(true);
            } else {
                callback(false);
            }
        })
    }

    function beginBlockComputing() {
        function computeBlock() {

            var blockNum = currentBlockNumber; // Helper variable to prevent race condition
            // in getBlock()
            var vops = getVops(blockNum)
            client.database.getBlock(blockNum)
                .then((result) => {
                    /*
                    block_header = {
                        timestamp: result.timestamp,
                        block_id: result.block_id,
                        block_number: blockNum
                    }
                    */
                    processBlock(result, blockNum, vops)
                        .then(r => {
                            currentBlockNumber++;
                            if (!stopping) {
                                isAtRealTime(function(result) {
                                    if (!result) {
                                        setTimeout(computeBlock, blockComputeSpeed);
                                    } else {
                                        beginBlockStreaming();
                                    }
                                })
                            } else {
                                console.log('failed at stopping')
                                setTimeout(stopCallback, 1000);
                            }
                        })
                        .catch(e => { console.log('failed at catch:', e) })
                })
                .catch((err) => {
                    console.log('get block catch:' + err)
                    cycleapi()
                })
        }

        computeBlock();
    }

    function beginBlockStreaming() {
        isStreaming = true;
        onStreamingStart();
        if (mode === 'latest') {
            stream = client.blockchain.getBlockStream({ mode: steem.BlockchainMode.Latest });
        } else {
            stream = client.blockchain.getBlockStream();
        }
        stream.on('data', function(block) {
            var blockNum = parseInt(block.block_id.slice(0, 8), 16);
            if (blockNum >= currentBlockNumber) {
                processBlock(block, blockNum);
                currentBlockNumber = blockNum + 1;
            }
        })
        stream.on('end', function() {
            console.error("Block stream ended unexpectedly. Restarting block computing.")
            beginBlockComputing();
        })
        stream.on('error', function(err) {
            cycleapi()
            console.log('This place:', err)
                //throw err;
        })
    }


    function transactional(ops, i, pc, num, block, vops) {
        if (ops.length) {
            
            doOp(ops[i], [ops, i, pc, num, block, vops])
                .then(v => {
                    if (ops.length > i + 1) {
                        transactional(v[0], v[1] + 1, v[2], v[3], v[4], v[5])
                    } else {
                        if(vops){
                            var Vops = []
                            vops.then(vo=>{
                                for(var j = 0; j < vo.length; j++){
                                    if(onOperation[vo[j].op[0]] !== undefined){
                                    var json = vo[j].op[1]
                                    json.block_num = vo[j].block
                                    json.txid = vo[j].trx_id
                                    Vops.push([vo[j].op[0],json])
                                    }
                                }
                                if(Vops.length){
                                    transactional(Vops, 0, v[2], v[3], v[4])
                                } else {
                                    onNewBlock(num, v)
                                        .then(r => {
                                            pc[0](pc[2])
                                        })
                                        .catch(e => { console.log(e) })
                                }
                            })
                        } else {
                            onNewBlock(num, v)
                            .then(r => {
                                pc[0](pc[2])
                            })
                            .catch(e => { console.log(e) })
                        }
                    }
                })
                .catch(e => {
                    console.log(e);
                    pc[1](e)
                })
        } else {
            onNewBlock(num, pc)
                .then(r => {
                    r[0]()
                })
                .catch(e => { pc[1](e) })
        }


        function doOp(op, pc) {
            return new Promise((resolve, reject) => {
                if (op.length == 4) {
                    onCustomJsonOperation[op[0]](op[1], op[2], op[3], [resolve, reject, pc])
                        //console.log(op[0])
                } else if (op.length == 2) {
                    onOperation[op[0]](op[1], [resolve, reject, pc]);
                    //console.log(op[0])
                }
            })
        }

        function doVop(op, pc) {
            return new Promise((resolve, reject) => {
                console.log(op, pc)
                onVOperation[op[0]](op[1], [resolve, reject, pc]);
            })
        }
    }

    function processBlock(block, num, Pvops) {
        return new Promise((resolve, reject) => {
            var transactions = block.transactions;
            let ops = []
            for (var i = 0; i < transactions.length; i++) {
                for (var j = 0; j < transactions[i].operations.length; j++) {
                    var op = transactions[i].operations[j];
                    if (op[0] === 'custom_json') {
                        if (typeof onCustomJsonOperation[op[1].id] === 'function') {
                            var ip = JSON.parse(op[1].json),
                                from = op[1].required_posting_auths[0],
                                active = false
                            ip.transaction_id = transactions[i].transaction_id
                            ip.block_num = transactions[i].block_num
                            ip.timestamp = block.timestamp
                            ip.prand = block.witness_signature
                            if (!from) {
                                from = op[1].required_auths[0];
                                active = true
                            }
                            ops.push([op[1].id, ip, from, active]) //onCustomJsonOperation[op[1].id](ip, from, active);
                        }
                    } else if (onOperation[op[0]] !== undefined) {
                        op[1].transaction_id = transactions[i].transaction_id
                        op[1].block_num = transactions[i].block_num
                        op[1].timestamp = block.timestamp
                        op[1].prand = block.witness_signature
                        ops.push([op[0], op[1]]) //onOperation[op[0]](op[1]);
                    }
                }
            }
            transactional(ops, 0, [resolve, reject], num, block, Pvops)
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

        getBlockHeader: function() {
            return block_header;
        },

        onStreamingStart: function(callback) {
            onStreamingStart = callback;
        },

        stop: function(callback) {
            if (isStreaming) {
                stopping = true;
                stream.pause();
                setTimeout(callback, 1000);
            } else {
                stopping = true;
                stopCallback = callback;
            }
        }
    }
}