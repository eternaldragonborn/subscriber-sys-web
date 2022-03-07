import { Router } from 'express';
import { redis, loaddata } from '../modules/db.js';

const router = Router();

router.get('/validation', async (req, res) => {
    const token = req.query['token'];

    if (await redis.exists(token)) {
        const data = JSON.parse(await redis.get(token));
        req.session.user = {
            id: data.id,    // DC id
            status: data.status // 0: 非訂閱者, 1: 訂閱者, 2: 管理員
        }
        res.redirect('/');
        if (!process.env.DEBUG_MODE) await redis.del(token);
    } else {
        res.status(401).send("無效的連結，請用指令取得新連結");
    }
});

router.get('/', async (req, res) => {
    const data = await loaddata();
    res.render('overview', { user: req.session.user?.id, status: req.session.user?.status ?? 0, data });
});

router.get('/test', (req, res) => {
    res.sendStatus(200);
});

export default router;