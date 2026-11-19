"use client";

import Link from "next/link";
import { useState } from "react";
import { StockSearch } from "@/components/StockSearch";
import { Badge, Card, Disclaimer, LinkButton } from "@/components/ui";
import { RISK_DESC, RISK_LABEL } from "@/lib/risk";
import { useHydrated, useStore } from "@/lib/store";
import { POPULAR_STOCKS } from "@/lib/stockList";

const TABS = [
  { id: "etf", label: "新手常見 ETF" },
  { id: "tw", label: "台股權值股" },
  { id: "us", label: "美股熱門" },
] as const;

export default function Home() {
  const hydrated = useHydrated();
  const [risk] = useStore("risk");
  const [ai] = useStore("ai");
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("etf");

  const list = POPULAR_STOCKS.filter((s) =>
    tab === "etf" ? s.type === "etf" : tab === "tw" ? s.market === "TW" && s.type === "stock" : s.market === "US" && s.type === "stock",
  );

  return (
    <div className="space-y-5">
      <section className="pt-2">
        <h1 className="text-2xl font-bold sm:text-3xl">從零開始，看懂你想買的股票</h1>
        <p className="mt-1 text-muted">搜尋一檔股票，讓 AI 用白話文幫你分析；再用虛擬的 100 萬練習投資。</p>
        <div className="mt-4">
          <StockSearch />
        </div>
      </section>

      {hydrated && (
        <div className="grid gap-4 md:grid-cols-2">
          {risk ? (
            <Card title="你的風險屬性" action={<Link href="/onboarding" className="text-sm text-accent">重新測驗</Link>}>
              <p className="text-xl font-bold text-accent">{RISK_LABEL[risk.level]}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{RISK_DESC[risk.level]}</p>
            </Card>
          ) : (
            <Card title="第一步：了解你的投資個性">
              <p className="text-sm leading-relaxed text-muted">花 2 分鐘回答 8 個問題，AI 會依照你的風險屬性調整建議。</p>
              <LinkButton href="/onboarding" className="mt-3">開始風險評估</LinkButton>
            </Card>
          )}
          {ai ? (
            <Card title="AI 模型" action={<Link href="/settings" className="text-sm text-accent">變更</Link>}>
              <p className="font-medium">{ai.model}</p>
              <p className="mt-1 text-sm text-muted">已設定完成，可以在個股頁使用 AI 分析，或到「AI 助理」提問。</p>
            </Card>
          ) : (
            <Card title="設定 AI 模型">
              <p className="text-sm leading-relaxed text-muted">
                AI 分析需要你自己的 AI 服務金鑰（支援 Claude、OpenAI、Gemini 或其他相容服務）。金鑰只存在你的瀏覽器。
              </p>
              <LinkButton href="/settings" variant="secondary" className="mt-3">前往設定</LinkButton>
            </Card>
          )}
        </div>
      )}

      <Card title="熱門標的">
        <div className="mb-3 flex gap-1 overflow-x-auto" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${tab === t.id ? "bg-accent text-white" : "bg-surface-2 text-muted"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {tab === "etf" && (
          <p className="mb-3 text-sm text-muted">
            💡 ETF 就像一籃子股票，一次買進很多家公司，比單買一檔股票分散風險，很適合新手入門。
          </p>
        )}
        <ul className="grid gap-2 sm:grid-cols-2">
          {list.map((s) => (
            <li key={s.symbol}>
              <Link href={`/stock/${s.symbol}`} className="flex items-center justify-between gap-2 rounded-xl border border-line px-3 py-2.5 hover:bg-surface-2">
                <span className="min-w-0">
                  <span className="font-semibold tabular">{s.symbol}</span>
                  <span className="ml-2 truncate">{s.name}</span>
                </span>
                <span className="flex shrink-0 gap-1">
                  <Badge>{s.sector}</Badge>
                  <Badge tone="accent">{s.market === "TW" ? "台股" : "美股"}</Badge>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <Link href="/learn" className="rounded-2xl border border-line bg-surface p-4 hover:bg-surface-2">
          <p className="font-semibold">📘 新手學堂</p>
          <p className="mt-1 text-sm text-muted">8 堂短課，搞懂 ETF、定期定額、停損停利</p>
        </Link>
        <Link href="/portfolio" className="rounded-2xl border border-line bg-surface p-4 hover:bg-surface-2">
          <p className="font-semibold">💰 模擬投資</p>
          <p className="mt-1 text-sm text-muted">用虛擬 100 萬練習，不怕賠到真錢</p>
        </Link>
        <Link href="/chat" className="rounded-2xl border border-line bg-surface p-4 hover:bg-surface-2">
          <p className="font-semibold">✦ 問 AI</p>
          <p className="mt-1 text-sm text-muted">「什麼是本益比？」任何問題都可以問</p>
        </Link>
      </div>

      <Disclaimer />
    </div>
  );
}
