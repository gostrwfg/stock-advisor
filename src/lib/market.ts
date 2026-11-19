import "server-only";
import { computeIndicators } from "./indicators";
import { mergeRealtime, parseFinMind, parseMis, parseStooqHistory, parseStooqQuote, type Realtime } from "./parsers";
import { findLocal, guessMarket, normalizeSymbol, POPULAR_STOCKS, searchLocal, type StockInfo } from "./stockList";
import type { Candle, Fundamentals, Market, NewsItem, Quote, StockData } from "./types";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

// ---------- 小工具 ----------

const cache = new Map<string, { at: number; value: unknown }>();

async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;
  const value = await fn();
  cache.set(key, { at: Date.now(), value });
  if (cache.size > 500) cache.delete(cache.keys().next().value as string);
  return value;
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 8000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, {
      ...init,
      headers: { "User-Agent": UA, ...(init.headers ?? {}) },
      signal: ctrl.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(t);
  }
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetchWithTimeout(url, init);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return (await res.json()) as T;
}

const num = (v: unknown): number | null => {
  if (v == null || v === "" || v === "-") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};

const forceDemo = () => process.env.FORCE_DEMO_DATA === "1";

// ---------- Yahoo Finance 日 K ----------

interface YahooChartResponse {
  chart: {
    result?: {
      meta: {
        currency: string;
        symbol: string;
        regularMarketPrice: number;
        chartPreviousClose?: number;
        previousClose?: number;
        regularMarketDayHigh?: number;
        regularMarketDayLow?: number;
        regularMarketVolume?: number;
        regularMarketTime?: number;
        longName?: string;
        shortName?: string;
        fiftyTwoWeekHigh?: number;
        fiftyTwoWeekLow?: number;
      };
      timestamp?: number[];
      indicators: { quote: { open: (number | null)[]; high: (number | null)[]; low: (number | null)[]; close: (number | null)[]; volume: (number | null)[] }[] };
    }[];
    error?: { description: string } | null;
  };
}

async function yahooChart(yahooSymbol: string, range = "2y") {
  const path = `/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=${range}&interval=1d&includePrePost=false`;
  let data: YahooChartResponse;
  try {
    data = await fetchJson<YahooChartResponse>(`https://query1.finance.yahoo.com${path}`);
  } catch (e) {
    if (/HTTP 404/.test(String((e as Error).message))) throw e;
    data = await fetchJson<YahooChartResponse>(`https://query2.finance.yahoo.com${path}`);
  }
  const r = data.chart.result?.[0];
  if (!r || !r.timestamp) throw new Error(data.chart.error?.description ?? "查無資料");
  const q = r.indicators.quote[0];
  const candles: Candle[] = [];
  const offsetMs = yahooSymbol.endsWith(".TW") || yahooSymbol.endsWith(".TWO") ? 8 * 3600e3 : -5 * 3600e3;
  r.timestamp.forEach((ts, i) => {
    const o = q.open[i], h = q.high[i], l = q.low[i], c = q.close[i];
    if (o == null || h == null || l == null || c == null) return;
    const time = new Date(ts * 1000 + offsetMs).toISOString().slice(0, 10);
    const candle = { time, open: o, high: h, low: l, close: c, volume: q.volume[i] ?? 0 };
    // 同一天重複時以最後一筆為準
    if (candles.length && candles[candles.length - 1].time === time) candles[candles.length - 1] = candle;
    else candles.push(candle);
  });
  return { meta: r.meta, candles };
}

/** 台股要決定是上市 (.TW) 或上櫃 (.TWO) */
async function resolveYahoo(symbol: string, market: Market, local?: StockInfo) {
  if (market === "US") return yahooChart(symbol);
  if (local?.exchange) return yahooChart(`${symbol}.${local.exchange}`);
  try {
    return await yahooChart(`${symbol}.TW`);
  } catch {
    return yahooChart(`${symbol}.TWO`);
  }
}

