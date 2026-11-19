import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const today = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
const ymd = today.replace(/-/g, "");

function finmindRows() {
  const rows = [];
  for (let i = 120; i >= 1; i--) {
    const d = new Date(Date.now() - i * 86400e3).toISOString().slice(0, 10);
    rows.push({ date: d, open: 1000, max: 1010, min: 990, close: 1000 + i, Trading_Volume: 1000 });
  }
  return rows;
}

function mockFetch(routes: Record<string, () => Response>) {
  return vi.fn(async (url: string | URL) => {
    const u = String(url);
    for (const [k, fn] of Object.entries(routes)) if (u.includes(k)) return fn();
    return new Response("blocked", { status: 403 });
  });
}

describe("getStockData 備援流程", () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.unstubAllGlobals());

  it("Yahoo 被擋時改用 FinMind，並併入證交所即時報價", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        "api.finmindtrade.com": () => Response.json({ status: 200, data: finmindRows() }),
        "mis.twse.com.tw": () =>
          Response.json({ msgArray: [{ c: "2330", n: "台積電", z: "1234.0", y: "1001.0", o: "1100", h: "1240", l: "1090", v: "500", d: ymd, t: "10:00:00" }] }),
      }),
    );
    const { getStockData } = await import("./market");
    const d = await getStockData("2330");
    expect(d.isDemo).toBe(false);
    expect(d.dataSources[0]).toBe("FinMind");
    expect(d.quote.price).toBe(1234);
    expect(d.quote.previousClose).toBe(1001);
    expect(d.quote.realtimeSource).toBe("臺灣證券交易所即時報價");
    expect(d.history.at(-1)).toMatchObject({ time: today, close: 1234, volume: 500_000 });
  });

  it("美股 Yahoo 被擋時改用 Stooq", async () => {
    const csv = ["Date,Open,High,Low,Close,Volume", ...finmindRows().map((r) => `${r.date},${r.open},${r.max},${r.min},${r.close / 5},100`)].join("\n");
    vi.stubGlobal(
      "fetch",
      mockFetch({
        "stooq.com/q/d/l": () => new Response(csv),
        "stooq.com/q/l": () => new Response(`Symbol,Date,Time,Open,High,Low,Close,Volume\nAAPL.US,${today},20:00:00,200,210,199,205.5,1000\n`),
      }),
    );
    const { getStockData } = await import("./market");
    const d = await getStockData("AAPL");
    expect(d.isDemo).toBe(false);
    expect(d.quote.price).toBe(205.5);
    expect(d.dataSources).toContain("Stooq");
  });

  it("全部連不上時，熱門股改用示範資料", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
    const { getStockData } = await import("./market");
    expect((await getStockData("2330")).isDemo).toBe(true);
  });

  it("備援來源回覆無資料時，視為查無此股", async () => {
    vi.stubGlobal("fetch", mockFetch({ "api.finmindtrade.com": () => Response.json({ status: 200, data: [] }) }));
    const { getStockData } = await import("./market");
    await expect(getStockData("9988")).rejects.toThrow(/找不到股票/);
  });
});
