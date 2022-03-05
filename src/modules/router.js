const { loaddata, redis, pg, getdata } = require('./db');
const { MessageEmbed, MessageAttachment } = require('discord.js');
const { Express, Router } = require('express');
const { notify, getUser, sendWebhook } = require('./discordbot');
const { getTime } = require('./env');

const public = Router();
const edit = Router();
const private = Router();

var data;

const dbError = (res, err) => {
    const message = err.detail ?? err.message;
    console.error(message);
    res.status(500).send('ERROR: ' + message);
}

// http://localhost:9090/validation?token=test

//#region public Router
public.get('/validation', async (req, res) => {
    const token = req.query['token'];

    if (await redis.exists(token)) {
        const data = JSON.parse(await redis.get(token));
        req.session.user = {
            id: data.id,    // DC id
            status: data.status // 0: 非訂閱者, 1: 訂閱者, 2: 管理員
        }
        res.redirect('/');
        if (!process.env.DEBUG_MODE) await redis.del(token);
    } else {
        res.status(401).send("無效的連結，請用指令取得新連結");
    }
});

public.get('/', async (req, res) => {
    res.render('overview', { user: req.session.user?.id, status: req.session.user?.status ?? 0, data });
});

public.get('/test', (req, res) => {
    if (data) res.sendStatus(200);
    else res.sendStatus(500);
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
    switch (req.params.type) {
        case 'url':
            res.send(data.subscribers);
            break;
        case 'artist':  // not used
            const id = req.query.id;
            artists = data.artists.filter(artist => { return artist.subscriber === `<@${id}>`; });
            res.send(artists);
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
    const info = new Object();
    info.subscribers = data.subscribers[`<@${req.params.id}>`];
    info.artists = data.artists.filter(artist => { return artist.subscriber === `<@${req.params.id}>`; });
    res.render('subscriber', { id: req.params.id, status: req.session.user.status, data: info });
});

private.post('/book', async (req, res) => {
    /**
     * @type {{id: string; author: string; channel: 'subscriber' | 'free'; title: string; url: string;}}
     */
    const form = req.body;
    const image = new MessageAttachment(req.files[0].buffer, req.files[0].originalname);
    const embed = new MessageEmbed()
        .setTitle(form.title)
        .setColor('GOLD')
        .addField('作者', form.author)
        .setImage('attachment://' + image.name);

    try {
        await sendWebhook(form.id, form.channel, {embeds: [embed], files: [image]});
        res.sendStatus(200);
    } catch(err) {
        res.status(500).send(err.message);
    }
});

private.post('/pack', async (req, res) => {
    /**
     * @type {{id: string; author: string; url: string;}}
     */
    const form = req.body;
    const image = new MessageAttachment(req.files[0].buffer, req.files[0].originalname);
    const embed = new MessageEmbed()
        .setTitle('圖包上傳')
        .setColor('GOLD')
        .addField('作者', form.author)
        .setImage('attachment://' + image.name);

    try {
        await sendWebhook(form.id, form.channel, {embeds: [embed], files: [image]});
        res.sendStatus(200);
    } catch(err) {
        res.status(500).send(err.message);
    }
})
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
        if (await getUser(form.id) === "unknown") {
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
        const time = getTime();
        pg.query(`INSERT INTO artists(subscriber, artist, mark, "lastUpdateTime")
                VALUES('<@${form.id}>', '${form.artist}', '${form.mark}', '${time.toISODate()}')`)
            .then(() => {
                res.sendStatus(200);
                const embed = new MessageEmbed()
                    .setTitle('新訂閱繪師')
                    .setTimestamp(time.toJSDate())
                    .setColor('AQUA')
                    .addField('繪師', `\`${form.artist}\``, true);
                if (form.mark) embed.addField('備註', form.mark, true);
                notify(form.id, { embeds: [embed] });
                next();
            })
            .catch(err => { dbError(res, err); });
    })
    .patch(async (req, res, next) => { // edit
        const form = req.body;
        pg.query(`UPDATE artists SET artist='${form.artist}', mark='${form.mark}' WHERE artist='${form.name}'`)
            .then((result) => {
                if (!result.rowCount) throw new Error("unknown target");
                res.sendStatus(200);
                // const embed = new MessageEmbed()
                //     .setTitle('繪師資料更動')
                //     .setColor('DARK_GREEN')
                //     .setFooter('詳細請至網頁查看');
                // if (form.artist != form.name) embed.addField('繪師更名', `\`${form.artist}\` -> \`${form.name}\``);
                // else embed.addField('繪師', `\`${form.artist}\``);
                // notify(data.artists[form.artist].subscriber, { embeds: [embed] });
                next();
            })
            .catch(err => { dbError(res, err); });
    })
    .notify(async (req, res, next) => { // update
        const form = req.body;
        const time = getTime();

        let query = 'UPDATE artists SET ';
        let values = new Array();
        if (form.status === '3') {
            query += 'status = $1 WHERE artist = ANY($2::text[])';
            values.push(form.status);
        } else {
            query += '(status, "lastUpdateTime") = ($1, $2) WHERE artist = ANY($3::text[])';
            values.push(form.status, time.toISO({ includeOffset: false }));
        }
        values.push(form.artists);

        const client = await pg.connect();
        try {
            await client.query('BEGIN');
            const result = await client.query(query, values);
            if (result.rowCount != form.artists.length) throw new Error('資料庫更新發生未知錯誤');
            await client.query('COMMIT');
            res.sendStatus(200);
            const subscriber = data.artists.find(v => { return form.artists.includes(v.artist); }).subscriber;

            const embed = new MessageEmbed()
                .addField('繪師', form.artists.map(v => `\`${v}\``).join('\n'), true)
                .setTimestamp(time.toJSDate());
            if (form.mark) embed.addField('備註/原因', form.mark, true);
            if (form['download-url']) embed.addField('檔案連結', form['download-url'], false);
            switch (form.status) {
                case '0': // 更新
                    embed.setTitle('繪師更新')
                        .setColor('GREEN');
                    if (data.subscribers[subscriber].preview_url)
                        embed.addField('預覽', data.subscribers[subscriber].preview_url, false);
                    embed.addField('下載', data.subscribers[subscriber].download_url, false);
                    break;
                case '2': // 停更
                    embed.setTitle('繪師停更')
                        .setColor('DARK_GREY');
                    break;
                case '3': // unsub
                    embed.setTitle('取消訂閱')
                        .setColor('DARK_RED');
                    break;
            }
            let attachments;
            if (req.files) {
                attachments = req.files.map((file) => new MessageAttachment(file.buffer, file.originalname))
                embed.setImage(`attachment://${attachments[0].name}`);
            }

            notify(subscriber, { embeds: [embed], files: [attachments.shift()] }, { files: attachments });
            next();
        } catch (err) {
            await client.query('ROLLBACK');
            dbError(res, err);
        } finally {
            client.release();
        }
    })
    .delete(async (req, res, next) => {
        const form = req.body;
        pg.query('DELETE FROM artists WHERE artist=ANY($1::text[])', [form.artists])
            .then(() => {
                res.sendStatus(200);
                const embed = new MessageEmbed()
                    .setTitle('繪師資料刪除')
                    .setColor('RED')
                    .addField('繪師', form.artists.map(v => `\`${v}\``).join('\n'));
                notify(form.id, { embeds: [embed] });
                next();
            })
            .catch(err => dbError(res, err));
    });

edit.use(async () => {  // reload data
    await getdata();
    data = await loaddata();
});
//#endregion

/**
 *
 * @param {Express} app
 */
module.exports = async app => {
    await getdata();
    data = await loaddata();
    app.use('/', public);
    app.use('/subscriber', private);
    app.use('/edit', edit);
};