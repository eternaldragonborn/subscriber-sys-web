import { DateTime } from "luxon";
import { checkUpdate, getdata, redis } from "./db.js";
import { bot } from "./discordbot.js";

// http://localhost:9090/validation?token=test

/**
 * @param { import('express').Express } app
 */
export default async function (app) {
    await bot.login(process.env['BOT_TOKEN']);
    await getdata();

    app.use('/', (await import('../router/public.js')).default);
    app.use('/subscriber', (await import('../router/private.js')).default);
    app.use('/edit', (await import('../router/edit.js')).default);

    // TODO: 排程
    if(await redis.exists('UpdateCheck')) {
        const time = DateTime.fromISO(await redis.get('UpdateCheck'));
        if(time.diffNow('days').days > 3) {
            await checkUpdate();
            await redis.set('UpdateCheck', DateTime.now().toISODate());
        }
    } else {
        await checkUpdate();
        await redis.set('UpdateCheck', DateTime.now().toISODate());
    }
    // await checkUpdate();
};