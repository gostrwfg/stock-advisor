import "server-only";
import { NextResponse } from "next/server";
import { AIError } from "./ai";
import { rateLimit } from "./rateLimit";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function handleError(e: unknown) {
  if (e instanceof AIError) return jsonError(e.message, e.status);
  const msg = e instanceof Error ? e.message : "發生未知錯誤";
  return jsonError(msg, 500);
}

export function checkRate(req: Request, bucket: string) {
  const r = rateLimit(req, bucket);
  if (!r.ok) {
    return NextResponse.json(
      { error: `使用太頻繁了，請 ${r.retryAfter} 秒後再試` },
      { status: 429, headers: { "retry-after": String(r.retryAfter) } },
    );
  }
  return null;
}

export async function readJson<T>(req: Request): Promise<T> {
  const text = await req.text();
  if (text.length > 200_000) throw new Error("請求內容過大");
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("請求格式錯誤");
  }
}
