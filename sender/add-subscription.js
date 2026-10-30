import { readFileSync } from "node:fs";
import { loadSubscriptions, saveSubscriptions, shortId } from "./subscriptions.js";

// 用法：pbpaste | npm run add，或 npm run add -- '<訂閱 JSON>'
let input = (process.argv[2] ?? readFileSync(0, "utf8")).trim();

// 從手機複製時常漏掉開頭的 {
if (input.startsWith('"endpoint"')) input = "{" + input;

let subscription;
try {
  subscription = JSON.parse(input);
} catch {
  console.error("無法解析訂閱 JSON，請確認複製完整（應以 {\"endpoint\" 開頭）");
  process.exit(1);
}

if (!subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
  console.error("訂閱 JSON 缺少 endpoint 或 keys（p256dh、auth）");
  process.exit(1);
}

const subscriptions = loadSubscriptions();
const index = subscriptions.findIndex((s) => s.endpoint === subscription.endpoint);

if (index === -1) {
  subscriptions.push(subscription);
  console.log(`已新增訂閱 ${shortId(subscription)}`);
} else {
  subscriptions[index] = subscription;
  console.log(`已更新既有訂閱 ${shortId(subscription)}`);
}

saveSubscriptions(subscriptions);
console.log(`目前共 ${subscriptions.length} 個訂閱`);
