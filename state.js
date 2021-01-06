const config = require('./config');
module.exports = {
    "balances": {
        [config.leader]: 1000000,
        "disregardfiat": 1000000, //additional distributions
        "it": 0, //inflation total
        "ib": 0, //inflation bounties
        "ic": 0, //inflation curation
        "id": 0, //inflation delegation
        "in": 0 //inflation nodes
    },
    "delegations": {}, //these need to be preloaded if already on account before starting block
    "dex": {
        "hbd": {
            "tick": "0.012500" //ICO price
        },
        "hive": {
            "tick": "0.100000" //ICO Price
        }
    },
    "markets": {
        "node": {
            [config.leader]: {
                "attempts": 0,
                "bidRate": 1500,
                "geyserRate": 1500,
                "contracts": 0,
                "domain": config.mainAPI,
                "escrow": true,
                "escrows": 0,
                "lastGood": 49994100, //genesisblock
                "marketingRate": 0,
                "self": [config.leader],
                "wins": 0,
                "yays": 0
            }
        }
    },
    "pow": {
        [config.leader]: 100000000,
        "t": 100000000 //total in other accounts
    },
    "queue": {
        "0": [config.leader]
    },
    "runners": {
        [config.leader]: { //config.leader
            "domain": config.mainAPI, //config.mainAPI
            "self": config.leader //config.leader
        }
    },
    "stats": {
        "HbdVWMA": {
            "block": 49747169,
            "rate": "0.330000", //set this at ICO price
            "vol": 1000
        },
        "HiveVWMA": {
            "block": 49936405,
            "rate": "3.00000", //set this at ICO price
            "vol": 1470
        },
        "movingWeight": {
            "running": 0
        },
        "bountyRate": 250, //for DLF
        "currationRate": 7000, //for content
        "delegationRate": 250, //for delegators
        "geyserRate": 1000, //for liquidity pool
        "hashLastIBlock": "Genesis",
        "lastBlock": "",
        "nodeRate": 1500, //for miners
        "tokenSupply": 6804000000, //your starting token supply
        "maxSupply": 1000000000000 //
    }
}