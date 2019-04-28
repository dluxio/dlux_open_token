dlux-token-node

This program is the Decentralized Autonomous Organization built on the STEEM ecosystem.

THIS BUILD IS PASSING BUT SEVERAL FEATURES ARE UNTESTED. DO NOT RECOMMEND USING ON ACCOUNT WITH HIGH BALANCES

This is the test environment. Upon completion of the following features we will announce a genesis block and begin our DAO

This software builds a network of peers that use STEEM to post and interpret transactions. This allows these nodes to come to a consensus and elect nodes to run tasks. Distributing computing in this way allows a vast amount of potential applications and oracle services. By distributing authority to perform transactions we can have a frictionless way to cross asset boundaries with no information asymmetries.

These features are currently working and being tested:
* Send: Use custom_json with active permission, "ACJ" to send DLUX tokens
* Illiquid voting state. Power up and down DLUX for voting and delegation with ACJ
* Chron to execute virtual operations
* Steem posts that benefit @dlux-io >10% are entered into a voting eligible content pool
* Users can vote on content with weight, using custom json with posting permissions.
* Have a daily pool of 10 full votes, and 1 in 10000 fine control of voting stake.
* State is saved to IPFS every 5 minutes for fast restarts
* LevelDB 
* JSON express server API
* Token sales from @robotolux steem transfers
* Token sales set with pricing feedback.
* 2/3rds consensus algorithm
* automatic messaging to join network ad-hoc
* ability to delete node from list(turn off escrow queue)
* report consensus
* distribute dlux tokens to @dlux-io delegators and keep running total
* pay nodes for processing top 20 trusted state or facilitating an escrow/dex transaction or running a smart contract.
* establishes a 5% inflation rate and distributes rewards to run the network4
* Automated accounting post
* Automated content voting
* Track interactions on a rolling feed via block_num and TXID.
* Automates IPFS pinning for DLUX votable content from @dlux-io


These features are works in progress:
* Ban nodes to discourage bad action
* 2 way open DEX
* Smart contracts to build IPFS market
* Smart contract to build account creation token market
* Finish encrypted CMS subscription system.
* NFT/smart contract system with fetch and consensus ie. distributed computer

***

This software is meant to be run as a public API for dlux token data.

While it runs it verifies other nodes are operating correctly and confirms this by posting a customJson transaction to steem. 288 messages will be required per day per node operator.

Deploy from heroku or similar and set ENV variables with a steem name and posting key.
* `account`  dlux-io
* `active` active posting key (will run escrow transactions for rewards) !! *caution while in testing* !!
* `DOMAIN` https://something-personal.herokuapp.com
* `BIDRATE` 1 to 20000
* `startingHash ` A hash from a recent block gets you up to speed in no time, automated... leave blank casually
