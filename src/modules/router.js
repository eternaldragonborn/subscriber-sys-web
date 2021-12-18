const { loaddata, redis, pg, getdata } = require('./db');
const { Express, Router } = require('express');
const { getUserName } = require('./discordbot');
const { DateTime } = require('luxon');

const public = Router();
const edit = Router();
const private = Router();

const dbError = (res, err) => {
    console.error(err.detail);
    res.status(500).send(err.detail);
}

// http://localhost:4567/valid?token=token
// http://localhost:4567/valid?token=test

public.get('/valid', async (req, res) => {
    const token = req.query['token'];

    if (token) {
        if (await redis.exists(token)) {
            const data = JSON.parse(await redis.get(token));
            req.session.user = {
                id: data.id,    // DC id
                status: data.status // 0: 非訂閱者, 1: 訂閱者, 2: 管理員
            }
            // console.log(data.status);
        }
        res.redirect('/');
    } else {
        res.status(401).send("無效的連結，請用指令取得新連結");
    }
});

public.get('/', async (req, res) => {
    let data = await loaddata();
    res.render('overview', { user: req.session.user?.id, status: req.session.user?.status ?? 0, data: data });
});

private.use((req, res, next) => {  // 驗證身分
    if ((req.session.user?.status ?? 0) === 0) {
        res.status(401).send("無效的訪問");
    }
    else { next(); };
});

private.get('/get-urls', async (req, res) => {
    const data = await loaddata();
    res.send(data.subscribers);
});

private.get('/get-artists', async (req, res) => {
    const id = req.query.id;
    let data = await loaddata();
    data = data.artists.filter(artist => { return artist.subscriber === `<@${id}>`; });
    res.send(data);
});

private.get('/:id', async (req, res) => {
    if (req.session.user?.id != req.params.id && req.session.user?.status != 2) {
        res.status(401).send("非管理員，無權修改他人資料");
        return;
    }
    let data = await loaddata();
    data.subscribers = data.subscribers[`<@${req.params.id}>`];
    data.artists = data.artists.filter(artist => { return artist.subscriber === `<@${req.params.id}>`; });
    res.render('subscriber', { id: req.params.id, data });
});

edit.use((req, res, next) => {
    if (!req.session.user)
        res.status(403).send("非訂閱者");
    else if (!Object.keys(req.body).length)
        res.status(400).send("empty form");
    else if (req.session.user.id != req.body.id && req.session.user.status != 2)
        res.status(403).send("非管理員，無權修改他人資料");
    else {
        next();
    }
});

edit.post('/url', async (req, res, next) => {
    const form = req.body;
    pg.query(`UPDATE subscribers SET preview_url='${form.preview_url}', download_url='${form.download_url}' WHERE subscriber='<@${form.id}>';`)
        .then((result) => {
            if (!result.rowCount) throw new Error("unknown target");
        })
        .then(() => { res.sendStatus(200); next(); })
        .catch(err => { dbError(res, err); });
});

edit.post('/set-up', async (req, res, next) => {
    const form = req.body;
    if (await getUserName(form.id) === "unknown") {
        res.status(400).send("無效的訂閱者id");
        return;
    }
    pg.query(`INSERT INTO subscribers VALUES('<@${form.id}>', '${form.preview_url}', '${form.download_url}');`)
        .then(() => { res.sendStatus(200); next(); })
        .catch((err) => { dbError(res, err); });
});

edit.post('/add-artist', async (req, res, next) => {
    const form = req.body;
    const time = DateTime.utc().toISODate();
    pg.query(`INSERT INTO artists(subscriber, artist, mark, "lastUpdateTime") VALUES('<@${form.id}>', '${form.artist}', '${form.mark}', '${time}')`)
        .then(() => { res.sendStatus(200); next(); })
        .catch(err => { dbError(res, err); });
});

edit.use(() => {  // reload data
    getdata();
});

/**
 *
 * @param {Express} app
 */
module.exports = app => {
    app.use('/', public);
    app.use('/subscriber', private);
    app.use('/edit', edit);
};