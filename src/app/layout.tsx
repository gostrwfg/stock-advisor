import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "新手投資小幫手",
  description: "給投資新手的 AI 股票分析與模擬投資練習工具",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

// 在畫面繪製前先套用深色模式，避免閃爍
const themeScript = `(function(){try{var p=JSON.parse(localStorage.getItem('sa.prefs')||'{}');var t=p.theme||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';document.documentElement.dataset.updown=p.colorConvention||'tw';}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant-TW" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
