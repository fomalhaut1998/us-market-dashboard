import { describe, expect, it } from "vitest";
import { buildMonthlyPePoints, calculatePePercentile } from "@/lib/peHistory";

describe("peHistory", () => {
  it("calculates PE percentile as fraction of samples <= current", () => {
    expect(calculatePePercentile(null, [{ date: "2026-01-01", pe: 20 }])).toBeNull();
    expect(calculatePePercentile(20, [])).toBeNull();

    const history = [
      { date: "2022-01-01", pe: 18 },
      { date: "2023-01-01", pe: 20 },
      { date: "2024-01-01", pe: 22 },
      { date: "2025-01-01", pe: 25 },
    ];
    expect(calculatePePercentile(20, history)).toBeCloseTo(50, 6);
    expect(calculatePePercentile(25, history)).toBeCloseTo(100, 6);
  });

  it("builds monthly PE points taking latest reading in each month and leaving gaps null", () => {
    const months = [
      { label: "6月", end: "2026-06-30" },
      { label: "7月", end: "2026-07-31" },
      { label: "8月", end: "2026-08-31" },
      { label: "9月", end: "2026-09-30" },
    ];
    const history = [
      { date: "2026-05-01", pe: 20, estimated: false },
      { date: "2026-06-01", pe: 22, estimated: false },
      // 7 月缺数 -> 应留空，不延续 6 月数值
      // 8 月有月初和月中两条 -> 应取更晚的 8-20
      { date: "2026-08-01", pe: 24, estimated: true },
      { date: "2026-08-20", pe: 26, estimated: true },
      { date: "2026-09-01", pe: 25, estimated: true },
    ];

    const result = buildMonthlyPePoints(months, history);
    expect(result[0]).toMatchObject({ month: "6月", pe: 22, estimated: false });
    expect(result[1]).toMatchObject({ month: "7月", pe: null, percentile: null, estimated: false });
    expect(result[2]).toMatchObject({ month: "8月", pe: 26, estimated: true });
    expect(result[3]).toMatchObject({ month: "9月", pe: 25, estimated: true });
  });
});
