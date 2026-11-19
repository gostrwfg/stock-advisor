"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Card, ErrorBox, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { resetAll, useHydrated, useStore, type Preferences } from "@/lib/store";
import type { AIProvider, AISettings } from "@/lib/types";

const PROVIDERS: { id: AIProvider; label: string; keyHint: string; modelHint: string; suggestions: string[]; docs: string }[] = [
  {
    id: "anthropic",
    label: "Anthropic Claude",
    keyHint: "sk-ant-...",
    modelHint: "例如 claude-sonnet-5-5",
    suggestions: ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"],
    docs: "到 console.anthropic.com 建立 API 金鑰",
  },
  {
    id: "openai",
    label: "OpenAI",
    keyHint: "sk-...",
    modelHint: "填入 OpenAI 的模型名稱",
    suggestions: [],
    docs: "到 platform.openai.com 建立 API 金鑰，模型名稱請參考其官方文件",
  },
  {
    id: "gemini",
    label: "Google Gemini",
    keyHint: "AIza...",
    modelHint: "填入 Gemini 的模型名稱",
    suggestions: [],
    docs: "到 Google AI Studio 建立 API 金鑰，模型名稱請參考其官方文件",
  },
  {
    id: "openai-compatible",
    label: "其他（OpenAI 相容格式）",
    keyHint: "依服務商而定，本機模型可留空",
    modelHint: "例如 llama3.1、deepseek-chat",
    suggestions: [],
    docs: "適用 Ollama、LM Studio、DeepSeek、Groq、OpenRouter 等，請填入服務的 Base URL（通常以 /v1 結尾）",
  },
];

