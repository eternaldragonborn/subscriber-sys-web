import { Client, User, GuildMember, Webhook } from 'discord.js';
import { webhooks, guilds, hookSetting, emojis } from './env.js';

export const bot = new Client({ intents: [32767] });

/**
 * @type { Webhook[] }
 */
const notifyHooks = new Array();
bot.on('ready', () => {
    for (let hook of Object.values(webhooks.subscribe)) {
        bot.fetchWebhook(hook)
            .then(webhook => { notifyHooks.push(webhook); })
            .catch(err => console.log(`fetch webhook ${hook} failed, ${err.message}`));
    };
});

/**
 *
 * @param {string} id - user ID
 * @returns {Promise<GuildMember | User | undefined>}
 */
export const getUser = async (id) => {
    if (id.startsWith('<@')) id = id.match(/\d{17,18}/)[0];
    try {
        const guild = await bot.guilds.fetch(guilds.furry);
        const user = await guild.members.fetch(id);
        return user;
    } catch (err) {
        console.log(err.message);
        bot.users.fetch(id)
            .then(user => { return user; })
            .catch((err) => { console.log(err.message); return undefined; })
    }
}

/**
 * @param {string} id
 * @param  {import('discord.js').MessageOptions | import('discord.js').MessageOptions[]} options
 */
export const notify = async (id, options) => {
    for (let hook of notifyHooks) {
        let user;
        try {
            user = await getUser(id);
        } catch (err) {
            console.log(err.message);
        }
        await hookSetting(hook, '訂閱通知', user);
        if(Array.isArray(options)) {
            for (let option of options) {
                await hook.send(option);
            }
        } else await hook.send(options);
    }
}

/**
 *
 * @param {string} id
 * @param {"subscriber" | "free"} type
 * @param {MessageOptions} options
 */
export const sendWebhook = async (id, type, options) => {
    const user = await getUser(id);
    try {
        const hook = await bot.fetchWebhook(webhooks.book[type]);
        await hookSetting(hook, '本本上傳', user);
        const msg = await hook.send(options);
        await msg.react(emojis.book);

        // TODO: 建檔
    } catch(err) {
        console.log(err.message);
    }
}