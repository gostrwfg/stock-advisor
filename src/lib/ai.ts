import "server-only";
import type { AISettings } from "./types";

export class AIError extends Error {
  constructor(message: string, public status = 502) {
    super(message);
  }
}

export interface AIMessage {
  role: "user" | "assistant";
  content: string;
}

interface CallOptions {
  system: string;
  messages: AIMessage[];
  maxTokens?: number;
  json?: boolean;
}

const DEFAULT_BASE: Record<string, string> = {
  anthropic: "https://api.anthropic.com",
  openai: "https://api.openai.com/v1",
  gemini: "https://generativelanguage.googleapis.com/v1beta",
};

export function validateSettings(s: unknown): AISettings {
  const v = s as Partial<AISettings> | undefined;
  if (!v || typeof v !== "object") throw new AIError("尚未設定 AI 模型，請到「設定」頁面填入", 400);
  if (!v.provider || !["anthropic", "openai", "gemini", "openai-compatible"].includes(v.provider)) {
    throw new AIError("AI 服務商設定不正確", 400);
  }
  if (!v.model?.trim()) throw new AIError("請在「設定」頁面填入模型名稱", 400);
  if (v.provider !== "openai-compatible" && !v.apiKey?.trim()) throw new AIError("請在「設定」頁面填入 API 金鑰", 400);
  if (v.provider === "openai-compatible") {
    if (!v.baseUrl?.trim()) throw new AIError("請填入 API 網址（Base URL）", 400);
    try {
      const u = new URL(v.baseUrl);
      if (!/^https?:$/.test(u.protocol)) throw new Error();
    } catch {
      throw new AIError("API 網址格式不正確", 400);
    }
  }
  return {
    provider: v.provider,
    apiKey: (v.apiKey ?? "").trim(),
    model: v.model.trim(),
    baseUrl: v.baseUrl?.trim().replace(/\/+$/, ""),
  };
}

async function post(url: string, headers: Record<string, string>, body: unknown, timeoutMs = 120_000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: ctrl.signal,
      cache: "no-store",
    });
  } catch (e) {
    throw new AIError(
      (e as Error).name === "AbortError" ? "AI 回應逾時，請稍後再試" : "無法連線到 AI 服務，請檢查網路或 API 網址",
      504,
    );
  } finally {
    clearTimeout(t);
  }
  const text = await res.text();
  let data: unknown = null;
  try {
    data = JSON.parse(text);
  } catch {
    /* 非 JSON */
  }
  if (!res.ok) throw new AIError(friendlyError(res.status, data, text), res.status === 401 || res.status === 403 ? 401 : 502);
  return data as Record<string, unknown>;
}

function friendlyError(status: number, data: unknown, text: string): string {
  const d = data as { error?: { message?: string } | string; message?: string } | null;
  const raw =
    (typeof d?.error === "object" ? d?.error?.message : typeof d?.error === "string" ? d.error : undefined) ??
    d?.message ??
    text.slice(0, 200);
  const hint =
    status === 401 || status === 403
      ? "API 金鑰無效或沒有權限"
      : status === 404
        ? "找不到這個模型，請確認模型名稱"
        : status === 429
          ? "呼叫太頻繁或額度不足，請稍後再試"
          : status >= 500
            ? "AI 服務暫時無法使用"
            : "AI 服務回傳錯誤";
  return `${hint}（${status}）：${raw}`;
}

/** 呼叫使用者自行設定的 AI 模型，回傳純文字 */
export async function callAI(settings: AISettings, opts: CallOptions): Promise<string> {
  const maxTokens = opts.maxTokens ?? 8000;
  const jsonHint = opts.json ? "\n\n只輸出一個 JSON 物件，不要加任何說明文字或 Markdown 程式碼框。" : "";
  const system = opts.system + jsonHint;

  switch (settings.provider) {
    case "anthropic": {
      const data = await post(
        `${DEFAULT_BASE.anthropic}/v1/messages`,
        { "x-api-key": settings.apiKey, "anthropic-version": "2023-06-01" },
        { model: settings.model, max_tokens: maxTokens, system, messages: opts.messages },
      );
      if (data.stop_reason === "refusal") throw new AIError("AI 拒絕回答這個問題，請換個方式提問", 422);
      const blocks = (data.content as { type: string; text?: string }[]) ?? [];
      const text = blocks.filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
      if (!text) throw new AIError("AI 沒有回傳內容");
      return text;
    }
    case "openai":
    case "openai-compatible": {
      const base = settings.provider === "openai" ? DEFAULT_BASE.openai : settings.baseUrl!;
      const headers: Record<string, string> = {};
      if (settings.apiKey) headers.authorization = `Bearer ${settings.apiKey}`;
      const body: Record<string, unknown> = {
        model: settings.model,
        messages: [{ role: "system", content: system }, ...opts.messages],
      };
      // OpenAI 新模型使用 max_completion_tokens；相容服務多半仍用 max_tokens
      if (settings.provider === "openai") body.max_completion_tokens = maxTokens;
      else body.max_tokens = maxTokens;
      if (opts.json && settings.provider === "openai") body.response_format = { type: "json_object" };
      const data = await post(`${base}/chat/completions`, headers, body);
      const choice = (data.choices as { message?: { content?: string; refusal?: string } }[] | undefined)?.[0];
      if (choice?.message?.refusal) throw new AIError("AI 拒絕回答這個問題，請換個方式提問", 422);
      const text = choice?.message?.content;
      if (!text) throw new AIError("AI 沒有回傳內容");
      return text;
    }
    case "gemini": {
      const url = `${DEFAULT_BASE.gemini}/models/${encodeURIComponent(settings.model)}:generateContent`;
      const data = await post(
        url,
        { "x-goog-api-key": settings.apiKey },
        {
          systemInstruction: { parts: [{ text: system }] },
          contents: opts.messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
          generationConfig: { maxOutputTokens: maxTokens, ...(opts.json ? { responseMimeType: "application/json" } : {}) },
        },
      );
      const cand = (data.candidates as { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[] | undefined)?.[0];
      if (cand?.finishReason === "SAFETY") throw new AIError("AI 拒絕回答這個問題，請換個方式提問", 422);
      const text = cand?.content?.parts?.filter((p) => !p.thought).map((p) => p.text ?? "").join("");
      if (!text) throw new AIError("AI 沒有回傳內容");
      return text;
    }
  }
}

/** 從 AI 回應中取出 JSON（容忍 ```json 框與前後文字） */
export function extractJson<T = unknown>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) throw new AIError("AI 回傳格式不正確，請再試一次");
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as T;
  } catch {
    throw new AIError("AI 回傳的 JSON 無法解析，請再試一次");
  }
}
