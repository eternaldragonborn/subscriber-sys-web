import express from 'express';
import session from 'express-session';
// const RedisStore = require('connect-redis')(session);
import engine from 'ejs-locals';
import { bot } from './modules/discordbot.js';
import parser from 'body-parser';
import morgan from 'morgan';
import multer from 'multer';
const { urlencoded } = parser;

bot.on('ready', async () => {
    console.log('client is login');
});

const app = express();

app.set('trust proxy', 1)
app.engine('ejs', engine);
app.set('views', './src/views');
app.set('view engine', 'ejs');

if (process.env.DEBUG_MODE) app.use(morgan('dev'));
app.use(express.static('./src/public'));
app.use(urlencoded({ extended: false }));
app.use(multer().any());
app.use(session({
    //store: new RedisStore({ client: redis }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: { // 5分鐘內無任何動作session將過期
        //maxAge: 5 * 60 * 1000
    }
}));

import mountRouter from './modules/router.js';

app.listen(process.env['PORT'], async () => {
    await mountRouter(app);
    console.log('web is online now');
});