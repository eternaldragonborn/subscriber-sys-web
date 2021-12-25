const { Pool } = require('pg');
const fs = require('fs');
const { DateTime } = require('luxon');
const { getUser } = require('./discordbot');
const pool = new Pool({
    host: process.env['SQL_HOST'],
    user: process.env['SQL_USER'],
    password: process.env['SQL_PASSWD'],
    database: process.env['SQL_DB'],
    ssl: {
        rejectUnauthorized: false
    }
});

const redis = require('redis');
const client = redis.createClient({ url: 'redis://' + process.env['REDIS_HOST'], password: process.env['REDIS_PASSWD'] });
client.connect();

function updateStatus(date, status) {
    const timeDiff = -(date.diffNow('days').days);
    date = date.toISODate();
    if (status === 1) {
        date = "---";
        status = "新訂閱";
    } else if (status === 3) {
        status = "已退訂";
    } else {
        if (timeDiff >= 30) {
            status = "未更新";
        } else {
            if (status === 0) {
                status = "已更新";
            } else if (status === 2) {
                status = "本月無更新";
            }
        }
    }
    return new Object({ updateDate: date, status: status });
}

const getdata = async () => {
    const data = new Object();

    data['subscribers'] = new Object();
    for (subscriber of (await pool.query('SELECT subscriber as id, preview_url, download_url FROM subscribers')).rows) {
        const name = (await getUser(subscriber.id.slice(2, -1))).username;
        data.subscribers[subscriber.id] = new Object({
            name,
            preview_url: subscriber.preview_url,
            download_url: subscriber.download_url
        });
    };


    data['artists'] = (await pool.query('SELECT * FROM artists ORDER BY "lastUpdateTime" DESC')).rows;
    data['artists'].forEach((artist, index) => {
        let { status, lastUpdateTime, ...info } = artist;
        lastUpdateTime = DateTime.fromJSDate(lastUpdateTime);
        data.artists[index] = { ...info, ...(updateStatus(lastUpdateTime, status)) };
    });

    // fs.writeFileSync('./subscribe.dat', JSON.stringify(data), { flag: 'w', encoding: 'utf-8' });
    await client.set('data', JSON.stringify(data));
}

const loaddata = async () => {
    if (!await client.exists('data')) await getdata();
    return JSON.parse(await client.get('data'));
    // if (!fs.existsSync('./subscribe.dat')) await getdata();
    // return JSON.parse(fs.readFileSync('./subscribe.dat', { encoding: 'utf-8' }));
}

module.exports = {
    pg: pool,
    redis: client,
    getdata,
    loaddata
}