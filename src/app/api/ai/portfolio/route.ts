import { NextResponse } from "next/server";
import { callAI, extractJson, validateSettings } from "@/lib/ai";
import { checkRate, handleError, readJson } from "@/lib/http";
import { portfolioToText } from "@/lib/portfolioText";
import { buildPortfolioPrompt } from "@/lib/prompts";
import type { Holding, RiskLevel } from "@/lib/types";

export const maxDuration = 120;

export async function POST(req: Request) {
  const limited = checkRate(req, "ai");
  if (limited) return limited;
  try {
    const body = await readJson<{ settings: unknown; holdings: Holding[]; cash: number; riskLevel?: RiskLevel | null }>(req);
    const settings = validateSettings(body.settings);
    if (!Array.isArray(body.holdings) || !body.holdings.length) throw new Error("目前沒有持股可以檢視");
    const text = await portfolioToText(body.holdings, body.cash);
    const level = ["conservative", "balanced", "aggressive"].includes(body.riskLevel ?? "") ? body.riskLevel : null;
    const { system, user } = buildPortfolioPrompt(level, text);
    const raw = extractJson<Record<string, unknown>>(
      await callAI(settings, { system, messages: [{ role: "user", content: user }], maxTokens: 4000, json: true }),
    );
    const s = (v: unknown) => (typeof v === "string" ? v : "");
    return NextResponse.json({
      summary: s(raw.summary),
      score: Math.max(0, Math.min(100, Math.round(Number(raw.score) || 50))),
      concentration: s(raw.concentration),
      diversification: s(raw.diversification),
      fit: s(raw.fit),
      suggestions: Array.isArray(raw.suggestions) ? raw.suggestions.map(s).filter(Boolean).slice(0, 5) : [],
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    return handleError(e);
  }
}
