### Account Creation Token Decentrlized Autonomous Coopertive

##### Ready for Testing

#### Setup:

You can run this from Heroku or a cloud VPS or directly from your home computer.

##### Heroku

Fork the ACT Branch of this software and set up a github deploy.
The following ENV Vars should be set
* 'username' : Steem username `disregardfiat`
* 'active' : Private active key
* 'low_price' : lowest price to sell ACTs for in millisteem. '1200' = 1.2 Steem
* 'release_rate' : How often to sell ACTs. '2000' is 20% per day and will eventually be equilibrium. Lower will tend to stockpile ACTs and higher will tend to lower your inventory.
* 'del_max' : '100' to '9500' is 1.00% to 95.00% availible SP to delegate to new accounts
* 'del_price' : '295' price for 15 SP delegation for 30 days in millisteem. .295 steem is 23.6% APY

* Set Manual or Auto Deploy

##### PC

Install Node.JS. Download ACT branch and adjust config.js with the above information. Run CMDs

* cd //to location
* npm i
* npm start
