import { NextResponse } from "next/server";
import { callAI, validateSettings } from "@/lib/ai";
import { checkRate, handleError, readJson } from "@/lib/http";
import { getStockData } from "@/lib/market";
import { portfolioToText } from "@/lib/portfolioText";
import { buildChatSystem, buildDataBlock } from "@/lib/prompts";
import { extractMentionedSymbols } from "@/lib/stockList";
import type { ChatMessage, Holding, RiskLevel } from "@/lib/types";

export const maxDuration = 120;

export async function POST(req: Request) {
  const limited = checkRate(req, "ai");
  if (limited) return limited;
  try {
    const body = await readJson<{
      settings: unknown;
      messages: ChatMessage[];
      riskLevel?: RiskLevel | null;
      holdings?: Holding[];
      cash?: number;
    }>(req);
    const settings = validateSettings(body.settings);
    const messages = (Array.isArray(body.messages) ? body.messages : [])
      .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-20)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
    if (!messages.length || messages[messages.length - 1].role !== "user") throw new Error("請輸入問題");
    while (messages[0]?.role === "assistant") messages.shift();

    // 從最近幾則使用者訊息找出提到的股票，抓取真實數據給 AI 參考
    const recentUserText = messages.filter((m) => m.role === "user").slice(-3).map((m) => m.content).join("\n");
    const symbols = extractMentionedSymbols(recentUserText);
    const stocks = (await Promise.all(symbols.map((s) => getStockData(s).catch(() => null)))).filter(
      (d): d is NonNullable<typeof d> => d != null,
    );
    const portfolioText = await portfolioToText(body.holdings ?? [], body.cash ?? 0);
    const level = ["conservative", "balanced", "aggressive"].includes(body.riskLevel ?? "") ? body.riskLevel : null;
    const system = buildChatSystem({
      level,
      portfolioText,
      stockBlocks: stocks.map((d) => buildDataBlock(d, [])),
    });
    const reply = await callAI(settings, { system, messages, maxTokens: 4000 });
    return NextResponse.json({
      reply,
      cards: stocks.map((d) => ({
        symbol: d.quote.symbol,
        name: d.quote.name,
        price: d.quote.price,
        change: d.quote.change,
        changePercent: d.quote.changePercent,
        currency: d.quote.currency,
        isDemo: d.isDemo,
      })),
    });
  } catch (e) {
    return handleError(e);
  }
}
