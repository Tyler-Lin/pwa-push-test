self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// iOS 要求每一則推播都顯示通知，否則 Safari 可能撤銷訂閱
self.addEventListener("push", (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { body: event.data.text() };
    }
  }

  const title = data.title || "Push Test";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "icons/icon-192.png",
      data: { url: data.url || "./" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "./", self.registration.scope).href;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      if (windows.length > 0) return windows[0].focus();
      return self.clients.openWindow(url);
    })(),
  );
});
