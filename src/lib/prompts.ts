import { describeIndicators } from "./indicators";
import { RISK_DESC, RISK_LABEL } from "./risk";
import type { AIAnalysis, NewsItem, RiskLevel, StockData } from "./types";

const BASE_RULES = `你是一位專為「投資新手」服務的股票分析助理，使用繁體中文（台灣用語）。

規則：
1. 用國中生也聽得懂的白話文，專有名詞第一次出現時要用括號加上簡短解釋。
2. 只能根據提供給你的數據做解讀，不可以自行編造任何數字、財報或新聞。資料缺漏時要明確說「資料不足」。
3. 絕對不可以使用「保證獲利」「一定會漲」「穩賺」「必漲」等字眼，也不可以鼓勵借錢或使用槓桿投資。
4. 你的內容僅供教育參考，不是投資建議；要提醒使用者自行判斷、分散風險。
5. 依使用者的風險屬性調整建議：保守型優先建議大盤或高股息 ETF、強調風險；積極型可以討論成長股，但仍要提醒分散。`;

function fmt(n: number | null | undefined, digits = 2, suffix = "") {
  return n == null || !Number.isFinite(n) ? "無資料" : `${Number(n.toFixed(digits))}${suffix}`;
}

export function buildDataBlock(data: StockData, news: NewsItem[]): string {
  const { quote: q, indicators: i, fundamentals: f } = data;
  const recent = data.history.slice(-10).map((c) => `${c.time} 收 ${c.close}`).join("、");
  const ruleNotes = describeIndicators(i, q.price).map((s) => `- ${s}`).join("\n");
  const newsText = news.length
    ? news.slice(0, 8).map((n) => `- [${n.publishedAt?.slice(0, 10) ?? "日期不明"}] ${n.title}（${n.publisher}）`).join("\n")
    : "（目前沒有取得新聞資料）";
  return `【股票】${q.name}（${q.symbol}，${q.market === "TW" ? "台股" : "美股"}，幣別 ${q.currency}）
【產業】${f.sector ?? "無資料"}
【資料是否為示範資料】${data.isDemo ? "是（隨機產生，非真實行情；請在分析中提醒使用者）" : "否"}
【資料來源】${f.source.join("、")}

【價格】
- 現價：${fmt(q.price)}；前收：${fmt(q.previousClose)}；漲跌：${fmt(q.change)}（${fmt(q.changePercent, 2, "%")}）
- 52 週高 / 低：${fmt(f.week52High)} / ${fmt(f.week52Low)}
- 近一個月報酬：${fmt(i.return1m, 2, "%")}；近三個月報酬：${fmt(i.return3m, 2, "%")}
- 20 日年化波動度：${fmt(i.volatility20, 2, "%")}
- 最近 10 個交易日收盤：${recent}

【技術指標（由程式計算）】
- MA5：${fmt(i.ma5)}；MA20：${fmt(i.ma20)}；MA60：${fmt(i.ma60)}
- RSI(14)：${fmt(i.rsi14)}
- MACD：DIF ${fmt(i.macd?.macd, 3)}、訊號線 ${fmt(i.macd?.signal, 3)}、柱狀體 ${fmt(i.macd?.histogram, 3)}
- KD(9)：K ${fmt(i.kd?.k)}、D ${fmt(i.kd?.d)}
- 20 日平均成交量：${fmt(i.volumeAvg20, 0)}
程式的規則判讀：
${ruleNotes || "- 資料不足"}

【基本面】
- 本益比（PE）：${fmt(f.peRatio)}
- 股價淨值比（PB）：${fmt(f.pbRatio)}
- EPS（近四季）：${fmt(f.eps)}
- 殖利率：${fmt(f.dividendYield, 2, "%")}
- 營收成長率（年增）：${fmt(f.revenueGrowth, 2, "%")}
- 淨利率：${fmt(f.profitMargin, 2, "%")}
- 負債權益比：${fmt(f.debtToEquity, 2, "%")}

【近期新聞標題】
${newsText}`;
}

export function riskBlock(level: RiskLevel | null | undefined): string {
  if (!level) return "【使用者風險屬性】尚未填寫問卷，請以「穩健型」角度說明，並建議使用者先完成風險評估。";
  return `【使用者風險屬性】${RISK_LABEL[level]}：${RISK_DESC[level]}`;
}

export const ANALYSIS_SCHEMA = `{
  "summary": "一句話總結（30 字以內，白話）",
  "technical": { "score": 0-100 的整數, "trend": "上升 / 盤整 / 下降 擇一", "explanation": "100–200 字，解釋均線、RSI、MACD、KD 代表的意義" },
  "fundamental": { "score": 0-100 的整數, "valuation": "偏低 / 合理 / 偏高 / 資料不足 擇一", "explanation": "100–200 字，說明獲利、成長、財務健康、估值" },
  "sentiment": { "score": 0-100 的整數, "mood": "正面 / 中性 / 負面 擇一", "explanation": "50–150 字，整理新聞重點；沒有新聞就說明資料不足" },
  "overallScore": 0-100 的整數,
  "action": "觀望 / 可分批布局 / 考慮減碼 擇一",
  "actionReason": "50–150 字，說明理由，並提醒分批、分散",
  "risks": ["風險 1", "風險 2", "風險 3"],
  "suitability": { "suitable": true 或 false, "explanation": "是否適合這位使用者的風險屬性，50–100 字" },
  "confidence": { "level": "高 / 中 / 低 擇一", "reason": "為什麼有這個把握程度（例如資料是否完整）" },
  "glossary": [ { "term": "報告中出現的專有名詞", "explanation": "一句白話解釋" } ]
}`;

