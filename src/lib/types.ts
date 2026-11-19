export type Market = "TW" | "US";

export interface Candle {
  time: string; // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Quote {
  symbol: string; // 顯示用代號，如 2330 或 AAPL
  yahooSymbol: string; // 查詢用代號，如 2330.TW
  name: string;
  market: Market;
  currency: string;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  dayHigh?: number;
  dayLow?: number;
  volume?: number;
  asOf: string; // ISO time
  realtimeSource?: string | null; // 最新報價來源，null 表示只有收盤資料
}

export interface Fundamentals {
  peRatio?: number | null; // 本益比
  pbRatio?: number | null; // 股價淨值比
  eps?: number | null; // 每股盈餘（近四季）
  dividendYield?: number | null; // 殖利率 %
  revenueGrowth?: number | null; // 營收成長率 %
  profitMargin?: number | null; // 淨利率 %
  debtToEquity?: number | null; // 負債權益比 %
  marketCap?: number | null;
  week52High?: number | null;
  week52Low?: number | null;
  sector?: string | null;
  source: string[];
}

export interface IndicatorSnapshot {
  ma5: number | null;
  ma20: number | null;
  ma60: number | null;
  rsi14: number | null;
  macd: { macd: number; signal: number; histogram: number } | null;
  kd: { k: number; d: number } | null;
  volumeAvg20: number | null;
  return1m: number | null; // 近一個月報酬 %
  return3m: number | null;
  volatility20: number | null; // 20 日年化波動度 %
}

export interface NewsItem {
  title: string;
  link: string;
  publisher: string;
  publishedAt: string | null;
}

export interface StockData {
  quote: Quote;
  history: Candle[];
  indicators: IndicatorSnapshot;
  fundamentals: Fundamentals;
  isDemo: boolean;
  dataSources: string[];
}

export type RiskLevel = "conservative" | "balanced" | "aggressive";

export interface RiskProfile {
  level: RiskLevel;
  score: number;
  completedAt: string;
}

export type AIProvider = "anthropic" | "openai" | "gemini" | "openai-compatible";

export interface AISettings {
  provider: AIProvider;
  apiKey: string;
  model: string;
  baseUrl?: string; // openai-compatible 使用
}

export interface AIAnalysis {
  summary: string;
  technical: { score: number; trend: string; explanation: string };
  fundamental: { score: number; valuation: string; explanation: string };
  sentiment: { score: number; mood: "正面" | "中性" | "負面"; explanation: string };
  overallScore: number;
  action: "觀望" | "可分批布局" | "考慮減碼";
  actionReason: string;
  risks: string[];
  suitability: { suitable: boolean; explanation: string };
  confidence: { level: "高" | "中" | "低"; reason: string };
  glossary: { term: string; explanation: string }[];
}

export interface AIAnalysisResult {
  analysis: AIAnalysis;
  symbol: string;
  name: string;
  generatedAt: string;
  model: string;
  isDemoData: boolean;
}

export interface Holding {
  symbol: string;
  name: string;
  market: Market;
  shares: number;
  avgCost: number; // 原幣
}

export interface Trade {
  id: string;
  symbol: string;
  name: string;
  market: Market;
  side: "buy" | "sell";
  shares: number;
  price: number; // 原幣
  fxRate: number; // 成交時匯率（台股 = 1）
  fee: number; // 台幣
  time: string;
}

export interface Portfolio {
  cash: number; // 台幣
  initialCash: number;
  holdings: Holding[];
  trades: Trade[];
}

export interface WatchItem {
  symbol: string;
  name: string;
  market: Market;
  addedAt: string;
  alertAbove?: number | null;
  alertBelow?: number | null;
  lastAiScore?: number | null;
  prevAiScore?: number | null;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}
