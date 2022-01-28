## Set Up Node

#### Prereqs
* Hive Account with ~100 HP
* Additional Hive Key Pair

### Privex Docker Deploy
* This will run IPFS. Ensure you select a region appropriate VPS in SWEDEN or USA
* A Dual-Core 1GB / 25GB should be fine (Check with specific community for additional requirements)
* Instructions for Ubuntu follow:
* `sudo apt install docker docker-compose` --install dependencies
* `git clone https://github.com/disregardfiat/honeycomb.git` --download this repo
* `cd honeycomb` --change working directory
* Edit your node specifics in `touch .env && nano .env`
   * ```account="hiveaccount"
active=5JactivePrivateKey
msowner=5KadditionalPrivateKey```
* `sudo docker-compose build` --Build Docker environment
* `sudo docker-compose up` --Deploy Docker environment


## Build A Token