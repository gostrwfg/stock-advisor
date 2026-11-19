import { describe, expect, it } from "vitest";
import { mergeRealtime, parseFinMind, parseMis, parseStooqHistory, parseStooqQuote } from "./parsers";
import type { Candle } from "./types";

const mis = {
  msgArray: [
    { c: "2330", n: "台積電", z: "1065.0000", y: "1050.0000", o: "1055.0000", h: "1070.0000", l: "1052.0000", v: "23456", b: "1060.0000_1055.0000_", a: "1065.0000_1070.0000_", d: "20261119", t: "11:02:35", tlong: "1795575755000" },
  ],
};

describe("parseMis", () => {
  it("解析即時報價，成交量由張換算成股", () => {
    const r = parseMis(mis, "2330")!;
    expect(r.price).toBe(1065);
    expect(r.previousClose).toBe(1050);
    expect(r.volume).toBe(23_456_000);
    expect(r.date).toBe("2026-11-19");
    expect(r.name).toBe("台積電");
  });
  it("尚未成交時用最佳買價", () => {
    const r = parseMis({ msgArray: [{ ...mis.msgArray[0], z: "-" }] }, "2330")!;
    expect(r.price).toBe(1060);
  });
  it("找不到代號回傳 null", () => {
    expect(parseMis(mis, "9999")).toBeNull();
    expect(parseMis({}, "2330")).toBeNull();
  });
});

describe("parseFinMind", () => {
  it("解析並依日期排序、略過無效資料", () => {
    const c = parseFinMind({
      data: [
        { date: "2026-11-18", open: 10, max: 11, min: 9, close: 10.5, Trading_Volume: 1000 },
        { date: "2026-11-17", open: 9, max: 10, min: 8, close: 9.5, Trading_Volume: 900 },
        { date: "2026-11-16", open: 0, max: 0, min: 0, close: 0, Trading_Volume: 0 },
      ],
    });
    expect(c.map((x) => x.time)).toEqual(["2026-11-17", "2026-11-18"]);
    expect(c[1]).toMatchObject({ high: 11, low: 9, close: 10.5, volume: 1000 });
  });
});

describe("Stooq", () => {
  it("解析日 K CSV", () => {
    const c = parseStooqHistory("Date,Open,High,Low,Close,Volume\n2026-11-17,1,2,0.5,1.5,100\n2026-11-18,1.5,2.5,1,2,200\n");
    expect(c).toHaveLength(2);
    expect(c[1].close).toBe(2);
  });
  it("無資料時回傳空陣列", () => {
    expect(parseStooqHistory("No data")).toEqual([]);
  });
  it("解析最新報價", () => {
    const r = parseStooqQuote("Symbol,Date,Time,Open,High,Low,Close,Volume\nAAPL.US,2026-11-18,22:00:09,230,233,229,232.5,50000000\n")!;
    expect(r.price).toBe(232.5);
    expect(r.date).toBe("2026-11-18");
  });
  it("N/D 回傳 null", () => {
    expect(parseStooqQuote("Symbol,Date,Time,Open,High,Low,Close,Volume\nXXX.US,N/D,N/D,N/D,N/D,N/D,N/D,N/D\n")).toBeNull();
  });
});

describe("mergeRealtime", () => {
  const candles: Candle[] = [
    { time: "2026-11-17", open: 1, high: 2, low: 1, close: 1.5, volume: 10 },
    { time: "2026-11-18", open: 1.5, high: 2, low: 1.4, close: 1.8, volume: 20 },
  ];
  const rt = { price: 2.1, previousClose: 1.8, open: 1.9, high: 2.2, low: 1.85, volume: 30, date: "2026-11-19", time: "", source: "t" };
  it("新的一天新增 K 線", () => {
    const m = mergeRealtime(candles, rt);
    expect(m).toHaveLength(3);
    expect(m[2]).toMatchObject({ time: "2026-11-19", close: 2.1, open: 1.9 });
  });
  it("同一天更新最後一根", () => {
    const m = mergeRealtime(candles, { ...rt, date: "2026-11-18" });
    expect(m).toHaveLength(2);
    expect(m[1].close).toBe(2.1);
  });
  it("舊資料不會覆蓋", () => {
    expect(mergeRealtime(candles, { ...rt, date: "2026-11-01" })).toEqual(candles);
  });
});
