import { loaddata, pg, getdata, getTime, dbError } from '../modules/db.js';
import { MessageEmbed, MessageAttachment } from 'discord.js';
import { Router } from 'express';
import { notify, getUser } from '../modules/discordbot.js';

/**
 * @type { import('../modules/types').SubscribeData }
 */
var data;
const router = Router();

router.use(async (req, res, next) => {  // validation
    if (!req.session.user)
        res.status(403).send("非訂閱者");
    else if (!Object.keys(req.body).length)
        res.status(400).send("empty form");
    else if (req.session.user.id != req.body.id && req.session.user.status != 2)
        res.status(403).send("非管理員，無權修改他人資料");
    else {
        data = await loaddata();
        next();
    }
});

router.route('/url')
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

router.route('/artist')
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
            if (form.mark) embed.addField('備註', form.mark, true);
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
            const payload = [{embeds: [embed]}];
            if (req.files.length) {
                const attachments = req.files.map((file) => new MessageAttachment(file.buffer, file.originalname));
                embed.setImage(`attachment://${attachments[0].name}`);
                payload[0].files = [attachments.shift()];
                if(attachments.length)  payload.push({ files: attachments });
            }
            notify(subscriber, payload);

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

router.use(async () => {  // reload data
    await getdata();
    data = await loaddata();
});

export default router;