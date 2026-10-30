# iOS PWA 推播通知測試站 — 討論議題整理

Oct 31, 2026 · @Tyler

整理開發與測試過程中討論過的議題，依主題分類。每項標示目前狀態：✅ 已完成、🧪 已實作未驗證、⏳ 待辦、💡 僅討論。

## 1. 規格文件修正

| 議題 | 處理方式 | 狀態 |
| --- | --- | --- |
| GitHub Pages「從分支部署」只能選根目錄或 `/docs`，無法指定 `site/` | 改用 GitHub Actions（`upload-pages-artifact` 設 `path: site`） | ✅ |
| `config.js` 用 `export`，但規格沒說 `app.js` 要以 module 載入 | 規定 `<script type="module" src="app.js">`，`app.js` 以 `import` 取公鑰 | ✅ |
| `TTL: 60` 太短，手機離線超過一分鐘推播就被丟棄 | 改為 `TTL: 3600` 並說明原因 | ✅ |
| 移除 App 後 Apple 不一定立即回 404/410 | 驗收清單加註「可能延遲」 | ✅ |
| 推播流程圖匯出失敗，只剩佔位文字 | 依步驟說明重畫為文字圖 | ✅ |
| `.gitignore` 缺 `node_modules/`、`notificationclick` 沒有預設網址、iOS 不顯示 `badge` | 補上 `node_modules/`、預設 `url` 為 `./`、移除 `badge` | ✅ |

## 2. 版本控制與部署

- **先 `git init` 再寫程式**：`.gitignore` 必須在第一次 commit 前設好，否則私鑰（`sender/.env`）一旦進入 git 歷史就很難清除。✅
- **GitHub repo**：`Tyler-Lin/pwa-push-test`，public。GitHub Pages 免費方案要求 repo 為 public；私鑰與訂閱都被 `.gitignore` 排除，不會公開。✅
- **Pages 來源設為 GitHub Actions**：`gh api -X POST repos/Tyler-Lin/pwa-push-test/pages -f build_type=workflow`。✅
- **網址**：`https://tyler-lin.github.io/pwa-push-test/`，`site/` 有變動推到 `main` 即自動部署。✅
- **免費方案能否測推播**：可以。iOS 只要求 HTTPS；推播由本機 `send.js` 經 Apple 投遞，不經過 GitHub。✅
- **更新延遲**：GitHub Pages 快取約 10 分鐘，部署本身約 1～2 分鐘；手機看到舊版時先等待，再完全關閉 App 重開。

## 3. 設定問題

| 問題 | 原因 | 處理 |
| --- | --- | --- |
| `VAPID_SUBJECT` 填成純信箱 | 必須是 `mailto:` 或 `https://` 網址，否則 `web-push` 報錯、Apple 拒絕 | 補上 `mailto:` 前綴 ✅ |
| 貼上的訂閱 JSON 開頭少了 `{` | 從手機複製時漏掉 | `npm run add` 自動補上 ✅ |
| dotenv 新版每次執行印出 `injected env` | dotenv 預設行為 | `dotenv.config({ quiet: true })` ✅ |
| 產生金鑰時是否印出私鑰 | 規格原寫「印出並寫入」 | 改為只印公鑰，私鑰只寫入 `.env`（權限 600）✅ |

## 4. 實機測試結果

| 驗收項目 | 結果 |
| --- | --- |
| Safari 開啟時顯示「加入主畫面」引導 | ✅ |
| 從主畫面開啟後能請求權限並完成訂閱 | ✅ |
| App 開著時收到推播 | ✅ |
| App 在背景時收到推播 | ✅ |
| 手機鎖定時收到推播 | ✅ |
| 點通知會開啟 App | ✅ |
| 兩台裝置同時收到推播 | ✅ |
| 「本機測試通知」能顯示通知 | 未回報 |
| 從主畫面開啟後 `standalone = true` | 未回報 |
| 移除 App 後發送回報 404/410 | ⏳ 移除後首次發送仍回 201，需隔一段時間再測 |

## 5. 多裝置發送

- `send.js` 改為讀取 `sender/subscriptions.json`（陣列），同時發送給所有裝置，逐台印出結果與總結；兩台實測成功。✅
- 新增 `npm run add`：`pbpaste | npm run add` 把剪貼簿中的訂閱加入清單，以 `endpoint` 去重。✅
- 遇到 404/410 自動從清單移除失效訂閱。🧪 尚無失效訂閱可實測
- 以上變更**尚未 commit / push**。⏳

## 6. 通知聲音

