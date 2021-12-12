const { Pool } = require('pg');
const fs = require('fs');
const { DateTime } = require('luxon');
const pool = new Pool({
    host: 'db',
    user: process.env['SQL_USER'],
    password: process.env['SQL_PASSWD'],
    database: process.env['SQL_DB']
});

const redis = require('redis');
const client = redis.createClient({ url: 'redis://myredis' });
client.connect();

module.exports = {
    pg: pool,
    redis: client,
    getdata: async (bot) => {
        const data = new Object();
        data['subscribers'] =
            (await pool
                .query('SELECT subscriber as id, preview_url, download_url FROM subscribers'))
                .rows;

        data['subscribers'].forEach(subscriber => {
            bot.users
                .fetch(subscriber.id.slice(2, -1))
                .then(user => subscriber['name'] = user.username);
        });

        data['artists'] = (await pool.query('SELECT * FROM artists')).rows;
        data['artists'].forEach(artist => {
            const lastUpdateTime = DateTime.fromJSDate(artist['lastUpdateTime']);
            const timeDiff = (-lastUpdateTime.diffNow('days').days);
            if (artist.status === 0) {
                if (timeDiff >= 30) {
                    artist.status = "未更新";
                } else {
                    artist.status = "已更新";
                }
            } else if (artist.status === 1) {
                artist.lastUpdateTime = "---";
                artist.status = "無紀錄";
            } else if (artist.status === 2) {
                artist.status = "本月無更新";
            }
        })

        fs.writeFileSync('./src/subscribe.dat', JSON.stringify(data), { flag: 'w', encoding: 'utf-8' });
    },
    loaddata: async () => {
        return JSON.parse(fs.readFileSync('./src/subscribe.dat', { encoding: 'utf-8' }));
    }
}