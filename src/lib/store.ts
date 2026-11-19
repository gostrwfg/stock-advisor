"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { AIAnalysisResult, AISettings, ChatMessage, Portfolio, RiskProfile, WatchItem } from "./types";

export const INITIAL_CASH = 1_000_000;

export interface Preferences {
  theme: "system" | "light" | "dark";
  /** tw = 紅漲綠跌（台灣習慣），us = 綠漲紅跌 */
  colorConvention: "tw" | "us";
}

export const KEYS = {
  ai: "sa.ai",
  prefs: "sa.prefs",
  risk: "sa.risk",
  consent: "sa.consent",
  portfolio: "sa.portfolio",
  watchlist: "sa.watchlist",
  analyses: "sa.analyses",
  chat: "sa.chat",
  learn: "sa.learn",
} as const;

export const DEFAULTS = {
  ai: null as AISettings | null,
  prefs: { theme: "system", colorConvention: "tw" } as Preferences,
  risk: null as RiskProfile | null,
  consent: null as string | null,
  portfolio: { cash: INITIAL_CASH, initialCash: INITIAL_CASH, holdings: [], trades: [] } as Portfolio,
  watchlist: [] as WatchItem[],
  analyses: {} as Record<string, AIAnalysisResult>,
  chat: [] as ChatMessage[],
  learn: {} as Record<string, { score: number; completedAt: string }>,
};

const listeners = new Set<() => void>();
const memo = new Map<string, { raw: string | null; value: unknown }>();

function read<T>(key: string, fallback: T): T {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    /* 無痕模式等情況 */
  }
  const m = memo.get(key);
  if (m && m.raw === raw) return m.value as T;
  let value: T = fallback;
  if (raw != null) {
    try {
      value = JSON.parse(raw) as T;
    } catch {
      value = fallback;
    }
  }
  memo.set(key, { raw, value });
  return value;
}

export function writeStore<T>(key: string, value: T) {
  try {
    if (value === null || value === undefined) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 忽略 */
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = () => cb();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

/** 讀寫 localStorage 的 hook，所有元件之間會同步 */
export function useStore<K extends keyof typeof KEYS>(name: K) {
  const key = KEYS[name];
  const fallback = DEFAULTS[name] as (typeof DEFAULTS)[K];
  const value = useSyncExternalStore(
    subscribe,
    () => read(key, fallback),
    () => fallback,
  );
  const set = useCallback(
    (next: (typeof DEFAULTS)[K] | ((prev: (typeof DEFAULTS)[K]) => (typeof DEFAULTS)[K])) => {
      const prev = read(key, fallback);
      const v = typeof next === "function" ? (next as (p: typeof prev) => typeof prev)(prev) : next;
      writeStore(key, v);
    },
    [key, fallback],
  );
  return [value, set] as const;
}

/** 是否已經在瀏覽器端載入（避免 SSR 與 localStorage 內容不一致） */
export function useHydrated() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function resetAll() {
  Object.values(KEYS).forEach((k) => {
    try {
      window.localStorage.removeItem(k);
    } catch {
      /* 忽略 */
    }
  });
  listeners.forEach((l) => l());
}
