const express = require('express');
const session = require('express-session');
// const RedisStore = require('connect-redis')(session);
const engine = require('ejs-locals');
const { bot } = require('./modules/discordbot');
const bodyParser = require('body-parser');

bot.on('ready', async () => {
    console.log('client is login');
});

const app = express();

app.set('trust proxy', 1)
app.engine('ejs', engine);
app.set('views', './src/views');
app.set('view engine', 'ejs');

if (process.env.DEBUG_MODE) app.use(require('morgan')('dev'));
app.use(express.static('./src/public'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(require('multer')().any());
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

require('./modules/router')(app);

app.listen(process.env['PORT'], () => {
    console.log('web is online now');
});