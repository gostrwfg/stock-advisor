"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";

export function Card({ children, className = "", title, action }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode }) {
  return (
    <section className={`rounded-2xl border border-line bg-surface p-4 sm:p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className="text-base font-semibold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

type Variant = "primary" | "secondary" | "ghost" | "danger";

export function Button({ variant = "primary", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const styles: Record<Variant, string> = {
    primary: "bg-accent text-white hover:opacity-90",
    secondary: "border border-line bg-surface hover:bg-surface-2",
    ghost: "hover:bg-surface-2",
    danger: "border border-line text-[var(--red)] hover:bg-surface-2",
  };
  return (
    <button
      {...props}
      className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
    />
  );
}

export function LinkButton({ href, children, variant = "primary", className = "" }: { href: string; children: ReactNode; variant?: Variant; className?: string }) {
  const styles: Record<Variant, string> = {
    primary: "bg-accent text-white hover:opacity-90",
    secondary: "border border-line bg-surface hover:bg-surface-2",
    ghost: "hover:bg-surface-2",
    danger: "border border-line text-[var(--red)]",
  };
  return (
    <Link href={href} className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-medium transition ${styles[variant]} ${className}`}>
      {children}
    </Link>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "accent" | "warn" | "up" | "down" }) {
  const tones = {
    neutral: "bg-surface-2 text-muted",
    accent: "bg-accent-soft text-accent",
    warn: "bg-warn-soft text-warn",
    up: "bg-surface-2 text-up",
    down: "bg-surface-2 text-down",
  };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

/** 名詞旁邊的「?」小說明，點一下展開 */
export function InfoTip({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  return (
    <span ref={ref} className="relative inline-flex align-middle">
      <button
        type="button"
        aria-label={`${title} 是什麼？`}
        onClick={() => setOpen((v) => !v)}
        className="ml-1 inline-flex h-4.5 w-4.5 items-center justify-center rounded-full border border-line text-[10px] leading-none text-muted hover:border-accent hover:text-accent"
      >
        ?
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute top-6 left-1/2 z-30 w-64 max-w-[80vw] -translate-x-1/2 rounded-xl border border-line bg-surface p-3 text-left text-xs font-normal leading-relaxed text-ink shadow-lg"
        >
          <span className="mb-1 block font-semibold">{title}</span>
          {children}
        </span>
      )}
    </span>
  );
}

export function Disclaimer({ className = "" }: { className?: string }) {
  return (
    <p className={`rounded-xl bg-surface-2 p-3 text-xs leading-relaxed text-muted ${className}`}>
      ⚠️ 本系統內容僅供教育與參考，不構成投資建議，投資有風險，請自行審慎評估。AI 可能出錯，請以官方公告與實際交易資訊為準。
    </p>
  );
}

export function DemoBanner() {
  return (
    <div className="rounded-xl border border-[var(--warn)]/40 bg-warn-soft p-3 text-sm text-warn">
      目前無法連線到行情資料來源，畫面顯示的是<strong>示範資料</strong>（隨機產生，不是真實股價），只能用來熟悉操作。
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-muted">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-accent" />
      {label}
    </span>
  );
}

export function ErrorBox({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--red)]/30 bg-surface p-3 text-sm text-[var(--red)]">
      {message}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ScoreRing({ score, size = 96, label }: { score: number; size?: number; label?: string }) {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const color = score >= 65 ? "var(--accent)" : score >= 45 ? "var(--warn)" : "var(--muted)";
  return (
    <div className="relative inline-flex flex-col items-center" style={{ width: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label ?? "分數"} ${score} 分`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={8} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={`${(score / 100) * c} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center" style={{ height: size }}>
        <span className="text-2xl font-bold tabular">{score}</span>
        {label && <span className="text-[11px] text-muted">{label}</span>}
      </span>
    </div>
  );
}

export function ScoreBar({ label, score, note }: { label: string; score: number; note?: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="tabular font-semibold">
          {score}
          {note && <span className="ml-1 font-normal text-muted">· {note}</span>}
        </span>
      </div>
      <div className="h-2 rounded-full bg-surface-2">
        <div className="h-2 rounded-full bg-accent" style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line p-8 text-center">
      <p className="font-medium">{title}</p>
      {children && <div className="mt-2 text-sm text-muted">{children}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose?: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open || !onClose) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl border border-line bg-surface p-5 sm:max-w-lg sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          {onClose && (
            <button onClick={onClose} aria-label="關閉" className="rounded-lg px-2 text-xl text-muted hover:bg-surface-2">
              ×
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
