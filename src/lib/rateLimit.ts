import "server-only";

const hits = new Map<string, number[]>();

/** 簡單的記憶體速率限制：每個 IP 每分鐘最多 N 次 */
export function rateLimit(req: Request, bucket: string): { ok: boolean; retryAfter: number } {
  const limit = Number(process.env.AI_RATE_LIMIT_PER_MIN ?? 20) || 20;
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
  if (arr.length >= limit) {
    hits.set(key, arr);
    return { ok: false, retryAfter: Math.ceil((60_000 - (now - arr[0])) / 1000) };
  }
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 5000) hits.delete(hits.keys().next().value as string);
  return { ok: true, retryAfter: 0 };
}
