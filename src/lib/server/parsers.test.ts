import { describe, expect, it } from "vitest";
import { buildBreadth } from "@/lib/server/breadth";
import { buildCreditSpread, parseFredApiObservations, parseFredCsv } from "@/lib/server/credit";
import { buildMultiplierHistory, buildRelativeStrength } from "@/lib/server/dashboardData";
import { parseCnnFearGreed } from "@/lib/server/fearGreed";
import { parseYahooBars } from "@/lib/server/macro";
import type { DashboardSnapshotRecord } from "@/lib/server/snapshotStore";
import { buildTailRisk, buildTermStructure } from "@/lib/server/vix";
import type { DailyBar, EquityMarketKey, MarketSeries } from "@/types/market";

function makeSeries(
  key: MarketSeries["key"],
  bars: DailyBar[],
  source = "Twelve Data",
): MarketSeries {
  return {
    key,
    providerSymbol: key.toUpperCase(),
    source,
    dataKind: "日线收盘",
    bars,
    error: null,
  };
}

function makeLinearBars(count: number, startClose: number, step: number, startDate = "2026-01-01"): DailyBar[] {
  const startMs = Date.parse(`${startDate}T00:00:00Z`);
  return Array.from({ length: count }, (_, index) => {
    const close = startClose + index * step;
    const date = new Date(startMs + index * 86_400_000).toISOString().slice(0, 10);
    return { date, open: close, high: close, low: close, close, volume: null };
  });
}

