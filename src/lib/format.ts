export function fmtNum(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("zh-TW", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtInt(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString("zh-TW");
}

export function fmtPct(n: number | null | undefined, digits = 2, sign = true): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${sign && n > 0 ? "+" : ""}${n.toFixed(digits)}%`;
}

export function fmtBig(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1e12) return `${(n / 1e12).toFixed(2)} 兆`;
  if (Math.abs(n) >= 1e8) return `${(n / 1e8).toFixed(2)} 億`;
  if (Math.abs(n) >= 1e4) return `${(n / 1e4).toFixed(1)} 萬`;
  return fmtInt(n);
}

export function changeClass(n: number | null | undefined) {
  if (n == null || n === 0) return "text-muted";
  return n > 0 ? "text-up" : "text-down";
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "剛剛";
  if (m < 60) return `${m} 分鐘前`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} 小時前`;
  const d = Math.round(h / 24);
  return d < 30 ? `${d} 天前` : new Date(iso).toLocaleDateString("zh-TW");
}

/** 台股手續費 0.1425%（最低 20 元），賣出另加證交稅 0.3%（ETF 0.1%）；美股以 0 手續費估算 */
export function estimateFee(market: "TW" | "US", side: "buy" | "sell", amountTwd: number, isEtf: boolean) {
  if (market === "US") return 0;
  const fee = Math.max(20, Math.round(amountTwd * 0.001425));
  const tax = side === "sell" ? Math.round(amountTwd * (isEtf ? 0.001 : 0.003)) : 0;
  return fee + tax;
}
