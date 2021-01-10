exports.sortBuyArray = (array, key) => array.sort(function(a, b) {
    return b[key] - a[key];
})