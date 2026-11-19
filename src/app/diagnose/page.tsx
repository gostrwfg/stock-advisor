"use client";

import { useEffect, useState } from "react";
import { Button, Card, Spinner } from "@/components/ui";

interface Result {
  name: string;
  ok: boolean;
  ms: number;
  detail: string;
}

export default function DiagnosePage() {
  const [data, setData] = useState<{ checkedAt: string; region: string; forceDemo: boolean; results: Result[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const run = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/diagnose", { cache: "no-store" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      setData(j);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    run();
  }, []);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">資料來源檢查</h1>
        <p className="mt-1 text-sm text-muted">檢查網站主機能不能連到各個行情資料來源。全部失敗時，網站會改用示範資料。</p>
      </div>
      <Card
        action={<Button variant="secondary" onClick={run} disabled={loading}>重新檢查</Button>}
        title={data ? `主機區域：${data.region}` : "檢查中"}
      >
        {loading ? (
          <Spinner label="正在連線各個資料來源（約 10 秒）…" />
        ) : error ? (
          <p className="text-sm text-[var(--red)]">{error}</p>
        ) : data ? (
          <ul className="divide-y divide-[var(--border)] text-sm">
            {data.results.map((r) => (
              <li key={r.name} className="py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{r.ok ? "✅" : "❌"} {r.name}</span>
                  <span className="text-xs text-muted tabular">{r.ms} ms</span>
                </div>
                <p className="mt-0.5 break-all text-xs text-muted">{r.detail}</p>
              </li>
            ))}
          </ul>
        ) : null}
        {data?.forceDemo && <p className="mt-3 text-sm text-warn">目前設定了 FORCE_DEMO_DATA=1，網站一律顯示示範資料。</p>}
      </Card>
    </div>
  );
}
