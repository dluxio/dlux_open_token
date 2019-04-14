
const XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest
var FormData = require('form-data');
module.exports = {
  jwt: '',
  un: '',
  up: '',
  tries: 0,
  setJWT: function (jwt){module.exports.jwt=jwt},
  handleLogin: function (username, password){
        fetch('https://dev.api.temporal.cloud/v2/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain'
            },
            body: JSON.stringify({
                "username": username.toString(),
                "password": password.toString()
            })
        }).then(res => res.json()).catch(error => {
            console.error(error);
            if (error) {
                reject(error)
            }
        })
            .then(response => {
                if (response.expire) {
                    module.exports.jwt = response.token,
                    module.exports.up = password.toString(),
                    module.exports.un = username.toString()
                }
            })
    },

handlePinFile: function (ipfsHash){
  return new Promise((resolve, reject) => {
    let data = new FormData();

    let xhr = new XMLHttpRequest();
    xhr.withCredentials = false;
    xhr.addEventListener("readystatechange", function () {
        if (xhr.readyState === 4) {
            let result = JSON.parse(xhr.responseText);
            if (result.code === 200) {
              resolve(result)
            }

            else {
              return reject()
            }
        }
    }.bind(this));

    xhr.open("POST", "https://dev.api.temporal.cloud/v2/ipfs/public/pin/" + ipfsHash);
    xhr.setRequestHeader("Cache-Control", "no-cache");
    xhr.setRequestHeader("Authorization", "Bearer " + module.exports.jwt);
    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded')
    xhr.send('hold_time=6');
  })
},
handleObject: function (hash){
  return new Promise((resolve, reject) => {
    var xhr_stat = new XMLHttpRequest();
    xhr_stat.withCredentials = false;

    xhr_stat.addEventListener("readystatechange", function () {

        if (xhr_stat.readyState === 4) {

            let result = JSON.parse(xhr_stat.responseText);
            if (result.code === 200) {
                resolve(result)
            } else {
                return reject()// Error handling.
            }
        }
    }.bind(this));

    xhr_stat.open("GET", "https://dev.api.temporal.cloud/v2/ipfs/public/stat/" + hash);
    xhr_stat.setRequestHeader("Cache-Control", "no-cache");
    xhr_stat.setRequestHeader("Authorization", "Bearer " + module.exports.jwt);
    xhr_stat.send();
  });
},
checkNpin: function (assets){
  return new Promise((resolve, reject) => {
  var totalBytes = 0
  var hashesP = []
  var pins = []
  var hashes = []
  for (var i = 0; i < assets.length; i++){
    if(assets[i].pin){
      hashesP.push(module.exports.handleObject(assets[i].hash))
      hashes.push(assets[i].hash)
    }
  }
  Promise.all(hashesP).then(function(values) {
    for (var i = 0;i < values.length;i++){
      totalBytes += values[i].response.CumulativeSize
    }
    resolve(totalBytes)
    if(totalBytes < 134217728){
      for (var i = 0; i < hashes.length; i++){
        pins.push(module.exports.handlePinFile(hashes[i]))

      }
      Promise.all(pins).then(function(result) {
        module.exports.tries = 0
        console.log(result,'pinned hashes')
      })
      .catch(function(error){
        if (error) {
            module.exports.tries++
            rtrades.handleLogin(module.exports.un, module.exports.up)
            if (module.exports.tires < 3){
              module.exports.checkNpin(assets)
            }
        } else {
        console.log('BAD',error)
      }
    })
    } else {console.log('Pin request too large:'+totalBytes)}
  })
  .catch(function(error){
    console.log(error)
    reject(error)
  })
  });
}
}
