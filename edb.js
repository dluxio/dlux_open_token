const {Pool} = require('pg');
const config = require('./config');
const pool = new Pool({
 connectionString: config.dbcs,
 ssl: {
 rejectUnauthorized: false
 }
});

function getStats(table){
    return new Promise ((r,e)=>{
        pool.query(`SELECT * FROM statssi;`, (err, res) => {
    if (err) {
        console.log(`Error - Failed to select all from ${table}`);
        e(err);
    }
    else{
        r(res.rows);
    }
});
    })
}

exports.getPromotedPosts = getPromotedPosts

function getPromotedPosts(amount, offset){
    let off = offset,
        amt = amount
        if(!amount)amt = 50
        if(!off)off = 0
    return new Promise ((r,e)=>{
        pool.query(`SELECT 
                        author, 
                        permlink, 
                        block, 
                        votes, 
                        voteweight, 
                        promote, 
                        paid 
                    FROM 
                        posts 
                    WHERE 
                        promote > 0
                    ORDER BY 
                        promote DESC
                    OFFSET ${off} ROWS FETCH FIRST ${amt} ROWS ONLY;`, (err, res) => {
            if (err) {
                console.log(`Error - Failed to select some new from ${table}`);
                e(err);
            }
            else{
                r(res.rows);
            }
        });
    })
}

exports.getTrendingPosts = getTrendingPosts

function getTrendingPosts(amount, offset){
    let off = offset,
        amt = amount
        if(!amount)amt = 50
        if(!off)off = 0
    return new Promise ((r,e)=>{
        pool.query(`SELECT 
                        author, 
                        permlink, 
                        block, 
                        votes, 
                        voteweight, 
                        promote, 
                        paid 
                    FROM 
                        posts 
                    WHERE 
                        paid = false
                    ORDER BY 
                        voteweight DESC
                    OFFSET ${off} ROWS FETCH FIRST ${amt} ROWS ONLY;`, (err, res) => {
            if (err) {
                console.log(`Error - Failed to select some new from ${table}`);
                e(err);
            }
            else{
                r(res.rows);
            }
        });
    })
}

exports.getPost = getPost

function getPost(author,permlink){
    return new Promise ((r,e)=>{
        pool.query(`SELECT * FROM posts WHERE author = '${author}' AND permlink = '${permlink}';`, (err, res) => {
    if (err) {
        console.log(`Error - Failed to get a post from posts`);
        e(err);
    }
    else{
        r(res.rows);
    }
});
    })
}

exports.getNewPosts = getNewPosts

function getNewPosts(amount, offset){
    let off = offset,
        amt = amount
        if(!amount)amt = 50
        if(!off)off = 0
    return new Promise ((r,e)=>{
        pool.query(`SELECT author, permlink, block, votes, voteweight, promote, paid FROM posts ORDER BY block DESC OFFSET ${off} ROWS FETCH FIRST ${amt} ROWS ONLY;`, (err, res) => {
            if (err) {
                console.log(`Error - Failed to select some new from ${table}`);
                e(err);
            }
            else{
                r(res.rows);
            }
        });
    })
}

exports.getAuthorPosts = getAuthorPosts

function getAuthorPosts(author, amount, offset){
    let off = offset,
        amt = amount
        if(!amount)amt = 50
        if(!off)off = 0
    return new Promise ((r,e)=>{
        pool.query(`SELECT 
                        author, 
                        permlink, 
                        block, 
                        votes, 
                        voteweight, 
                        promote, 
                        paid 
                    FROM 
                        posts
                    WHERE
                        author = '${author}' 
                    ORDER BY 
                        block DESC 
                    OFFSET ${off} ROWS FETCH FIRST ${amt} ROWS ONLY;`, (err, res) => {
            if (err) {
                console.log(`Error - Failed to select some new from ${table}`);
                e(err);
            }
            else{
                r(res.rows);
            }
        });
    })
}


exports.insertNewPost = insertNewPost

