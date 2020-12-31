# dlux_open_token

This is a Decentralized Autonomous Organization built on the HIVE ecosystem.

THIS BUILD IS PASSING BUT SEVERAL FEATURES ARE UNTESTED. DO NOT RECOMMEND USING ON ACCOUNT WITH HIGH BALANCES

This software builds a network of peers that use HIVE to post and interpret transactions. This allows these peers to come to a consensus and elect peers to run tasks. Distributing computing in this way allows a vast amount of potential applications, DeFi, and oracle services. By distributing authority to perform transactions we can have a frictionless(no intermediate tokens, no central authority, no intrinsic fees) way to cross asset boundaries(HIVE/OPEN_TOKEN) with no information asymmetries, ie Finance without securities by definition... just free speech: As no party is required to perfom any function, or prevented from performing any function, no promises are made by peers. Network Incentives (OPEN-TOKEN) alone are enough to maintain trust.

These features are currently working and being tested for `0.9.0a`:

* Send: Use custom_json with active permission, "ACJ" to send OPEN_TOEK tokens
* Illiquid voting state. Power up and down OPEN_TOKEN for voting and delegation with ACJ
* Chron to execute virtual operations: expire trades, powerdown stake, enforce penalties.
* Hive posts that benefit the configured account at > the configured % are: 
   * entered into a voting eligible content pool
   * optionally have their IPFS content pinned with rtrades(3rd party service)
   * can be programmed for any other function
* Users can vote on content with weight, using custom json with posting permissions.
* Have a daily pool of 10 full votes, and 1 in 10000 fine control of voting stake.
* State is saved to IPFS every 5 minutes for fast automatic starts and restarts, also used to determine consensus
* LevelDB with custom transactional handlers for transactional writes
* JSON express server API
* Token sales from the configured account with HIVE transfers
* Token sales set with pricing feedback.
* 2/3rds consensus algorithm
* automatic messaging to join network ad-hoc
* ability to delete node from list(turn off escrow queue)
* report consensus
* distribute OPEN_TOKENS to configured account delegators and keep running total
   * Used for auto voting on content with delegation
* pay nodes for processing trusted state, facilitating an escrow/dex transaction or running a smart contract.
   * Effectively mining OPEN_TOKENS with Hive Resource Credits
* establishes a 5%(configurable) inflation rate and distributes rewards to run the network
* Automated accounting post from configured account or mirrors
* Track interactions on a rolling feed via block_num and TXID.
* Automates IPFS pinning for OPEN_TOKEN votable content from configured account or mirrors
* 2 way DEX
  * HIVE:OPEN_TOKEN & HBD:OPEN_TOKEN pairs
  * On state trade history with daily reductions to high/low/volume
  * Price/collateral controls from Volume Weighted Moving Average
  * Enforcement of collateral

These features are works in progress:
* Partial fills of DEX orders `1.0.0`
* Multi-signature deterministic control of community capital `1.0.0`
* Ban nodes to discourage bad action `1.0.0`
* Smart contracts to build IPFS market `1.1`
* Smart contract to build account creation token market `1.1`
* NFT/smart contract system with fetch and consensus ie. distributed computer `1.1`

### Bounty and PenTest
If you're tech savvy help us test this. 
There are currently roughly 12M Tokens in DLUX
Any major breach will be rolled back and/or corrected with the breacher earning a maximum of 5,000 DLUX. 
Gains that can be made less than 5000 DLUX can be kept.
Any users accounts are guaranteed. 
All tokens distributed from this bounty will be from already minted tokens.
Any critical(balance altering) pull requests will earn 2500 DLUX.
Any non-critical(halting - other) pull requests accepted by the deadline can earn upto 1000 DLUX.
1 bounty per bug (please fix all instances of found bug)
Bounty ends on Feb 15th or the first 3 day period with no critical errors found.
There are up to 750,000 DLUX up for bounties. (currently located in `rc` and `rm`, your pull request can alter these) in the following fashion:

>index.js:
```
var cleanState = data[1]
cleanState.balances.rc = cleanState.balances.rc - 2500000 //add these 2 lines
cleanState.balances.yourhiveaccount = cleanState.balances.yourhiveaccount + 2500000
store.put([], cleanState, function(err) {
```
After merge and 10 minutes the above lines will be removed, but your name will remain in the code forever.

***

This software is meant to be run as a public API for decentralized token data.

While it runs it verifies other nodes are operating correctly and confirms this by posting a customJson transaction to Hive. 288(configurable) messages will be required per day per node operator. More Resource Credits will be required to handle escrow transactions and transfers.

Deploy from heroku or similar and set ENV variables with a hive name and active key. Deploy from home computer for maximum account security.

* `account` - dlux-io
* `active` - active posting key (will run escrow transactions for rewards) !! *caution while in testing* !!
* `domain` - `https://<token-api>.<a-domain>.com` or `http://<static-ip>:<port>`

***

### To Build Your Own Token

Branch this and find this part of `config.js`

*TOKEN CONFIGS -- ALL COMMUNITY RUNNERS NEED THESE SAME VALUES*

`const starting_block = 49988008;` //from what block does your token start

`const prefix = 'dlux_'` //Community token name for Custom Json IDs

`const TOKEN = 'DLUX'` //Token name

`const tag = 'dlux'` //https://the-front-end.com/`tag`/@`leader`/`permlink`

`const jsonTokenName = 'dlux'` //what customJSON in Escrows and sends is looking for

`const leader = 'dlux-io'` //Default account to pull state from, will post daily

`const ben = 'dlux-io'` //Account where comment benifits trigger token action

`const delegation = 'dlux-io'` //account people can delegate to for rewards

`const msaccount = 'dac.escrow'` //account controlled by community leaders

`const mainAPI = 'token.dlux.io'` //leaders API probably

`const mainFE = 'dlux.io'` //frontend for content

`const mainIPFS = 'a.ipfs.dlux.io'` //IPFS service

`const mainICO = 'robotolux'` //Account collecting ICO HIVE

Then alter the `state.js` with balances and other starting information