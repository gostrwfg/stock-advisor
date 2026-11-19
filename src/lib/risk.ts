import type { RiskLevel } from "./types";

export const RISK_LABEL: Record<RiskLevel, string> = {
  conservative: "保守型",
  balanced: "穩健型",
  aggressive: "積極型",
};

export const RISK_DESC: Record<RiskLevel, string> = {
  conservative:
    "你最在意的是「不要虧錢」。比較適合波動小的標的，例如大盤型 ETF、高股息 ETF，並以定期定額、長期持有為主。",
  balanced:
    "你可以接受一些價格波動來換取較好的報酬。適合以 ETF 為核心，再搭配少量體質好的大型績優股。",
  aggressive:
    "你能承受較大的價格波動，追求較高的報酬。可以配置成長型個股，但仍要注意分散風險，不要把錢集中在少數股票。",
};

export interface RiskQuestion {
  id: string;
  question: string;
  options: { label: string; score: number }[];
}

export const RISK_QUESTIONS: RiskQuestion[] = [
  {
    id: "age",
    question: "你的年齡是？",
    options: [
      { label: "60 歲以上", score: 1 },
      { label: "45–59 歲", score: 2 },
      { label: "30–44 歲", score: 3 },
      { label: "未滿 30 歲", score: 4 },
    ],
  },
  {
    id: "income",
    question: "你的收入穩定嗎？",
    options: [
      { label: "目前沒有固定收入", score: 1 },
      { label: "收入不太穩定", score: 2 },
      { label: "穩定，但沒有太多結餘", score: 3 },
      { label: "穩定，且每月有固定結餘", score: 4 },
    ],
  },
  {
    id: "emergency",
    question: "扣除投資的錢，你有幾個月的緊急預備金？",
    options: [
      { label: "幾乎沒有", score: 1 },
      { label: "1–3 個月", score: 2 },
      { label: "3–6 個月", score: 3 },
      { label: "6 個月以上", score: 4 },
    ],
  },
  {
    id: "horizon",
    question: "這筆錢你打算投資多久？",
    options: [
      { label: "1 年內就要用", score: 1 },
      { label: "1–3 年", score: 2 },
      { label: "3–5 年", score: 3 },
      { label: "5 年以上", score: 4 },
    ],
  },
  {
    id: "experience",
    question: "你的投資經驗？",
    options: [
      { label: "完全沒有", score: 1 },
      { label: "只有定存或儲蓄險", score: 2 },
      { label: "買過基金或 ETF", score: 3 },
      { label: "買賣過個股", score: 4 },
    ],
  },
  {
    id: "loss",
    question: "如果投資的 10 萬元，一個月後變成 8 萬元，你會？",
    options: [
      { label: "非常焦慮，馬上全部賣掉", score: 1 },
      { label: "賣掉一部分，降低風險", score: 2 },
      { label: "先不動，觀察看看", score: 3 },
      { label: "覺得變便宜了，考慮再買一些", score: 4 },
    ],
  },
  {
    id: "goal",
    question: "你投資的主要目的是？",
    options: [
      { label: "保本，比定存好一點就好", score: 1 },
      { label: "穩定領股息", score: 2 },
      { label: "長期穩健增值", score: 3 },
      { label: "追求高報酬，可以承擔高風險", score: 4 },
    ],
  },
  {
    id: "tolerance",
    question: "一年內你能接受的最大虧損是？",
    options: [
      { label: "5% 以內", score: 1 },
      { label: "5–15%", score: 2 },
      { label: "15–30%", score: 3 },
      { label: "30% 以上也可以", score: 4 },
    ],
  },
];

export function scoreToLevel(score: number): RiskLevel {
  // 8 題，每題 1–4 分，總分 8–32
  if (score <= 16) return "conservative";
  if (score <= 24) return "balanced";
  return "aggressive";
}
