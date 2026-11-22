import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import type { SignalEvaluation } from "@/types/market";

/**
 * 每日快照落盘：把每次真实计算出的指标写一行 JSON 到同一个 JSONL 文件（或 Upstash Redis List）。
 *
 * 为什么本地默认用 JSONL 而不是 SQLite：
 * - 一年只有约 250 行（每个交易日一行），单文件不到 1 MB，不需要数据库；
 * - 纯文本，git / 记事本 / jq 都能直接看，出问题能一眼定位那一行；
 * - 不需要引入 better-sqlite3 这类原生模块，降低构建与跨平台 ABI 风险。
 * Serverless 只读环境可通过 UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN 持久化。
 */

export const SNAPSHOT_SCHEMA_VERSION = 1;

export interface MarketSnapshot {
  date: string | null;
  close: number | null;
  rsi6: number | null;
  drawdown52w: number | null;
  return25d: number | null;
  /** 只在 QQQ 上有意义：距离 200 日均线的比例。 */
  distance200d: number | null;
}

export interface DashboardSnapshotInput {
  marketDate: string;
  multiplier: string;
  status: string;
  reason: string;
  missingCount: number;
  signals: SignalEvaluation[];
  valuation: {
    pe: number | null;
    percentile: number | null;
    asOf: string | null;
    ageDays: number | null;
    stale: boolean;
    /** 当前采用的 PE 是否为 Multpl 财报估算值。 */
    estimated?: boolean;
    /** 陈旧估值不参与倍率计算，落盘时一并记下，避免以后复盘误判。 */
    participates: boolean;
  };
  fearGreed: { score: number | null; rating: string | null; dataTime: string | null };
  termStructure: {
    vix9d: number | null;
    vix30d: number | null;
    vix3m: number | null;
    ratio: number | null;
    state: string;
    asOf: string | null;
  };
  /** 尾部对冲读数（SKEW / VVIX），上线晚于第一版快照，所以是可选字段。 */
  tailRisk?: {
    skew: number | null;
    skewPercentile: number | null;
    vvix: number | null;
    vvixPercentile: number | null;
    asOf: string | null;
  };
  /** 市场宽度（等权 vs 市值权），可选。 */
  breadth?: {
    gap200: number | null;
    relative20d: number | null;
    ratioPercentile: number | null;
    state: string;
    asOf: string | null;
  };
  /** 信用利差（高收益债 OAS），同样上线晚于第一版快照，可选。 */
  creditSpread?: {
    latest: number | null;
    percentile5y: number | null;
    change20d: number | null;
    state: string;
    asOf: string | null;
  };
  markets: { qqq: MarketSnapshot; spy: MarketSnapshot; vixClose: number | null };
  health: { status: string; notices: string[] };
}

export interface DashboardSnapshotRecord extends DashboardSnapshotInput {
  schema: number;
  recordedAt: string;
}

export interface SnapshotWriteResult {
  written: boolean;
  reason: "written" | "unchanged" | "error";
  file: string;
}

export interface SnapshotStorage {
  readLastLine(): Promise<string | null>;
  appendLine(line: string): Promise<void>;
  readAllLines(limit: number): Promise<string[]>;
  label(): string;
}

const DEFAULT_FILE = path.join("data", "snapshots.jsonl");
const DEFAULT_REDIS_KEY = "us-market-dashboard:snapshots";
const UPSTASH_MAX_ITEMS = 1000;
const UPSTASH_TIMEOUT_MS = 5_000;

/** 默认写到 <项目根>/data/snapshots.jsonl；可用 DASHBOARD_SNAPSHOT_FILE 覆盖（容器/只读盘场景）。 */
export function snapshotFilePath() {
  const override = process.env.DASHBOARD_SNAPSHOT_FILE;
  return override && override.trim() ? path.resolve(override) : path.join(process.cwd(), DEFAULT_FILE);
}

async function readLastLineFromFile(file: string): Promise<string | null> {
  let handle: fs.FileHandle | null = null;
  try {
    handle = await fs.open(file, "r");
    const { size } = await handle.stat();
    if (size === 0) return null;
    const length = Math.min(size, 64 * 1024);
    const buffer = Buffer.alloc(length);
    await handle.read(buffer, 0, length, size - length);
    const lines = buffer.toString("utf8").split("\n").filter((line) => line.trim() !== "");
    return lines.length > 0 ? lines[lines.length - 1] : null;
  } catch {
    return null;
  } finally {
    await handle?.close().catch(() => {});
  }
}

export function createFileSnapshotStorage(filePath?: string): SnapshotStorage {
  const resolved = filePath ? path.resolve(filePath) : snapshotFilePath();
  return {
    async readLastLine() {
      return readLastLineFromFile(resolved);
    },
    async appendLine(line: string) {
      await fs.mkdir(path.dirname(resolved), { recursive: true });
      await fs.appendFile(resolved, `${line}\n`, "utf8");
    },
    async readAllLines(limit: number) {
      try {
        const text = await fs.readFile(resolved, "utf8");
        return text
          .split("\n")
          .filter((line) => line.trim() !== "")
          .slice(-limit);
      } catch {
        return [];
      }
    },
    label() {
      return resolved;
    },
  };
}

