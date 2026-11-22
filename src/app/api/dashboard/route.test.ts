import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DashboardPayload } from "@/types/dashboard";

function makePayload(tag: string, generatedAt: number): DashboardPayload {
  return {
    status: "success",
    lastUpdated: `2026-11-22 ${tag}`,
    generatedAt,
    indexSummaries: [],
    indexConclusion: { title: "结论", rows: [] },
    relativeStrength: { asOfLabel: "", baselineLabel: "", rows: [], note: "" },
    macro: { title: "", description: "", asOfLabel: "", assets: [], note: "" },
    sentimentMetrics: [],
    termStructure: {
      title: "",
      description: "",
      points: [],
      ratioLabel: "",
      stateLabel: "",
      tone: "normal",
      legend: { caption: "", items: [] },
      note: "",
    },
    tailRisk: {
      title: "",
      asOfLabel: "",
      items: [],
      legend: { caption: "", items: [] },
      note: "",
    },
    creditSpread: {
      title: "",
      description: "",
      asOfLabel: "",
      value: "",
      stateLabel: "",
      facts: [],
      tone: "normal",
      legend: { caption: "", items: [] },
      note: "",
    },
    breadth: {
      title: "",
      description: "",
      asOfLabel: "",
      value: "",
      valueLabel: "",
      stateLabel: "",
      facts: [],
      tone: "normal",
      legend: { caption: "", items: [] },
      note: "",
    },
    vixPeHistory: {
      title: "",
      description: "",
      vixLabel: "",
      peLabel: "",
      currentVix: "",
      currentPePercentile: "",
      analysis: "",
      points: [],
    },
    strategyData: {
      title: "",
      description: "",
      levels: [],
      currentMultiplier: "1×",
      currentReason: "",
      conclusionTitle: "",
      conclusionRows: [],
      history: { points: [], rangeLabel: "", last2xLabel: "", sinceLabel: "" },
      sensitivity: { rows: [], note: "" },
      disciplineTitle: "",
      disciplineSubtitle: "",
      disciplineItems: [],
    },
    missingCount: 0,
    notices: [],
  };
}

describe("GET /api/dashboard", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-22T10:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns cached data for normal GET and performs throttled refresh for ?refresh=1", async () => {
    const staleCached = makePayload("stale-ssr", Date.parse("2026-11-22T09:35:00Z"));
    const freshFirst = makePayload("fresh-1", Date.parse("2026-11-22T10:00:00Z"));
    const freshSecond = makePayload("fresh-2", Date.parse("2026-11-22T10:01:05Z"));

    const getCachedDashboardData = vi.fn(async () => staleCached);
    const buildDashboardData = vi
      .fn<() => Promise<DashboardPayload>>()
      .mockResolvedValueOnce(freshFirst)
      .mockResolvedValueOnce(freshSecond);
    const rememberDashboardData = vi.fn();

    vi.doMock("@/lib/server/dashboardData", () => ({
      getCachedDashboardData,
      buildDashboardData,
      rememberDashboardData,
    }));

    const { GET } = await import("@/app/api/dashboard/route");

    // 1. 普通 GET 读缓存
    const cachedResponse = await GET(new Request("http://localhost/api/dashboard"));
    expect(cachedResponse.status).toBe(200);
    expect(cachedResponse.headers.get("X-Dashboard-Refreshed")).toBe("0");
    expect(cachedResponse.headers.get("Cache-Control")).toBe("no-store");
    expect(((await cachedResponse.json()) as DashboardPayload).lastUpdated).toContain("stale-ssr");

    // 2. 首次强制刷新真抓数据并回填内存缓存
    const firstRefresh = await GET(new Request("http://localhost/api/dashboard?refresh=1"));
    expect(firstRefresh.status).toBe(200);
    expect(firstRefresh.headers.get("X-Dashboard-Refreshed")).toBe("1");
    expect(firstRefresh.headers.get("X-Dashboard-Generated-At")).toBe(String(freshFirst.generatedAt));
    expect(((await firstRefresh.json()) as DashboardPayload).lastUpdated).toContain("fresh-1");
    expect(rememberDashboardData).toHaveBeenCalledWith(freshFirst);

    // 3. 20 秒内再次刷新被节流，但返回上次真抓到的 fresh-1（绝不退回 stale-ssr）
    vi.advanceTimersByTime(20_000);
    const throttled = await GET(new Request("http://localhost/api/dashboard?refresh=1"));
    expect(throttled.status).toBe(200);
    expect(throttled.headers.get("X-Dashboard-Refreshed")).toBe("0");
    expect(throttled.headers.get("X-Dashboard-Retry-After")).toBe("40");
    expect(((await throttled.json()) as DashboardPayload).lastUpdated).toContain("fresh-1");
    expect(buildDashboardData).toHaveBeenCalledTimes(1);

    // 4. 超过 60 秒后可再次真刷新
    vi.advanceTimersByTime(45_000);
    const secondRefresh = await GET(new Request("http://localhost/api/dashboard?refresh=1"));
    expect(secondRefresh.headers.get("X-Dashboard-Refreshed")).toBe("1");
    expect(((await secondRefresh.json()) as DashboardPayload).lastUpdated).toContain("fresh-2");
    expect(buildDashboardData).toHaveBeenCalledTimes(2);
  });

  it("coalesces concurrent refreshes and does not consume throttle window on failure", async () => {
    const recovered = makePayload("recovered", Date.parse("2026-11-22T10:00:05Z"));
    let rejectFirst!: (reason?: unknown) => void;
    const firstAttempt = new Promise<DashboardPayload>((_resolve, reject) => {
      rejectFirst = reject;
    });

    const buildDashboardData = vi
      .fn<() => Promise<DashboardPayload>>()
      .mockReturnValueOnce(firstAttempt)
      .mockResolvedValueOnce(recovered);
    const rememberDashboardData = vi.fn();

    vi.doMock("@/lib/server/dashboardData", () => ({
      getCachedDashboardData: vi.fn(),
      buildDashboardData,
      rememberDashboardData,
    }));

    const { GET } = await import("@/app/api/dashboard/route");

    // 两个并发 ?refresh=1 合并为一次调用，失败时均返回 503 且不占用节流窗口
    const p1 = GET(new Request("http://localhost/api/dashboard?refresh=1"));
    const p2 = GET(new Request("http://localhost/api/dashboard?refresh=1"));
    rejectFirst(new Error("upstream 429"));

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1.status).toBe(503);
    expect(r2.status).toBe(503);
    expect(buildDashboardData).toHaveBeenCalledTimes(1);

    // 失败后立刻重试应直接放行（不需等 60 秒）
    const retry = await GET(new Request("http://localhost/api/dashboard?refresh=1"));
    expect(retry.status).toBe(200);
    expect(retry.headers.get("X-Dashboard-Refreshed")).toBe("1");
    expect(((await retry.json()) as DashboardPayload).lastUpdated).toContain("recovered");
    expect(buildDashboardData).toHaveBeenCalledTimes(2);
  });
});
