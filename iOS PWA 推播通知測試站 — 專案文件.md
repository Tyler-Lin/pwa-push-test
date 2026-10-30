# iOS PWA 推播通知測試站 — 專案文件

Oct 29, 2026 · @Tyler

## 專案目標與範圍

目標：做一個最小可用的 PWA，驗證 iPhone 安裝到主畫面後，能收到由伺服器端發送、出現在鎖定畫面的推播通知。

**在範圍內**

- 一個靜態測試網站（manifest、Service Worker、單一頁面），部署在有 HTTPS 的主機
- 頁面引導使用者「加入主畫面」、請求通知權限、產生並顯示訂閱資訊（JSON）
- 一支在本機執行的 Node.js 發送腳本，用 VAPID 金鑰對訂閱發送 Web Push
- 頁面內的診斷資訊與「本機測試通知」，方便排查卡在哪一步

**不在範圍內**

- 後端資料庫與自動保存訂閱（訂閱 JSON 改為手動複製貼上）
- Android、桌機瀏覽器的相容處理（能用但不特別驗證）
- 使用者帳號、多裝置管理、正式 UI 設計

**前提條件**：iPhone 為 iOS 16.4 以上，使用 Safari 加入主畫面；本機已安裝 Node.js 18 以上。

## 架構與推播流程

訂閱在 iPhone 上只做一次；之後每次推播都由本機腳本送到 Apple 推播服務，再由 Apple 投遞到手機。

```
 iPhone（主畫面 PWA）          本機電腦（sender/）            Apple 推播服務
 ─────────────────────         ──────────────────            ──────────────
 ① 用 VAPID 公鑰訂閱 ─────────────────────────────────────▶  建立訂閱端點
 ② 取得訂閱 JSON ◀─────────────────────────────────────────  回傳 endpoint 與金鑰
 ③ 手動複製訂閱 JSON ────────▶ 加入 subscriptions.json
                               ④ send.js 用 VAPID 私鑰簽章 ─▶ 驗證發送者身分
 ⑤ SW 收到 push、顯示通知 ◀──────────────────────────────── 投遞推播
```

公鑰在 ① 讓 Apple 綁定訂閱，私鑰在 ④ 證明發送者身分，兩者必須是同一組。正式產品只需把 ③ 改成網站自動 POST 訂閱到後端保存，其餘步驟不變。

## 檔案結構

專案分兩個資料夾：`site/` 整包部署上線，`sender/` 只留在本機，絕不部署（裡面有私鑰）。

```
pwa-push-test/
├── site/                      # 部署到 HTTPS 主機
│   ├── index.html             # 主頁面：引導安裝、訂閱、診斷
│   ├── app.js                 # 頁面邏輯（註冊 SW、訂閱、複製 JSON）
│   ├── sw.js                  # Service Worker：收推播、點擊開啟
│   ├── manifest.json          # PWA 設定
│   ├── config.js              # VAPID 公鑰（可公開）
│   └── icons/
│       ├── icon-192.png
│       ├── icon-512.png
│       └── apple-touch-icon.png   # 180×180，iOS 主畫面圖示
└── sender/                    # 只在本機執行
    ├── package.json
    ├── generate-keys.js       # 產生 VAPID 金鑰
    ├── send.js                # 對所有訂閱發送推播
    ├── add-subscription.js    # 把訂閱 JSON 加入清單
    ├── subscriptions.js       # 讀寫訂閱清單的共用函式
    ├── .env                   # VAPID 公私鑰、聯絡信箱（加入 .gitignore）
    ├── subscriptions.json     # 所有裝置的訂閱清單（加入 .gitignore）
    └── .gitignore             # 列入 .env、subscriptions.json、node_modules/
```

| 檔案 | 能否公開 | 說明 |
| --- | --- | --- |
| `site/config.js` | 可以 | 只放 VAPID 公鑰 |
| `sender/.env` | 不行 | VAPID 私鑰外洩，別人就能冒名推播給你的訂閱者 |
| `sender/subscriptions.json` | 不建議 | 含裝置的推播端點與加密金鑰 |

## 實作規格

網站用純 HTML/JS，不用框架與打包工具，所有路徑用相對路徑（`./`），部署在子路徑（例如 GitHub Pages）也能運作。

### manifest.json

- `display` 必須是 `standalone`：iOS 只有在主畫面 Web App 模式下才提供 `pushManager`
- `start_url` 與 `scope` 設為 `./`
- 填 `name`、`short_name`、`theme_color`、`background_color`
- `icons` 放 192 與 512 兩種尺寸

