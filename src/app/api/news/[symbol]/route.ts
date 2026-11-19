import { NextResponse } from "next/server";
import { getNews } from "@/lib/market";

export async function GET(req: Request, ctx: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await ctx.params;
  const name = new URL(req.url).searchParams.get("name")?.slice(0, 60) ?? undefined;
  return NextResponse.json(await getNews(decodeURIComponent(symbol), name));
}
