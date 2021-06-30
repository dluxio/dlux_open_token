const config = require('./config');
const fetch = require('node-fetch');
//const { store } = require("./index");
//const { getPathObj } = require("./getPathObj");
module.exports = {
    ipfsVerify: function (str, pinobj) {
        return new Promise ((resolve, reject) => {
            const pins = Object.keys(pinobj)
            fetch(config.pinurl, {
                body: `{"jsonrpc":"2.0", "method":"ipfs.stats", "params":[${pins}], "id":1}`,
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                method: "POST"
                })
                .then(got=>{
                    // put in plasma memory and report? this verification may not scale very well
                    // maybe load by ${str} key and return [bytes] 
                })
        })
    }
}