```json
{
  "name": "Push Test",
  "short_name": "PushTest",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "theme_color": "#1f6feb",
  "background_color": "#ffffff",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### index.html

- `<head>` 要有：`<link rel="manifest" href="manifest.json">`、`<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">`、viewport、`theme-color`
- 以 `<script type="module" src="app.js"></script>` 載入頁面邏輯：`config.js` 使用 `export`，必須以 ES module 方式 `import`
- 頁面依狀態切換三個區塊：
  1. **未安裝**（在 Safari 分頁中開啟）：顯示「分享 → 加入主畫面 → 從主畫面圖示開啟」的步驟說明
  2. **已安裝、未訂閱**：顯示「開啟通知」按鈕
  3. **已訂閱**：顯示訂閱 JSON（唯讀文字框）＋「複製」按鈕、「本機測試通知」按鈕、「取消訂閱」按鈕
- 底部固定顯示診斷區：User Agent、是否 standalone、`Notification.permission`、是否支援 `PushManager`、Service Worker 狀態、目前是否已有訂閱

### app.js

- 以 `import { VAPID_PUBLIC_KEY } from "./config.js";` 取得公鑰
- 載入時註冊 `sw.js`
- 判斷是否已安裝：`matchMedia('(display-mode: standalone)').matches || navigator.standalone === true`
- 「開啟通知」按鈕：`Notification.requestPermission()` 必須在 click 處理函式內直接呼叫，前面不能先 `await` 其他非同步動作，否則 iOS 會判定不是使用者觸發而拒絕
- 權限為 `granted` 後：取得 `navigator.serviceWorker.ready`，先用 `getSubscription()` 檢查既有訂閱，沒有才 `subscribe({ userVisibleOnly: true, applicationServerKey })`
- `applicationServerKey` 要把 base64url 公鑰轉成 `Uint8Array`（寫一個 `urlBase64ToUint8Array` 工具函式）
- 訂閱結果用 `JSON.stringify(subscription)` 顯示；「複製」用 `navigator.clipboard.writeText`，失敗時退回選取文字框內容讓使用者手動複製
- 「本機測試通知」：直接呼叫 `registration.showNotification()`，不經推播伺服器，用來確認通知顯示本身沒問題
- 所有錯誤顯示在畫面上（手機上看不到 console）

### sw.js

- `install` 時 `skipWaiting()`，`activate` 時 `clients.claim()`，讓新版立即生效
- `push` 事件：解析 `event.data.json()`（失敗則用 `text()` 當內文），用 `event.waitUntil(self.registration.showNotification(title, { body, icon, data: { url } }))` 顯示（iOS 不顯示 `badge`，故不設定）
- payload 缺少欄位時給預設值：`title` 預設 `"Push Test"`、`url` 預設 `"./"`
- **每一則推播都必須顯示通知**：iOS 要求推播對使用者可見，收到推播卻不顯示，Safari 可能撤銷這個訂閱
- `notificationclick` 事件：關閉通知，若已有開啟中的視窗就 `focus()`，否則 `clients.openWindow(url)`；`data.url` 不存在時使用 `"./"`
- 不需要離線快取，測試期間避免快取造成看不到新版

### sender/generate-keys.js

- 用 `web-push` 的 `generateVAPIDKeys()` 產生公私鑰，印出並寫入 `.env`：

```
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:you@example.com
```

- 已存在 `.env` 時不覆蓋，避免換掉金鑰導致既有訂閱全部失效

### sender/send.js

- 用法：`node send.js "標題" "內容" [網址]`，未給參數時用預設文字
- 讀取 `.env`（用 `dotenv` 套件）與 `subscriptions.json`（訂閱物件的陣列），同時發送給所有訂閱
- `webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)`
- `VAPID_SUBJECT` 必須是有效的 `mailto:` 或 `https://` 網址，Apple 會拒絕格式不對的值
- payload 為 JSON：`{ "title", "body", "url" }`；選項設 `TTL: 3600`、`urgency: "high"`
- TTL 不要設太短：手機離線、關機或省電時推播會暫存在 Apple，超過 TTL 就被丟棄，容易誤判為程式問題
- 每個訂閱以 endpoint 尾端 8 碼當代號，逐一印出結果：成功印狀態碼；失敗印 `statusCode` 與 `body`
- 遇到 404 或 410 視為訂閱失效，自動從 `subscriptions.json` 移除，並提示該裝置需重新訂閱
- 最後印出總結（成功數／總數、移除數），有任何失敗時 exit code 為 1

### sender/add-subscription.js

- 用法：`pbpaste | npm run add`（從剪貼簿讀取），或 `npm run add -- '<訂閱 JSON>'`
- 驗證必須有 `endpoint`、`keys.p256dh`、`keys.auth`；從手機複製時常漏掉開頭的 `{`，自動補上
- 以 `endpoint` 去重：已存在就更新，否則新增