function insertNewPost(post){ //is good
    let record = {
        author: post.author,
        permlink: post.permlink,
        block: post.block,
        votes: post.votes || 0,
        voteweight: post.voteweight || 0,
        promote: post.promote || 0,
        paid: post.paid || false,
        payout: post.payout || 0,
        payout_author: post.payout_author || 0,
        linear_weight: post.linear_weight || 0,
        voters: post.voters || '',
        voters_paid: post.voters_paid || '',
    }
    return new Promise((r,e)=>{
        pool.query(`INSERT INTO posts(author,permlink,block,votes,voteweight,promote,paid,payout,payout_author,linear_weight,voters,voters_paid)VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`, 
                [
                    record.author,
                    record.permlink,
                    record.block,
                    record.votes,
                    record.voteweight,
                    record.promote,
                    record.paid,
                    record.payout,
                    record.payout_author,
                    record.linear_weight,
                    record.voters,
                    record.voters_paid
                ], (err, res) => {
            if (err) {
                console.log(`Error - Failed to insert data into posts`);
                e(err);
            } else {
                r(res)
            }
        });
    })
}

exports.updatePost = updatePost

function updatePost(post){ 
    let record = {
            author: post.author,
            permlink: post.permlink,
            block: post.block,
            votes: Object.keys(post.votes).length,
            voteweight: post.t.totalWeight,
            paid: true,
            payout: post.paid,
            payout_author: post.author_payout,
            linear_weight: post.t.linearWeight || 0,
            voters: post.voters || '',
            voters_paid: post.voters_paid || '',
        }
        for(v in post.votes){
            record.voters += v + ','
            record.voters_paid += post.votes[v].p + ','
        }
        record.voters = record.voters.substring(0, record.voters.length -1)
        record.voters_paid = record.voters_paid.substring(0, record.voters_paid.length -1)
    return new Promise((r,e)=>{
        getPost(post.author,post.permlink)
        .then(ret=>{
            pool.query(`UPDATE posts
                    SET votes = ${record.votes},
                        voteweight = ${record.voteweight},
                        paid = ${record.paid},
                        payout = ${record.payout},
                        payout_author = ${record.payout_author},
                        linear_weight = ${record.linear_weight},
                        voters = '${record.voters}',
                        voters_paid = '${record.voters_paid}'
                    WHERE author = '${record.author}' AND
                        permlink = '${record.permlink}';`, (err, res) => {
                if (err) {
                    console.log(`Error - Failed to insert data into posts`);
                    e(err);
                } else {
                    console.log(res)
                    r(res)
                }
            });
        })

    })
}

exports.updatePostVotes = updatePostVotes

function updatePostVotes(post){ //live votes
    return new Promise((r,e)=>{
        let votes = Object.keys(post.votes).length,
            voteweight = 0,
            voters = ''
        for (v in post.votes){
            voteweight += post.votes[v].v
            voters += v + ','
        }
        voters = voters.substring(0,voters.length -1 )
        pool.query(`UPDATE posts
                    SET votes = ${votes},
                        voteweight = ${voteweight},
                        voters = '${voters}'
                    WHERE author = '${post.author}' AND
                        permlink = '${post.permlink}';`, (err, res) => {
                if (err) {
                    console.log(`Error - Failed to insert data into posts`);
                    e(err);
                } else {
                    r(res)
                }
            });
    })
}

exports.updateStat = updateStat

function insertStats(stat){ //is good
    let stats = {
        string: stat.string,
        int: stat.int
    }
    return new Promise((r,e)=>{
        pool.query(`INSERT INTO statssi(string,int)VALUES($1,$2)`, 
                [
                    stats.string,
                    stats.int
                ], (err, res) => {
            if (err) {
                console.log(`Error - Failed to insert data into statssi`);
                e(err);
            } else {
                r(res)
            }
        });
    })
}

function updateStat(stat){ //is good
    let record = {
        string: stat.string,
        int: stat.int
    }
    return new Promise((r,e)=>{
        pool.query(`UPDATE statssi
                    SET int = '${record.int}'
                    WHERE string = '${record.string}';`, (err, res) => {
                if (err) {
                    insertStats(stat)
                    .then(ret=>{
                        r(ret)
                    })
                    .catch(errr=>{
                        console.log(err,errr)
                        e(err,errr)
                    })
                } else {
                    r(res)
                }
            });
    })
}

exports.updatePromote = updatePromote

function updatePromote(author, permlink, amt){ //is good
    return new Promise((r,e)=>{
        getPost(post.author,post.permlink)
            .then(post => {
                amount = post.promote + amt
                pool.query(`UPDATE posts
                    SET promote = '${amount}'
                    WHERE author = '${author}' AND
                        permlink = '${permlink}';`, (err, res) => {
                if (err) {
                    insertStats(stat)
                    .then(ret=>{
                        r(ret)
                    })
                    .catch(errr=>{
                        console.log(err,errr)
                        e(err,errr)
                    })
                } else {
                    r(res)
                }
            });
            })
    })
}
