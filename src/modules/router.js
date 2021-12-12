const { loaddata, redis } = require('./db');
const { Express } = require('express');

/**
 *
 * @param {Express} app
 */
module.exports = app => {
    app.get('/', async (req, res) => {
        const token = req.query['token'];

        if (token) {
            if (await redis.exists(token)) {
                const data = JSON.parse(await redis.get(token));
                req.session.user = {
                    id: data.id,    // DC id
                    status: data.status // 0: 非訂閱者, 1: 訂閱者, 2: 管理員
                }
                // console.log(data.status);
            }
            res.redirect('/overview');
        } else {
            res.status(401).send("無效的連結，請用指令取得新連結");
        }
    });

    // http://localhost:4567/?token=token
    // http://localhost:4567/?token=test

    app.get('/overview', async (req, res) => {
        if (false && !req.session.user) {
            res.send("no cookie");
            return;
        }

        let data = await loaddata();
        // if (req.query.target ?? '' != '') {
        //     if (req.query.type === 'subscriber') {
        //         data['subscribers'] = data['subscribers'].filter(d => {
        //             return d.subscriber.search(req.query.target) || d.name.search(req.query.target);
        //         })
        //     } else if (req.query.type === 'artist') {

        //     } else if (req.query.type === '') {

        //     } else
        //         res.send('被我抓到偷改html了ㄛ');
        // }
        res.render('overview', { user: req.session.user?.id, status: req.session.user?.status ?? 0, data: data });
    });

    app.get('/subscriber/:id', (req, res, next) => {
        if (!req.session.user || !req.params.id)
            res.status(401).send("無效的訪問");
        else if (req.session.user.id != req.params.id && req.session.user.status != 2)
            res.status(401).send("非管理員，無權修改他人資料");
        else next('route');
    })

    app.get('/subscriber/:id', async (req, res) => {
        let data = await loaddata();
        data.subscribers = data.subscribers.filter(d => { return d.id === `<@${req.params.id}>`; });
        res.render('subscriber', { id: req.params.id, data: data })
    })
};