"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { AnalysisReport } from "@/components/AnalysisReport";
import { PriceChart } from "@/components/PriceChart";
import { TradeDialog } from "@/components/TradeDialog";
import { Badge, Button, Card, DemoBanner, Disclaimer, ErrorBox, InfoTip, LinkButton, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { changeClass, fmtBig, fmtNum, fmtPct, timeAgo } from "@/lib/format";
import { GLOSSARY } from "@/lib/glossary";
import { describeIndicators } from "@/lib/indicators";
import { findLocal } from "@/lib/stockList";
import { useHydrated, useStore } from "@/lib/store";
import type { AIAnalysisResult, NewsItem, StockData } from "@/lib/types";

const CACHE_MS = 60 * 60 * 1000; // AI 分析快取 1 小時

export default function StockPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol: raw } = use(params);
  const symbol = decodeURIComponent(raw).toUpperCase();
  const hydrated = useHydrated();
  const [data, setData] = useState<StockData | null>(null);
  const [error, setError] = useState("");
  const [news, setNews] = useState<NewsItem[] | null>(null);
  const [trade, setTrade] = useState<"buy" | "sell" | null>(null);
  const [watchlist, setWatchlist] = useStore("watchlist");
  const [portfolio] = useStore("portfolio");

  useEffect(() => {
    let alive = true;
    setData(null);
    setError("");
    setNews(null);
    api<StockData>(`/api/stock/${encodeURIComponent(symbol)}`)
      .then((d) => {
        if (!alive) return;
        setData(d);
        fetch(`/api/news/${encodeURIComponent(d.quote.symbol)}?name=${encodeURIComponent(d.quote.name)}`)
          .then((r) => r.json())
          .then((n: { items: NewsItem[] }) => alive && setNews(n.items))
          .catch(() => alive && setNews([]));
      })
      .catch((e) => alive && setError((e as Error).message));
    return () => {
      alive = false;
    };
  }, [symbol]);

  // 每 5 秒更新最新報價（分頁在背景時暫停）
  const [lastPoll, setLastPoll] = useState<number | null>(null);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const loaded = data != null && !data.isDemo;
  useEffect(() => {
    if (!loaded) return;
    let alive = true;
    let busy = false; // 上一次還沒回來就不要再發，避免請求堆積
    const poll = async () => {
      if (document.visibilityState !== "visible" || busy) return;
      busy = true;
      try {
        const r = await api<{ quote: StockData["quote"]; isDemo: boolean }>(`/api/quote/${encodeURIComponent(symbol)}`);
        if (!alive) return;
        setData((d) => {
          if (!d) return d;
          if (r.quote.price !== d.quote.price) {
            setFlash(r.quote.price > d.quote.price ? "up" : "down");
            window.setTimeout(() => setFlash(null), 1200);
          }
          return { ...d, quote: r.quote };
        });
        setLastPoll(Date.now());
      } catch {
        /* 下次再試 */
      } finally {
        busy = false;
      }
    };
    const t = window.setInterval(poll, 5_000);
    const onVisible = () => document.visibilityState === "visible" && poll();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [loaded, symbol]);

  if (error) {
    return (
      <div className="space-y-4">
        <ErrorBox message={error} action={<LinkButton href="/" variant="secondary">回首頁重新搜尋</LinkButton>} />
      </div>
    );
  }
  if (!data) return <div className="py-16 text-center"><Spinner label={`正在載入 ${symbol} 的資料…`} /></div>;

  const { quote: q, fundamentals: f, indicators: ind } = data;
  const local = findLocal(q.symbol);
  const inWatch = watchlist.some((w) => w.symbol === q.symbol);
  const held = portfolio.holdings.find((h) => h.symbol === q.symbol);

  const toggleWatch = () =>
    setWatchlist(
      inWatch
        ? watchlist.filter((w) => w.symbol !== q.symbol)
        : [...watchlist, { symbol: q.symbol, name: q.name, market: q.market, addedAt: new Date().toISOString() }],
    );

  return (
    <div className="space-y-4">
      {data.isDemo && <DemoBanner />}

      <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{q.name}</h1>
            <span className="text-muted tabular">{q.symbol}</span>
            <Badge tone="accent">{q.market === "TW" ? "台股" : "美股"}</Badge>
            {local?.type === "etf" && <Badge>ETF</Badge>}
            {f.sector && <Badge>{f.sector}</Badge>}
          </div>
          <div className="mt-1 flex items-baseline gap-3">
            <span className={`rounded-lg px-1 text-3xl font-bold tabular transition-colors duration-700 ${changeClass(q.change)} ${flash ? "bg-surface-2" : ""}`}>{fmtNum(q.price)}</span>
            <span className={`tabular ${changeClass(q.change)}`}>
              {q.change > 0 ? "▲" : q.change < 0 ? "▼" : ""} {fmtNum(Math.abs(q.change))}（{fmtPct(q.changePercent)}）
            </span>
            <span className="text-xs text-muted">{q.currency}</span>
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
            {!data.isDemo && (
              <span className={q.realtimeSource ? "text-accent" : ""}>
                {q.realtimeSource ? "● 自動更新中（每 5 秒）" : "收盤資料"}
              </span>
            )}
            <span>報價時間：{new Date(q.asOf).toLocaleString("zh-TW")}</span>
            {lastPoll && <span>最後檢查：{new Date(lastPoll).toLocaleTimeString("zh-TW")}</span>}
            <span>來源：{data.dataSources.join("、")}</span>
          </p>
        </div>
        {hydrated && (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={toggleWatch} aria-pressed={inWatch}>
              {inWatch ? "★ 已加入自選" : "☆ 加入自選"}
            </Button>
            <Button onClick={() => setTrade("buy")}>模擬買進</Button>
            {held && <Button variant="secondary" onClick={() => setTrade("sell")}>模擬賣出</Button>}
          </div>
        )}
      </section>

      <Card>
        <PriceChart candles={data.history} />
      </Card>

      <AIAnalysisCard data={data} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="基本面數據">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <Metric label="本益比" value={fmtNum(f.peRatio)} />
            <Metric label="股價淨值比" value={fmtNum(f.pbRatio)} />
            <Metric label="EPS" value={fmtNum(f.eps)} />
            <Metric label="殖利率" value={fmtPct(f.dividendYield, 2, false)} />
            <Metric label="營收成長率" value={fmtPct(f.revenueGrowth)} />
            <Metric label="淨利率" value={fmtPct(f.profitMargin, 2, false)} />
            <Metric label="負債權益比" value={fmtPct(f.debtToEquity, 1, false)} />
            <Metric label="市值" value={fmtBig(f.marketCap)} />
            <Metric label="52 週高低" value={`${fmtNum(f.week52High)} / ${fmtNum(f.week52Low)}`} />
          </dl>
          <p className="mt-3 text-xs text-muted">資料來源：{f.source.join("、")}。「—」表示目前取不到該項資料。</p>
        </Card>

        <Card title="技術指標">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <Metric label="均線" tip="均線" value={`MA5 ${fmtNum(ind.ma5)}｜MA20 ${fmtNum(ind.ma20)}｜MA60 ${fmtNum(ind.ma60)}`} wide />
            <Metric label="RSI" value={fmtNum(ind.rsi14)} />
            <Metric label="KD" value={ind.kd ? `K ${fmtNum(ind.kd.k)}｜D ${fmtNum(ind.kd.d)}` : "—"} />
            <Metric label="MACD" value={ind.macd ? `柱狀體 ${fmtNum(ind.macd.histogram, 3)}` : "—"} />
            <Metric label="波動度" value={fmtPct(ind.volatility20, 1, false)} />
            <Metric label="近 1 月報酬" tip="" value={fmtPct(ind.return1m)} className={changeClass(ind.return1m)} />
            <Metric label="近 3 月報酬" tip="" value={fmtPct(ind.return3m)} className={changeClass(ind.return3m)} />
            <Metric label="成交量" value={`${fmtBig(q.volume)}（20 日均 ${fmtBig(ind.volumeAvg20)}）`} wide />
          </dl>
          <div className="mt-4 rounded-xl bg-surface-2 p-3">
            <p className="mb-1 text-sm font-medium">白話解讀（系統自動判讀）</p>
            <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted">
              {describeIndicators(ind, q.price).map((s) => <li key={s}>{s}</li>)}
            </ul>
          </div>
        </Card>
      </div>

      <Card title="近期新聞">
        {news == null ? (
          <Spinner label="載入新聞中…" />
        ) : news.length === 0 ? (
          <p className="text-sm text-muted">目前沒有取得相關新聞。</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {news.map((n) => (
              <li key={n.link} className="py-2.5">
                <a href={n.link} target="_blank" rel="noopener noreferrer" className="hover:text-accent">{n.title}</a>
                <p className="mt-0.5 text-xs text-muted">{n.publisher}{n.publishedAt ? ` · ${timeAgo(n.publishedAt)}` : ""}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Disclaimer />

      {trade && (
        <TradeDialog
          open
          onClose={() => setTrade(null)}
          defaultSide={trade}
          stock={{ symbol: q.symbol, name: q.name, market: q.market, price: q.price, isDemo: data.isDemo }}
        />
      )}
    </div>
  );
}

function Metric({ label, value, tip, wide, className = "" }: { label: string; value: string; tip?: string; wide?: boolean; className?: string }) {
  const key = tip ?? label;
  return (
    <div className={wide ? "col-span-2" : ""}>
      <dt className="text-muted">
        {label}
        {key && GLOSSARY[key] && <InfoTip title={key}>{GLOSSARY[key]}</InfoTip>}
      </dt>
      <dd className={`mt-0.5 font-medium tabular ${className}`}>{value}</dd>
    </div>
  );
}

function AIAnalysisCard({ data }: { data: StockData }) {
  const hydrated = useHydrated();
  const [ai] = useStore("ai");
  const [risk] = useStore("risk");
  const [analyses, setAnalyses] = useStore("analyses");
  const [, setWatchlist] = useStore("watchlist");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const key = ai ? `${data.quote.symbol}:${ai.model}` : "";
  const cached = key ? analyses[key] : undefined;
  const fresh = cached && Date.now() - new Date(cached.generatedAt).getTime() < CACHE_MS;

  const run = useCallback(async () => {
    if (!ai) return;
    setLoading(true);
    setError("");
    try {
      const r = await api<AIAnalysisResult>("/api/ai/analyze", { settings: ai, symbol: data.quote.symbol, riskLevel: risk?.level ?? null });
      setAnalyses((prev) => {
        // 只保留最近 30 筆，避免 localStorage 爆掉
        const entries = Object.entries({ ...prev, [key]: r }).sort((a, b) => b[1].generatedAt.localeCompare(a[1].generatedAt));
        return Object.fromEntries(entries.slice(0, 30));
      });
      setWatchlist((list) =>
        list.map((w) => (w.symbol === r.symbol ? { ...w, prevAiScore: w.lastAiScore ?? null, lastAiScore: r.analysis.overallScore } : w)),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [ai, data.quote.symbol, key, risk?.level, setAnalyses, setWatchlist]);

  if (!hydrated) return null;

  return (
    <Card
      title={<span>✦ AI 分析報告</span>}
      action={
        ai && cached && !loading ? (
          <Button variant="ghost" onClick={run} className="text-accent">
            {fresh ? "重新分析" : "更新分析"}
          </Button>
        ) : null
      }
    >
      {!ai ? (
        <div className="text-sm">
          <p className="text-muted">要使用 AI 分析，請先設定你的 AI 模型與 API 金鑰。</p>
          <LinkButton href="/settings" className="mt-3">前往設定</LinkButton>
        </div>
      ) : loading ? (
        <div className="py-8 text-center">
          <Spinner label="AI 正在閱讀數據並撰寫報告，約需 10–60 秒…" />
        </div>
      ) : cached ? (
        <>
          {!fresh && <p className="mb-3 rounded-xl bg-surface-2 p-2.5 text-xs text-muted">這份報告是 {timeAgo(cached.generatedAt)}產生的，股價可能已經變動，建議更新。</p>}
          <AnalysisReport result={cached} />
        </>
      ) : (
        <div className="text-sm">
          <p className="leading-relaxed text-muted">
            AI 會根據系統抓到的股價、技術指標、基本面與新聞，用白話文幫你整理這檔股票的現況、風險，以及{risk ? "是否適合你的風險屬性" : "給新手的注意事項"}。
          </p>
          {!risk && (
            <p className="mt-2 text-xs text-warn">
              你還沒做風險評估，AI 會用「穩健型」的角度分析。<Link href="/onboarding" className="underline">先去測驗</Link>
            </p>
          )}
          <Button onClick={run} className="mt-3">開始 AI 分析</Button>
        </div>
      )}
      {error && <div className="mt-3"><ErrorBox message={error} action={<Button variant="secondary" onClick={run}>再試一次</Button>} /></div>}
      <p className="mt-4 text-xs text-muted">AI 分析僅供學習參考，不構成投資建議。</p>
    </Card>
  );
}
