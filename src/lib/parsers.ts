import type { Candle } from "./types";

/** 即時（或最新）報價，用來更新最後一根 K 線與畫面上的價格 */
export interface Realtime {
  price: number;
  previousClose: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  volume: number | null; // 股
  date: string; // YYYY-MM-DD（交易所當地日期）
  time: string; // ISO
  name?: string;
  source: string;
}

const n = (v: unknown): number | null => {
  if (v == null || v === "" || v === "-" || v === "N/D") return null;
  const x = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
  return Number.isFinite(x) ? x : null;
};

// ---------- 證交所 MIS 即時報價 ----------

interface MisItem {
  c: string; n: string; z: string; y: string; o: string; h: string; l: string;
  v: string; b?: string; a?: string; d: string; t: string; tlong?: string; ex?: string;
}

/** 解析 https://mis.twse.com.tw/stock/api/getStockInfo.jsp 的回應 */
export function parseMis(json: unknown, code: string): Realtime | null {
  const arr = (json as { msgArray?: MisItem[] })?.msgArray ?? [];
  const it = arr.find((x) => x.c === code);
  if (!it) return null;
  const firstOf = (s?: string) => n(s?.split("_").find((p) => p && p !== "-"));
  // z 為最新成交價；剛開盤或暫無成交時為 "-"，改用最佳買價、賣價、昨收依序替代
  const price = n(it.z) ?? firstOf(it.b) ?? firstOf(it.a) ?? n(it.y);
  if (price == null || !/^\d{8}$/.test(it.d)) return null;
  const date = `${it.d.slice(0, 4)}-${it.d.slice(4, 6)}-${it.d.slice(6, 8)}`;
  const time = it.tlong ? new Date(Number(it.tlong)).toISOString() : new Date(`${date}T${it.t || "13:30:00"}+08:00`).toISOString();
  const vol = n(it.v);
  return {
    price,
    previousClose: n(it.y),
    open: n(it.o),
    high: n(it.h),
    low: n(it.l),
    volume: vol == null ? null : vol * 1000, // MIS 的成交量單位是「張」
    date,
    time,
    name: it.n,
    source: "臺灣證券交易所即時報價",
  };
}

// ---------- FinMind 台股日 K ----------

/** 解析 FinMind TaiwanStockPrice */
export function parseFinMind(json: unknown): Candle[] {
  const data = (json as { data?: Record<string, unknown>[] })?.data ?? [];
  const out: Candle[] = [];
  for (const r of data) {
    const open = n(r.open), high = n(r.max), low = n(r.min), close = n(r.close);
    if (open == null || high == null || low == null || close == null || close === 0) continue;
    out.push({ time: String(r.date).slice(0, 10), open, high, low, close, volume: n(r.Trading_Volume) ?? 0 });
  }
  return out.sort((a, b) => a.time.localeCompare(b.time));
}

// ---------- Stooq ----------

/** 解析 Stooq 日 K CSV（Date,Open,High,Low,Close,Volume） */
export function parseStooqHistory(csv: string): Candle[] {
  const lines = csv.trim().split(/\r?\n/);
  if (!/^Date,Open,High,Low,Close/i.test(lines[0] ?? "")) return [];
  const out: Candle[] = [];
  for (const line of lines.slice(1)) {
    const [d, o, h, l, c, v] = line.split(",");
    const open = n(o), high = n(h), low = n(l), close = n(c);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || open == null || high == null || low == null || close == null) continue;
    out.push({ time: d, open, high, low, close, volume: n(v) ?? 0 });
  }
  return out;
}

/** 解析 Stooq 最新報價 CSV（Symbol,Date,Time,Open,High,Low,Close,Volume） */
export function parseStooqQuote(csv: string): Realtime | null {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return null;
  const head = lines[0].split(",").map((s) => s.trim().toLowerCase());
  const row = lines[1].split(",");
  const get = (k: string) => row[head.indexOf(k)];
  const price = n(get("close"));
  const date = get("date");
  if (price == null || !/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) return null;
  const t = get("time") && /^\d{2}:\d{2}:\d{2}$/.test(get("time")) ? get("time") : "16:00:00";
  return {
    price,
    previousClose: null,
    open: n(get("open")),
    high: n(get("high")),
    low: n(get("low")),
    volume: n(get("volume")),
    date,
    time: new Date(`${date}T${t}Z`).toISOString(),
    source: "Stooq",
  };
}

// ---------- 合併 ----------

/** 把即時報價併入日 K：同一天就更新最後一根，較新的日期就新增一根 */
export function mergeRealtime(candles: Candle[], rt: Realtime): Candle[] {
  if (!candles.length) return candles;
  const out = candles.slice();
  const last = out[out.length - 1];
  if (rt.date < last.time) return out;
  const bar: Candle = {
    time: rt.date,
    open: rt.open ?? (rt.date === last.time ? last.open : rt.price),
    high: Math.max(rt.high ?? rt.price, rt.price),
    low: Math.min(rt.low ?? rt.price, rt.price),
    close: rt.price,
    volume: rt.volume ?? (rt.date === last.time ? last.volume : 0),
  };
  if (rt.date === last.time) out[out.length - 1] = bar;
  else out.push(bar);
  return out;
}
