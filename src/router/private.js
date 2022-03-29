import { loaddata, mongoDB, redis } from "../modules/db.js";
import { MessageEmbed, MessageAttachment } from "discord.js";
import { Router } from "express";
import { sendWebhook, notify } from "../modules/discordbot.js";

/**
 * @type { import('../modules/types').SubscribeData }
 */
var data;
const router = Router();

router.use(async (req, res, next) => {
  // 驗證身分
  if ((req.session.user?.status ?? 0) === 0) {
    res.status(401).send("無效的訪問");
  } else {
    data = await loaddata();
    next();
  }
});

router.get("/get/:type", async (req, res) => {
  switch (req.params.type) {
    case "url":
      res.json(data.subscribers);
      break;
    case "artist": // not used
      const id = req.query.id;
      const artists = data.artists.filter((artist) => {
        return artist.subscriber === `<@${id}>`;
      });
      res.json(artists);
      break;
    default:
      res.status(404).send("unknown data type");
  }
});

router.get("/:id", async (req, res) => {
  if (req.session.user?.id != req.params.id && req.session.user?.status != 2) {
    res.status(401).send("非管理員，無權修改他人資料");
    return;
  }
  const info = new Object();
  info.subscribers = data.subscribers[`<@${req.params.id}>`];
  info.artists = data.artists.filter((artist) => {
    return artist.subscriber === `<@${req.params.id}>`;
  });
  res.render("subscriber", {
    id: req.params.id,
    status: req.session.user.status,
    data: info,
  });
});

router.post("/book", async (req, res) => {
  /**
   * @type {{id: string; author: string; channel: 'subscriber' | 'free'; title: string; url: string;}}
   */
  const form = req.body;
  const image = new MessageAttachment(
    req.files[0].buffer,
    req.files[0].originalname,
  );
  const embed = new MessageEmbed()
    .setTitle(form.title)
    .setColor("GOLD")
    .addField("作者", `\`${form.author}\``)
    .setImage("attachment://" + image.name);

  try {
    const msg = await sendWebhook(form.id, form.channel, {
      embeds: [embed],
      files: [image],
    });
    await mongoDB.connect();
    const collection = mongoDB.db("book-record").collection("books");
    await collection
      .insertOne({ _id: msg.id, url: form.url, users: [] })
      .catch((err) => {
        console.log(err.message);
        throw Error("資料建檔錯誤");
      });
    await redis.sAdd("msg_ids", msg.id);
    res.sendStatus(200);
  } catch (err) {
    res.status(500).send(err);
  }
});

router.post("/pack", async (req, res) => {
  /**
   * @type {{id: string; author: string; url: string;}}
   */
  const form = req.body;
  const subscriberData = data.subscribers[`<@${form.id}>`];
  const embed = new MessageEmbed()
    .setTitle("圖包上傳")
    .setColor("GOLD")
    .addField("作者", `\`${form.author}\``);
  if (form.url) embed.addField("直接連結", form.url);
  if (subscriberData.preview_url)
    embed.addField("預覽", subscriberData.preview_url);
  embed.addField("下載", subscriberData.download_url);
  const payload = { embeds: [embed] };

  if (req.files.length) {
    const image = new MessageAttachment(
      req.files[0].buffer,
      req.files[0].originalname,
    );
    embed.setImage("attachment://" + image.name);
    payload.files = [image];
  }

  try {
    await notify(form.id, payload);
    res.sendStatus(200);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

export default router;
