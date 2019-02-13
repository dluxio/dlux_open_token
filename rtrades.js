module.exports = {
  jwt: '',
  handleLogin: function (username, password){
return new Promise((resolve, reject) => {
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
                    resolve(response.token)
                }
                return reject(response)
            })
});
    },

handlePinFile: function (ipfsHash, holdTime){
  return new Promise((resolve, reject) => {
    let data = new FormData();
    data.append("hold_time", holdTime);

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
    xhr.setRequestHeader("Authorization", "Bearer " + rtrades.jwt);
    xhr.send(data);
  })
},
handleObject: function (hash){
  return new Promise((resolve, reject) => {
    let xhr_stat = new XMLHttpRequest();
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
    xhr_stat.setRequestHeader("Authorization", "Bearer " + rtrades.jwt);
    xhr_stat.send();
  });
},
checkNpin: function (assets){
  var totalBytes = 0
  var hashes = []
  var pins = []
  for (var i = 0; i < assets.length; i++){
    if(assets[i].pin){
      hashes.push(assets[i].hash)
    }
  }
  Promise.all(hashes).then(function(values) {
  for (var i = 0;i < values.length;i++){
    console.log(values[i])
    totalBytes += values[i].cumulativeSize
  }
  if(totalBytes < 134217728){
    for (var i = 0; i < hashes.length; i++){
      pins.push(this.handlePinFile(hashes[i],12))
    }
    Promise.all(pins).then(function(yays) {console.log('pinned hashes')})
  } else {console.log('Pin request too large!')}
});
}
}
