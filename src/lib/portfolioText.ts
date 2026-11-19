import "server-only";
import { getStockData, getUsdTwd } from "./market";
import type { Holding } from "./types";

/** 用伺服器端抓到的最新價格，把模擬持股整理成文字（避免相信前端傳來的價格） */
export async function portfolioToText(holdings: Holding[], cash: number): Promise<string> {
  const list = (Array.isArray(holdings) ? holdings : []).slice(0, 20).filter((h) => h && typeof h.symbol === "string" && h.shares > 0);
  if (!list.length) return `現金 ${Math.round(Number(cash) || 0).toLocaleString()} 元，尚無持股。`;
  const fx = await getUsdTwd();
  const rows = await Promise.all(
    list.map(async (h) => {
      try {
        const d = await getStockData(h.symbol);
        const rate = d.quote.market === "US" ? fx.rate : 1;
        const value = d.quote.price * h.shares * rate;
        const pnl = h.avgCost ? ((d.quote.price - h.avgCost) / h.avgCost) * 100 : 0;
        return { h, d, value, pnl };
      } catch {
        return null;
      }
    }),
  );
  const valid = rows.filter((r): r is NonNullable<typeof r> => r != null);
  const total = valid.reduce((a, r) => a + r.value, 0) + (Number(cash) || 0);
  const lines = valid.map(
    (r) =>
      `- ${r.d.quote.name}（${r.d.quote.symbol}，${r.d.quote.market === "TW" ? "台股" : "美股"}，產業：${r.d.fundamentals.sector ?? "不明"}）` +
      `：${r.h.shares} 股，成本 ${r.h.avgCost.toFixed(2)}，現價 ${r.d.quote.price}，報酬 ${r.pnl.toFixed(1)}%，` +
      `市值約 ${Math.round(r.value).toLocaleString()} 台幣，占總資產 ${((r.value / total) * 100).toFixed(1)}%`,
  );
  return `總資產約 ${Math.round(total).toLocaleString()} 台幣，現金 ${Math.round(Number(cash) || 0).toLocaleString()} 元（占 ${(((Number(cash) || 0) / total) * 100).toFixed(1)}%）。
${lines.join("\n")}`;
}
