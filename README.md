# 新手投資小幫手

給投資新手的股票分析與模擬投資練習工具。支援台股與美股，AI 分析可使用你自己的 AI 模型（Claude、OpenAI、Gemini，或任何 OpenAI 相容服務，例如 Ollama 本機模型）。

> ⚠️ 本系統內容僅供教育與參考，不構成投資建議，投資有風險，請自行審慎評估。

## 功能

| 功能 | 說明 |
| --- | --- |
| 風險屬性評估 | 8 題問卷，分為保守型／穩健型／積極型，AI 建議會依此調整 |
| 股票查詢 | 台股、美股搜尋（支援中文名稱），日／週／月 K 線、MA5/20/60、成交量 |
| 基本面與技術指標 | 本益比、淨值比、EPS、殖利率、營收成長等；RSI、MACD、KD、波動度，每項都有「?」白話說明 |
| AI 分析報告 | 一句話總結、技術／基本／消息面評分、建議動作、三大風險、是否適合你、AI 把握程度、名詞小辭典 |
| AI 投資助理 | 聊天問答；提到股票時自動抓取最新數據並附上報價卡片 |
| 模擬投資 | 虛擬 100 萬台幣，含台股手續費與證交稅、美股匯率換算、資產配置圖、AI 組合健檢 |
| 自選股與提醒 | 價格上下限提醒（瀏覽器通知）、AI 評分變化追蹤 |
| 新手學堂 | 8 堂短課，每課 3 題測驗 |

## 安裝與啟動

需要 Node.js 20 以上。

```bash
npm install
```

```bash
npm run dev
```

打開 http://localhost:3000 即可使用。正式環境：

```bash
npm run build && npm start
```

執行單元測試：

```bash
npm test
```

## 部署到網路上（GitHub + Vercel，免費）

1. 把這個專案推送到你的 GitHub repository。
2. 到 [vercel.com](https://vercel.com) 用 GitHub 帳號登入，按 **Add New → Project**。
3. 選擇這個 repository 後按 **Import**，設定都用預設值（Vercel 會自動偵測 Next.js），再按 **Deploy**。
4. 約 1–2 分鐘後會得到一個網址，例如 `https://stock-advisor-xxx.vercel.app`。
5. 之後每次推送到 GitHub 的 `main` 分支，網站都會自動更新。

選填：在 Vercel 專案的 **Settings → Environment Variables** 可以設定下方的環境變數。

## 設定 AI 模型

進入網站的「設定」頁面，選擇服務商並填入：

- **Anthropic Claude**：API 金鑰 + 模型名稱（例如 `claude-sonnet-5-5`、`claude-opus-5-5`、`claude-haiku-5-5`）
- **OpenAI**：API 金鑰 + 模型名稱
- **Google Gemini**：API 金鑰 + 模型名稱
- **OpenAI 相容服務**：Base URL（例如 Ollama 是 `http://localhost:11434/v1`）+ 模型名稱，金鑰視服務而定

按「測試連線」確認可以使用後再儲存。金鑰只存在瀏覽器的 localStorage，每次呼叫時經本系統的後端轉送給 AI 服務，後端不會保存或記錄。

## 環境變數（選填）

複製 `.env.example` 為 `.env.local`：

| 變數 | 預設 | 說明 |
| --- | --- | --- |
| `AI_RATE_LIMIT_PER_MIN` | `20` | 每個 IP 每分鐘最多呼叫 AI 的次數 |
| `FORCE_DEMO_DATA` | `0` | 設為 `1` 時一律使用示範資料，不連外抓行情 |

## 資料來源

| 資料 | 主要來源 | 備援 |
| --- | --- | --- |
| 台股日 K | Yahoo Finance | FinMind |
| 台股即時報價（盤中約 5 秒更新） | 臺灣證券交易所 MIS | Yahoo Finance |
| 美股日 K、報價 | Yahoo Finance | Stooq |
| 台股本益比／殖利率／淨值比 | 證交所、櫃買中心 OpenAPI | — |
| 美股財務數據、搜尋 | Yahoo Finance | 內建熱門清單 |
| 新聞 | Google 新聞 RSS、Yahoo Finance | — |

個股頁開著時每 5 秒自動更新報價（分頁在背景時暫停；伺服器端同一檔股票 4 秒內只向資料來源查詢一次）。打開網站的 `/diagnose` 頁面，可以檢查主機連不連得到每個資料來源。

**連不上資料來源時**（例如網路受限），系統會自動改用「示範資料」，畫面頂端會清楚標示，方便離線展示與測試。

Yahoo Finance 的端點並非官方 API，可能隨時變動或被限流；若要正式上線，建議改接付費資料源（例如 FinMind、Alpha Vantage）。

## 設計原則

- **數字由程式計算，AI 只負責解讀**：技術指標在 `src/lib/indicators.ts` 計算，AI 收到的是整理好的真實數據，並被要求不得自行編造數字。
- **結構化輸出**：AI 分析回傳 JSON，後端會檢查欄位、限制分數範圍，並過濾「保證獲利」「一定會漲」等用語。
- **快取**：行情快取 5 分鐘、新聞 15 分鐘；同一檔股票的 AI 分析在瀏覽器保留 1 小時，避免重複花費 AI 額度。
- **資料都在瀏覽器**：風險問卷、模擬投資、自選股、AI 設定都存在 localStorage，不需要資料庫。

## 專案結構

```
src/
  app/
    page.tsx              首頁
    onboarding/           風險問卷
    stock/[symbol]/       個股頁（K 線、指標、AI 報告、新聞）
    chat/                 AI 助理
    portfolio/            模擬投資
    watchlist/            自選股
    learn/                新手學堂
    settings/             AI 模型與顯示設定
    api/
      stock/ news/ search/ fx/      行情資料
      ai/analyze chat portfolio test AI 功能（使用者提供的模型）
  components/             共用介面元件、K 線圖、交易視窗、AI 報告
  lib/
    market.ts             抓取行情、基本面、新聞，與示範資料
    indicators.ts         技術指標計算（有單元測試）
    ai.ts                 多家 AI 服務的呼叫介面
    prompts.ts            AI 提示詞與輸出檢查
    portfolio.ts          模擬交易邏輯（有單元測試）
    lessons.ts risk.ts glossary.ts stockList.ts
```
