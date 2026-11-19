"use client";

import { useEffect, useState } from "react";
import { estimateFee, fmtInt, fmtNum } from "@/lib/format";
import { applyTrade } from "@/lib/portfolio";
import { findLocal } from "@/lib/stockList";
import { useStore } from "@/lib/store";
import type { Market } from "@/lib/types";
import { Button, ErrorBox, Modal } from "./ui";

export function TradeDialog({
  open,
  onClose,
  stock,
  defaultSide = "buy",
}: {
  open: boolean;
  onClose: () => void;
  stock: { symbol: string; name: string; market: Market; price: number; isDemo?: boolean };
  defaultSide?: "buy" | "sell";
}) {
  const [portfolio, setPortfolio] = useStore("portfolio");
  const [side, setSide] = useState<"buy" | "sell">(defaultSide);
  const [shares, setShares] = useState("");
  const [fx, setFx] = useState(1);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  useEffect(() => {
    if (!open) return;
    setSide(defaultSide);
    setShares("");
    setError("");
    setDone("");
    if (stock.market === "US") {
      fetch("/api/fx").then((r) => r.json()).then((d: { rate: number }) => setFx(d.rate)).catch(() => setFx(32));
    } else setFx(1);
  }, [open, defaultSide, stock.market]);

  const held = portfolio.holdings.find((h) => h.symbol === stock.symbol)?.shares ?? 0;
  const n = Number(shares);
  const isEtf = findLocal(stock.symbol)?.type === "etf";
  const amountTwd = n > 0 ? n * stock.price * fx : 0;
  const fee = n > 0 ? estimateFee(stock.market, side, amountTwd, isEtf) : 0;
  const maxBuy = Math.floor(portfolio.cash / (stock.price * fx * 1.002));

  const submit = () => {
    setError("");
    try {
      const next = applyTrade(portfolio, { symbol: stock.symbol, name: stock.name, market: stock.market, side, shares: n, price: stock.price, fxRate: fx, isEtf });
      setPortfolio(next);
      setDone(`已${side === "buy" ? "買進" : "賣出"} ${stock.name} ${fmtInt(n)} 股`);
      setShares("");
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const quick = stock.market === "TW" ? [1000, 100, 10] : [10, 5, 1];

  return (
    <Modal open={open} onClose={onClose} title={`模擬交易 · ${stock.name}`}>
      <div className="space-y-4 text-sm">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1">
          {(["buy", "sell"] as const).map((s) => (
            <button key={s} onClick={() => setSide(s)} className={`rounded-lg py-2 font-medium ${side === s ? "bg-surface shadow-sm" : "text-muted"}`}>
              {s === "buy" ? "買進" : "賣出"}
            </button>
          ))}
        </div>
        <dl className="grid grid-cols-2 gap-y-1.5 text-muted">
          <dt>成交價（以最新價格計算）</dt>
          <dd className="text-right tabular text-ink">{fmtNum(stock.price)} {stock.market === "US" ? "USD" : "TWD"}</dd>
          {stock.market === "US" && (<><dt>美元匯率</dt><dd className="text-right tabular text-ink">{fmtNum(fx, 3)}</dd></>)}
          <dt>可用現金</dt>
          <dd className="text-right tabular text-ink">{fmtInt(portfolio.cash)} 元</dd>
          <dt>目前持有</dt>
          <dd className="text-right tabular text-ink">{fmtInt(held)} 股</dd>
        </dl>
        <div>
          <label htmlFor="shares" className="mb-1 block font-medium">股數</label>
          <input
            id="shares"
            inputMode="numeric"
            value={shares}
            onChange={(e) => setShares(e.target.value.replace(/\D/g, ""))}
            placeholder={side === "buy" ? `最多約 ${fmtInt(Math.max(0, maxBuy))} 股` : `最多 ${fmtInt(held)} 股`}
            className="h-11 w-full rounded-xl border border-line bg-surface px-3 text-base outline-none focus:border-accent"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {quick.map((q) => (
              <button key={q} onClick={() => setShares(String((Number(shares) || 0) + q))} className="rounded-full bg-surface-2 px-2.5 py-1 text-xs">
                +{q} 股{stock.market === "TW" && q === 1000 ? "（1 張）" : ""}
              </button>
            ))}
          </div>
          {stock.market === "TW" && <p className="mt-2 text-xs text-muted">台股 1 張 = 1,000 股；少於 1,000 股稱為「零股」，新手可以先從零股開始。</p>}
        </div>
        {n > 0 && (
          <div className="rounded-xl bg-surface-2 p-3">
            <div className="flex justify-between"><span>成交金額</span><span className="tabular">{fmtInt(amountTwd)} 元</span></div>
            <div className="flex justify-between text-muted">
              <span>{stock.market === "TW" ? (side === "sell" ? "手續費＋證交稅（估）" : "手續費（估）") : "手續費（以 0 元估算）"}</span>
              <span className="tabular">{fmtInt(fee)} 元</span>
            </div>
            <div className="mt-1 flex justify-between font-semibold">
              <span>{side === "buy" ? "總共支出" : "實際入帳"}</span>
              <span className="tabular">{fmtInt(side === "buy" ? amountTwd + fee : amountTwd - fee)} 元</span>
            </div>
          </div>
        )}
        {stock.isDemo && <p className="text-xs text-warn">注意：目前是示範資料價格，非真實股價。</p>}
        {error && <ErrorBox message={error} />}
        {done && <p className="text-accent">✓ {done}</p>}
        <Button className="w-full" disabled={!(n > 0)} onClick={submit}>
          確認{side === "buy" ? "買進" : "賣出"}（虛擬資金）
        </Button>
      </div>
    </Modal>
  );
}