// ---------- Yahoo 基本面（需要 crumb，失敗就略過） ----------

let crumbCache: { crumb: string; cookie: string; at: number } | null = null;

async function getYahooCrumb() {
  if (crumbCache && Date.now() - crumbCache.at < 3600e3) return crumbCache;
  const r1 = await fetchWithTimeout("https://fc.yahoo.com", { redirect: "manual" });
  const setCookie = r1.headers.getSetCookie?.() ?? [];
  const cookie = setCookie.map((c) => c.split(";")[0]).join("; ");
  const r2 = await fetchWithTimeout("https://query2.finance.yahoo.com/v1/test/getcrumb", { headers: { Cookie: cookie } });
  const crumb = (await r2.text()).trim();
  if (!r2.ok || !crumb || crumb.includes("<")) throw new Error("crumb 取得失敗");
  crumbCache = { crumb, cookie, at: Date.now() };
  return crumbCache;
}

type Raw = { raw?: number } | undefined;

async function yahooFundamentals(yahooSymbol: string): Promise<Partial<Fundamentals>> {
  const { crumb, cookie } = await getYahooCrumb();
  const modules = "summaryDetail,defaultKeyStatistics,financialData,assetProfile";
  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(yahooSymbol)}?modules=${modules}&crumb=${encodeURIComponent(crumb)}`;
  const data = await fetchJson<{
    quoteSummary: { result?: Record<string, Record<string, Raw | string>>[] };
  }>(url, { headers: { Cookie: cookie } });
  const r = data.quoteSummary.result?.[0];
  if (!r) return {};
  const g = (mod: string, key: string) => num((r[mod]?.[key] as Raw)?.raw);
  const pct = (v: number | null) => (v == null ? null : v * 100);
  return {
    peRatio: g("summaryDetail", "trailingPE"),
    pbRatio: g("defaultKeyStatistics", "priceToBook"),
    eps: g("defaultKeyStatistics", "trailingEps"),
    dividendYield: pct(g("summaryDetail", "dividendYield") ?? g("summaryDetail", "yield")),
    revenueGrowth: pct(g("financialData", "revenueGrowth")),
    profitMargin: pct(g("financialData", "profitMargins")),
    debtToEquity: g("financialData", "debtToEquity"),
    marketCap: g("summaryDetail", "marketCap"),
    sector: (r.assetProfile?.sector as string | undefined) ?? null,
  };
}

// ---------- 證交所 / 櫃買中心 本益比、殖利率、淨值比 ----------

async function twValuation(symbol: string): Promise<Partial<Fundamentals> | null> {
  const twse = await cached("twse-bwibbu", 6 * 3600e3, () =>
    fetchJson<{ Code: string; PEratio: string; DividendYield: string; PBratio: string }[]>(
      "https://openapi.twse.com.tw/v1/exchangeReport/BWIBBU_ALL",
    ),
  ).catch(() => []);
  const a = twse.find((x) => x.Code === symbol);
  if (a) return { peRatio: num(a.PEratio), dividendYield: num(a.DividendYield), pbRatio: num(a.PBratio) };

  const tpex = await cached("tpex-pe", 6 * 3600e3, () =>
    fetchJson<{ SecuritiesCompanyCode: string; PriceEarningRatio: string; YieldRatio: string; PriceBookRatio: string }[]>(
      "https://www.tpex.org.tw/openapi/v1/tpex_mainboard_peratio_analysis",
    ),
  ).catch(() => []);
  const b = tpex.find((x) => x.SecuritiesCompanyCode === symbol);
  if (b) return { peRatio: num(b.PriceEarningRatio), dividendYield: num(b.YieldRatio), pbRatio: num(b.PriceBookRatio) };
  return null;
}

// ---------- 示範資料（無法連線時使用） ----------

function hash(s: string) {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

function seeded(seed: number) {
  let t = seed;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const DEMO_BASE: Record<string, number> = {
  "2330": 1050, "0050": 190, "0056": 37, "2317": 210, "2454": 1300, "2412": 128, "2881": 90,
  AAPL: 230, MSFT: 430, NVDA: 140, TSLA: 260, SPY: 590, VOO: 540, QQQ: 510, TSM: 200,
};

function demoStock(symbol: string, market: Market, local?: StockInfo): StockData {
  const rand = seeded(hash(symbol));
  const base = DEMO_BASE[symbol] ?? (market === "TW" ? 30 + rand() * 500 : 20 + rand() * 400);
  const drift = (rand() - 0.45) * 0.0015;
  const vol = 0.012 + rand() * 0.015;
  const candles: Candle[] = [];
  const day = new Date();
  day.setUTCDate(day.getUTCDate() - 730);
  let price = base * (0.7 + rand() * 0.3);
  while (day <= new Date()) {
    const wd = day.getUTCDay();
    if (wd !== 0 && wd !== 6) {
      const open = price;
      const change = drift + (rand() - 0.5) * 2 * vol;
      const close = Math.max(1, open * (1 + change));
      const high = Math.max(open, close) * (1 + rand() * vol * 0.6);
      const low = Math.min(open, close) * (1 - rand() * vol * 0.6);
      const r2 = (v: number) => Math.round(v * 100) / 100;
      candles.push({
        time: day.toISOString().slice(0, 10),
        open: r2(open), high: r2(high), low: r2(low), close: r2(close),
        volume: Math.round((market === "TW" ? 5e6 : 2e7) * (0.5 + rand())),
      });
      price = close;
    }
    day.setUTCDate(day.getUTCDate() + 1);
  }
  const lastC = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const recent = candles.slice(-250);
  const isEtf = local?.type === "etf";
  const quote: Quote = {
    symbol,
    yahooSymbol: market === "TW" ? `${symbol}.TW` : symbol,
    name: local?.name ?? symbol,
    market,
    currency: market === "TW" ? "TWD" : "USD",
    price: lastC.close,
    previousClose: prev.close,
    change: Math.round((lastC.close - prev.close) * 100) / 100,
    changePercent: Math.round(((lastC.close - prev.close) / prev.close) * 10000) / 100,
    dayHigh: lastC.high,
    dayLow: lastC.low,
    volume: lastC.volume,
    asOf: new Date().toISOString(),
  };
  return {
    quote,
    history: candles,
    indicators: computeIndicators(candles),
    fundamentals: {
      peRatio: isEtf ? null : Math.round((10 + rand() * 25) * 100) / 100,
      pbRatio: isEtf ? null : Math.round((1 + rand() * 6) * 100) / 100,
      eps: isEtf ? null : Math.round((lastC.close / (10 + rand() * 25)) * 100) / 100,
      dividendYield: Math.round((0.5 + rand() * 5) * 100) / 100,
      revenueGrowth: isEtf ? null : Math.round((rand() * 40 - 10) * 100) / 100,
      profitMargin: isEtf ? null : Math.round((5 + rand() * 35) * 100) / 100,
      debtToEquity: isEtf ? null : Math.round(rand() * 120 * 100) / 100,
      week52High: Math.max(...recent.map((c) => c.high)),
      week52Low: Math.min(...recent.map((c) => c.low)),
      sector: local?.sector ?? null,
      source: ["示範資料（隨機產生，非真實行情）"],
    },
    isDemo: true,
    dataSources: ["示範資料"],
  };
}

// ---------- 備援資料源 ----------

const MIS_HEADERS = { Referer: "https://mis.twse.com.tw/stock/index.jsp", Accept: "application/json" };

/** 證交所 MIS 即時報價（上市 tse / 上櫃 otc 一起查） */
async function misRealtime(symbol: string): Promise<Realtime | null> {
  const exCh = `tse_${symbol}.tw|otc_${symbol}.tw`;
  const url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=${encodeURIComponent(exCh)}&json=1&delay=0&_=${Date.now()}`;
  const json = await fetchJson<unknown>(url, { headers: MIS_HEADERS });
  return parseMis(json, symbol);
}

