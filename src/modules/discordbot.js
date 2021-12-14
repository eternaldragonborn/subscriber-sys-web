const { Client } = require('discord.js');

const bot = new Client({ intents: [32767] });

module.exports = {
    bot: bot,
    getUserName: async (id) => {
        return (bot.users
            .fetch(id))
            .then(user => { return user.username; });
    }
}