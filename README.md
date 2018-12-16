dlux-token-node

This is the custom implementation of `STEEM-STATE` for the dlux ecosystem.

This program is the Decentralized Autonomous Organization built on the STEEM blockchain and participated in by posting custom json from associated accounts.

This is the test environment. Upon completion of the following features we will announce a genesis block and begin our DAO:
* DEX for currency exchange
* Decentralized markets for p2p services
    * IPFS pinning
    * Provide consensus and API (this software)
    * Encrypted anonymous dApp relays
* An NFT, Non-fungible Token, implementation
* Incentive mechanisms for participation

***

This software is meant to be run as a public API for dlux token data.

While it runs it verifies other nodes are operating correctly and confirms this by posting a customJson transaction to steem. 288 messages will be required per day per node operator.

Deploy from heroku and set ENV variables with a steem name and posting key.
* `ACCOUNT`  dlux-io
* `KEY` posting key
* `DOMAIN` https://token.dlux.io
* `BIDRATE` 1 to 10000 which is average
* `STARTHASH` A hash from a recent block gets you up to speed in no time

Once your node is running post a custom json transaction with these details registering your node.
```
dlux_token_node_add

domain: https://dlux.fullpath.tld
bidRate: integer 0 to 10000 (payout is determined from average bidrates)
```
