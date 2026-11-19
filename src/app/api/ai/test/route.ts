import { NextResponse } from "next/server";
import { callAI, validateSettings } from "@/lib/ai";
import { checkRate, handleError, readJson } from "@/lib/http";

export async function POST(req: Request) {
  const limited = checkRate(req, "ai");
  if (limited) return limited;
  try {
    const body = await readJson<{ settings: unknown }>(req);
    const settings = validateSettings(body.settings);
    const reply = await callAI(settings, {
      system: "你是連線測試助理。",
      messages: [{ role: "user", content: "請只回覆「連線成功」四個字。" }],
      maxTokens: 1000,
    });
    return NextResponse.json({ ok: true, reply: reply.slice(0, 100) });
  } catch (e) {
    return handleError(e);
  }
}
