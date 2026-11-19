"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TradeDialog } from "@/components/TradeDialog";
import { Badge, Button, Card, Disclaimer, Empty, ErrorBox, LinkButton, ScoreRing, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { changeClass, fmtInt, fmtNum, fmtPct } from "@/lib/format";
import { DEFAULTS, useHydrated, useStore } from "@/lib/store";
import type { Holding, StockData } from "@/lib/types";

interface Review {
  summary: string;
  score: number;
  concentration: string;
  diversification: string;
  fit: string;
  suggestions: string[];
  generatedAt: string;
}

const PALETTE = ["#2f6fed", "#e0a100", "#a35bd6", "#13a3a3", "#e2662f", "#6b8e23", "#c2417a", "#5a6acf"];

function Donut({ parts }: { parts: { label: string; value: number }[] }) {
  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  const r = 52;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <svg width={140} height={140} viewBox="0 0 140 140" role="img" aria-label="資產配置圓餅圖">
        {parts.map((p, i) => {
          const len = (p.value / total) * c;
          const el = (
            <circle key={p.label} cx={70} cy={70} r={r} fill="none" stroke={p.label === "現金" ? "var(--border)" : PALETTE[i % PALETTE.length]} strokeWidth={22}
              strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} transform="rotate(-90 70 70)" />
          );
          offset += len;
          return el;
        })}
      </svg>
      <ul className="space-y-1 text-sm">
        {parts.map((p, i) => (
          <li key={p.label} className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: p.label === "現金" ? "var(--border)" : PALETTE[i % PALETTE.length] }} />
            <span>{p.label}</span>
            <span className="text-muted tabular">{((p.value / total) * 100).toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function PortfolioPage() {
  const hydrated = useHydrated();
  const [portfolio, setPortfolio] = useStore("portfolio");
  const [ai] = useStore("ai");
  const [risk] = useStore("risk");
  const [prices, setPrices] = useState<Record<string, { price: number; isDemo: boolean }>>({});
  const [fx, setFx] = useState(32);
  const [trade, setTrade] = useState<{ h: Holding; side: "buy" | "sell" } | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState("");

  const symbols = portfolio.holdings.map((h) => h.symbol).join(",");
  useEffect(() => {
    if (!hydrated) return;
    fetch("/api/fx").then((r) => r.json()).then((d: { rate: number }) => setFx(d.rate)).catch(() => {});
    symbols.split(",").filter(Boolean).forEach((s) =>
      fetch(`/api/stock/${encodeURIComponent(s)}`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d: StockData) => setPrices((p) => ({ ...p, [s]: { price: d.quote.price, isDemo: d.isDemo } })))
        .catch(() => {}),
    );
  }, [symbols, hydrated]);

  if (!hydrated) return <Spinner label="載入中…" />;

  const rows = portfolio.holdings.map((h) => {
    const price = prices[h.symbol]?.price ?? h.avgCost;
    const rate = h.market === "US" ? fx : 1;
    const value = price * h.shares * rate;
    const cost = h.avgCost * h.shares * rate;
    return { h, price, value, pnl: value - cost, pnlPct: cost ? ((value - cost) / cost) * 100 : 0, loaded: h.symbol in prices };
  });
  const holdingsValue = rows.reduce((a, r) => a + r.value, 0);
  const total = holdingsValue + portfolio.cash;
  const totalPnl = total - portfolio.initialCash;
  const anyDemo = Object.values(prices).some((p) => p.isDemo);

  const runReview = async () => {
    if (!ai) return;
    setReviewing(true);
    setError("");
    try {
      setReview(await api<Review>("/api/ai/portfolio", { settings: ai, holdings: portfolio.holdings, cash: portfolio.cash, riskLevel: risk?.level ?? null }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setReviewing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">模擬投資</h1>
        <p className="mt-1 text-sm text-muted">用虛擬的 {fmtInt(portfolio.initialCash)} 元練習投資，不會動到你的真錢。</p>
      </div>
      {anyDemo && <p className="rounded-xl bg-warn-soft p-3 text-sm text-warn">部分價格為示範資料，損益僅供參考。</p>}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-muted">總資產（台幣）</p>
          <p className="mt-1 text-2xl font-bold tabular">{fmtInt(total)}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">總損益</p>
          <p className={`mt-1 text-2xl font-bold tabular ${changeClass(totalPnl)}`}>
            {totalPnl > 0 ? "+" : ""}{fmtInt(totalPnl)} <span className="text-base">({fmtPct((totalPnl / portfolio.initialCash) * 100)})</span>
          </p>
        </Card>
        <Card>
          <p className="text-sm text-muted">可用現金</p>
          <p className="mt-1 text-2xl font-bold tabular">{fmtInt(portfolio.cash)}</p>
        </Card>
      </div>

      {rows.length === 0 ? (
        <Empty title="還沒有持股">
          到個股頁按「模擬買進」開始練習。新手可以從 <Link className="text-accent underline" href="/stock/0050">0050</Link> 這類大盤 ETF 開始。
        </Empty>
      ) : (
        <>
          <Card title="持股明細">
            <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="text-left text-muted">
                  <tr>
                    <th className="py-2 font-normal">股票</th>
                    <th className="py-2 text-right font-normal">股數</th>
                    <th className="py-2 text-right font-normal">成本 / 現價</th>
                    <th className="py-2 text-right font-normal">市值（台幣）</th>
                    <th className="py-2 text-right font-normal">損益</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {rows.map((r) => (
                    <tr key={r.h.symbol}>
                      <td className="py-2.5">
                        <Link href={`/stock/${r.h.symbol}`} className="font-medium hover:text-accent">{r.h.name}</Link>
                        <div className="text-xs text-muted">{r.h.symbol} · {r.h.market === "TW" ? "台股" : "美股"}</div>
                      </td>
                      <td className="text-right tabular">{fmtInt(r.h.shares)}</td>
                      <td className="text-right tabular">
                        {fmtNum(r.h.avgCost)}<br />
                        <span className="text-muted">{r.loaded ? fmtNum(r.price) : "…"}</span>
                      </td>
                      <td className="text-right tabular">{fmtInt(r.value)}</td>
                      <td className={`text-right tabular ${changeClass(r.pnl)}`}>
                        {fmtInt(r.pnl)}<br />
                        <span className="text-xs">{fmtPct(r.pnlPct)}</span>
                      </td>
                      <td className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" className="min-h-8 px-2" onClick={() => setTrade({ h: r.h, side: "buy" })}>買</Button>
                          <Button variant="ghost" className="min-h-8 px-2" onClick={() => setTrade({ h: r.h, side: "sell" })}>賣</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="資產配置">
              <Donut parts={[...rows.map((r) => ({ label: r.h.name, value: r.value })), { label: "現金", value: portfolio.cash }]} />
            </Card>
            <Card title="✦ AI 組合健檢">
              {!ai ? (
                <div className="text-sm">
                  <p className="text-muted">設定 AI 模型後，AI 可以幫你檢查持股是否太集中、是否符合你的風險屬性。</p>
                  <LinkButton href="/settings" className="mt-3" variant="secondary">前往設定</LinkButton>
                </div>
              ) : reviewing ? (
                <Spinner label="AI 正在檢視你的組合…" />
              ) : review ? (
                <div className="space-y-3 text-sm leading-relaxed">
                  <div className="flex items-center gap-4">
                    <ScoreRing score={review.score} size={80} label="健康度" />
                    <p className="font-medium">{review.summary}</p>
                  </div>
                  <p><strong>集中度：</strong>{review.concentration}</p>
                  <p><strong>分散度：</strong>{review.diversification}</p>
                  <p><strong>與風險屬性：</strong>{review.fit}</p>
                  {review.suggestions.length > 0 && (
                    <ul className="list-disc space-y-1 pl-5">{review.suggestions.map((s, i) => <li key={i}>{s}</li>)}</ul>
                  )}
                  <Button variant="secondary" onClick={runReview}>重新檢視</Button>
                </div>
              ) : (
                <div className="text-sm">
                  <p className="text-muted">AI 會檢查集中度風險、產業分散程度，以及是否符合你的風險屬性。</p>
                  <Button className="mt-3" onClick={runReview}>開始健檢</Button>
                </div>
              )}
              {error && <div className="mt-3"><ErrorBox message={error} /></div>}
            </Card>
          </div>
        </>
      )}

      {portfolio.trades.length > 0 && (
        <Card title="交易紀錄">
          <ul className="divide-y divide-[var(--border)] text-sm">
            {portfolio.trades.slice(0, 30).map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <Badge tone={t.side === "buy" ? "up" : "down"}>{t.side === "buy" ? "買進" : "賣出"}</Badge>
                  <span className="ml-2">{t.name}</span>
                  <span className="ml-1 text-muted tabular">{fmtInt(t.shares)} 股 @ {fmtNum(t.price)}</span>
                </span>
                <span className="text-xs text-muted">費用 {fmtInt(t.fee)} 元 · {new Date(t.time).toLocaleString("zh-TW")}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="flex justify-end">
        <Button
          variant="danger"
          onClick={() => {
            if (confirm("確定要重設模擬投資嗎？所有持股與交易紀錄都會清除，資金回到 100 萬。")) {
              setPortfolio(DEFAULTS.portfolio);
              setReview(null);
            }
          }}
        >
          重設模擬投資
        </Button>
      </div>
      <Disclaimer />

      {trade && (
        <TradeDialog
          open
          onClose={() => setTrade(null)}
          defaultSide={trade.side}
          stock={{
            symbol: trade.h.symbol,
            name: trade.h.name,
            market: trade.h.market,
            price: prices[trade.h.symbol]?.price ?? trade.h.avgCost,
            isDemo: prices[trade.h.symbol]?.isDemo,
          }}
        />
      )}
    </div>
  );
}
