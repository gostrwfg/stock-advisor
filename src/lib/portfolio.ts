import { estimateFee } from "./format";
import type { Market, Portfolio, Trade } from "./types";

export interface TradeInput {
  symbol: string;
  name: string;
  market: Market;
  side: "buy" | "sell";
  shares: number;
  price: number; // 原幣
  fxRate: number; // 美股為 USD/TWD，台股 1
  isEtf: boolean;
}

/** 執行一筆模擬交易，回傳新的組合；不合法時丟出錯誤訊息 */
export function applyTrade(p: Portfolio, t: TradeInput, now = new Date()): Portfolio {
  if (!Number.isInteger(t.shares) || t.shares <= 0) throw new Error("股數必須是正整數");
  if (!(t.price > 0)) throw new Error("價格不正確");
  const amountTwd = t.shares * t.price * t.fxRate;
  const fee = estimateFee(t.market, t.side, amountTwd, t.isEtf);
  const holdings = p.holdings.map((h) => ({ ...h }));
  const idx = holdings.findIndex((h) => h.symbol === t.symbol);
  let cash = p.cash;

  if (t.side === "buy") {
    if (amountTwd + fee > cash) throw new Error(`現金不足：需要約 ${Math.round(amountTwd + fee).toLocaleString()} 元，目前只有 ${Math.round(cash).toLocaleString()} 元`);
    cash -= amountTwd + fee;
    if (idx >= 0) {
      const h = holdings[idx];
      h.avgCost = (h.avgCost * h.shares + t.price * t.shares) / (h.shares + t.shares);
      h.shares += t.shares;
    } else {
      holdings.push({ symbol: t.symbol, name: t.name, market: t.market, shares: t.shares, avgCost: t.price });
    }
  } else {
    if (idx < 0 || holdings[idx].shares < t.shares) throw new Error("持有股數不足");
    cash += amountTwd - fee;
    holdings[idx].shares -= t.shares;
    if (holdings[idx].shares === 0) holdings.splice(idx, 1);
  }

  const trade: Trade = {
    id: `${now.getTime()}-${Math.random().toString(36).slice(2, 7)}`,
    symbol: t.symbol,
    name: t.name,
    market: t.market,
    side: t.side,
    shares: t.shares,
    price: t.price,
    fxRate: t.fxRate,
    fee,
    time: now.toISOString(),
  };
  return { ...p, cash, holdings, trades: [trade, ...p.trades].slice(0, 500) };
}
