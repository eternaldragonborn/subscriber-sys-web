import Pg from "pg";
import { DateTime } from "luxon";
import { getUser, bot } from "./discordbot.js";
import { webhooks, UpdateStatus, hookSetting } from "./env.js";
import { createClient } from "redis";
import { MongoClient, ServerApiVersion } from "mongodb";

export const pg = new Pg.Pool({
  host: process.env["SQL_HOST"],
  user: process.env["SQL_USER"],
  password: process.env["SQL_PASSWD"],
  database: process.env["SQL_DB"],
  ssl: process.env.DEBUG_MODE
    ? false
    : {
        rejectUnauthorized: false,
      },
});
export const redis = createClient({
  url: "redis://" + process.env["REDIS_HOST"],
  password: process.env["REDIS_PASSWD"],
});
redis.connect();

export const getTime = () => DateTime.now().setZone("Asia/Taipei");

export const updateStatus = (date, status) => {
  const timeDiff = -date.diffNow("days").days;
  date = date.toISODate();
  if (timeDiff >= 30 && status !== UpdateStatus.unSubscribed) {
    status = "未更新";
  } else if (status === UpdateStatus.newSubscribe) {
    status = "新訂閱";
  } else if (status === UpdateStatus.unSubscribed) {
    status = "已退訂";
  } else if (status === UpdateStatus.normal) {
    status = "已更新";
  } else if (status === UpdateStatus.noUpdate) {
    status = "本月無更新";
  }
  return new Object({ updateDate: date, status: status });
};

/**
 * 將database中資料存至Collect中
 */
export const getdata = async () => {
  const data = new Object();

  data["subscribers"] = new Object();
  for (let subscriber of (
    await pg.query(
      "SELECT subscriber as id, preview_url, download_url FROM subscribers",
    )
  ).rows) {
    const user = await getUser(subscriber.id);
    const name = user?.displayName ?? user?.username ?? "unknown";
    data.subscribers[subscriber.id] = {
      name,
      preview_url: subscriber.preview_url,
      download_url: subscriber.download_url,
    };
  }

  data["artists"] = (
    await pg.query('SELECT * FROM artists ORDER BY "lastUpdateTime" DESC')
  ).rows;
  data["artists"].forEach((artist, index) => {
    let { status, lastUpdateTime, ...info } = artist;
    lastUpdateTime = DateTime.fromJSDate(lastUpdateTime);
    data.artists[index] = { ...info, ...updateStatus(lastUpdateTime, status) };
  });

  await redis.set("data", JSON.stringify(data));
};

/**
 * @returns {Promise<import('./types').SubscribeData>}
 * 回傳Collect中的資料
 */
export const loaddata = async () => {
  if (!(await redis.exists("data"))) await getdata();
  return JSON.parse(await redis.get("data"));
};

export const checkUpdate = async () => {
  const targetDate = getTime().minus({ day: 30 }).toISODate();
  /**
   * @type {import('./types').ArtistData[]}
   */
  let data = (
    await pg.query(
      `SELECT * FROM artists WHERE "lastUpdateTime" < '${targetDate}' AND status != ${UpdateStatus.unSubscribed}`,
    )
  ).rows;
  const filteredData = data.map((artist) => {
    let time = DateTime.fromJSDate(artist.lastUpdateTime).toFormat("LL/dd");
    if (artist.status === UpdateStatus.newSubscribe)
      time = `新增後未更新，${time}`;
    return {
      artist: artist.artist,
      subscriber: artist.subscriber,
      lastUpdateTime: time,
    };
  });

  /**
   * @type {{[subscriber: string]: string}}
   */
  const sortedData = {};
  filteredData.forEach((data) => {
    const { subscriber, ...info } = data;
    if (!Object.keys(sortedData).includes(subscriber)) {
      sortedData[subscriber] = `\`${info.artist}\`(${info.lastUpdateTime})`;
    } else {
      sortedData[subscriber] += `、\`${info.artist}\`(${info.lastUpdateTime})`;
    }
  });

  let content = "30天未更新：\n>>> ";
  if (!Object.keys(sortedData).length) content += "無";
  else {
    Object.keys(sortedData).forEach((subscriber) => {
      content += `${subscriber}：${sortedData[subscriber]}\n`;
    });
  }

  try {
    const hook = await bot.fetchWebhook(webhooks.subscribe.notification);
    await hookSetting(hook, "未更新訂閱通知");
    await hook.send({ content });
  } catch (err) {
    console.log("發送未更新通知失敗，原因： " + err.message);
  }
};

export const dbError = (res, err) => {
  const message = err.detail ?? err.message;
  console.error(message);
  res.status(500).send("ERROR: " + message);
};

const mongoPWD = encodeURIComponent(process.env.MONGO_PWD);
const database = encodeURIComponent("Fafnir-Database");
const uri = `mongodb+srv://EternalDragonborn:${mongoPWD}@fafnir-database.tk85b.mongodb.net/${database}?retryWrites=true&w=majority`;
export const mongoDB = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

mongoDB.on("commandFailed", (err) => {
  console.log(`MongoDB操作失敗，${err.failure.message}`);
});
