import type { Market } from "./types";

export interface StockInfo {
  symbol: string;
  name: string;
  market: Market;
  /** 台股上市為 TW、上櫃為 TWO */
  exchange?: "TW" | "TWO";
  type: "stock" | "etf";
  sector: string;
  aliases?: string[];
}

/** 內建熱門清單：讓新手可以用中文名稱搜尋，也作為無法連線時的示範清單 */
export const POPULAR_STOCKS: StockInfo[] = [
  { symbol: "0050", name: "元大台灣50", market: "TW", exchange: "TW", type: "etf", sector: "大盤 ETF", aliases: ["台灣50"] },
  { symbol: "0056", name: "元大高股息", market: "TW", exchange: "TW", type: "etf", sector: "高股息 ETF", aliases: ["高股息"] },
  { symbol: "006208", name: "富邦台50", market: "TW", exchange: "TW", type: "etf", sector: "大盤 ETF" },
  { symbol: "00878", name: "國泰永續高股息", market: "TW", exchange: "TW", type: "etf", sector: "高股息 ETF" },
  { symbol: "00919", name: "群益台灣精選高息", market: "TW", exchange: "TW", type: "etf", sector: "高股息 ETF" },
  { symbol: "2330", name: "台積電", market: "TW", exchange: "TW", type: "stock", sector: "半導體", aliases: ["台積", "TSMC"] },
  { symbol: "2317", name: "鴻海", market: "TW", exchange: "TW", type: "stock", sector: "電子代工", aliases: ["富士康"] },
  { symbol: "2454", name: "聯發科", market: "TW", exchange: "TW", type: "stock", sector: "IC 設計", aliases: ["MTK"] },
  { symbol: "2308", name: "台達電", market: "TW", exchange: "TW", type: "stock", sector: "電源與電子零組件" },
  { symbol: "2382", name: "廣達", market: "TW", exchange: "TW", type: "stock", sector: "電腦與伺服器" },
  { symbol: "2303", name: "聯電", market: "TW", exchange: "TW", type: "stock", sector: "半導體" },
  { symbol: "3711", name: "日月光投控", market: "TW", exchange: "TW", type: "stock", sector: "半導體封測" },
  { symbol: "2412", name: "中華電", market: "TW", exchange: "TW", type: "stock", sector: "電信", aliases: ["中華電信"] },
  { symbol: "2881", name: "富邦金", market: "TW", exchange: "TW", type: "stock", sector: "金融" },
  { symbol: "2882", name: "國泰金", market: "TW", exchange: "TW", type: "stock", sector: "金融" },
  { symbol: "2884", name: "玉山金", market: "TW", exchange: "TW", type: "stock", sector: "金融" },
  { symbol: "2886", name: "兆豐金", market: "TW", exchange: "TW", type: "stock", sector: "金融" },
  { symbol: "2891", name: "中信金", market: "TW", exchange: "TW", type: "stock", sector: "金融" },
  { symbol: "1301", name: "台塑", market: "TW", exchange: "TW", type: "stock", sector: "塑化" },
  { symbol: "2002", name: "中鋼", market: "TW", exchange: "TW", type: "stock", sector: "鋼鐵" },
  { symbol: "2603", name: "長榮", market: "TW", exchange: "TW", type: "stock", sector: "航運", aliases: ["長榮海運"] },
  { symbol: "2357", name: "華碩", market: "TW", exchange: "TW", type: "stock", sector: "電腦品牌" },
  { symbol: "3008", name: "大立光", market: "TW", exchange: "TW", type: "stock", sector: "光學鏡頭" },
  { symbol: "5347", name: "世界先進", market: "TW", exchange: "TWO", type: "stock", sector: "半導體" },
  { symbol: "6488", name: "環球晶", market: "TW", exchange: "TWO", type: "stock", sector: "半導體材料" },
  { symbol: "SPY", name: "SPDR 標普500 ETF", market: "US", type: "etf", sector: "大盤 ETF", aliases: ["標普500", "S&P500"] },
  { symbol: "VOO", name: "Vanguard 標普500 ETF", market: "US", type: "etf", sector: "大盤 ETF" },
  { symbol: "VT", name: "Vanguard 全世界股票 ETF", market: "US", type: "etf", sector: "全球 ETF", aliases: ["全世界"] },
  { symbol: "QQQ", name: "Invesco 那斯達克100 ETF", market: "US", type: "etf", sector: "科技 ETF", aliases: ["那斯達克"] },
  { symbol: "AAPL", name: "蘋果 Apple", market: "US", type: "stock", sector: "消費電子", aliases: ["蘋果", "Apple"] },
  { symbol: "MSFT", name: "微軟 Microsoft", market: "US", type: "stock", sector: "軟體", aliases: ["微軟"] },
  { symbol: "NVDA", name: "輝達 NVIDIA", market: "US", type: "stock", sector: "半導體", aliases: ["輝達", "NVIDIA"] },
  { symbol: "GOOGL", name: "Alphabet (Google)", market: "US", type: "stock", sector: "網路服務", aliases: ["谷歌", "Google"] },
  { symbol: "AMZN", name: "亞馬遜 Amazon", market: "US", type: "stock", sector: "電商與雲端", aliases: ["亞馬遜"] },
  { symbol: "META", name: "Meta Platforms", market: "US", type: "stock", sector: "社群媒體", aliases: ["臉書", "Facebook"] },
  { symbol: "TSLA", name: "特斯拉 Tesla", market: "US", type: "stock", sector: "電動車", aliases: ["特斯拉"] },
  { symbol: "TSM", name: "台積電 ADR", market: "US", type: "stock", sector: "半導體", aliases: ["台積電ADR"] },
  { symbol: "KO", name: "可口可樂 Coca-Cola", market: "US", type: "stock", sector: "飲料", aliases: ["可口可樂"] },
  { symbol: "JNJ", name: "嬌生 Johnson & Johnson", market: "US", type: "stock", sector: "醫療保健", aliases: ["嬌生"] },
];