- Web Push **無法指定通知聲音**：通知 API 的 `sound` 選項已從規格移除，Safari 不支援；聲音由 iOS 決定。💡
- 可行的調整：
  - 設定 → 通知 → PushTest → 聲音：開關此 App 的通知聲
  - iOS 17.2+ 設定 → 聲音與觸覺回饋 → 預設提示：會影響所有使用預設聲音的 App（是否套用到網頁 App 未驗證）
  - 程式端 `silent: true` 可送無聲通知（iOS 是否遵守未驗證）
- 需要自訂音效只能做原生 iOS App（APNs 搭配內建音效檔）。

## 7. 架構與正式產品方向

**現行架構**：iPhone PWA 用公鑰訂閱 → 手動複製訂閱 JSON → 本機 `send.js` 以私鑰簽章 → Apple 推播服務投遞 → `sw.js` 顯示通知。GitHub Pages 只提供靜態檔案，不參與推播。

**後台網站能否推播**：可以，但發送的是**後端伺服器**，不是後台網頁；私鑰只能放在伺服器。💡

| 元件 | 需要做的事 |
| --- | --- |
| PWA | 訂閱後自動 `POST /api/subscriptions`；取消訂閱時通知後端刪除 |
| 後端 | 沿用 `send.js` 邏輯做成 API；訂閱存資料庫；404/410 自動刪除 |
| 後台網頁 | 需登入；填標題、內容、連結後呼叫後端 API |
| 主機 | GitHub Pages 無法執行後端，需 Render、Fly.io、Railway 或 Vercel Functions 等 |

延伸功能：指定對象或標籤發送、排程、發送紀錄、後台權限保護。

## 8. LIFF 整合

**LIFF 頁面本身不能用 Web Push**：LIFF 在 LINE 內建瀏覽器（WKWebView）執行，iOS 只有從 Safari 加入主畫面的 PWA 才有 `PushManager`。💡

**方案 A：LIFF + LINE Messaging API**

- LIFF 取得 ID Token → 後端向 LINE 驗證取得 `userId` → 後台透過 Messaging API 推送 LINE 訊息
- `userId` 必須在後端驗證，不可信任前端直接傳來的值
- 使用者需加官方帳號好友；LINE Login channel 與 Messaging API channel 須在同一個 Provider
- 優點：門檻低、到達率高、可用 Flex Message；缺點：通知是 LINE 訊息、免費方案有每月則數上限

**方案 B：先加入主畫面，再由 LIFF 觸發 Web Push**

- 可行：Web Push 與觸發來源無關，只要使用者在 PWA 訂閱過，LIFF 的操作經後端即可發推播
- LIFF 用 `liff.openWindow({ url, external: true })` 開 Safari 引導安裝
- **PWA 與 LIFF 不共用 cookie / storage / 登入**，必須另外綁定訂閱與 LINE 帳號：
  - 配對碼（建議）：PWA 顯示短時效配對碼，使用者在 LIFF 輸入，後端以 ID Token 驗證後綁定
  - PWA 內走 LINE Login：免輸入，但 iOS 主畫面 App 跳轉外部登入頁再返回的行為需實測
  - 從 LIFF 帶參數開 PWA：不可行，iOS 點連結只會開 Safari 分頁
- 優點：免費、系統通知；缺點：步驟多、流失率高，點通知開的是 PWA 而非 LINE

**選擇建議**：使用者主要在 LINE 上、追求覆蓋率 → 方案 A；想省訊息費用或要獨立 App 體驗 → 方案 B；也可並行，有 Web Push 訂閱者走 Web Push，其他人走 LINE 訊息。

## 9. PWA 與 LINE 帳號綁定

**需求**：使用者已加入 PWA，要知道他對應既有 LIFF 的哪個 LINE 帳號，之後才能依 `userId` 對他發 Web Push。💡

**目的**：**不使用 LINE Messaging API 的付費推播**。LINE 只用來確認身份（LINE Login / LIFF 的 ID Token，免費），通知一律走 Web Push（免費），以既有 LIFF 的 `userId` 作為使用者識別。

**加入主畫面當下無法驗證身份**：iOS 不提供「已加入主畫面」事件，網頁無從介入。驗證時機改為**第一次從主畫面開啟 PWA 時**。

**前提：同一個 Provider**

- LINE `userId` 依 Provider 區分，同一人在不同 Provider 下的 `userId` 不同
- PWA 使用的 LINE Login channel 必須與既有 LIFF 位於**同一個 Provider**，兩邊的 `userId` 才會一致

**主要方案：LINE Login + 一次性 nonce + 輪詢**

PWA 內直接走 LINE Login 的問題：iOS 常跳到 LINE App 授權，完成後回到的是 **Safari 而非 PWA**；兩者不共用 cookie / storage，PWA 拿不到登入結果。解法是不依賴 callback 落點，用 nonce 在後端把兩邊接起來：

