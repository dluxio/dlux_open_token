function waitup(promises_array, promise_chain_array, resolve_reject) {
    Promise.all(promises_array)
        .then(r => {
            resolve_reject[0](promise_chain_array);
        })
        .catch(e => { resolve_reject[1](e); });
}
exports.waitup = waitup;