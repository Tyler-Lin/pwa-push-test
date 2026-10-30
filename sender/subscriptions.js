import { existsSync, readFileSync, writeFileSync } from "node:fs";

export const subscriptionsPath = new URL("./subscriptions.json", import.meta.url);

export function loadSubscriptions() {
  if (!existsSync(subscriptionsPath)) return [];
  return JSON.parse(readFileSync(subscriptionsPath, "utf8"));
}

export function saveSubscriptions(subscriptions) {
  writeFileSync(subscriptionsPath, JSON.stringify(subscriptions, null, 2) + "\n");
}

// 用 endpoint 尾端幾個字元當作簡短代號，方便在輸出中分辨裝置
export function shortId(subscription) {
  return "…" + subscription.endpoint.slice(-8);
}
