import { NextResponse } from "next/server";
import { getUsdTwd } from "@/lib/market";

export async function GET() {
  return NextResponse.json(await getUsdTwd());
}
