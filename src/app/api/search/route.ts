import { NextResponse } from "next/server";
import { searchStocks } from "@/lib/market";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.slice(0, 40) ?? "";
  return NextResponse.json({ results: await searchStocks(q) });
}
