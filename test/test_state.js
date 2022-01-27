module.exports = {
    "balances": {
        "leader": 1000000,
        "test-from": 1000000, //additional distributions
        "test-to": 1000000,
        "ra": 0,
        "rb": 0,
        "rc": 0,
        "rd": 0,
        "re": 0,
        "ri": 100000000, //in ICO account for fixed price
        "rm": 0,
        "rn": 0,
        "rr": 0
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
            "leader": {
                "attempts": 0,
                "bidRate": 2000,
                "contracts": 0,
                "domain": "localhost",
                "escrow": true,
                "escrows": 0,
                "lastGood": 1, //genesisblock
                "marketingRate": 0,
                "self": "leader",
                "wins": 0,
                "yays": 0
            }
        }
    },
    "pow": {
        "leader": 100000000,
        "t": 100000000 //total in other accounts
    },
    "queue": {
        "0": "leader"
    },
    "runners": {
        "leader": { //config.leader
            "domain": "localhost", //config.mainAPI
            "self": "leader" //config.leader
        }
    },
    "stats": {
        "IPFSRate": 2000,
        "budgetRate": 2000,
        "currationRate": 2000,
        "delegationRate": 2000,
        "hashLastIBlock": "Genesis",
        "icoPrice": 100, //in millihive
        "interestRate": 2100000, //mints 1 millitoken per this many millitokens in your DAO period
        "lastBlock": "",
        "marketingRate": 2500,
        "maxBudget": 1000000000,
        "nodeRate": 2000,
        "outOnBlock": 0, //amm ICO pricing
        "reblogReward": 10000, //unused
        "savingsRate": 1000,
        "tokenSupply": 203000000 //your starting token supply
    }
}