interface UpstashConfig {
  url: string;
  token: string;
  key: string;
}

export function createUpstashSnapshotStorage(config: UpstashConfig): SnapshotStorage {
  const baseUrl = config.url.replace(/\/+$/, "");
  const headers = {
    Authorization: `Bearer ${config.token}`,
    "Content-Type": "application/json",
  };

  async function command<T>(body: unknown): Promise<T> {
    const response = await fetch(baseUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTASH_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Upstash HTTP ${response.status}`);
    const payload = (await response.json()) as { result?: T; error?: string };
    if (payload.error) throw new Error(payload.error);
    return payload.result as T;
  }

  return {
    async readLastLine() {
      try {
        const result = await command<string | null>(["LINDEX", config.key, -1]);
        return typeof result === "string" && result.trim() !== "" ? result : null;
      } catch {
        return null;
      }
    },
    async appendLine(line: string) {
      const response = await fetch(`${baseUrl}/pipeline`, {
        method: "POST",
        headers,
        body: JSON.stringify([
          ["RPUSH", config.key, line],
          ["LTRIM", config.key, -UPSTASH_MAX_ITEMS, -1],
        ]),
        cache: "no-store",
        signal: AbortSignal.timeout(UPSTASH_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`Upstash pipeline HTTP ${response.status}`);
      const results = (await response.json()) as Array<{ error?: string }>;
      const failed = Array.isArray(results) ? results.find((item) => item?.error) : null;
      if (failed?.error) throw new Error(failed.error);
    },
    async readAllLines(limit: number) {
      try {
        const count = Math.max(1, limit);
        const result = await command<unknown>(["LRANGE", config.key, -count, -1]);
        if (!Array.isArray(result)) return [];
        return result.filter((item): item is string => typeof item === "string" && item.trim() !== "");
      } catch {
        return [];
      }
    },
    label() {
      return `upstash:${config.key}`;
    },
  };
}

export function resolveSnapshotStorage(): SnapshotStorage {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (url && token) {
    const key = process.env.DASHBOARD_SNAPSHOT_REDIS_KEY?.trim() || DEFAULT_REDIS_KEY;
    return createUpstashSnapshotStorage({ url, token, key });
  }
  return createFileSnapshotStorage();
}

function comparable(record: unknown) {
  const { recordedAt, ...rest } = record as Record<string, unknown>;
  void recordedAt;
  return JSON.stringify(rest);
}

async function performWrite(
  input: DashboardSnapshotInput,
  storage: SnapshotStorage,
): Promise<SnapshotWriteResult> {
  const target = storage.label();
  const record: DashboardSnapshotRecord = {
    schema: SNAPSHOT_SCHEMA_VERSION,
    ...input,
    recordedAt: new Date().toISOString(),
  };

  const lastLine = await storage.readLastLine();
  if (lastLine) {
    try {
      if (comparable(JSON.parse(lastLine)) === comparable(record)) {
        return { written: false, reason: "unchanged", file: target };
      }
    } catch {
      // 末行损坏就照常追加，不因为一行坏数据丢掉今天的记录。
    }
  }

  await storage.appendLine(JSON.stringify(record));
  return { written: true, reason: "written", file: target };
}

// 同一进程内串行化写入，避免并发请求把两行交错写进存储。
let writeChain: Promise<unknown> = Promise.resolve();

/** 落盘一次快照。永不抛错：看板展示不能因为写盘失败而挂掉。 */
export async function recordDashboardSnapshot(
  input: DashboardSnapshotInput,
  storage: SnapshotStorage = resolveSnapshotStorage(),
): Promise<SnapshotWriteResult> {
  const task = writeChain.then(() => performWrite(input, storage));
  writeChain = task.catch(() => undefined);
  try {
    return await task;
  } catch {
    return {
      written: false,
      reason: "error",
      file: storage.label(),
    };
  }
}

/** 同一交易日可能写入多条（盘中信号变化），复盘时以每个 marketDate 的最后一条为准。 */
export function latestPerMarketDate(records: DashboardSnapshotRecord[]): DashboardSnapshotRecord[] {
  const byDate = new Map<string, DashboardSnapshotRecord>();
  for (const record of records) byDate.set(record.marketDate, record);
  return [...byDate.values()].sort((a, b) => a.marketDate.localeCompare(b.marketDate));
}

/** 读回历史快照（按写入顺序，最新的在最后）。 */
export async function readSnapshots(
  limit = 400,
  storage: SnapshotStorage = resolveSnapshotStorage(),
): Promise<DashboardSnapshotRecord[]> {
  try {
    const lines = await storage.readAllLines(limit);
    const records: DashboardSnapshotRecord[] = [];
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        records.push(JSON.parse(line) as DashboardSnapshotRecord);
      } catch {
        // 跳过损坏行
      }
    }
    return records.slice(-limit);
  } catch {
    return [];
  }
}
