import { NextResponse } from "next/server";
import { getStockData } from "@/lib/market";
import { jsonError } from "@/lib/http";

export async function GET(_req: Request, ctx: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await ctx.params;
  try {
    return NextResponse.json(await getStockData(decodeURIComponent(symbol)));
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "查詢失敗", 404);
  }
}
