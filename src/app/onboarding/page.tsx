"use client";

import { useState } from "react";
import { Button, Card, LinkButton } from "@/components/ui";
import { RISK_DESC, RISK_LABEL, RISK_QUESTIONS, scoreToLevel } from "@/lib/risk";
import { useStore } from "@/lib/store";
import type { RiskProfile } from "@/lib/types";

export default function Onboarding() {
  const [, setRisk] = useStore("risk");
  const [answers, setAnswers] = useState<number[]>([]);
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<RiskProfile | null>(null);

  const q = RISK_QUESTIONS[step];
  const choose = (score: number) => {
    const next = [...answers.slice(0, step), score];
    setAnswers(next);
    if (step < RISK_QUESTIONS.length - 1) {
      setStep(step + 1);
    } else {
      const total = next.reduce((a, b) => a + b, 0);
      const profile: RiskProfile = { level: scoreToLevel(total), score: total, completedAt: new Date().toISOString() };
      setRisk(profile);
      setResult(profile);
    }
  };

  if (result) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <Card>
          <p className="text-sm text-muted">你的風險屬性是</p>
          <p className="mt-1 text-3xl font-bold text-accent">{RISK_LABEL[result.level]}</p>
          <p className="mt-1 text-sm text-muted">總分 {result.score} / 32</p>
          <p className="mt-4 leading-relaxed">{RISK_DESC[result.level]}</p>
          <div className="mt-4 rounded-xl bg-surface-2 p-3 text-sm leading-relaxed text-muted">
            之後 AI 分析每一檔股票時，都會告訴你這檔股票「適不適合你」。風險屬性會隨人生階段改變，建議每年重新測驗一次。
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <LinkButton href="/">回首頁開始搜尋</LinkButton>
            <LinkButton href="/learn" variant="secondary">先上新手學堂</LinkButton>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">風險屬性評估</h1>
        <p className="mt-1 text-sm text-muted">沒有標準答案，照實回答就好。</p>
      </div>
      <div className="h-2 rounded-full bg-surface-2" aria-hidden>
        <div className="h-2 rounded-full bg-accent transition-all" style={{ width: `${(step / RISK_QUESTIONS.length) * 100}%` }} />
      </div>
      <Card>
        <p className="text-sm text-muted">
          第 {step + 1} 題 / 共 {RISK_QUESTIONS.length} 題
        </p>
        <h2 className="mt-1 text-lg font-semibold">{q.question}</h2>
        <div className="mt-4 grid gap-2">
          {q.options.map((o) => (
            <button
              key={o.label}
              onClick={() => choose(o.score)}
              className={`rounded-xl border px-4 py-3 text-left hover:border-accent hover:bg-accent-soft ${answers[step] === o.score ? "border-accent bg-accent-soft" : "border-line"}`}
            >
              {o.label}
            </button>
          ))}
        </div>
        {step > 0 && (
          <Button variant="ghost" className="mt-3" onClick={() => setStep(step - 1)}>
            ← 上一題
          </Button>
        )}
      </Card>
    </div>
  );
}
