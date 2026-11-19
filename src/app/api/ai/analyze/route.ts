import { NextResponse } from "next/server";
import { callAI, extractJson, validateSettings } from "@/lib/ai";
import { checkRate, handleError, readJson } from "@/lib/http";
import { getNews, getStockData } from "@/lib/market";
import { buildAnalysisPrompt, normalizeAnalysis } from "@/lib/prompts";
import type { AIAnalysisResult, RiskLevel } from "@/lib/types";

export const maxDuration = 120;

export async function POST(req: Request) {
  const limited = checkRate(req, "ai");
  if (limited) return limited;
  try {
    const body = await readJson<{ settings: unknown; symbol: string; riskLevel?: RiskLevel | null }>(req);
    const settings = validateSettings(body.settings);
    if (typeof body.symbol !== "string") throw new Error("缺少股票代號");
    // 數據一律由伺服器抓取與計算，AI 只負責解讀
    const data = await getStockData(body.symbol);
    const news = await getNews(data.quote.symbol, data.quote.name).catch(() => ({ items: [], isDemo: true }));
    const level = ["conservative", "balanced", "aggressive"].includes(body.riskLevel ?? "") ? body.riskLevel : null;
    const { system, user } = buildAnalysisPrompt(data, news.items, level);
    const text = await callAI(settings, { system, messages: [{ role: "user", content: user }], maxTokens: 8000, json: true });
    const result: AIAnalysisResult = {
      analysis: normalizeAnalysis(extractJson(text)),
      symbol: data.quote.symbol,
      name: data.quote.name,
      generatedAt: new Date().toISOString(),
      model: settings.model,
      isDemoData: data.isDemo,
    };
    return NextResponse.json(result);
  } catch (e) {
    return handleError(e);
  }
}
