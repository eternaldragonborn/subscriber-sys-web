const { loaddata, redis, pg, getdata } = require('./db');
const { Express, Router } = require('express');
const { getUserName } = require('./discordbot');
const { DateTime } = require('luxon');

const public = Router();
const edit = Router();
const private = Router();

const dbError = (res, err) => {
    const message = err.detail ?? err.message;
    console.error(message);
    res.status(500).send('ERROR: ' + message);
}

// http://localhost:8000/validation?token=token
// http://localhost:8000/validation?token=test

//#region public Router
public.get('/validation', async (req, res) => {
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
//#endregion

//#region private Router
private.use(async (req, res, next) => {  // 驗證身分
    if ((req.session.user?.status ?? 0) === 0) {
        res.status(401).send("無效的訪問");
    }
    else {
        next();
    };
});

private.get('/get/:type', async (req, res) => {
    let data = await loaddata();
    switch (req.params.type) {
        case 'url':
            res.send(data.subscribers);
            break;
        case 'artist':  // not used
            const id = req.query.id;
            data = data.artists.filter(artist => { return artist.subscriber === `<@${id}>`; });
            res.send(data);
            break;
        default:
            res.status(404).send('unknown data type');
    }
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
//#endregion

//#region edit Router
edit.use((req, res, next) => {  // validation
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

edit.route('/url')
    .put(async (req, res, next) => {  // set up
        const form = req.body;
        if (await getUserName(form.id) === "unknown") {
            res.status(400).send("無效的訂閱者id");
            return;
        }
        pg.query(`INSERT INTO subscribers VALUES('<@${form.id}>', '${form.preview_url}', '${form.download_url}');`)
            .then(() => { res.sendStatus(200); next(); })
            .catch((err) => { dbError(res, err); });
    })
    .patch(async (req, res, next) => {  // edit
        const form = req.body;
        pg.query(`UPDATE subscribers SET preview_url='${form.preview_url}', download_url='${form.download_url}' WHERE subscriber='<@${form.id}>';`)
            .then((result) => {
                if (!result.rowCount) throw new Error("unknown target");
                res.sendStatus(200); next();
            })
            .catch(err => { dbError(res, err); });
    });

edit.route('/artist')
    .put(async (req, res, next) => { // add
        const form = req.body;
        const time = DateTime.utc().toISODate();
        pg.query(`INSERT INTO artists(subscriber, artist, mark, "lastUpdateTime") VALUES('<@${form.id}>', '${form.artist}', '${form.mark}', '${time}')`)
            .then(() => { res.sendStatus(200); next(); })
            .catch(err => { dbError(res, err); });
    })
    .patch(async (req, res, next) => { // edit
        const form = req.body;
        pg.query(`UPDATE artists SET artist='${form.artist}', mark='${form.mark}' WHERE artist='${form.name}'`)
            .then((result) => {
                if (!result.rowCount) throw new Error("unknown target");
                res.sendStatus(200); next();
            })
            .catch(err => { dbError(res, err); });
    })
    .notify(async (req, res, next) => { // update
        const form = req.body;
        const artists = form.artists;
        let query = 'UPDATE artists SET ';
        let data;
        if (form.status === '3') {
            query += 'status = $1 WHERE artist = ANY($2::text[])';
            data = [form.status];
        } else {
            query += '(status, "lastUpdateTime") = ($1, $2) WHERE artist = ANY($3::text[])';
            data = [form.status, DateTime.utc().toISODate()];
        }
        data.push(artists);

        const client = await pg.connect();
        try {
            await client.query('BEGIN');
            const result = await client.query(query, data);
            if (result.rowCount != artists.length) throw new Error('UPDATE列數與繪師數不符');
            await client.query('COMMIT');
            res.sendStatus(200);
            next();
        } catch (err) {
            await client.query('ROLLBACK');
            dbError(res, err);
        } finally {
            client.release();
        }
    });

edit.use(() => {  // reload data
    getdata();
});
//#endregion

/**
 *
 * @param {Express} app
 */
module.exports = app => {
    app.use('/', public);
    app.use('/subscriber', private);
    app.use('/edit', edit);
};