```
 PWA（主畫面）                         後端                              LINE
 ① 點「開啟通知」→ 允許 → 建立訂閱
    向後端要 nonce，並連同訂閱上傳 ──▶ 建立 nonce（5 分鐘有效、只能用一次）
                                       記錄：nonce → 推播訂閱（尚不知是誰）
 ② 點「用 LINE 綁定」
    開啟 LINE Login 授權頁 ──────────────────────────────────────────▶  使用者同意
    （state 帶上 nonce）                                                 │
                                       ③ callback（不管落在 Safari      ◀┘
                                          還是 PWA 都沒關係）
                                          用 code 換 ID Token → 驗證 → 取得 userId
                                          ★ 用 nonce 找到訂閱，存下：userId ↔ 推播訂閱
                                            （綁定在此完成，已可對此人發 Web Push）
 ④ 回到前景時查詢「nonce 綁好了嗎？」──▶ 綁好了 → 發給 PWA 一個 session
    （另每 2 秒輪詢）                     nonce 作廢
 ⑤ 顯示「✓ 已綁定 LINE：王小明」
```

- **綁定在後端第 ③ 步完成**：訂閱在第 ① 步就與 nonce 一起上傳，所以使用者登入後即使停在 Safari、沒切回 PWA，後端也已知道要推播給誰
- **回到 PWA 只為兩件事**：畫面顯示綁定結果；取得 session，之後開啟 PWA 能認得使用者
- **回到前景要立即查詢**：切到 LINE 期間 iOS 會暫停背景的 PWA、輪詢也停止，需監聽 `visibilitychange`，不能只靠定時輪詢

- **ID Token 必須在後端驗證**（呼叫 LINE verify API 並帶 `client_id`），不可信任前端傳來的 `userId`
- **nonce 短時效、一次性**，並放在 OAuth `state` 中，防止 CSRF 與重放
- **需要兩次點擊**：`requestPermission()` 必須是點擊內第一個動作，LINE 登入又會跳離頁面，兩者不能合併；先「開啟通知」再「綁定 LINE」
- LINE Login 的 `disable_ios_auto_login` 參數可避免跳轉 LINE App，流程較可能留在 PWA 內，但使用者需在網頁輸入帳密；目前行為未驗證，需實測

**備案：配對碼**

1. PWA 訂閱後顯示 6 碼配對碼（例如 `482 913`）
2. 使用者回到 LIFF 輸入配對碼；LIFF 有已驗證的 ID Token，可確定身份
3. 後端把配對碼對應的訂閱綁定到該 `userId`

完全不受 iOS 跳轉行為影響，最可靠；缺點是需手動輸入。

**不建議**：從 LIFF 開 Safari 時在網址帶 token，期待加入主畫面後 PWA 帶著 token 開啟。iOS 用哪個網址開啟主畫面 App 與 manifest `start_url` 有關、行為不穩定，且 token 可能永久留在主畫面捷徑網址中，有安全疑慮。

**建議**：主流程用「LINE Login + nonce」（一次點擊即可綁定），同畫面提供「登入沒反應？改用配對碼」作為備案。

**使用者實際流程**

| 步驟 | 使用者看到 / 要做的事 | 系統在背後做的事 |
| --- | --- | --- |
| 1 | 首次從主畫面開啟，點「開啟通知」→ iOS 詢問 → 允許 | 建立訂閱，連同 nonce 上傳後端 |
| 2 | 點「用 LINE 綁定」 | 開啟 LINE Login，`state` 帶 nonce |
| 3 | 跳到 LINE App（或網頁登入），點「許可」 | 後端驗證 ID Token，用 nonce 綁定 `userId` ↔ 訂閱 |
| 4A | 自動回到 PWA，顯示「✓ 已綁定」 | PWA 查詢 nonce，取得 session |
| 4B | 落在 Safari，顯示「綁定成功，請回到主畫面的 PushTest」→ 使用者自行切回 | 同上，切回前景時立即查詢 |
| 之後 | 開啟 PWA 不需再登入；照常收通知，點通知開啟對應頁面 | session 認得使用者；權限仍在但訂閱遺失時背景自動補回 |

| 需重來的情況 | 處理 |
| --- | --- |
| 刪除 PWA 後重新加入 | 權限、訂閱、session 全部清空，重走「開啟通知 → 綁定 LINE」 |
| 換新手機 | 新手機走完整流程；舊手機訂閱發送時回 404/410，自動移除 |
| 在設定關閉 PushTest 通知 | 收不到；開啟 PWA 時提示「通知已關閉，請到設定開啟」 |
| 同一 LINE 帳號綁定多支手機 | 後端存多組訂閱，每支都收到 |

## 10. 自動訂閱

