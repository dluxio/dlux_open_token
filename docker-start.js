const fetch = require('node-fetch');
const spawn = require('child_process').spawn
ping()
function ping () {
  fetch(`http://${process.env.ipfshost}:${process.env.ipfsport}/ping`)
    .then(res => res.text())
    .then(text => {console.log('Deploying:');spawn('node', ['index.js'], {stdio: 'inherit'})})
    .catch(err => {console.log('Waiting for IPFS...');setTimeout(ping, 2000)});
}