describe("parsers and server builders", () => {
  it("parses CNN Fear & Greed nested payload variants", () => {
    const parsed = parseCnnFearGreed({
      fear_and_greed: {
        score: 21.4,
        rating: "extreme fear",
        timestamp: "2026-11-20T18:00:00Z",
      },
    });
    expect(parsed).toEqual({
      score: 21.4,
      rating: "极度恐惧",
      dataTime: "2026-11-20T18:00:00.000Z",
    });

    const nested = parseCnnFearGreed({
      wrapper: {
        score: 68,
        status: "greed",
        last_updated: 1_795_000_000,
      },
    });
    expect(nested?.score).toBe(68);
    expect(nested?.rating).toBe("贪婪");
    expect(nested?.dataTime).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    expect(parseCnnFearGreed({ invalid: true })).toBeNull();
  });

  it("parses Yahoo Finance chart bars with date deduplication and ascending sort", () => {
    const day1 = Math.floor(Date.parse("2026-11-18T14:30:00Z") / 1000);
    const day2Early = Math.floor(Date.parse("2026-11-19T14:30:00Z") / 1000);
    const day2Late = Math.floor(Date.parse("2026-11-19T20:00:00Z") / 1000);
    const day0 = Math.floor(Date.parse("2026-11-17T14:30:00Z") / 1000);

    const bars = parseYahooBars({
      chart: {
        result: [
          {
            timestamp: [day1, day2Late, day2Early, day0],
            indicators: {
              quote: [{ close: [101, 105, 103, null] }],
            },
          },
        ],
      },
    });

    expect(bars.map((b) => ({ date: b.date, close: b.close }))).toEqual([
      { date: "2026-11-18", close: 101 },
      { date: "2026-11-19", close: 105 },
    ]);
  });

  it("aligns VIX term structure and tail risk to the earliest latest trading date", () => {
    const vix = makeSeries(
      "vix",
      [
        { date: "2026-11-18", open: 20, high: 20, low: 20, close: 20, volume: null },
        { date: "2026-11-19", open: 22, high: 22, low: 22, close: 22, volume: null },
        { date: "2026-11-20", open: 35, high: 35, low: 35, close: 35, volume: null },
      ],
      "Cboe",
    );
    const term = buildTermStructure(vix, {
      vix9d: [
        { date: "2026-11-18", open: 18, high: 18, low: 18, close: 18, volume: null },
        { date: "2026-11-19", open: 21, high: 21, low: 21, close: 21, volume: null },
      ],
      vix3m: [
        { date: "2026-11-18", open: 20, high: 20, low: 20, close: 20, volume: null },
        { date: "2026-11-19", open: 20, high: 20, low: 20, close: 20, volume: null },
      ],
      error: null,
    });
    expect(term.asOf).toBe("2026-11-19");
    expect(term.vix30d).toBe(22);
    expect(term.ratio).toBeCloseTo(1.1, 4);
    expect(term.state).toBe("backwardation");

    const skewPoints = Array.from({ length: 130 }, (_, index) => ({
      date: new Date(Date.parse("2026-01-01T00:00:00Z") + index * 86_400_000)
        .toISOString()
        .slice(0, 10),
      value: 120 + index * 0.2,
    }));
    const vvixPoints = skewPoints.slice(0, 125).map((p, index) => ({
      date: p.date,
      value: 80 + index * 0.1,
    }));
    const tail = buildTailRisk({ skew: skewPoints, vvix: vvixPoints, error: null });
    expect(tail.asOf).toBe(vvixPoints.at(-1)?.date);
    expect(tail.skew).toBeCloseTo(120 + 124 * 0.2, 4);
    expect(tail.vvixPercentile).toBeCloseTo(100, 4);
  });

  it("builds breadth metrics on aligned SPY/RSP dates", () => {
    const spyBars = makeLinearBars(230, 100, 0.5); // 上行更快
    const rspBars = makeLinearBars(230, 100, 0.05); // 明显落后，形成 narrow
    const breadth = buildBreadth(spyBars, { rsp: rspBars, source: "Nasdaq", error: null });

    expect(breadth.state).toBe("narrow");
    expect(breadth.gap200).not.toBeNull();
    expect(breadth.gap200!).toBeLessThan(-2);
    expect(breadth.ratioSampleDays).toBe(230);
    expect(breadth.source).toContain("Nasdaq");
  });

  it("parses FRED API & CSV data and builds credit spread stats", () => {
    const apiPoints = parseFredApiObservations([
      { date: "2026-11-19", value: "." },
      { date: "2026-11-18", value: "3.15" },
      { date: "2026-11-20", value: "3.65" },
    ]);
    expect(apiPoints).toEqual([
      { date: "2026-11-18", value: 3.15 },
      { date: "2026-11-20", value: 3.65 },
    ]);

    const csvPoints = parseFredCsv(
      "observation_date,BAMLH0A0HYM2\n2026-11-18,3.15\n2026-11-19,.\n2026-11-20,3.65\n",
    );
    expect(csvPoints).toEqual(apiPoints);

    const longPoints = Array.from({ length: 130 }, (_, index) => ({
      date: new Date(Date.parse("2026-01-01T00:00:00Z") + index * 86_400_000)
        .toISOString()
        .slice(0, 10),
      value: 3.0 + (index >= 120 ? 0.8 : 0),
    }));
    const credit = buildCreditSpread({ points: longPoints, error: null });
    expect(credit.latest).toBeCloseTo(3.8, 4);
    expect(credit.state).toBe("elevated");
    expect(credit.change20d).toBeCloseTo(0.8, 4);
    expect(credit.percentile5y).toBeCloseTo(100, 4);
  });

  it("aligns relative strength by common trading dates and uses dynamic spy source", () => {
    // SPY 拥有到 2026-04-05 的数据（70 根，每天平稳 +1）
    const spyBars = makeLinearBars(70, 100, 1, "2026-01-26");
    // QQQ 只停在早两天（但与 SPY 在重叠区间内完全同涨同跌），验证不会跨日错位比较
    const qqqBars = spyBars.slice(0, -2);
    const emptyBars: DailyBar[] = [];

    const seriesByKey: Record<EquityMarketKey, MarketSeries> = {
      spy: makeSeries("spy", spyBars, "Nasdaq"),
      qqq: makeSeries("qqq", qqqBars, "Nasdaq"),
      dia: makeSeries("dia", emptyBars, "Twelve Data"),
      soxx: makeSeries("soxx", emptyBars, "Twelve Data"),
      iwm: makeSeries("iwm", emptyBars, "Twelve Data"),
      ixic: makeSeries("ixic", emptyBars, "Twelve Data"),
    };

    const view = buildRelativeStrength(seriesByKey);
    expect(view.asOfLabel).toContain("Nasdaq");
    expect(view.asOfLabel).not.toContain("Twelve Data");
    const qqqRow = view.rows.find((row) => row.id === "qqq");
    expect(qqqRow?.excess20dLabel).toBe("0.00 pp");
    expect(qqqRow?.excess60dLabel).toBe("0.00 pp");
  });

  it("finds 2x reference date and continuous streak start beyond 12 trading days", () => {
    const startMs = Date.parse("2026-10-01T00:00:00Z");
    const makeRecord = (dayOffset: number, multiplier: string): DashboardSnapshotRecord => ({
      schema: 1,
      marketDate: new Date(startMs + dayOffset * 86_400_000).toISOString().slice(0, 10),
      multiplier,
      status: multiplier === "2×" ? "triggered" : "normal",
      reason: "test",
      missingCount: 0,
      signals: [],
      valuation: { pe: null, percentile: null, asOf: null, ageDays: null, stale: false, participates: false },
      fearGreed: { score: 50, rating: "中性", dataTime: null },
      termStructure: { vix9d: null, vix30d: null, vix3m: null, ratio: null, state: "missing", asOf: null },
      markets: {
        qqq: { date: null, close: null, rsi6: null, drawdown52w: null, return25d: null, distance200d: null },
        spy: { date: null, close: null, rsi6: null, drawdown52w: null, return25d: null, distance200d: null },
        vixClose: null,
      },
      health: { status: "success", notices: [] },
      recordedAt: "2026-10-01T00:00:00.000Z",
    });

    // 18 个交易日：第 2 天是 2x，后 15 天全是 1x -> 仍能找到 12 天外的上次 2x
    const qqqBars = makeLinearBars(20, 100, 1, "2026-10-01");
    const recordsPast2x = Array.from({ length: 18 }, (_, i) => makeRecord(i, i === 2 ? "2×" : "1×"));
    const historyPast = buildMultiplierHistory(recordsPast2x, makeSeries("qqq", qqqBars));
    expect(historyPast.points).toHaveLength(12);
    expect(historyPast.last2xLabel).toBe(`上次 2×：${recordsPast2x[2].marketDate}`);
    expect(historyPast.rangeLabel).toContain("累计记录 18 个交易日");
    expect(historyPast.sinceLabel).toContain(`自 ${recordsPast2x[2].marketDate} 以来 QQQ`);

    // 连续 15 天均为 2x -> 起点应回溯到第 0 天，而非被 slice(-12) 截断
    const streakRecords = Array.from({ length: 15 }, (_, i) => makeRecord(i, "2×"));
    const historyStreak = buildMultiplierHistory(streakRecords, makeSeries("qqq", qqqBars));
    expect(historyStreak.last2xLabel).toBe(`当前 2× 从 ${streakRecords[0].marketDate} 开始`);
  });
});
