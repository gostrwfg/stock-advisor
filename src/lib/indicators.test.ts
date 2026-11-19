import { describe, expect, it } from "vitest";
import { computeIndicators, ema, kd, macd, rsi, sma } from "./indicators";
import type { Candle } from "./types";

describe("sma", () => {
  it("計算簡單移動平均", () => {
    expect(sma([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4]);
  });
  it("資料不足時全為 null", () => {
    expect(sma([1, 2], 3)).toEqual([null, null]);
  });
});

describe("ema", () => {
  it("以 SMA 為起始值", () => {
    const out = ema([1, 2, 3, 4, 5], 3);
    expect(out[2]).toBe(2);
    expect(out[3]).toBeCloseTo(3); // 4*0.5 + 2*0.5
    expect(out[4]).toBeCloseTo(4);
  });
});

describe("rsi", () => {
  it("一路上漲時 RSI 為 100", () => {
    const vals = Array.from({ length: 20 }, (_, i) => i + 1);
    expect(rsi(vals, 14).at(-1)).toBe(100);
  });
  it("一路下跌時 RSI 為 0", () => {
    const vals = Array.from({ length: 20 }, (_, i) => 100 - i);
    expect(rsi(vals, 14).at(-1)).toBe(0);
  });
  it("值介於 0 到 100", () => {
    const vals = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i / 3) * 10);
    for (const v of rsi(vals, 14)) if (v != null) expect(v).toBeGreaterThanOrEqual(0), expect(v).toBeLessThanOrEqual(100);
  });
});

describe("macd", () => {
  it("價格不變時 MACD 為 0", () => {
    const out = macd(new Array(60).fill(10));
    const lastPoint = out.at(-1)!;
    expect(lastPoint.macd).toBeCloseTo(0);
    expect(lastPoint.histogram).toBeCloseTo(0);
  });
  it("前 33 筆沒有訊號值", () => {
    const out = macd(Array.from({ length: 40 }, (_, i) => i));
    expect(out[32]).toBeNull();
    expect(out[33]).not.toBeNull();
  });
});

function makeCandles(closes: number[]): Candle[] {
  return closes.map((c, i) => ({
    time: `2026-01-${String(i + 1).padStart(2, "0")}`,
    open: c,
    high: c + 1,
    low: c - 1,
    close: c,
    volume: 1000,
  }));
}

describe("kd", () => {
  it("收在最高附近時 K 值往上", () => {
    const candles = makeCandles(Array.from({ length: 20 }, (_, i) => 10 + i));
    const out = kd(candles);
    expect(out[7]).toBeNull();
    expect(out.at(-1)!.k).toBeGreaterThan(80);
  });
});

describe("computeIndicators", () => {
  it("產生完整摘要", () => {
    const closes = Array.from({ length: 120 }, (_, i) => 100 + i * 0.5 + Math.sin(i) * 2);
    const snap = computeIndicators(makeCandles(closes));
    expect(snap.ma5).not.toBeNull();
    expect(snap.ma60).not.toBeNull();
    expect(snap.rsi14).not.toBeNull();
    expect(snap.macd).not.toBeNull();
    expect(snap.kd).not.toBeNull();
    expect(snap.return1m).toBeGreaterThan(0);
    expect(snap.volatility20).toBeGreaterThan(0);
  });
  it("資料很少時不會出錯", () => {
    const snap = computeIndicators(makeCandles([1, 2, 3]));
    expect(snap.ma20).toBeNull();
    expect(snap.rsi14).toBeNull();
  });
});