function dateNDaysAgo(days: number) {
  return new Date(Date.now() - days * 86400e3).toISOString().slice(0, 10);
}

async function finmindHistory(symbol: string): Promise<Candle[]> {
  const url = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockPrice&data_id=${encodeURIComponent(symbol)}&start_date=${dateNDaysAgo(740)}`;
  const headers: Record<string, string> = {};
  if (process.env.FINMIND_TOKEN) headers.Authorization = `Bearer ${process.env.FINMIND_TOKEN}`;
  const json = await fetchJson<{ status?: number; msg?: string }>(url, { headers });
  const candles = parseFinMind(json);
  if (!candles.length) throw new Error(`FinMind 無資料：${json.msg ?? ""}`);
  return candles;
}

async function stooqHistory(symbol: string): Promise<Candle[]> {
  const res = await fetchWithTimeout(`https://stooq.com/q/d/l/?s=${encodeURIComponent(symbol.toLowerCase())}.us&i=d`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const candles = parseStooqHistory(await res.text()).filter((c) => c.time >= dateNDaysAgo(740));
  if (!candles.length) throw new Error("Stooq 無資料");
  return candles;
}

async function stooqQuote(symbol: string): Promise<Realtime | null> {
  const res = await fetchWithTimeout(`https://stooq.com/q/l/?s=${encodeURIComponent(symbol.toLowerCase())}.us&f=sd2t2ohlcv&h&e=csv`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseStooqQuote(await res.text());
}

async function yahooQuote(yahooSymbol: string): Promise<Realtime | null> {
  const { meta, candles } = await yahooChart(yahooSymbol, "5d");
  const last = candles[candles.length - 1];
  if (!last || meta.regularMarketPrice == null) return null;
  return {
    price: meta.regularMarketPrice,
    previousClose: candles.length > 1 ? candles[candles.length - 2].close : null,
    open: last.open,
    high: meta.regularMarketDayHigh ?? last.high,
    low: meta.regularMarketDayLow ?? last.low,
    volume: meta.regularMarketVolume ?? last.volume,
    date: last.time,
    time: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : new Date().toISOString(),
    source: "Yahoo Finance",
  };
}

// ---------- 對外 API ----------

interface HistoryBundle {
  candles: Candle[];
  yahooSymbol: string;
  name: string | null;
  currency: string | null;
  week52High: number | null;
  week52Low: number | null;
  source: string;
}

/** 依序嘗試多個資料源取得日 K */
async function getHistory(symbol: string, market: Market, local?: StockInfo): Promise<HistoryBundle> {
  const errors: string[] = [];
  try {
    const { meta, candles } = await resolveYahoo(symbol, market, local);
    if (candles.length >= 2) {
      return {
        candles,
        yahooSymbol: meta.symbol,
        name: meta.longName ?? meta.shortName ?? null,
        currency: meta.currency ?? null,
        week52High: meta.fiftyTwoWeekHigh ?? null,
        week52Low: meta.fiftyTwoWeekLow ?? null,
        source: "Yahoo Finance",
      };
    }
  } catch (e) {
    errors.push(`Yahoo: ${(e as Error).message}`);
  }
  try {
    const candles = market === "TW" ? await finmindHistory(symbol) : await stooqHistory(symbol);
    return {
      candles,
      yahooSymbol: market === "TW" ? `${symbol}.${local?.exchange ?? "TW"}` : symbol,
      name: null,
      currency: market === "TW" ? "TWD" : "USD",
      week52High: null,
      week52Low: null,
      source: market === "TW" ? "FinMind" : "Stooq",
    };
  } catch (e) {
    errors.push(`${market === "TW" ? "FinMind" : "Stooq"}: ${(e as Error).message}`);
  }
  throw new Error(errors.join("；"));
}

/** 最新報價：台股用證交所即時報價，美股用 Yahoo、Stooq */
async function getRealtime(symbol: string, market: Market, yahooSymbol: string): Promise<Realtime | null> {
  return cached(`rt:${symbol}`, 15e3, async () => {
    if (market === "TW") {
      const r = await misRealtime(symbol).catch(() => null);
      if (r) return r;
      return yahooQuote(yahooSymbol).catch(() => null);
    }
    const y = await yahooQuote(yahooSymbol).catch(() => null);
    if (y) return y;
    return stooqQuote(symbol).catch(() => null);
  });
}

function buildQuote(symbol: string, market: Market, name: string, currency: string, yahooSymbol: string, candles: Candle[], rt: Realtime | null): Quote {
  const last = candles[candles.length - 1];
  const prevBar = candles[candles.length - 2];
  const price = rt?.price ?? last.close;
  const previousClose = rt?.previousClose ?? prevBar?.close ?? last.open;
  return {
    symbol,
    yahooSymbol,
    name,
    market,
    currency,
    price,
    previousClose,
    change: Math.round((price - previousClose) * 100) / 100,
    changePercent: previousClose ? Math.round(((price - previousClose) / previousClose) * 10000) / 100 : 0,
    dayHigh: rt?.high ?? last.high,
    dayLow: rt?.low ?? last.low,
    volume: rt?.volume ?? last.volume,
    asOf: rt?.time ?? new Date(`${last.time}T00:00:00Z`).toISOString(),
    realtimeSource: rt?.source ?? null,
  };
}

function resolveSymbol(rawSymbol: string) {
  const symbol = normalizeSymbol(rawSymbol);
  if (!/^[A-Z0-9.\-^=]{1,12}$/.test(symbol)) throw new Error("股票代號格式不正確");
  const local = findLocal(symbol);
  const market = local?.market ?? guessMarket(symbol);
  return { symbol, local, market };
}

export async function getStockData(rawSymbol: string): Promise<StockData> {
  const { symbol, local, market } = resolveSymbol(rawSymbol);
  if (forceDemo()) return demoStock(symbol, market, local);

  // 歷史 K 線與基本面快取 10 分鐘；最新報價另外快取 15 秒
  const base = await cached(`stock:${symbol}`, 10 * 60e3, async () => {
    let hist: HistoryBundle;
    try {
      hist = await getHistory(symbol, market, local);
    } catch (e) {
      // 連不上外部資料源 → 熱門清單內的股票改用示範資料；其他代號視為查無此股
      // 備援資料源明確回覆「無資料」時，代表代號不存在
      if (!local && /無資料/.test((e as Error).message)) throw new Error(`找不到股票「${symbol}」，請確認代號是否正確`);
      if (local || isNetworkError(e)) return { demo: demoStock(symbol, market, local) as StockData };
      throw new Error(`找不到股票「${symbol}」，請確認代號是否正確`);
    }
    const recent = hist.candles.slice(-250);
    const fundamentals: Fundamentals = {
      week52High: hist.week52High ?? Math.max(...recent.map((c) => c.high)),
      week52Low: hist.week52Low ?? Math.min(...recent.map((c) => c.low)),
      sector: local?.sector ?? null,
      source: [`${hist.source}（股價）`],
    };
    const dataSources = [hist.source];
    const [yf, tw] = await Promise.all([
      hist.source === "Yahoo Finance" ? yahooFundamentals(hist.yahooSymbol).catch(() => null) : Promise.resolve(null),
      market === "TW" ? twValuation(symbol).catch(() => null) : Promise.resolve(null),
    ]);
    if (yf) {
      for (const [k, v] of Object.entries(yf)) {
        if (v != null && (fundamentals as unknown as Record<string, unknown>)[k] == null) {
          (fundamentals as unknown as Record<string, unknown>)[k] = v;
        }
      }
      fundamentals.source.push("Yahoo Finance（財務數據）");
    }
    if (tw) {
      // 台股以官方公布的本益比、殖利率、淨值比為準
      Object.assign(fundamentals, Object.fromEntries(Object.entries(tw).filter(([, v]) => v != null)));
      fundamentals.source.push("臺灣證券交易所 / 櫃買中心 OpenAPI");
      dataSources.push("TWSE/TPEx OpenAPI");
    }
    return { hist, fundamentals, dataSources };
  });

  if ("demo" in base && base.demo) return base.demo;
  if (!("hist" in base) || !base.hist) throw new Error("資料錯誤");
  const { hist, fundamentals, dataSources } = base;
  const rt = await getRealtime(symbol, market, hist.yahooSymbol);
  const candles = rt ? mergeRealtime(hist.candles, rt) : hist.candles;
  const name = local?.name ?? hist.name ?? rt?.name ?? symbol;
  const quote = buildQuote(symbol, market, name, hist.currency ?? (market === "TW" ? "TWD" : "USD"), hist.yahooSymbol, candles, rt);
  return {
    quote,
    history: candles,
    indicators: computeIndicators(candles),
    fundamentals,
    isDemo: false,
    dataSources: rt && !dataSources.includes(rt.source) ? [...dataSources, rt.source] : dataSources,
  };
}

/** 只取最新報價（給頁面每 30 秒更新用） */
export async function getQuote(rawSymbol: string): Promise<{ quote: Quote; isDemo: boolean }> {
  const d = await getStockData(rawSymbol);
  return { quote: d.quote, isDemo: d.isDemo };
}

/** 檢查每個資料源在目前主機上能不能用 */
export async function diagnoseSources() {
  const test = async (name: string, fn: () => Promise<unknown>) => {
    const t0 = Date.now();
    try {
      const r = await fn();
      const ok = Array.isArray(r) ? r.length > 0 : r != null;
      return { name, ok, ms: Date.now() - t0, detail: Array.isArray(r) ? `${r.length} 筆` : ok ? JSON.stringify(r).slice(0, 120) : "無資料" };
    } catch (e) {
      const cause = (e as { cause?: { code?: string; message?: string } }).cause;
      const why = cause ? `（${cause.code ?? cause.message ?? ""}）` : "";
      return { name, ok: false, ms: Date.now() - t0, detail: `${(e as Error).message}${why}`.slice(0, 200) };
    }
  };
  return Promise.all([
    test("Yahoo 台股 K 線 (2330.TW)", async () => (await yahooChart("2330.TW", "5d")).candles),
    test("Yahoo 美股 K 線 (AAPL)", async () => (await yahooChart("AAPL", "5d")).candles),
    test("Yahoo 財務數據 (crumb)", async () => (await getYahooCrumb()).crumb ? "ok" : null),
    test("證交所即時報價 (2330)", () => misRealtime("2330")),
    test("FinMind 台股 K 線 (2330)", () => finmindHistory("2330")),
    test("證交所本益比 OpenAPI", () => twValuation("2330")),
    test("Stooq 美股 K 線 (AAPL)", () => stooqHistory("AAPL")),
    test("Stooq 美股報價 (AAPL)", () => stooqQuote("AAPL")),
    test("Google 新聞 RSS", async () => {
      const res = await fetchWithTimeout("https://news.google.com/rss/search?q=%E5%8F%B0%E7%A9%8D%E9%9B%BB&hl=zh-TW&gl=TW&ceid=TW:zh-Hant");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return parseRss(await res.text());
    }),
  ]);
}

function isNetworkError(e: unknown) {
  const msg = String((e as Error)?.message ?? e);
  return /fetch failed|abort|ENOTFOUND|ECONN|ETIMEDOUT|EAI_AGAIN|HTTP 4(03|07|29)|HTTP 5\d\d/i.test(msg) ||
    String((e as { cause?: unknown })?.cause ?? "").length > 0;
}

export async function getNews(rawSymbol: string, name?: string): Promise<{ items: NewsItem[]; isDemo: boolean }> {
  const symbol = normalizeSymbol(rawSymbol);
  const local = findLocal(symbol);
  const market = local?.market ?? guessMarket(symbol);
  const displayName = name ?? local?.name ?? symbol;
  if (forceDemo()) return { items: [], isDemo: true };

  return cached(`news:${symbol}`, 15 * 60e3, async () => {
    const items: NewsItem[] = [];
    // 中文新聞：Google News RSS
    try {
      const q = market === "TW" ? `${displayName} ${symbol} 股價` : `${displayName} 股票`;
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`;
      const res = await fetchWithTimeout(url);
      if (res.ok) items.push(...parseRss(await res.text()).slice(0, 8));
    } catch {
      /* 略過 */
    }
    // 英文新聞：Yahoo Finance（美股）
    if (market === "US") {
      try {
        const data = await fetchJson<{ news?: { title: string; link: string; publisher: string; providerPublishTime?: number }[] }>(
          `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(symbol)}&newsCount=6&quotesCount=0`,
        );
        for (const n of data.news ?? []) {
          items.push({
            title: n.title,
            link: n.link,
            publisher: n.publisher,
            publishedAt: n.providerPublishTime ? new Date(n.providerPublishTime * 1000).toISOString() : null,
          });
        }
      } catch {
        /* 略過 */
      }
    }
    items.sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
    return { items: items.slice(0, 10), isDemo: false };
  });
}

function decodeEntities(s: string) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

export function parseRss(xml: string): NewsItem[] {
  const out: NewsItem[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const block = m[1];
    const tag = (t: string) => {
      const r = block.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`));
      return r ? decodeEntities(r[1]) : "";
    };
    const title = tag("title");
    const link = tag("link");
    if (!title || !/^https?:\/\//.test(link)) continue;
    const pub = tag("pubDate");
    const d = pub ? new Date(pub) : null;
    const source = tag("source");
    out.push({
      title: source && title.endsWith(` - ${source}`) ? title.slice(0, -(source.length + 3)) : title,
      link,
      publisher: source || "Google 新聞",
      publishedAt: d && !isNaN(d.getTime()) ? d.toISOString() : null,
    });
  }
  return out;
}

