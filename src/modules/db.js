const { Pool } = require('pg');
const fs = require('fs');
const { DateTime } = require('luxon');
const { getUserName } = require('./discordbot');
const pool = new Pool({
    host: 'db',
    user: process.env['SQL_USER'],
    password: process.env['SQL_PASSWD'],
    database: process.env['SQL_DB']
});

const redis = require('redis');
const client = redis.createClient({ url: 'redis://myredis' });
client.connect();

function updateStatus(date, status) {
    const timeDiff = -(date.diffNow('days').days);
    if (status === 1) {
        date = "---";
        status = "無紀錄";
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
        date = date.toISODate();
    }
    return new Object({ date: date, status: status });
}

pool.on('error', (err, client) => {
    console.log(err);
})

module.exports = {
    pg: pool,
    redis: client,
    getdata: async () => {
        const data = new Object();

        data['subscribers'] = new Object();
        for (subscriber of (await pool.query('SELECT subscriber as id, preview_url, download_url FROM subscribers')).rows) {
            const name = await getUserName(subscriber.id.slice(2, -1))
            data.subscribers[subscriber.id] = new Object({
                name,
                preview_url: subscriber.preview_url,
                download_url: subscriber.download_url
            });
        };


        data['artists'] = (await pool.query('SELECT * FROM artists ORDER BY "lastUpdateTime" DESC')).rows;
        data['artists'].forEach(artist => {
            const lastUpdateTime = DateTime.fromJSDate(artist['lastUpdateTime']);
            artist['updateInfo'] = updateStatus(lastUpdateTime, artist.status);
            delete artist.status, delete artist.lastUpdateTime;
        });

        fs.writeFileSync('./src/subscribe.dat', JSON.stringify(data), { flag: 'w', encoding: 'utf-8' });
    },
    loaddata: async () => {
        return JSON.parse(fs.readFileSync('./src/subscribe.dat', { encoding: 'utf-8' }));
    }
}