export function buildAnalysisPrompt(data: StockData, news: NewsItem[], level: RiskLevel | null | undefined) {
  const system = `${BASE_RULES}

你的任務：根據使用者提供的股票數據，產出一份結構化的新手分析報告。
輸出必須是符合下列格式的 JSON：
${ANALYSIS_SCHEMA}

評分原則：
- 技術面：趨勢向上、動能轉強給高分；跌破均線、動能轉弱給低分。
- 基本面：獲利穩定、成長、估值合理給高分；ETF 改評估其成分與費用特性，數據缺漏時給 50 分並說明。
- 消息面：依新聞標題的整體情緒評分，沒有新聞給 50 分。
- overallScore 大約是技術 30%、基本 50%、消息 20% 的加權，可依情況微調。
- glossary 至少列出 3 個報告中用到的術語。`;
  const user = `${riskBlock(level)}

以下是由程式抓取與計算的真實數據，請只根據這些數據分析：

${buildDataBlock(data, news)}`;
  return { system, user };
}

const clampScore = (v: unknown) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 50;
};
const str = (v: unknown, fallback = "") => (typeof v === "string" && v.trim() ? v.trim() : fallback);
const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(v as T) ? (v as T) : fallback;

// 過濾肯定語氣的保證用語；「沒有保證獲利」「保證獲利是不存在的」這類否定句保留
const BANNED = /(?<!(不|沒有|無|沒|並非|不是|不會|不能|不可能)[「『"]?)(保證獲利|一定會漲|穩賺不賠|穩賺|必漲)(?![」』"]?\s*(是不存在|不存在|是不可能|是詐騙|都是詐騙))/g;
export const clean = (s: string) => s.replace(BANNED, "（無法保證）");

/** 檢查並補齊 AI 回傳的欄位，避免畫面壞掉 */
export function normalizeAnalysis(raw: unknown): AIAnalysis {
  const r = (raw ?? {}) as Record<string, Record<string, unknown> & unknown>;
  const t = (r.technical ?? {}) as Record<string, unknown>;
  const f = (r.fundamental ?? {}) as Record<string, unknown>;
  const s = (r.sentiment ?? {}) as Record<string, unknown>;
  const su = (r.suitability ?? {}) as Record<string, unknown>;
  const c = (r.confidence ?? {}) as Record<string, unknown>;
  const risks = Array.isArray(r.risks) ? (r.risks as unknown[]).map((x) => clean(str(x))).filter(Boolean).slice(0, 5) : [];
  const glossary = Array.isArray(r.glossary)
    ? (r.glossary as Record<string, unknown>[])
        .map((g) => ({ term: str(g?.term), explanation: clean(str(g?.explanation)) }))
        .filter((g) => g.term && g.explanation)
        .slice(0, 8)
    : [];
  return {
    summary: clean(str(r.summary, "AI 沒有提供總結")),
    technical: { score: clampScore(t.score), trend: str(t.trend, "資料不足"), explanation: clean(str(t.explanation, "資料不足")) },
    fundamental: { score: clampScore(f.score), valuation: str(f.valuation, "資料不足"), explanation: clean(str(f.explanation, "資料不足")) },
    sentiment: {
      score: clampScore(s.score),
      mood: pick(s.mood, ["正面", "中性", "負面"] as const, "中性"),
      explanation: clean(str(s.explanation, "資料不足")),
    },
    overallScore: clampScore(r.overallScore),
    action: pick(r.action, ["觀望", "可分批布局", "考慮減碼"] as const, "觀望"),
    actionReason: clean(str(r.actionReason, "")),
    risks: risks.length ? risks : ["AI 未列出風險，請自行評估市場與個股風險"],
    suitability: { suitable: su.suitable === true, explanation: clean(str(su.explanation, "")) },
    confidence: { level: pick(c.level, ["高", "中", "低"] as const, "低"), reason: str(c.reason, "") },
    glossary,
  };
}

export function buildChatSystem(opts: {
  level: RiskLevel | null | undefined;
  portfolioText: string;
  stockBlocks: string[];
}) {
  return `${BASE_RULES}

你現在是聊天介面中的「AI 投資小幫手」。回答要親切、簡短（多數情況 300 字內），必要時用條列。
如果使用者問「現在適合買嗎」這類問題，不要直接叫他買或賣，而是說明目前數據透露的訊息、需要注意的風險、以及適合他風險屬性的做法（例如分批、定期定額、先用模擬交易練習）。
若問題與投資理財無關，禮貌地把話題帶回投資學習。

${riskBlock(opts.level)}

【使用者的模擬投資組合】
${opts.portfolioText || "（尚無持股）"}

${opts.stockBlocks.length ? `【對話中提到的股票，最新數據如下（只能引用這些數字）】\n\n${opts.stockBlocks.join("\n\n---\n\n")}` : "【對話中沒有提到特定股票，若需要數據請請使用者到個股頁查看】"}`;
}

export function buildPortfolioPrompt(level: RiskLevel | null | undefined, portfolioText: string) {
  const system = `${BASE_RULES}

你的任務：檢視使用者的「模擬」投資組合，輸出 JSON：
{
  "summary": "一句話總評",
  "score": 0-100 的整數（組合健康度）,
  "concentration": "集中度風險說明（單一持股占比是否過高，超過 30% 要提醒）",
  "diversification": "產業與市場分散程度說明",
  "fit": "與使用者風險屬性是否相符的說明",
  "suggestions": ["具體但不強迫的調整方向 1", "2", "3"]
}`;
  return { system, user: `${riskBlock(level)}\n\n【模擬投資組合】\n${portfolioText}` };
}
