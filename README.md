dlux-token-node

This is the custom implementation of `STEEM-STATE` for the dlux ecosystem.

This program is the Decentralized Autonomous Organization built on the STEEM blockchain and participated in by posting custom json from associated accounts.

This is the test environment. Upon completion of the following features we will announce a genesis block and begin our DAO

This software builds a network of peers that use steem to post internal messaging. This allows these nodes to come to a consensus and elect nodes to run tasks. Distributing computing in this way allows a vast amount of potential applications and oracle services. By distributing authority to perform transactions we can have a frictionless way to cross asset boundaries with no information asymmetries.

These features are currently working and being tested:
* DLUX token system. Send
* DLUX power system. Power up and down
* Chrono to support power down & content voting
* Eligible content has dlux listed as a 10% or higher beneficiary
* Users can vote on content with weight. Have a daily pool of 10 full votes, and 1 in 10000 control.
* State is saved to IPFS every 5 minutes for fast restarts
* JSON express server API
* Announce if escrow eligible
* Distributed ICO Auction round to all bidders
* 2/3rds consensus algorithm, POW also determinines eligibility for escrow service.
* If all nodes go off-line rouge runners can't hijack the chain.
* automatic messaging to join network ad-hoc
* ability to delete node from list(turn off escrow queue)
* Set marketing rewards for resteems of @dlux-io posts
* Expire posts to remove resteem reward eligibility
* report consensus
* distribute dlux tokens to @dlux-io delegators and keep running total
* pay nodes for processing top 20 trusted state or facilitating an escrow/dex transaction or running a smart contract. (look hard at this)
* establishes a 5% inflation rate and distributes rewards to run the network

These features are works in progress:
* Dynamic state retrieval and restart
* Determine IPFS hash before upload
* Establish RSS feed for transaction verification
* Ban nodes to discourage bad action
* 2 way open DEX
* NFT/smart contract system with fetch and consensus ie. distributed computer

***

This software is meant to be run as a public API for dlux token data.

While it runs it verifies other nodes are operating correctly and confirms this by posting a customJson transaction to steem. 288 messages will be required per day per node operator.

Deploy from heroku and set ENV variables with a steem name and posting key.
* `account`  dlux-io
* `active` active posting key (will run escrow transactions for rewards)
* `posting` posting, can participate in network
* `DOMAIN` https://token.dlux.io
* `BIDRATE` 1 to 10000 which is average
* `startingHash ` A hash from a recent block gets you up to speed in no time

Once your node is running post a custom json transaction with these details registering your node.
```
dlux_token_node_add

domain: https://dlux.fullpath.tld
bidRate: integer 0 to 10000 (payout is determined from average bidrates)
```
