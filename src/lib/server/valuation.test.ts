import { describe, expect, it } from "vitest";
import {
  monthlyHistoryInFiveYears,
  parseMultplPeTable,
  selectActiveValuationPoint,
} from "@/lib/server/valuation";

describe("valuation", () => {
  it("parses Multpl HTML table and marks estimated rows", () => {
    const html = `
      <table>
        <tr><th>Date</th><th>Value</th></tr>
        <tr><td>Nov 20, 2026</td><td>&dagger; 23.55</td></tr>
        <tr><td>Nov 1, 2026</td><td>&#8224; 25.73</td></tr>
        <tr><td>Jun 1, 2026</td><td>&#x2002; 25.22</td></tr>
        <tr><td>Invalid row</td><td>N/A</td></tr>
      </table>
    `;
    const points = parseMultplPeTable(html);
    expect(points).toEqual([
      { date: "2026-06-01", pe: 25.22, estimated: false },
      { date: "2026-11-01", pe: 25.73, estimated: true },
      { date: "2026-11-20", pe: 23.55, estimated: true },
    ]);
  });

  it("deduplicates same-month rows in 5y history preferring actual over estimated", () => {
    const points = [
      { date: "2020-01-01", pe: 15, estimated: false }, // 超出 5 年窗口
      { date: "2025-05-01", pe: 24, estimated: false },
      { date: "2026-06-01", pe: 25.22, estimated: false },
      { date: "2026-06-15", pe: 25.9, estimated: true }, // 同月存在实际值，应保留实际值
      { date: "2026-11-01", pe: 25.73, estimated: true },
      { date: "2026-11-20", pe: 23.55, estimated: true }, // 同为估算值，保留更晚日期
    ];

    const history = monthlyHistoryInFiveYears(points, "2026-11-20");
    expect(history).toEqual([
      { date: "2025-05-01", pe: 24, estimated: false },
      { date: "2026-06-01", pe: 25.22, estimated: false },
      { date: "2026-11-20", pe: 23.55, estimated: true },
    ]);
  });

  it("prefers fresh actuals, falls back to fresh estimate when actual is stale, and marks stale if even estimate is old", () => {
    const withFreshActual = selectActiveValuationPoint(
      [
        { date: "2026-10-01", pe: 24, estimated: false },
        { date: "2026-11-15", pe: 25, estimated: true },
      ],
      "2026-11-10",
    );
    expect(withFreshActual.active?.date).toBe("2026-10-01");
    expect(withFreshActual.isEstimated).toBe(false);
    expect(withFreshActual.stale).toBe(false);

    const fallbackToEstimate = selectActiveValuationPoint(
      [
        { date: "2026-06-01", pe: 25.22, estimated: false },
        { date: "2026-11-20", pe: 23.55, estimated: true },
      ],
      "2026-11-22",
    );
    expect(fallbackToEstimate.active?.date).toBe("2026-11-20");
    expect(fallbackToEstimate.latestActual?.date).toBe("2026-06-01");
    expect(fallbackToEstimate.isEstimated).toBe(true);
    expect(fallbackToEstimate.stale).toBe(false);
    expect(fallbackToEstimate.ageDays).toBe(2);

    const staleEstimate = selectActiveValuationPoint(
      [
        { date: "2026-06-01", pe: 25.22, estimated: false },
        { date: "2026-09-01", pe: 24.0, estimated: true },
      ],
      "2026-11-22",
    );
    expect(staleEstimate.active?.date).toBe("2026-09-01");
    expect(staleEstimate.isEstimated).toBe(true);
    expect(staleEstimate.stale).toBe(true);
  });
});
