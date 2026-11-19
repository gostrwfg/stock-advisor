import type { Candle, IndicatorSnapshot } from "./types";

/** 簡單移動平均，資料不足的位置回傳 null */
export function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (period <= 0) return out;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

/** 指數移動平均，以前 period 筆的 SMA 作為起始值 */
export function ema(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < period || period <= 0) return out;
  const k = 2 / (period + 1);
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/** RSI（Wilder 平滑法） */
export function rsi(values: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  const calc = () => (avgLoss === 0 ? (avgGain === 0 ? 50 : 100) : 100 - 100 / (1 + avgGain / avgLoss));
  out[period] = calc();
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
    out[i] = calc();
  }
  return out;
}

export interface MacdPoint {
  macd: number;
  signal: number;
  histogram: number;
}

/** MACD(12, 26, 9) */
export function macd(values: number[], fast = 12, slow = 26, signalPeriod = 9): (MacdPoint | null)[] {
  const out: (MacdPoint | null)[] = new Array(values.length).fill(null);
  const ef = ema(values, fast);
  const es = ema(values, slow);
  const dif: number[] = [];
  const difIdx: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (ef[i] != null && es[i] != null) {
      dif.push((ef[i] as number) - (es[i] as number));
      difIdx.push(i);
    }
  }
  const sig = ema(dif, signalPeriod);
  for (let j = 0; j < dif.length; j++) {
    if (sig[j] != null) {
      out[difIdx[j]] = { macd: dif[j], signal: sig[j] as number, histogram: dif[j] - (sig[j] as number) };
    }
  }
  return out;
}

/** KD 隨機指標（台灣常用 9,3,3 算法，K、D 起始值 50） */
export function kd(candles: Candle[], period = 9): ({ k: number; d: number } | null)[] {
  const out: ({ k: number; d: number } | null)[] = new Array(candles.length).fill(null);
  let k = 50;
  let d = 50;
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) continue;
    const win = candles.slice(i - period + 1, i + 1);
    const hi = Math.max(...win.map((c) => c.high));
    const lo = Math.min(...win.map((c) => c.low));
    const rsv = hi === lo ? 50 : ((candles[i].close - lo) / (hi - lo)) * 100;
    k = (2 / 3) * k + (1 / 3) * rsv;
    d = (2 / 3) * d + (1 / 3) * k;
    out[i] = { k, d };
  }
  return out;
}

function last<T>(arr: (T | null)[]): T | null {
  for (let i = arr.length - 1; i >= 0; i--) if (arr[i] != null) return arr[i];
  return null;
}

function pctReturn(closes: number[], bars: number): number | null {
  if (closes.length <= bars) return null;
  const from = closes[closes.length - 1 - bars];
  const to = closes[closes.length - 1];
  return from === 0 ? null : ((to - from) / from) * 100;
}

function round(n: number | null, digits = 2): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

/** 依日 K 資料計算最新一筆的技術指標摘要 */
export function computeIndicators(candles: Candle[]): IndicatorSnapshot {
  const closes = candles.map((c) => c.close);
  const volumes = candles.map((c) => c.volume);
  const m = last(macd(closes));
  const k = last(kd(candles));

  let volatility20: number | null = null;
  if (closes.length > 21) {
    const rets: number[] = [];
    for (let i = closes.length - 20; i < closes.length; i++) rets.push(Math.log(closes[i] / closes[i - 1]));
    const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
    const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1);
    volatility20 = Math.sqrt(variance) * Math.sqrt(252) * 100;
  }

  return {
    ma5: round(last(sma(closes, 5))),
    ma20: round(last(sma(closes, 20))),
    ma60: round(last(sma(closes, 60))),
    rsi14: round(last(rsi(closes, 14))),
    macd: m ? { macd: round(m.macd, 3)!, signal: round(m.signal, 3)!, histogram: round(m.histogram, 3)! } : null,
    kd: k ? { k: round(k.k)!, d: round(k.d)! } : null,
    volumeAvg20: round(last(sma(volumes, 20)), 0),
    return1m: round(pctReturn(closes, 21)),
    return3m: round(pctReturn(closes, 63)),
    volatility20: round(volatility20),
  };
}

/** 把技術指標轉成新手看得懂的一句話（不靠 AI，純規則） */
export function describeIndicators(ind: IndicatorSnapshot, price: number): string[] {
  const notes: string[] = [];
  if (ind.ma20 != null) {
    notes.push(
      price >= ind.ma20
        ? "股價在 20 日均線（約一個月平均成本）之上，短期走勢偏強。"
        : "股價在 20 日均線之下，代表最近一個月買進的人平均是虧損的，短期走勢偏弱。",
    );
  }
  if (ind.ma20 != null && ind.ma60 != null) {
    notes.push(
      ind.ma20 >= ind.ma60
        ? "月均線高於季均線，中期趨勢向上。"
        : "月均線低於季均線，中期趨勢向下。",
    );
  }
  if (ind.rsi14 != null) {
    if (ind.rsi14 >= 70) notes.push(`RSI 為 ${ind.rsi14}，偏高（超過 70），短期可能漲多、要小心追高。`);
    else if (ind.rsi14 <= 30) notes.push(`RSI 為 ${ind.rsi14}，偏低（低於 30），短期可能跌深，但不代表一定會反彈。`);
    else notes.push(`RSI 為 ${ind.rsi14}，在正常區間（30–70）。`);
  }
  if (ind.macd) {
    notes.push(
      ind.macd.histogram >= 0
        ? "MACD 柱狀體為正，上漲動能大於下跌動能。"
        : "MACD 柱狀體為負，下跌動能較強。",
    );
  }
  if (ind.kd) {
    if (ind.kd.k > ind.kd.d) notes.push(`KD 指標 K(${ind.kd.k}) 大於 D(${ind.kd.d})，短線偏多。`);
    else notes.push(`KD 指標 K(${ind.kd.k}) 小於 D(${ind.kd.d})，短線偏空。`);
  }
  return notes;
}
