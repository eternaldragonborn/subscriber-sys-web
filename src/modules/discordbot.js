const { Client, User, GuildMember } = require('discord.js');
const { webhooks, book_webhooks, guilds } = require('./env');

const bot = new Client({ intents: [32767] });
bot.login(process.env['BOT_TOKEN']);

const hooks = new Array();
for (let hook of webhooks) {
    bot.fetchWebhook(hook)
        .then(webhook => { hooks.push(webhook); })
        .catch(err => console.log(`fetch webhook ${hook} failed, ${err.message}`));
};

/**
 *
 * @param {string} id - user ID
 * @returns {Promise<GuildMember | User | undefined>}
 */
const getUser = async (id) => {
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

module.exports = {
    bot,
    getUser,
    notify: async (id, ...options) => {
        for (let hook of hooks) {
            let user;
            try {
                user = await getUser(id);;
            } catch (err) {
                console.log(err.message);
            }
            await hook.edit({ name: (user.displayName ?? user.username ?? 'unknown') + '(訂閱通知)', avatar: user.displayAvatarURL() });
            for (let option of options) {
                await hook.send(option);
            }
        }
    },
    /**
     *
     * @param {string} id
     * @param {"subscriber" | "free"} type
     * @param {import('discord.js').MessageOptions} options
     */
    sendWebhook: async (id, type, options) => {
        const user = await getUser(id);
        try {
            const hook = await bot.fetchWebhook(book_webhooks[type])
            await hook.edit({name: (user.displayName ?? user.username ?? 'unknown') + '(本本上傳)', avatar: user.displayAvatarURL() });
            const msg = await hook.send(options);
            await msg.react()
        } catch(err) {
            console.log(err.message);
        }
    }
}