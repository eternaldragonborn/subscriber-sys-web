require('dotenv').config();
const express = require('express');
const session = require('express-session');
// const RedisStore = require('connect-redis')(session);
const engine = require('ejs-locals');
const { getdata, redis } = require('./modules/db');
const { Client } = require('discord.js');
const mountRouter = require('./modules/router');

const app = express();

const bot = new Client({ intents: [32767] });

app.set('trust proxy', 1)
app.engine('ejs', engine);
app.set('views', './src/views');
app.set('view engine', 'ejs');

app.use(express.static('./src/style'));

app.use(session({
    //store: new RedisStore({ client: redis }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,  // 5分鐘內無任何動作session將過期
    cookie: {
        //maxAge: 5 * 60 * 1000
        //maxAge: 30 * 1000
    }
}));

mountRouter(app);

bot.login(process.env['BOT_TOKEN']);

bot.on('ready', () => {
    console.log('client is login')
    getdata(bot);
});

app.listen(80, () => {
    console.log('web is online now');
});