### sender/package.json

- `"type": "module"`，相依套件：`web-push`、`dotenv`
- scripts：`"keys": "node generate-keys.js"`、`"send": "node send.js"`、`"add": "node add-subscription.js"`

## 執行步驟

順序很重要：先產生金鑰並把公鑰放進網站，再部署；部署後換金鑰，所有既有訂閱都要重做。

1. **產生 VAPID 金鑰**

   ```
   cd sender
   npm install
   npm run keys
   ```

   把印出的公鑰填入 `site/config.js`：`export const VAPID_PUBLIC_KEY = "...";`，並把 `.env` 的 `VAPID_SUBJECT` 改成你的信箱。
2. **準備圖示**：放入 192×192、512×512、180×180 三張 PNG 到 `site/icons/`（任何簡單圖片即可）。
3. **本機預覽（選用）**：`npx serve site`，用電腦瀏覽器打開 localhost 檢查頁面與診斷區是否正常。iPhone 無法用這個網址測推播，因為不是 HTTPS。
4. **部署 `site/` 到 HTTPS 主機**，擇一：
   - Netlify Drop：到 app.netlify.com/drop，把 `site` 資料夾拖進去
   - Vercel：`npx vercel site --prod`
   - GitHub Pages：「從分支部署」只能選根目錄或 `/docs`，無法直接指定 `site/`。改用 GitHub Actions：Settings → Pages → Source 選 GitHub Actions，workflow 用 `actions/upload-pages-artifact`（`path: site`）加 `actions/deploy-pages`。網址會是子路徑 `https://<帳號>.github.io/<repo>/`，因此所有路徑都必須是相對路徑
5. **iPhone 安裝**：用 Safari 開部署網址 → 分享 → 加入主畫面 → 關掉 Safari，從主畫面圖示開啟。
6. **iPhone 訂閱**：點「開啟通知」→ 允許 → 點「複製」取得訂閱 JSON。
7. **把訂閱傳到電腦**：用 AirDrop、備忘錄同步或傳訊息給自己，複製到 Mac 剪貼簿後在 `sender/` 執行 `pbpaste | npm run add`。每台裝置各做一次。
8. **發送測試**：

   ```
   npm run send -- "測試標題" "這是第一則推播"
   ```
9. **驗證三種情境**：App 開著、App 在背景、手機鎖定，三種都應該收到通知；點通知應開啟 App。

## 驗收清單與疑難排解

**驗收清單**

- [ ] Safari 開啟網站時顯示「加入主畫面」引導
- [ ] 從主畫面開啟後沒有網址列，診斷區顯示 standalone = true
- [ ] 點「開啟通知」跳出 iOS 權限詢問，允許後顯示訂閱 JSON
- [ ] 「本機測試通知」能顯示通知
- [ ] `send.js` 發送後，App 在背景與手機鎖定時都收到通知
- [ ] 點擊通知會開啟或切回 App
- [ ] 從主畫面移除 App 後再發送，`send.js` 回報訂閱失效（404/410）。註：Apple 不一定立即失效，移除後短時間內仍可能回 201，可隔一段時間再試

**疑難排解**

| 症狀 | 可能原因 | 處理方式 |
| --- | --- | --- |
| `pushManager` 是 undefined | 不是從主畫面開啟，或 manifest 的 `display` 不是 `standalone` | 從主畫面圖示開啟；檢查 manifest 與 `<link rel="manifest">` |
| 按「開啟通知」沒反應或直接 denied | `requestPermission()` 前有其他 `await`，或之前曾拒絕過 | 改為 click 內第一個動作；到 設定 → 通知 → 該 App 開啟，或刪除 App 重裝 |
| 本機測試通知正常，遠端推播收不到 | 公鑰與私鑰不是同一組、訂閱 JSON 過期、專注模式擋下 | 確認 `config.js` 與 `.env` 公鑰一致，重新訂閱，關閉專注模式測試 |
| `send.js` 回 403 或 BadJwtToken | `VAPID_SUBJECT` 格式不對或金鑰錯誤 | 改用 `mailto:真實信箱`，確認私鑰沒被截斷 |
| `send.js` 回 404 或 410 | 訂閱已失效（App 被移除、重裝、權限被關） | `send.js` 會自動移除失效訂閱；該裝置重新訂閱後再 `npm run add` |
| 改了程式但手機上沒更新 | Service Worker 或頁面被快取 | 完全關閉 App 再開；仍無效就從主畫面移除後重新加入 |
| 一陣子後就收不到推播 | 推播時沒有顯示通知，被 Safari 撤銷訂閱 | 確認 `sw.js` 每個 `push` 事件都呼叫 `showNotification` |
