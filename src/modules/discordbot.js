const { Client } = require('discord.js');
const { webhooks, guilds } = require('./env');

const bot = new Client({ intents: [32767] });
bot.login(process.env['BOT_TOKEN']);

const hooks = new Array();
for (let hook of webhooks) {
    bot.fetchWebhook(hook)
        .then(webhook => { hooks.push(webhook); })
        .catch(err => console.log(`fetch webhook ${hook} failed, ${err.message}`));
};

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
        if (id.startsWith('<@')) id = id.match(/\d{17,18}/)[0];
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
    }
}