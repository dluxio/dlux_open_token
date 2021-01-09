const { store } = require("./../index");
const { getPathObj } = require("./../getPathObj");

exports.cjv = (json, from, active, pc) => {
    var postPromise = getPathObj(['posts', `${json.a}/${json.p}`]);
    Promise.all([postPromise])
        .then(function(v) {
            var post = v[0];
            ops = [],
                auth = false;
            console.log('cjv', post);
            if (post) {
                for (i in post.customJSON.assignments) {
                    if (from == post.customJSON.assignments[i]) {
                        auth = true;
                        if (i == 0) { post.customJSON.b = json.b; }
                        break;
                    }
                }
                if (auth) {
                    let same = true,
                        othersame = true;
                    for (i in json.c) {
                        if (post.customJSON.p[i] != json.c[i]) {
                            same = false;
                        }
                    }
                    for (i in json.c) {
                        if (post.customJSON.s[i] != json.c[i]) {
                            othersame = false;
                        }
                    }
                    if (!post.customJSON.p) {
                        post.customJSON.p = json.c;
                        post.customJSON.pw = 1;
                    } else if (same) {
                        post.customJSON.pw++;
                    } else if (!othersame) {
                        post.customJSON.s = json.c;
                        post.customJSON.sw = 1;
                    } else if (othersame) {
                        post.customJSON.sw++;
                        if (post.customJSON.sw > post.customJSON.pw) {
                            var temp = post.customJSON.p;
                            post.customJSON.p = post.customJSON.s;
                            post.customJSON.s = temp;
                            temp = post.customJSON.pw;
                            post.customJSON.pw = post.customJSON.sw;
                            post.customJSON.sw = temp;
                        }
                    }
                    ops.push({ type: 'put', path: ['posts', `${json.a}/${json.p}`], data: post });
                    console.log(ops);
                    store.batch(ops, pc);
                } else {
                    pc[0](pc[2]);
                }
            } else {
                pc[0](pc[2]);
            }
        })
        .catch(function(e) {
            console.log(e);
        });
}