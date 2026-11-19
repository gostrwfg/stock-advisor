import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { getQuote } from "@/lib/market";

export async function GET(_req: Request, ctx: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await ctx.params;
  try {
    return NextResponse.json(await getQuote(decodeURIComponent(symbol)), { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "查詢失敗", 404);
  }
}