export default function SettingsPage() {
  const hydrated = useHydrated();
  const [ai, setAi] = useStore("ai");
  const [prefs, setPrefs] = useStore("prefs");
  const [form, setForm] = useState<AISettings>({ provider: "anthropic", apiKey: "", model: "", baseUrl: "" });
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (ai) setForm({ ...ai, baseUrl: ai.baseUrl ?? "" });
  }, [ai]);

  const p = PROVIDERS.find((x) => x.id === form.provider)!;
  const update = (patch: Partial<AISettings>) => {
    setForm((f) => ({ ...f, ...patch }));
    setSaved(false);
    setTestMsg(null);
  };

  const valid =
    form.model.trim() &&
    (form.provider === "openai-compatible" ? form.baseUrl?.trim() : form.apiKey.trim());

  const save = () => {
    const clean: AISettings = {
      provider: form.provider,
      apiKey: form.apiKey.trim(),
      model: form.model.trim(),
      ...(form.provider === "openai-compatible" ? { baseUrl: form.baseUrl?.trim() } : {}),
    };
    setAi(clean);
    setSaved(true);
  };

  const test = async () => {
    setTesting(true);
    setTestMsg(null);
    try {
      const r = await api<{ reply: string }>("/api/ai/test", { settings: form });
      setTestMsg({ ok: true, text: `連線成功！AI 回覆：「${r.reply}」` });
    } catch (e) {
      setTestMsg({ ok: false, text: (e as Error).message });
    } finally {
      setTesting(false);
    }
  };

  const setPref = (patch: Partial<Preferences>) => setPrefs({ ...prefs, ...patch });

  if (!hydrated) return <Spinner label="載入中…" />;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">設定</h1>

      <Card title="AI 模型" action={ai ? <Badge tone="accent">已設定</Badge> : <Badge tone="warn">尚未設定</Badge>}>
        <p className="mb-4 text-sm leading-relaxed text-muted">
          AI 分析使用你自己的 AI 服務帳號。API 金鑰只會存在這台裝置的瀏覽器，每次分析時經由本系統伺服器轉送給 AI 服務，伺服器不會保存。
          使用 AI 服務可能會產生費用，請留意你的帳號用量。
        </p>

        <label className="mb-1 block text-sm font-medium">AI 服務商</label>
        <div className="mb-4 grid grid-cols-2 gap-2">
          {PROVIDERS.map((x) => (
            <button
              key={x.id}
              onClick={() => update({ provider: x.id, model: x.suggestions[0] ?? "" })}
              className={`rounded-xl border px-3 py-2.5 text-left text-sm ${form.provider === x.id ? "border-accent bg-accent-soft font-medium text-accent" : "border-line hover:bg-surface-2"}`}
            >
              {x.label}
            </button>
          ))}
        </div>
        <p className="-mt-2 mb-4 text-xs text-muted">{p.docs}</p>

        {form.provider === "openai-compatible" && (
          <div className="mb-4">
            <label htmlFor="baseUrl" className="mb-1 block text-sm font-medium">API 網址（Base URL）</label>
            <input
              id="baseUrl"
              value={form.baseUrl ?? ""}
              onChange={(e) => update({ baseUrl: e.target.value })}
              placeholder="例如 http://localhost:11434/v1"
              className="h-11 w-full rounded-xl border border-line bg-surface px-3 outline-none focus:border-accent"
            />
          </div>
        )}

        <div className="mb-4">
          <label htmlFor="apiKey" className="mb-1 block text-sm font-medium">API 金鑰</label>
          <div className="flex gap-2">
            <input
              id="apiKey"
              type={showKey ? "text" : "password"}
              value={form.apiKey}
              onChange={(e) => update({ apiKey: e.target.value })}
              placeholder={p.keyHint}
              autoComplete="off"
              className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 outline-none focus:border-accent"
            />
            <Button variant="secondary" onClick={() => setShowKey((v) => !v)}>{showKey ? "隱藏" : "顯示"}</Button>
          </div>
        </div>

        <div className="mb-4">
          <label htmlFor="model" className="mb-1 block text-sm font-medium">模型名稱</label>
          <input
            id="model"
            list="model-suggestions"
            value={form.model}
            onChange={(e) => update({ model: e.target.value })}
            placeholder={p.modelHint}
            className="h-11 w-full rounded-xl border border-line bg-surface px-3 outline-none focus:border-accent"
          />
          <datalist id="model-suggestions">
            {p.suggestions.map((m) => <option key={m} value={m} />)}
          </datalist>
          {p.suggestions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {p.suggestions.map((m) => (
                <button key={m} onClick={() => update({ model: m })} className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-muted hover:text-ink">
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={save} disabled={!valid}>儲存</Button>
          <Button variant="secondary" onClick={test} disabled={!valid || testing}>
            {testing ? <Spinner label="測試中…" /> : "測試連線"}
          </Button>
          {ai && (
            <Button variant="danger" onClick={() => { setAi(null); setForm({ provider: "anthropic", apiKey: "", model: "", baseUrl: "" }); }}>
              清除金鑰
            </Button>
          )}
        </div>
        {saved && <p className="mt-3 text-sm text-accent">✓ 已儲存</p>}
        {testMsg && (testMsg.ok ? <p className="mt-3 text-sm text-accent">{testMsg.text}</p> : <div className="mt-3"><ErrorBox message={testMsg.text} /></div>)}
      </Card>

      <Card title="顯示">
        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-sm font-medium">外觀</p>
            <div className="flex gap-2">
              {(["system", "light", "dark"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setPref({ theme: t })}
                  className={`rounded-xl border px-3 py-2 text-sm ${prefs.theme === t ? "border-accent bg-accent-soft text-accent" : "border-line"}`}
                >
                  {t === "system" ? "跟隨系統" : t === "light" ? "淺色" : "深色"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium">漲跌顏色</p>
            <div className="flex gap-2">
              <button
                onClick={() => setPref({ colorConvention: "tw" })}
                className={`rounded-xl border px-3 py-2 text-sm ${prefs.colorConvention === "tw" ? "border-accent bg-accent-soft" : "border-line"}`}
              >
                <span className="text-[var(--red)]">紅漲</span> <span className="text-[var(--green)]">綠跌</span>（台灣習慣）
              </button>
              <button
                onClick={() => setPref({ colorConvention: "us" })}
                className={`rounded-xl border px-3 py-2 text-sm ${prefs.colorConvention === "us" ? "border-accent bg-accent-soft" : "border-line"}`}
              >
                <span className="text-[var(--green)]">綠漲</span> <span className="text-[var(--red)]">紅跌</span>（歐美習慣）
              </button>
            </div>
          </div>
        </div>
      </Card>

      <Card title="資料管理">
        <p className="mb-3 text-sm text-muted">所有資料（模擬投資、自選股、問卷、AI 設定）都只存在這個瀏覽器。</p>
        <Button
          variant="danger"
          onClick={() => {
            if (confirm("確定要清除所有資料嗎？模擬投資紀錄、自選股與 AI 設定都會被刪除，無法復原。")) resetAll();
          }}
        >
          清除所有資料
        </Button>
      </Card>
    </div>
  );
}