export async function searchStocks(q: string): Promise<{ symbol: string; name: string; market: Market; type: string }[]> {
  const local = searchLocal(q).map((s) => ({ symbol: s.symbol, name: s.name, market: s.market, type: s.type }));
  if (forceDemo() || q.trim().length < 1) return local.slice(0, 10);
  try {
    const data = await cached(`search:${q}`, 3600e3, () =>
      fetchJson<{ quotes?: { symbol: string; shortname?: string; longname?: string; quoteType?: string; exchange?: string }[] }>(
        `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=10&newsCount=0`,
      ),
    );
    const remote = (data.quotes ?? [])
      .filter((x) => x.quoteType === "EQUITY" || x.quoteType === "ETF")
      .filter((x) => /\.(TW|TWO)$/.test(x.symbol) || !x.symbol.includes("."))
      .map((x) => ({
        symbol: normalizeSymbol(x.symbol),
        name: x.longname ?? x.shortname ?? x.symbol,
        market: (/\.(TW|TWO)$/.test(x.symbol) ? "TW" : "US") as Market,
        type: x.quoteType === "ETF" ? "etf" : "stock",
      }));
    const seen = new Set(local.map((x) => x.symbol));
    return [...local, ...remote.filter((x) => !seen.has(x.symbol))].slice(0, 10);
  } catch {
    return local.slice(0, 10);
  }
}

export async function getUsdTwd(): Promise<{ rate: number; isDemo: boolean }> {
  if (forceDemo()) return { rate: 32, isDemo: true };
  try {
    return await cached("fx:usdtwd", 30 * 60e3, async () => {
      const { meta } = await yahooChart("TWD=X", "5d");
      return { rate: meta.regularMarketPrice, isDemo: false };
    });
  } catch {
    return { rate: 32, isDemo: true };
  }
}

export { POPULAR_STOCKS };
