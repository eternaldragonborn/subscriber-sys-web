const express = require('express');
const session = require('express-session');
// const RedisStore = require('connect-redis')(session);
const engine = require('ejs-locals');
const { getdata, redis } = require('./modules/db');
const { bot } = require('./modules/discordbot');
const bodyParser = require('body-parser');

const app = express();

app.set('trust proxy', 1)
app.engine('ejs', engine);
app.set('views', './src/views');
app.set('view engine', 'ejs');

app.use(express.static('./src/public'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(require('multer')().array());
app.use(session({
    //store: new RedisStore({ client: redis }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,  // 5分鐘內無任何動作session將過期
    cookie: {
        //maxAge: 5 * 60 * 1000
    }
}));

require('./modules/router')(app);

bot.login(process.env['BOT_TOKEN']);

bot.on('ready', async () => {
    console.log('client is login')
    await getdata();
});

app.listen(80, () => {
    console.log('web is online now');
});