"use client";

import { timeAgo } from "@/lib/format";
import type { AIAnalysisResult } from "@/lib/types";
import { Badge, ScoreBar, ScoreRing } from "./ui";

const ACTION_TONE = { 觀望: "neutral", 可分批布局: "accent", 考慮減碼: "warn" } as const;

export function AnalysisReport({ result }: { result: AIAnalysisResult }) {
  const a = result.analysis;
  return (
    <div className="space-y-5">
      {result.isDemoData && (
        <p className="rounded-xl bg-warn-soft p-3 text-sm text-warn">這份分析是根據「示範資料」產生的，只能用來熟悉功能，不代表真實情況。</p>
      )}
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <ScoreRing score={a.overallScore} label="綜合評分" />
        <div className="flex-1 text-center sm:text-left">
          <p className="text-lg leading-relaxed font-semibold">{a.summary}</p>
          <div className="mt-2 flex flex-wrap justify-center gap-1.5 sm:justify-start">
            <Badge tone={ACTION_TONE[a.action]}>建議：{a.action}</Badge>
            <Badge tone={a.confidence.level === "高" ? "accent" : a.confidence.level === "中" ? "neutral" : "warn"}>AI 把握程度：{a.confidence.level}</Badge>
            <Badge tone={a.suitability.suitable ? "accent" : "warn"}>{a.suitability.suitable ? "符合你的風險屬性" : "不太符合你的風險屬性"}</Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <ScoreBar label="技術面" score={a.technical.score} note={a.technical.trend} />
        <ScoreBar label="基本面" score={a.fundamental.score} note={a.fundamental.valuation} />
        <ScoreBar label="消息面" score={a.sentiment.score} note={a.sentiment.mood} />
      </div>

      <Section title="📈 技術面：最近的價格走勢">{a.technical.explanation}</Section>
      <Section title="🏢 基本面：公司體質與價格貴不貴">{a.fundamental.explanation}</Section>
      <Section title="📰 消息面：最近的新聞">{a.sentiment.explanation}</Section>

      <div className="rounded-xl border border-line p-4">
        <h3 className="font-semibold">🧭 建議動作：{a.action}</h3>
        <p className="mt-1.5 text-sm leading-relaxed">{a.actionReason}</p>
      </div>

      <div>
        <h3 className="mb-2 font-semibold">⚠️ 主要風險</h3>
        <ol className="list-decimal space-y-1 pl-5 text-sm leading-relaxed">
          {a.risks.map((r, i) => <li key={i}>{r}</li>)}
        </ol>
      </div>

      <Section title="👤 適合你嗎？">{a.suitability.explanation}</Section>
      <Section title="🎯 AI 的把握程度">{`${a.confidence.level}：${a.confidence.reason}`}</Section>

      {a.glossary.length > 0 && (
        <div>
          <h3 className="mb-2 font-semibold">📖 名詞小辭典</h3>
          <dl className="grid gap-2 sm:grid-cols-2">
            {a.glossary.map((g) => (
              <div key={g.term} className="rounded-xl bg-surface-2 p-3 text-sm">
                <dt className="font-medium">{g.term}</dt>
                <dd className="mt-0.5 text-muted">{g.explanation}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      <p className="text-xs text-muted">由 {result.model} 於 {timeAgo(result.generatedAt)}產生 · 數據由系統抓取，AI 僅負責解讀</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: string }) {
  return (
    <div>
      <h3 className="mb-1 font-semibold">{title}</h3>
      <p className="text-sm leading-relaxed">{children}</p>
    </div>
  );
}
