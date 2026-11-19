"use client";

import Link from "next/link";
import { Badge, Card } from "@/components/ui";
import { LESSONS } from "@/lib/lessons";
import { useHydrated, useStore } from "@/lib/store";

export default function LearnPage() {
  const hydrated = useHydrated();
  const [progress] = useStore("learn");
  const done = hydrated ? LESSONS.filter((l) => progress[l.id]).length : 0;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">新手學堂</h1>
        <p className="mt-1 text-sm text-muted">每堂 3–4 分鐘，讀完做 3 題小測驗。已完成 {done} / {LESSONS.length} 堂。</p>
        <div className="mt-3 h-2 rounded-full bg-surface-2">
          <div className="h-2 rounded-full bg-accent transition-all" style={{ width: `${(done / LESSONS.length) * 100}%` }} />
        </div>
      </div>
      <ol className="grid gap-3 sm:grid-cols-2">
        {LESSONS.map((l, i) => {
          const p = hydrated ? progress[l.id] : undefined;
          return (
            <li key={l.id}>
              <Link href={`/learn/${l.id}`} className="block h-full">
                <Card className="h-full hover:border-accent">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-muted">第 {i + 1} 課 · {l.minutes} 分鐘</p>
                    {p && <Badge tone="accent">✓ {p.score}/3</Badge>}
                  </div>
                  <p className="mt-1 font-semibold">{l.title}</p>
                  <p className="mt-1 text-sm text-muted">{l.intro}</p>
                </Card>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
