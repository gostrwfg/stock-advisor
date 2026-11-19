"use client";

import { CandlestickSeries, ColorType, createChart, HistogramSeries, LineSeries, type IChartApi, type UTCTimestamp } from "lightweight-charts";
import { useEffect, useMemo, useRef, useState } from "react";
import { sma } from "@/lib/indicators";
import type { Candle } from "@/lib/types";

const RANGES = [
  { id: "1M", label: "1月", days: 22 },
  { id: "3M", label: "3月", days: 66 },
  { id: "6M", label: "6月", days: 130 },
  { id: "1Y", label: "1年", days: 260 },
  { id: "2Y", label: "2年", days: 9999 },
] as const;

const INTERVALS = [
  { id: "D", label: "日K" },
  { id: "W", label: "週K" },
  { id: "M", label: "月K" },
] as const;

function aggregate(candles: Candle[], mode: "D" | "W" | "M"): Candle[] {
  if (mode === "D") return candles;
  const out: Candle[] = [];
  let key = "";
  for (const c of candles) {
    const d = new Date(c.time + "T00:00:00Z");
    let k: string;
    if (mode === "M") k = c.time.slice(0, 7);
    else {
      const monday = new Date(d);
      monday.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
      k = monday.toISOString().slice(0, 10);
    }
    if (k !== key) {
      out.push({ ...c });
      key = k;
    } else {
      const last = out[out.length - 1];
      last.high = Math.max(last.high, c.high);
      last.low = Math.min(last.low, c.low);
      last.close = c.close;
      last.volume += c.volume;
    }
  }
  return out;
}

const toTs = (t: string) => (Date.parse(t + "T00:00:00Z") / 1000) as UTCTimestamp;

function cssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function PriceChart({ candles }: { candles: Candle[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState<(typeof RANGES)[number]["id"]>("6M");
  const [interval, setIv] = useState<"D" | "W" | "M">("D");
  const [themeTick, setThemeTick] = useState(0);

  useEffect(() => {
    const obs = new MutationObserver(() => setThemeTick((t) => t + 1));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-updown"] });
    return () => obs.disconnect();
  }, []);

  const data = useMemo(() => {
    const days = RANGES.find((r) => r.id === range)!.days;
    // 多取 60 根讓均線在畫面起點就有值
    const sliced = candles.slice(-(days + 60));
    const agg = aggregate(sliced, interval);
    const closes = agg.map((c) => c.close);
    const visibleFrom = interval === "D" ? Math.max(0, agg.length - days) : 0;
    return { agg, ma5: sma(closes, 5), ma20: sma(closes, 20), ma60: sma(closes, 60), visibleFrom };
  }, [candles, range, interval]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const up = cssVar("--up");
    const down = cssVar("--down");
    const text = cssVar("--muted");
    const grid = cssVar("--border");
    const chart: IChartApi = createChart(el, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: text, fontFamily: "inherit", attributionLogo: false },
      grid: { vertLines: { color: grid }, horzLines: { color: grid } },
      rightPriceScale: { borderColor: grid },
      timeScale: { borderColor: grid },
      localization: { locale: "zh-TW" },
    });
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: up, downColor: down, borderUpColor: up, borderDownColor: down, wickUpColor: up, wickDownColor: down,
    });
    const visible = data.agg.slice(data.visibleFrom);
    candleSeries.setData(visible.map((c) => ({ time: toTs(c.time), open: c.open, high: c.high, low: c.low, close: c.close })));

    const lines: [string, (number | null)[], string][] = [
      ["MA5", data.ma5, "#e0a100"],
      ["MA20", data.ma20, "#2f6fed"],
      ["MA60", data.ma60, "#a35bd6"],
    ];
    for (const [title, vals, color] of lines) {
      const s = chart.addSeries(LineSeries, { color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, title });
      s.setData(
        data.agg
          .map((c, i) => ({ time: toTs(c.time), value: vals[i] }))
          .slice(data.visibleFrom)
          .filter((p): p is { time: UTCTimestamp; value: number } => p.value != null),
      );
    }

    const vol = chart.addSeries(HistogramSeries, { priceFormat: { type: "volume" }, priceScaleId: "vol", lastValueVisible: false, priceLineVisible: false });
    chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    vol.setData(visible.map((c) => ({ time: toTs(c.time), value: c.volume, color: (c.close >= c.open ? up : down) + "66" })));
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [data, themeTick]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1" role="group" aria-label="K 線週期">
          {INTERVALS.map((i) => (
            <button key={i.id} onClick={() => setIv(i.id)} className={`rounded-lg px-2.5 py-1 text-sm ${interval === i.id ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-surface-2"}`}>
              {i.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1" role="group" aria-label="時間範圍">
          {RANGES.map((r) => (
            <button key={r.id} onClick={() => setRange(r.id)} className={`rounded-lg px-2.5 py-1 text-sm ${range === r.id ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-surface-2"}`}>
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <div ref={ref} className="h-72 w-full sm:h-96" />
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
        <span><span className="mr-1 inline-block h-0.5 w-3 bg-[#e0a100] align-middle" />MA5 週線</span>
        <span><span className="mr-1 inline-block h-0.5 w-3 bg-[#2f6fed] align-middle" />MA20 月線</span>
        <span><span className="mr-1 inline-block h-0.5 w-3 bg-[#a35bd6] align-middle" />MA60 季線</span>
      </div>
    </div>
  );
}
