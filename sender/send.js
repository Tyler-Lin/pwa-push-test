import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import webpush from "web-push";

dotenv.config({ path: fileURLToPath(new URL("./.env", import.meta.url)), quiet: true });

const subscriptionPath = new URL("./subscription.json", import.meta.url);

const [title = "測試推播", body = "這是一則來自 send.js 的推播", url = "./"] = process.argv.slice(2);

const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
  console.error("找不到 VAPID 設定，請先執行 npm run keys");
  process.exit(1);
}

if (!existsSync(subscriptionPath)) {
  console.error("找不到 subscription.json，請把 iPhone 上複製的訂閱 JSON 存成 sender/subscription.json");
  process.exit(1);
}

if (VAPID_SUBJECT.includes("example.com")) {
  console.warn("警告：VAPID_SUBJECT 還是範例值，Apple 可能拒絕，請改成 mailto:你的信箱");
}

const subscription = JSON.parse(readFileSync(subscriptionPath, "utf8"));

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

try {
  const response = await webpush.sendNotification(subscription, JSON.stringify({ title, body, url }), {
    TTL: 3600,
    urgency: "high",
  });
  console.log(`發送成功，狀態碼 ${response.statusCode}`);
} catch (err) {
  console.error(`發送失敗，狀態碼 ${err.statusCode ?? "無"}`);
  console.error(err.body || err.message);
  if (err.statusCode === 404 || err.statusCode === 410) {
    console.error("訂閱已失效，請在 iPhone 重新訂閱，並更新 subscription.json");
  }
  process.exitCode = 1;
}