export function findLocal(symbol: string): StockInfo | undefined {
  const s = symbol.trim().toUpperCase();
  return POPULAR_STOCKS.find((x) => x.symbol.toUpperCase() === s);
}

export function searchLocal(q: string): StockInfo[] {
  const query = q.trim().toLowerCase();
  if (!query) return [];
  return POPULAR_STOCKS.filter(
    (s) =>
      s.symbol.toLowerCase().startsWith(query) ||
      s.name.toLowerCase().includes(query) ||
      s.aliases?.some((a) => a.toLowerCase().includes(query)),
  );
}

/** 判斷使用者輸入的代號屬於哪個市場：純數字（含 ETF 的 00xxx）視為台股 */
export function guessMarket(symbol: string): Market {
  return /^\d{4,6}[A-Z]?$/i.test(symbol.trim()) ? "TW" : "US";
}

export function normalizeSymbol(input: string): string {
  return input.trim().toUpperCase().replace(/\.(TW|TWO)$/i, "");
}

/** 從一段文字中找出提到的股票（給 AI 助理用） */
export function extractMentionedSymbols(text: string, max = 3): string[] {
  const found = new Set<string>();
  for (const s of POPULAR_STOCKS) {
    const names = [s.name, ...(s.aliases ?? [])];
    if (names.some((n) => text.includes(n))) found.add(s.symbol);
  }
  for (const m of text.matchAll(/(?<![\d])(\d{4,6})(?![\d])/g)) {
    if (!/^(19|20)\d{2}$/.test(m[1])) found.add(m[1]); // 避免把年份當成股票代號
  }
  for (const m of text.matchAll(/\b([A-Z]{1,5})\b/g)) {
    if (findLocal(m[1])) found.add(m[1]);
  }
  return [...found].slice(0, max);
}
