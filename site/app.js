import { VAPID_PUBLIC_KEY } from "./config.js";

const $ = (id) => document.getElementById(id);

let registration = null;

// 手機上看不到 console，所有錯誤都顯示在畫面上
function showError(err) {
  const box = $("error");
  box.textContent = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  box.hidden = false;
}

function showMessage(text) {
  $("error").hidden = true;
  $("message").textContent = text;
  $("message").hidden = false;
}

window.addEventListener("error", (event) => showError(event.error ?? event.message));
window.addEventListener("unhandledrejection", (event) => showError(event.reason));

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

async function getSubscription() {
  if (!registration || !("PushManager" in window)) return null;
  return registration.pushManager.getSubscription();
}

function serviceWorkerState() {
  if (!("serviceWorker" in navigator)) return "不支援";
  if (!registration) return "未註冊";
  const worker = registration.active ?? registration.waiting ?? registration.installing;
  const controlled = navigator.serviceWorker.controller ? "，已控制頁面" : "，尚未控制頁面";
  return (worker ? worker.state : "無 worker") + controlled;
}

function renderDiagnostics(subscription) {
  const rows = [
    ["User Agent", navigator.userAgent],
    ["standalone", String(isStandalone())],
    ["Notification.permission", "Notification" in window ? Notification.permission : "不支援"],
    ["支援 PushManager", String("PushManager" in window)],
    ["Service Worker", serviceWorkerState()],
    ["已有訂閱", String(Boolean(subscription))],
  ];
  const list = $("diagnostics");
  list.replaceChildren();
  for (const [label, value] of rows) {
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = value;
    list.append(dt, dd);
  }
}

async function render() {
  const subscription = await getSubscription();

  $("install").hidden = true;
  $("subscribe").hidden = true;
  $("subscribed").hidden = true;

  if (!isStandalone()) {
    $("install").hidden = false;
  } else if (subscription) {
    $("subscription").value = JSON.stringify(subscription);
    $("subscribed").hidden = false;
  } else {
    $("subscribe").hidden = false;
  }

  renderDiagnostics(subscription);
}

async function subscribe() {
  if (!VAPID_PUBLIC_KEY || VAPID_PUBLIC_KEY.startsWith("PASTE_")) {
    throw new Error("config.js 尚未填入 VAPID 公鑰，請先在 sender/ 執行 npm run keys");
  }
  const ready = await navigator.serviceWorker.ready;
  let subscription = await ready.pushManager.getSubscription();
  if (!subscription) {
    subscription = await ready.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }
  return subscription;
}

// 不能是 async：requestPermission() 必須是 click 內第一個呼叫，前面不能有 await，否則 iOS 會拒絕
$("enable").addEventListener("click", () => {
  if (!("Notification" in window)) {
    showError("此環境不支援 Notification，請確認是從主畫面圖示開啟");
    return;
  }
  Notification.requestPermission()
    .then(async (permission) => {
      if (permission !== "granted") {
        throw new Error(`通知權限為 ${permission}，請到 設定 → 通知 → PushTest 開啟，或刪除 App 重新加入主畫面`);
      }
      await subscribe();
      showMessage("訂閱成功");
    })
    .catch(showError)
    .finally(render);
});

$("copy").addEventListener("click", () => {
  const textarea = $("subscription");
  navigator.clipboard.writeText(textarea.value).then(
    () => showMessage("已複製訂閱 JSON"),
    () => {
      textarea.focus();
      textarea.select();
      showMessage("無法自動複製，已選取文字，請手動複製");
    },
  );
});

$("local-test").addEventListener("click", async () => {
  try {
    const ready = await navigator.serviceWorker.ready;
    await ready.showNotification("本機測試通知", {
      body: "這則通知沒有經過推播伺服器",
      icon: "icons/icon-192.png",
      data: { url: "./" },
    });
  } catch (err) {
    showError(err);
  }
});

$("unsubscribe").addEventListener("click", async () => {
  try {
    const subscription = await getSubscription();
    if (subscription) await subscription.unsubscribe();
    showMessage("已取消訂閱");
  } catch (err) {
    showError(err);
  }
  await render();
});

async function init() {
  if ("serviceWorker" in navigator) {
    try {
      registration = await navigator.serviceWorker.register("./sw.js");
    } catch (err) {
      showError(err);
    }
  } else {
    showError("此瀏覽器不支援 Service Worker");
  }
  await render();
}

init();
