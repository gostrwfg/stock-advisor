import { NextResponse } from "next/server";
import { checkRate } from "@/lib/http";
import { diagnoseSources } from "@/lib/market";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const limited = checkRate(req, "diagnose");
  if (limited) return limited;
  const results = await diagnoseSources();
  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    region: process.env.VERCEL_REGION ?? "local",
    forceDemo: process.env.FORCE_DEMO_DATA === "1",
    results,
  });
}
