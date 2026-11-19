import { describe, expect, it } from "vitest";
import { applyTrade } from "./portfolio";
import type { Portfolio } from "./types";

const empty: Portfolio = { cash: 1_000_000, initialCash: 1_000_000, holdings: [], trades: [] };
const buy = { symbol: "2330", name: "台積電", market: "TW" as const, side: "buy" as const, shares: 100, price: 1000, fxRate: 1, isEtf: false };

describe("applyTrade", () => {
  it("買進扣現金與手續費", () => {
    const p = applyTrade(empty, buy);
    expect(p.holdings[0].shares).toBe(100);
    expect(p.cash).toBe(1_000_000 - 100_000 - 143); // 手續費 0.1425% 四捨五入
  });
  it("加碼時計算平均成本", () => {
    const p = applyTrade(applyTrade(empty, buy), { ...buy, price: 1200 });
    expect(p.holdings[0].shares).toBe(200);
    expect(p.holdings[0].avgCost).toBe(1100);
  });
  it("賣出含證交稅，賣光後移除持股", () => {
    const p1 = applyTrade(empty, buy);
    const p2 = applyTrade(p1, { ...buy, side: "sell" });
    expect(p2.holdings).toHaveLength(0);
    expect(p2.cash).toBe(p1.cash + 100_000 - 143 - 300);
  });
  it("現金不足時報錯", () => {
    expect(() => applyTrade(empty, { ...buy, shares: 2000 })).toThrow(/現金不足/);
  });
  it("持股不足時報錯", () => {
    expect(() => applyTrade(empty, { ...buy, side: "sell" })).toThrow(/持有股數不足/);
  });
  it("美股依匯率換算台幣、不收手續費", () => {
    const p = applyTrade(empty, { ...buy, symbol: "AAPL", market: "US", price: 200, shares: 10, fxRate: 32 });
    expect(p.cash).toBe(1_000_000 - 64_000);
  });
  it("最低手續費 20 元", () => {
    const p = applyTrade(empty, { ...buy, shares: 1, price: 100 });
    expect(p.cash).toBe(1_000_000 - 100 - 20);
  });
});
