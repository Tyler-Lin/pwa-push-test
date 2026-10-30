import { existsSync, writeFileSync } from "node:fs";
import webpush from "web-push";

const envPath = new URL("./.env", import.meta.url);

// 換金鑰會讓既有訂閱全部失效，所以不覆蓋
if (existsSync(envPath)) {
  console.log(".env 已存在，不重新產生金鑰。若真的要換，請先手動刪除 .env，並讓 iPhone 重新訂閱。");
  process.exit(0);
}

const { publicKey, privateKey } = webpush.generateVAPIDKeys();

writeFileSync(
  envPath,
  `VAPID_PUBLIC_KEY=${publicKey}\nVAPID_PRIVATE_KEY=${privateKey}\nVAPID_SUBJECT=mailto:you@example.com\n`,
  { mode: 0o600 },
);

// 私鑰只寫入 .env，不印在終端機
console.log("已產生 VAPID 金鑰並寫入 .env");
console.log("");
console.log("公鑰（填入 site/config.js）：");
console.log(publicKey);
console.log("");
console.log("記得把 .env 的 VAPID_SUBJECT 改成你的信箱。");
