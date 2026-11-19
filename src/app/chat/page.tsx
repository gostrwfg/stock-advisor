"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button, Disclaimer, ErrorBox, LinkButton, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { changeClass, fmtNum, fmtPct } from "@/lib/format";
import { useHydrated, useStore } from "@/lib/store";
import type { ChatMessage } from "@/lib/types";

interface StockCard {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  currency: string;
  isDemo: boolean;
}

type Msg = ChatMessage & { cards?: StockCard[] };

const SUGGESTIONS = ["什麼是 ETF？跟買股票有什麼不同？", "台積電現在適合買嗎？", "定期定額要怎麼開始？", "幫我看看我的模擬投資組合", "本益比怎麼看？"];

/** 很簡單的 Markdown 顯示：粗體、條列、段落 */
function RichText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part));
  return (
    <div className="space-y-2">
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        if (lines.every((l) => /^\s*([-*•]|\d+\.)\s+/.test(l))) {
          const ordered = /^\s*\d+\./.test(lines[0]);
          const items = lines.map((l) => l.replace(/^\s*([-*•]|\d+\.)\s+/, ""));
          return ordered ? (
            <ol key={i} className="list-decimal space-y-1 pl-5">{items.map((it, j) => <li key={j}>{inline(it)}</li>)}</ol>
          ) : (
            <ul key={i} className="list-disc space-y-1 pl-5">{items.map((it, j) => <li key={j}>{inline(it)}</li>)}</ul>
          );
        }
        return (
          <p key={i}>
            {lines.map((l, j) => (
              <span key={j}>
                {inline(l.replace(/^#{1,4}\s+/, ""))}
                {j < lines.length - 1 && <br />}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

export default function ChatPage() {
  const hydrated = useHydrated();
  const [ai] = useStore("ai");
  const [risk] = useStore("risk");
  const [portfolio] = useStore("portfolio");
  const [history, setHistory] = useStore("chat");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (hydrated) setMessages(history);
    // 只在載入時讀取一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || !ai || loading) return;
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setError("");
    setLoading(true);
    try {
      const r = await api<{ reply: string; cards: StockCard[] }>("/api/ai/chat", {
        settings: ai,
        messages: next.map(({ role, content }) => ({ role, content })),
        riskLevel: risk?.level ?? null,
        holdings: portfolio.holdings,
        cash: portfolio.cash,
      });
      const done: Msg[] = [...next, { role: "assistant", content: r.reply, cards: r.cards }];
      setMessages(done);
      setHistory(done.slice(-40).map(({ role, content }) => ({ role, content })));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (!hydrated) return <Spinner label="載入中…" />;

  if (!ai) {
    return (
      <div className="mx-auto max-w-xl py-10 text-center">
        <h1 className="text-2xl font-bold">AI 投資小幫手</h1>
        <p className="mt-2 text-muted">請先設定你的 AI 模型與 API 金鑰，就可以開始提問。</p>
        <LinkButton href="/settings" className="mt-4">前往設定</LinkButton>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">AI 投資小幫手</h1>
          <p className="text-xs text-muted">使用 {ai.model}{risk ? "" : " · 尚未做風險評估"}</p>
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" onClick={() => { setMessages([]); setHistory([]); }}>清除對話</Button>
        )}
      </div>

      <div className="space-y-4">
        {messages.length === 0 && (
          <div className="rounded-2xl border border-line bg-surface p-5">
            <p className="font-medium">嗨！我可以回答任何投資入門問題 👋</p>
            <p className="mt-1 text-sm text-muted">問題中提到股票名稱或代號時，我會自動抓最新數據來回答。</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} className="rounded-full border border-line px-3 py-1.5 text-sm hover:border-accent hover:text-accent">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${m.role === "user" ? "bg-accent text-white" : "border border-line bg-surface"}`}>
              {m.role === "assistant" && m.cards && m.cards.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {m.cards.map((c) => (
                    <Link key={c.symbol} href={`/stock/${c.symbol}`} className="rounded-xl bg-surface-2 px-3 py-2 hover:ring-1 hover:ring-accent">
                      <p className="text-xs text-muted">{c.name} {c.symbol}{c.isDemo && " · 示範資料"}</p>
                      <p className={`font-semibold tabular ${changeClass(c.change)}`}>
                        {fmtNum(c.price)} <span className="text-xs">{fmtPct(c.changePercent)}</span>
                      </p>
                    </Link>
                  ))}
                </div>
              )}
              {m.role === "assistant" ? <RichText text={m.content} /> : <p className="whitespace-pre-wrap">{m.content}</p>}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl border border-line bg-surface px-4 py-3"><Spinner label="思考中…" /></div>
          </div>
        )}
        {error && <ErrorBox message={error} />}
        <div ref={endRef} />
      </div>

      <form
        className="sticky bottom-20 mt-4 flex gap-2 rounded-2xl border border-line bg-surface p-2 md:bottom-4"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={1}
          placeholder="輸入你的問題…"
          aria-label="輸入問題"
          className="max-h-32 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-base outline-none"
        />
        <Button type="submit" disabled={!input.trim() || loading}>送出</Button>
      </form>
      <Disclaimer className="mt-3" />
    </div>
  );
}
