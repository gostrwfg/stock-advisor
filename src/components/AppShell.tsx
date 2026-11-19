"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useHydrated, useStore } from "@/lib/store";
import { Button, Modal } from "./ui";

const NAV = [
  { href: "/", label: "首頁", icon: "⌂" },
  { href: "/watchlist", label: "自選股", icon: "☆" },
  { href: "/chat", label: "AI 助理", icon: "✦" },
  { href: "/portfolio", label: "模擬投資", icon: "◔" },
  { href: "/learn", label: "新手學堂", icon: "✎" },
];

function ThemeSync() {
  const [prefs] = useStore("prefs");
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const dark = prefs.theme === "dark" || (prefs.theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      root.dataset.theme = dark ? "dark" : "light";
    };
    apply();
    root.dataset.updown = prefs.colorConvention;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [prefs.theme, prefs.colorConvention]);
  return null;
}

function ConsentGate() {
  const hydrated = useHydrated();
  const [consent, setConsent] = useStore("consent");
  if (!hydrated || consent) return null;
  return (
    <Modal open title="使用前請先閱讀">
      <div className="space-y-3 text-sm leading-relaxed">
        <p>歡迎使用「新手投資小幫手」！開始之前，請了解以下事項：</p>
        <ul className="list-disc space-y-1.5 pl-5 text-muted">
          <li>本系統內容<strong className="text-ink">僅供教育與參考，不構成投資建議</strong>，也不是證券投資顧問服務。</li>
          <li>AI 分析可能出錯或過時，請一定要自己查證，並以官方公告為準。</li>
          <li>模擬投資使用的是虛擬資金，不會動用到你的真錢。</li>
          <li>你填入的 AI 金鑰與所有資料只存在你自己的瀏覽器，系統伺服器不會保存。</li>
          <li>投資一定有風險，過去的表現不代表未來，可能會虧損本金。</li>
        </ul>
        <Button className="w-full" onClick={() => setConsent(new Date().toISOString())}>
          我了解並同意，開始使用
        </Button>
      </div>
    </Modal>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  return (
    <>
      <ThemeSync />
      <ConsentGate />
      <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-sm text-white">投</span>
            <span>新手投資小幫手</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="主選單">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`rounded-lg px-3 py-1.5 text-sm ${isActive(n.href) ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-surface-2 hover:text-ink"}`}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <Link
            href="/settings"
            aria-label="設定"
            className={`rounded-lg px-3 py-1.5 text-sm ${isActive("/settings") ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-2"}`}
          >
            ⚙ <span className="hidden sm:inline">設定</span>
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 pt-4 pb-28 md:pb-12">{children}</main>
      <nav
        aria-label="主選單"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={`flex flex-col items-center gap-0.5 py-2 text-[11px] ${isActive(n.href) ? "text-accent" : "text-muted"}`}
          >
            <span className="text-lg leading-none" aria-hidden>
              {n.icon}
            </span>
            {n.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