| 步驟 | 能否自動 |
| --- | --- |
| 加入主畫面 | ❌ 只能由使用者在 Safari 操作，網頁也偵測不到 |
| 請求通知權限 | ❌ 必須在點擊事件內呼叫，載入時呼叫會被 iOS 拒絕 |
| 建立訂閱 | ✅ 權限為 `granted` 後不需使用者操作 |
| 上傳訂閱到後端 | ✅ 需有後端 |
| 訂閱遺失後重建 | ✅ 權限仍在時，開啟 App 即可背景補回 |

- 權限屬於主畫面上的那個 App；刪除後重新加入會重置。
- 最佳體驗：首次開啟只放一個「開啟通知」按鈕，點擊後全自動完成。
- 目前程式在「權限已 `granted` 但沒有訂閱」時仍顯示按鈕，尚未改為背景自動重訂。⏳

## 11. 費用

**結論**：Web Push 發送本身免費、不按則數計費；成本主要是自架後端的固定月費，小規模時可控制在免費或很低。💡

**免費的部分**

| 項目 | 說明 |
| --- | --- |
| Apple / Google / Mozilla 推播服務 | 不收費，無每月則數上限 |
| VAPID 金鑰 | 自行產生，不需申請 |
| Apple 開發者帳號 | 不需要（原生 App 走 APNs 才需年費帳號） |
| LINE Login / LIFF ID Token 驗證 | 不收費；只有 Messaging API 發訊息才計費 |
| 前端網頁 | GitHub Pages 免費 |

**可能付費的部分**

| 項目 | 用途 | 費用概況 |
| --- | --- | --- |
| 後端伺服器 | 存訂閱、處理 LINE 登入、執行 `web-push` 發送；GitHub Pages 無法執行後端 | Render、Fly.io、Railway、Vercel 等有免費或低價方案；免費方案常有閒置休眠、用量上限，正式上線通常需付費方案（價格以官網為準） |
| 資料庫 | 存 `userId` ↔ 推播訂閱 | 小量時 Supabase、Neon 免費方案或 SQLite 即可 |
| 自訂網域（選用） | 取代 `github.io` 網址 | 網域年費 |

**規模變大時的注意事項**

- **每則個別加密**：每個訂閱都要用各自的金鑰加密，數萬人以上需排隊分批發送並提高伺服器規格
- **內容上限約 4KB**：放標題、內文、連結足夠，無法夾帶圖片檔
- **頻率限制**：Apple 未公開明確上限，短時間對同一裝置大量發送可能被限流
- **不保證送達**：沒有已讀回條；裝置離線超過 TTL 的推播會被丟棄

**TTL（Time To Live，存活時間）**

- 推播送到 Apple 時，若手機離線（關機、無網路、深度省電），Apple 會暫存推播，等手機上線再投遞
- TTL 是暫存的最長秒數，超過就丟棄、不再投遞；`send.js` 目前設 `TTL: 3600`（1 小時）
- 設定依通知性質決定：
  - 時效性強（驗證碼、「司機已到達」）→ 短 TTL，過時的通知不該送達
  - 一般訊息（公告、優惠）→ 長 TTL（數小時到一天），確保關機後開機仍收得到
  - `TTL: 0` → 只在手機當下在線時投遞，否則直接丟棄
- 規格曾用 `TTL: 60`，導致手機離線超過一分鐘就收不到，容易誤判為程式問題，因此改為 3600

**與 LINE Messaging API 比較**

| | LINE 訊息 | Web Push |
| --- | --- | --- |
| 成本結構 | 隨「人數 × 則數」增加 | 主要是固定的伺服器月費 |
| 發 10 則 vs 1 萬則 | 費用差距大 | 費用差不多 |
| 前提 | 加官方帳號好友 | 使用者加入主畫面並開啟通知 |

使用者越多、通知越頻繁，Web Push 省下越多；但只能觸及已加入主畫面並開啟通知的使用者。

## 12. 待辦清單

- [ ] commit / push 多裝置發送的變更（含頁面說明文字，push 後會重新部署）
- [ ] 對已移除 App 的舊訂閱再次發送，確認 Apple 回 410，並驗證自動移除
- [ ] 確認「本機測試通知」與 `standalone = true` 兩項驗收
- [ ] 權限已 `granted` 但無訂閱時，自動重新訂閱
- [x] 決定正式方向：不使用 LINE Messaging API 付費推播；LINE 僅用於身份綁定，通知走 Web Push
- [ ] 確認既有 LIFF 所在的 Provider，在同一 Provider 下建立 PWA 用的 LINE Login channel
- [ ] 實作 PWA ↔ LINE 帳號綁定（LINE Login + nonce + 輪詢，配對碼備案）
- [ ] 實測 iOS 主畫面 PWA 內 LINE Login 的跳轉行為，以及 `disable_ios_auto_login` 的效果
- [ ] （選做）實測 `silent: true` 在 iOS 上是否生效
