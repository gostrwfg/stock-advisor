"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { use, useState } from "react";
import { Button, Card, LinkButton } from "@/components/ui";
import { LESSONS } from "@/lib/lessons";
import { useStore } from "@/lib/store";

export default function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const idx = LESSONS.findIndex((l) => l.id === id);
  const lesson = LESSONS[Math.max(idx, 0)];
  const next = LESSONS[idx + 1];
  const [, setProgress] = useStore("learn");
  const [answers, setAnswers] = useState<(number | null)[]>(lesson.quiz.map(() => null));
  const [submitted, setSubmitted] = useState(false);
  if (idx < 0) notFound();
  const score = answers.filter((a, i) => a === lesson.quiz[i].answer).length;

  const submit = () => {
    setSubmitted(true);
    setProgress((p) => ({ ...p, [lesson.id]: { score, completedAt: new Date().toISOString() } }));
  };

  return (
    <article className="mx-auto max-w-2xl space-y-4">
      <Link href="/learn" className="text-sm text-accent">← 新手學堂</Link>
      <header>
        <p className="text-sm text-muted">第 {idx + 1} 課 · 約 {lesson.minutes} 分鐘</p>
        <h1 className="mt-1 text-2xl font-bold">{lesson.title}</h1>
        <p className="mt-1 text-muted">{lesson.intro}</p>
      </header>

      {lesson.sections.map((s) => (
        <section key={s.heading}>
          <h2 className="mb-1.5 text-lg font-semibold">{s.heading}</h2>
          {s.body.map((p, i) => <p key={i} className="mb-2 leading-relaxed">{p}</p>)}
        </section>
      ))}

      <Card title="重點整理">
        <ul className="list-disc space-y-1 pl-5">{lesson.takeaways.map((t) => <li key={t}>{t}</li>)}</ul>
        {lesson.tryIt && <LinkButton href={lesson.tryIt.href} variant="secondary" className="mt-3">{lesson.tryIt.label} →</LinkButton>}
      </Card>

      <Card title="小測驗">
        <div className="space-y-5">
          {lesson.quiz.map((q, qi) => (
            <fieldset key={qi}>
              <legend className="mb-2 font-medium">{qi + 1}. {q.q}</legend>
              <div className="grid gap-1.5">
                {q.options.map((o, oi) => {
                  const chosen = answers[qi] === oi;
                  const correct = submitted && oi === q.answer;
                  const wrong = submitted && chosen && oi !== q.answer;
                  return (
                    <label
                      key={oi}
                      className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm ${correct ? "border-accent bg-accent-soft" : wrong ? "border-[var(--red)]" : chosen ? "border-accent" : "border-line"}`}
                    >
                      <input
                        type="radio"
                        name={`q${qi}`}
                        checked={chosen}
                        disabled={submitted}
                        onChange={() => setAnswers((a) => a.map((v, i) => (i === qi ? oi : v)))}
                      />
                      {o}
                      {correct && <span className="ml-auto text-accent">✓</span>}
                    </label>
                  );
                })}
              </div>
              {submitted && <p className="mt-1.5 text-sm text-muted">💡 {q.explain}</p>}
            </fieldset>
          ))}
        </div>
        {!submitted ? (
          <Button className="mt-4" disabled={answers.some((a) => a == null)} onClick={submit}>送出答案</Button>
        ) : (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <p className="font-semibold">答對 {score} / {lesson.quiz.length} 題{score === lesson.quiz.length ? " 🎉" : ""}</p>
            <Button variant="secondary" onClick={() => { setSubmitted(false); setAnswers(lesson.quiz.map(() => null)); }}>重新作答</Button>
            {next ? <LinkButton href={`/learn/${next.id}`}>下一課：{next.title}</LinkButton> : <LinkButton href="/">回首頁</LinkButton>}
          </div>
        )}
      </Card>
    </article>
  );
}
