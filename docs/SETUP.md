## Set Up Node

#### Prereqs
* Hive Account with ~100 HP
* Additional Hive Key Pair

### (Privex) Docker Deploy
* This will run IPFS. Ensure you select a region appropriate VPS in SWEDEN or USA
* A Dual-Core 1GB / 25GB should be fine (Check with specific community for additional requirements)
* Instructions for Ubuntu follow:
* `sudo apt install docker docker-compose` --install dependencies
* `git clone https://github.com/disregardfiat/honeycomb.git` --download this repo
* `cd honeycomb` --change working directory
* Edit your node specifics via `touch .env && nano .env`
   * Contents: 
```
account="hiveaccount"
active=5JactivePrivateKey
msowner=5KadditionalPrivateKey
mspublic=STMpublickey
```
* `sudo docker-compose build` --Build Docker environment
* `sudo docker-compose up` --Deploy Docker environment

#### nginx setup
* `sudo apt install nginx certbot python3-certbot-nginx`
    Select `nginx-full`
* `sudo nano /etc/nginx/sites-availible/default`
   * Enter and save:
```
server{
server_name location.yourdomain.io;

        location / {
                proxy_pass http://127.0.0.1:3001;
                proxy_http_version 1.1;
                proxy_set_header Upgrade $http_upgrade;
                proxy_set_header Connection 'upgrade';
                proxy_set_header Host $host;
        }
}
```
* `sudo systemctl reload nginx`
* Ensure your DNS information points to your server and run `sudo certbot`

## Build A Token