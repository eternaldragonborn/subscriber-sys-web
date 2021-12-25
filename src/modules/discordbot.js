const { Client } = require('discord.js');
const { webhooks } = require('./env');

const bot = new Client({ intents: [32767] });
const hooks = new Array();
for (let hook of webhooks) {
    bot.fetchWebhook(hook)
        .then(webhook => hooks.push(webhook))
        .catch(err => console.log(`fetch webhook ${hook} failed, ${err.message}`));
};

const getUser = async (id) => {
    if (id.startsWith('<@')) id = id.slice(2, -1);
    return (bot.users
        .fetch(id))
        .then(user => { return user; })
        .catch(() => { return "unknown"; });
}

module.exports = {
    bot,
    getUser,
    notify: async (id, options) => {
        for (let hook of hooks) {
            const user = await getUser(id);
            await hook.edit({ name: user.username + '(訂閱通知)', avatar: user.avatarURL() });
            await hook.send(options);
        }
    }
}