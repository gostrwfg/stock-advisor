import { describe, expect, it } from "vitest";
import { clean, normalizeAnalysis } from "./prompts";
import { extractMentionedSymbols } from "./stockList";

describe("clean", () => {
  it("過濾肯定語氣的保證用語", () => {
    expect(clean("這檔股票保證獲利")).toBe("這檔股票（無法保證）");
    expect(clean("明天一定會漲")).toBe("明天（無法保證）");
  });
  it("保留否定句", () => {
    expect(clean("投資沒有保證獲利")).toBe("投資沒有保證獲利");
    expect(clean("保證獲利是不存在的")).toBe("保證獲利是不存在的");
    expect(clean("不會穩賺")).toBe("不會穩賺");
  });
});

describe("normalizeAnalysis", () => {
  it("補齊缺漏欄位並限制分數範圍", () => {
    const a = normalizeAnalysis({ overallScore: 150, action: "全部買進", technical: { score: -5 } });
    expect(a.overallScore).toBe(100);
    expect(a.technical.score).toBe(0);
    expect(a.action).toBe("觀望");
    expect(a.confidence.level).toBe("低");
    expect(a.risks.length).toBeGreaterThan(0);
  });
  it("處理完全錯誤的輸入", () => {
    expect(() => normalizeAnalysis(null)).not.toThrow();
    expect(normalizeAnalysis("oops").summary).toBeTruthy();
  });
});

describe("extractMentionedSymbols", () => {
  it("從中文名稱與代號找出股票", () => {
    expect(extractMentionedSymbols("台積電和 0050 哪個好？")).toEqual(expect.arrayContaining(["2330", "0050"]));
  });
  it("不把年份當成代號", () => {
    expect(extractMentionedSymbols("2025 年的 AAPL 表現")).toEqual(["AAPL"]);
  });
});
