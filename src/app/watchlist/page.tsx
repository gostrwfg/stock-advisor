"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { StockSearch } from "@/components/StockSearch";
import { Badge, Button, Card, Disclaimer, Empty, Modal, Spinner } from "@/components/ui";
import { changeClass, fmtNum, fmtPct } from "@/lib/format";
import { useHydrated, useStore } from "@/lib/store";
import type { StockData, WatchItem } from "@/lib/types";

type Snap = Pick<StockData["quote"], "price" | "change" | "changePercent" | "currency"> & { isDemo: boolean };

export default function WatchlistPage() {
  const hydrated = useHydrated();
  const [list, setList] = useStore("watchlist");
  const [quotes, setQuotes] = useState<Record<string, Snap | "error">>({});
  const [editing, setEditing] = useState<WatchItem | null>(null);
  const notified = useRef(new Set<string>());

  const symbols = list.map((w) => w.symbol).join(",");

  useEffect(() => {
    if (!symbols) return;
    let alive = true;
    const load = () =>
      symbols.split(",").forEach((s) =>
        fetch(`/api/stock/${encodeURIComponent(s)}`)
          .then((r) => (r.ok ? r.json() : Promise.reject()))
          .then((d: StockData) => alive && setQuotes((q) => ({ ...q, [s]: { ...d.quote, isDemo: d.isDemo } })))
          .catch(() => alive && setQuotes((q) => ({ ...q, [s]: "error" }))),
      );
    load();
    const t = window.setInterval(load, 5 * 60 * 1000); // 開著頁面時每 5 分鐘更新
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [symbols]);

  // 價格提醒
  const triggered = list.filter((w) => {
    const q = quotes[w.symbol];
    if (!q || q === "error") return false;
    return (w.alertAbove != null && q.price >= w.alertAbove) || (w.alertBelow != null && q.price <= w.alertBelow);
  });

  useEffect(() => {
    for (const w of triggered) {
      if (notified.current.has(w.symbol)) continue;
      notified.current.add(w.symbol);
      try {
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          new Notification(`價格提醒：${w.name}`, { body: "已達到你設定的提醒價格" });
        }
      } catch {
        /* 不支援通知 */
      }
    }
  }, [triggered]);

  if (!hydrated) return <Spinner label="載入中…" />;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">自選股</h1>
        <p className="mt-1 text-sm text-muted">把關注的股票加進來，設定價格提醒，並追蹤 AI 評分的變化。</p>
      </div>
      <StockSearch placeholder="搜尋股票，進入個股頁後按「加入自選」" />

      {triggered.length > 0 && (
        <div className="rounded-xl border border-accent/40 bg-accent-soft p-3 text-sm">
          🔔 價格提醒：{triggered.map((w) => w.name).join("、")} 已達到你設定的價格。
        </div>
      )}

      {list.length === 0 ? (
        <Empty title="還沒有自選股">搜尋股票並在個股頁按「☆ 加入自選」，就會出現在這裡。</Empty>
      ) : (
        <Card>
          <ul className="divide-y divide-[var(--border)]">
            {list.map((w) => {
              const q = quotes[w.symbol];
              const scoreDiff = w.lastAiScore != null && w.prevAiScore != null ? w.lastAiScore - w.prevAiScore : null;
              return (
                <li key={w.symbol} className="flex flex-wrap items-center gap-3 py-3">
                  <Link href={`/stock/${w.symbol}`} className="min-w-0 flex-1">
                    <p className="font-medium">
                      {w.name} <span className="text-sm text-muted tabular">{w.symbol}</span>
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge>{w.market === "TW" ? "台股" : "美股"}</Badge>
                      {w.lastAiScore != null && (
                        <Badge tone="accent">
                          AI 評分 {w.lastAiScore}
                          {scoreDiff != null && scoreDiff !== 0 && ` (${scoreDiff > 0 ? "↑" : "↓"}${Math.abs(scoreDiff)})`}
                        </Badge>
                      )}
                      {w.alertAbove != null && <Badge>≥ {w.alertAbove} 提醒</Badge>}
                      {w.alertBelow != null && <Badge>≤ {w.alertBelow} 提醒</Badge>}
                    </div>
                  </Link>
                  <div className="text-right">
                    {q == null ? (
                      <Spinner />
                    ) : q === "error" ? (
                      <span className="text-sm text-muted">無法取得</span>
                    ) : (
                      <>
                        <p className={`font-semibold tabular ${changeClass(q.change)}`}>{fmtNum(q.price)}</p>
                        <p className={`text-xs tabular ${changeClass(q.change)}`}>{fmtPct(q.changePercent)}{q.isDemo && " · 示範"}</p>
                      </>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" onClick={() => setEditing(w)} aria-label={`設定 ${w.name} 提醒`}>🔔</Button>
                    <Button variant="ghost" onClick={() => setList(list.filter((x) => x.symbol !== w.symbol))} aria-label={`移除 ${w.name}`}>✕</Button>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-muted">
            AI 評分會在你每次於個股頁執行 AI 分析時更新，箭頭表示和上一次分析的差異。提醒只在這個頁面開著時檢查。
          </p>
        </Card>
      )}

      <AlertDialog
        item={editing}
        onClose={() => setEditing(null)}
        onSave={(w) => {
          setList(list.map((x) => (x.symbol === w.symbol ? w : x)));
          setEditing(null);
          try {
            if (typeof Notification !== "undefined" && Notification.permission === "default") Notification.requestPermission();
          } catch {
            /* 忽略 */
          }
        }}
      />
      <Disclaimer />
    </div>
  );
}

function AlertDialog({ item, onClose, onSave }: { item: WatchItem | null; onClose: () => void; onSave: (w: WatchItem) => void }) {
  const [above, setAbove] = useState("");
  const [below, setBelow] = useState("");
  useEffect(() => {
    setAbove(item?.alertAbove != null ? String(item.alertAbove) : "");
    setBelow(item?.alertBelow != null ? String(item.alertBelow) : "");
  }, [item]);
  if (!item) return null;
  const parse = (s: string) => (s.trim() && Number(s) > 0 ? Number(s) : null);
  return (
    <Modal open onClose={onClose} title={`價格提醒 · ${item.name}`}>
      <div className="space-y-3 text-sm">
        <label className="block">
          <span className="mb-1 block font-medium">漲到多少以上提醒我</span>
          <input inputMode="decimal" value={above} onChange={(e) => setAbove(e.target.value)} placeholder="不設定請留空" className="h-11 w-full rounded-xl border border-line bg-surface px-3 outline-none focus:border-accent" />
        </label>
        <label className="block">
          <span className="mb-1 block font-medium">跌到多少以下提醒我</span>
          <input inputMode="decimal" value={below} onChange={(e) => setBelow(e.target.value)} placeholder="不設定請留空" className="h-11 w-full rounded-xl border border-line bg-surface px-3 outline-none focus:border-accent" />
        </label>
        <p className="text-xs text-muted">💡 設定提醒價就像預先決定「停利點」和「停損點」，可以避免情緒化交易。</p>
        <Button className="w-full" onClick={() => onSave({ ...item, alertAbove: parse(above), alertBelow: parse(below) })}>儲存</Button>
      </div>
    </Modal>
  );
}
