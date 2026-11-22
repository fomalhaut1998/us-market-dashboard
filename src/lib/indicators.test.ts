import { describe, expect, it } from "vitest";
import {
  alignBarsByDate,
  calculateDistanceFrom200DayAverage,
  calculateDrawdown52Week,
  calculateRange52Week,
  calculateReturn25Day,
  calculateReturnOverDays,
  calculateWilderRsi,
} from "@/lib/indicators";
import type { DailyBar } from "@/types/market";

function makeBars(closes: number[], startDate = "2026-01-01"): DailyBar[] {
  const startMs = Date.parse(`${startDate}T00:00:00Z`);
  return closes.map((close, index) => {
    const date = new Date(startMs + index * 86_400_000).toISOString().slice(0, 10);
    return { date, open: close, high: close, low: close, close, volume: null };
  });
}

describe("indicators", () => {
  it("calculates Wilder RSI(6) edge cases and mixed series", () => {
    expect(calculateWilderRsi(makeBars([10, 11, 12, 13, 14, 15]), 6)).toBeNull();
    expect(calculateWilderRsi(makeBars([10, 10, 10, 10, 10, 10, 10]), 6)).toBe(50);
    expect(calculateWilderRsi(makeBars([10, 11, 12, 13, 14, 15, 16]), 6)).toBe(100);
    expect(calculateWilderRsi(makeBars([16, 15, 14, 13, 12, 11, 10]), 6)).toBe(0);

    // 7 根序列前 6 次变化：+2, -1, +2, -1, +2, -1 -> avgGain = 6/6 = 1, avgLoss = 3/6 = 0.5 -> RS = 2 -> RSI = 66.667
    const rsi = calculateWilderRsi(makeBars([10, 12, 11, 13, 12, 14, 13]), 6);
    expect(rsi).toBeCloseTo(66.6667, 3);
  });

  it("calculates 52-week drawdown only on the latest 252 trading days", () => {
    expect(calculateDrawdown52Week(makeBars(Array(251).fill(100)))).toBeNull();

    // 第 1 天有极值 200，但第 2-253 天最高为 100、收在 80 -> 应基于最近 252 根算得 -20%
    const closes = [200, ...Array(251).fill(100), 80];
    expect(calculateDrawdown52Week(makeBars(closes))).toBeCloseTo(-0.2, 6);
  });

  it("supports configurable window on calculateRange52Week (252 vs 365)", () => {
    expect(calculateRange52Week(makeBars(Array(59).fill(100)))).toBeNull();
    expect(calculateRange52Week(makeBars(Array(60).fill(100)))).toBeNull(); // high === low

    // 构造 365 天序列：第 0 天高点 200（仅在 365 窗口内，不在 252 窗口内），之后 100..150
    const closes = [200, ...Array.from({ length: 364 }, (_, i) => 100 + (i === 363 ? 50 : i % 20))];
    const bars = makeBars(closes);

    const tradingRange = calculateRange52Week(bars, 252);
    expect(tradingRange).not.toBeNull();
    expect(tradingRange?.high).toBe(150);
    expect(tradingRange?.position).toBeCloseTo(100, 4);

    const calendarRange = calculateRange52Week(bars, 365);
    expect(calendarRange).not.toBeNull();
    expect(calendarRange?.high).toBe(200);
    expect(calendarRange?.low).toBe(100);
    expect(calendarRange?.position).toBeCloseTo(50, 4);
    expect(calendarRange?.fromHigh).toBeCloseTo(-0.25, 4);
  });

  it("calculates N-day returns and 200-day MA distance", () => {
    expect(calculateReturnOverDays(makeBars([100, 110]), 2)).toBeNull();
    expect(calculateReturnOverDays(makeBars([100, 105, 115]), 2)).toBeCloseTo(0.15, 6);
    expect(calculateReturn25Day(makeBars(Array(25).fill(100)))).toBeNull();
    expect(calculateReturn25Day(makeBars([...Array(25).fill(100), 90]))).toBeCloseTo(-0.1, 6);

    expect(calculateDistanceFrom200DayAverage(makeBars(Array(199).fill(100)))).toBeNull();
    // 199 根 100 + 1 根 80 -> 均值 99.9 -> 80 / 99.9 - 1
    const dist = calculateDistanceFrom200DayAverage(makeBars([...Array(199).fill(100), 80]));
    expect(dist).toBeCloseTo(80 / 99.9 - 1, 6);
  });

  it("aligns two series by common dates in ascending order", () => {
    const spyBars: DailyBar[] = [
      { date: "2026-01-03", open: 10, high: 10, low: 10, close: 102, volume: null },
      { date: "2026-01-01", open: 10, high: 10, low: 10, close: 100, volume: null },
      { date: "2026-01-02", open: 10, high: 10, low: 10, close: 101, volume: null },
    ];
    const targetBars: DailyBar[] = [
      { date: "2026-01-02", open: 20, high: 20, low: 20, close: 202, volume: null },
      { date: "2026-01-04", open: 20, high: 20, low: 20, close: 210, volume: null },
      { date: "2026-01-03", open: 20, high: 20, low: 20, close: 205, volume: null },
    ];

    const aligned = alignBarsByDate(spyBars, targetBars);
    expect(aligned.base.map((b) => b.date)).toEqual(["2026-01-02", "2026-01-03"]);
    expect(aligned.target.map((b) => b.date)).toEqual(["2026-01-02", "2026-01-03"]);
    expect(aligned.base.map((b) => b.close)).toEqual([101, 102]);
    expect(aligned.target.map((b) => b.close)).toEqual([202, 205]);
  });
});
