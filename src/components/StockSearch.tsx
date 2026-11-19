"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Badge } from "./ui";

interface Result {
  symbol: string;
  name: string;
  market: "TW" | "US";
  type: string;
}

export function StockSearch({ autoFocus = false, placeholder = "輸入代號或名稱，例如 2330、台積電、AAPL" }: { autoFocus?: boolean; placeholder?: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const query = q.trim();
    if (!query) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: ctrl.signal });
        const data = (await res.json()) as { results: Result[] };
        setResults(data.results);
        setActive(0);
      } catch {
        /* 取消或失敗 */
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const go = (symbol: string) => {
    setOpen(false);
    setQ("");
    router.push(`/stock/${encodeURIComponent(symbol)}`);
  };

  const submit = () => {
    if (results[active]) return go(results[active].symbol);
    const raw = q.trim().toUpperCase();
    if (/^[A-Z0-9.]{1,10}$/.test(raw)) go(raw);
  };

  return (
    <div ref={boxRef} className="relative">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        role="search"
      >
        <input
          value={q}
          autoFocus={autoFocus}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") setActive((a) => Math.min(a + 1, results.length - 1));
            if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, 0));
          }}
          placeholder={placeholder}
          aria-label="搜尋股票"
          className="h-12 w-full rounded-xl border border-line bg-surface px-4 text-base outline-none focus:border-accent"
        />
      </form>
      {open && results.length > 0 && (
        <ul className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
          {results.map((r, i) => (
            <li key={`${r.market}-${r.symbol}`}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => go(r.symbol)}
                className={`flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm ${i === active ? "bg-surface-2" : ""}`}
              >
                <span className="min-w-0 truncate">
                  <span className="font-semibold tabular">{r.symbol}</span>
                  <span className="ml-2 text-muted">{r.name}</span>
                </span>
                <span className="flex shrink-0 gap-1">
                  {r.type === "etf" && <Badge tone="accent">ETF</Badge>}
                  <Badge>{r.market === "TW" ? "台股" : "美股"}</Badge>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
