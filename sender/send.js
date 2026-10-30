import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import webpush from "web-push";
import { loadSubscriptions, saveSubscriptions, shortId } from "./subscriptions.js";

dotenv.config({ path: fileURLToPath(new URL("./.env", import.meta.url)), quiet: true });

const [title = "測試推播", body = "這是一則來自 send.js 的推播", url = "./"] = process.argv.slice(2);

const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
  console.error("找不到 VAPID 設定，請先執行 npm run keys");
  process.exit(1);
}

if (VAPID_SUBJECT.includes("example.com")) {
  console.warn("警告：VAPID_SUBJECT 還是範例值，Apple 可能拒絕，請改成 mailto:你的信箱");
}

const subscriptions = loadSubscriptions();

if (subscriptions.length === 0) {
  console.error("沒有任何訂閱，請用 pbpaste | npm run add 加入從 iPhone 複製的訂閱 JSON");
  process.exit(1);
}

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const payload = JSON.stringify({ title, body, url });
const results = await Promise.allSettled(
  subscriptions.map((subscription) =>
    webpush.sendNotification(subscription, payload, { TTL: 3600, urgency: "high" }),
  ),
);

const expired = new Set();
let succeeded = 0;

results.forEach((result, i) => {
  const id = shortId(subscriptions[i]);
  if (result.status === "fulfilled") {
    succeeded++;
    console.log(`${id} 發送成功，狀態碼 ${result.value.statusCode}`);
    return;
  }
  const err = result.reason;
  if (err.statusCode === 404 || err.statusCode === 410) {
    expired.add(subscriptions[i].endpoint);
    console.error(`${id} 訂閱已失效（${err.statusCode}），將自動移除；該裝置需重新訂閱`);
  } else {
    console.error(`${id} 發送失敗，狀態碼 ${err.statusCode ?? "無"}`);
    console.error(err.body || err.message);
  }
});

if (expired.size > 0) {
  saveSubscriptions(subscriptions.filter((s) => !expired.has(s.endpoint)));
}

console.log(`完成：成功 ${succeeded}／共 ${subscriptions.length}，移除失效 ${expired.size}`);
if (succeeded < subscriptions.length) process.exitCode = 1;
