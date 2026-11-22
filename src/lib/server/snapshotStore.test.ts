import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createFileSnapshotStorage,
  createUpstashSnapshotStorage,
  latestPerMarketDate,
  readSnapshots,
  recordDashboardSnapshot,
  type DashboardSnapshotInput,
  type DashboardSnapshotRecord,
} from "@/lib/server/snapshotStore";

function makeSnapshotInput(overrides: Partial<DashboardSnapshotInput> = {}): DashboardSnapshotInput {
  return {
    marketDate: "2026-11-20",
    multiplier: "1×",
    status: "normal",
    reason: "维持常态",
    missingCount: 0,
    signals: [],
    valuation: {
      pe: 25.5,
      percentile: 70,
      asOf: "2026-11-20",
      ageDays: 2,
      stale: false,
      estimated: true,
      participates: true,
    },
    fearGreed: { score: 50, rating: "中性", dataTime: null },
    termStructure: { vix9d: 15, vix30d: 16, vix3m: 18, ratio: 0.89, state: "contango", asOf: "2026-11-20" },
    markets: {
      qqq: { date: "2026-11-20", close: 500, rsi6: 50, drawdown52w: -0.02, return25d: 0.03, distance200d: 0.08 },
      spy: { date: "2026-11-20", close: 580, rsi6: 52, drawdown52w: -0.01, return25d: 0.02, distance200d: null },
      vixClose: 16,
    },
    health: { status: "success", notices: [] },
    ...overrides,
  };
}

describe("snapshotStore", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(tempDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  it("writes, deduplicates unchanged snapshots, and tolerates corrupted lines in file storage", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "us-market-snapshot-"));
    tempDirs.push(dir);
    const file = path.join(dir, "snapshots.jsonl");
    const storage = createFileSnapshotStorage(file);

    const first = await recordDashboardSnapshot(makeSnapshotInput(), storage);
    expect(first).toEqual({ written: true, reason: "written", file });

    // 内容完全相同（仅 recordedAt 不同）时去重不写入
    const duplicate = await recordDashboardSnapshot(makeSnapshotInput(), storage);
    expect(duplicate).toEqual({ written: false, reason: "unchanged", file });

    // 末行损坏时仍应正常追加下一条，读取时跳过损坏行
    await fs.appendFile(file, "{corrupted-json\n", "utf8");
    const updated = await recordDashboardSnapshot(makeSnapshotInput({ multiplier: "1.5×" }), storage);
    expect(updated).toEqual({ written: true, reason: "written", file });

    const records = await readSnapshots(100, storage);
    expect(records).toHaveLength(2);
    expect(records[0].multiplier).toBe("1×");
    expect(records[1].multiplier).toBe("1.5×");
  });

  it("deduplicates records by marketDate keeping the last record per trading day", () => {
    const base = makeSnapshotInput();
    const records: DashboardSnapshotRecord[] = [
      { ...base, schema: 1, marketDate: "2026-11-20", multiplier: "1×", recordedAt: "2026-11-20T15:00:00Z" },
      { ...base, schema: 1, marketDate: "2026-11-19", multiplier: "2×", recordedAt: "2026-11-19T21:00:00Z" },
      { ...base, schema: 1, marketDate: "2026-11-20", multiplier: "1.5×", recordedAt: "2026-11-20T21:00:00Z" },
    ];
    const perDay = latestPerMarketDate(records);
    expect(perDay.map((r) => [r.marketDate, r.multiplier])).toEqual([
      ["2026-11-19", "2×"],
      ["2026-11-20", "1.5×"],
    ]);
  });

  it("persists and reads snapshots through Upstash REST storage", async () => {
    const list: string[] = [];
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = typeof input === "string" ? input : input.toString();
      const body = JSON.parse(String(init?.body ?? "null"));

      if (url.endsWith("/pipeline")) {
        const [[, , item]] = body as [[string, string, string], [string, string, number, number]];
        list.push(item);
        return new Response(JSON.stringify([{ result: list.length }, { result: "OK" }]), { status: 200 });
      }

      const [cmd] = body as [string, ...unknown[]];
      if (cmd === "LINDEX") {
        return new Response(JSON.stringify({ result: list.at(-1) ?? null }), { status: 200 });
      }
      if (cmd === "LRANGE") {
        return new Response(JSON.stringify({ result: [...list] }), { status: 200 });
      }
      return new Response("bad command", { status: 400 });
    });

    vi.stubGlobal("fetch", fetchMock);
    const storage = createUpstashSnapshotStorage({
      url: "https://example.upstash.io",
      token: "test-token",
      key: "snapshots:test",
    });

    const first = await recordDashboardSnapshot(makeSnapshotInput(), storage);
    expect(first.written).toBe(true);
    expect(first.file).toBe("upstash:snapshots:test");

    const dup = await recordDashboardSnapshot(makeSnapshotInput(), storage);
    expect(dup.written).toBe(false);
    expect(dup.reason).toBe("unchanged");

    const readBack = await readSnapshots(50, storage);
    expect(readBack).toHaveLength(1);
    expect(readBack[0].valuation.estimated).toBe(true);
  });
});
