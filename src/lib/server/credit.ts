import "server-only";

import { CREDIT_SPREAD_BANDS } from "@/config/thresholds";
import type { CreditSpreadData, CreditSpreadState } from "@/types/market";

const FRED_GRAPH_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv";
const FRED_API_URL = "https://api.stlouisfed.org/fred/series/observations";
/** 免费申请的 FRED key（https://fredaccount.stlouisfed.org/apikeys）。有 key 时优先走官方 JSON 接口，通常 1 秒内返回。 */
const FRED_API_KEY = (process.env.FRED_API_KEY ?? "").trim();
const HY_OAS_SERIES_ID = "BAMLH0A0HYM2";
/** 该序列 T+1 公布、每天只更新一次，没必要跟着行情 30 分钟刷一次。 */
const CREDIT_CACHE_SECONDS = 21_600;
/**
 * FRED 的 CSV 端点会排队：实测正常 1–2s，偶尔挂到 20s+ 甚至不返回。
 * 所以超时放宽到这个值，并且失败时沿用进程内上一次成功的样本。
 */
const FRED_TIMEOUT_MS = 24_000;
/**
 * 页面愿意为这一条最多等多久。等不到就先返回上一次的样本（或空），
 * 后台那次请求继续跑完 —— Next 的 fetch 缓存会把结果留下，下一次请求直接命中。
 * 这样 FRED 卡住时整页不会被它拖慢。
 */
const SOFT_DEADLINE_MS = 6_000;
const SOURCE = "FRED · ICE BofA 美国高收益债 OAS";

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export interface CreditSpreadPoint {
  date: string;
  value: number;
}

export interface CreditSpreadInputs {
  points: CreditSpreadPoint[];
  error: string | null;
}

/** 失败后的冷却期：源站卡住时不要每次刷新页面都白等一个软超时。 */
const FAILURE_COOLDOWN_MS = 10 * 60 * 1000;

/** 进程内记住最后一次成功拉到的样本：FRED 超时时不至于把卡片直接清空。 */
let lastGoodPoints: CreditSpreadPoint[] = [];
/** 冷却截止时间；用户手动点「刷新数据」会绕开它重试一次。 */
let cooldownUntil = 0;

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

/** 请求近 5 年多一点：分位窗口按 5 年算，多留 90 天余量。 */
function requestWindow() {
  const now = new Date();
  const from = new Date(now.getTime() - (5 * 365 + 90) * 24 * 60 * 60 * 1000);
  return { from: isoDate(from), to: isoDate(now) };
}

function csvUrl() {
  const { from, to } = requestWindow();
  return `${FRED_GRAPH_URL}?id=${HY_OAS_SERIES_ID}&cosd=${from}&coed=${to}`;
}

function apiUrl() {
  const { from, to } = requestWindow();
  const params = new URLSearchParams({
    series_id: HY_OAS_SERIES_ID,
    api_key: FRED_API_KEY,
    file_type: "json",
    observation_start: from,
    observation_end: to,
    sort_order: "asc",
  });
  return `${FRED_API_URL}?${params.toString()}`;
}

/** 官方 JSON 接口：有 key 时优先走这条，比 CSV 端点稳定得多。 */
async function fetchCreditSeriesViaApi(forceRefresh: boolean): Promise<CreditSpreadPoint[]> {
  const response = await fetch(apiUrl(), {
    headers: { Accept: "application/json" },
    ...(forceRefresh ? { cache: "no-store" as const } : { next: { revalidate: CREDIT_CACHE_SECONDS } }),
    signal: AbortSignal.timeout(FRED_TIMEOUT_MS),
  });

  if (!response.ok) {
    const detail = await response
      .json()
      .then((payload: { error_message?: string }) => payload.error_message ?? "")
      .catch(() => "");
    throw new Error(`FRED API HTTP ${response.status}${detail ? `：${detail}` : ""}`);
  }

  const payload = (await response.json()) as { observations?: { date?: string; value?: string }[] };
  const points = (payload.observations ?? [])
    .map((row): CreditSpreadPoint | null => {
      const date = (row.date ?? "").trim().slice(0, 10);
      const raw = (row.value ?? "").trim();
      // FRED 用 "." 表示当天没有观测值
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || raw === "" || raw === ".") return null;
      const value = Number.parseFloat(raw);
      return Number.isFinite(value) ? { date, value } : null;
    })
    .filter((point): point is CreditSpreadPoint => point !== null)
    .sort((left, right) => left.date.localeCompare(right.date));

  if (points.length === 0) throw new Error(`FRED API 中没有有效数据（${HY_OAS_SERIES_ID}）`);
  return points;
}

async function fetchCreditSeriesViaCsv(forceRefresh: boolean): Promise<CreditSpreadPoint[]> {
  const response = await fetch(csvUrl(), {
    headers: { Accept: "text/csv" },
    ...(forceRefresh ? { cache: "no-store" as const } : { next: { revalidate: CREDIT_CACHE_SECONDS } }),
    signal: AbortSignal.timeout(FRED_TIMEOUT_MS),
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const rows = (await response.text()).trim().split(/\r?\n/);
  const header = rows.shift()?.split(",").map((value) => value.replaceAll('"', "").trim().toUpperCase());
  if (!header) throw new Error("FRED CSV 缺少表头");

  const dateIndex = header.indexOf("OBSERVATION_DATE");
  const valueIndex = header.findIndex((name, index) => index !== dateIndex && name !== "");
  if (dateIndex < 0 || valueIndex < 0) {
    throw new Error(`FRED CSV 字段结构已变化（${HY_OAS_SERIES_ID}）`);
  }

  const points = rows
    .map((row): CreditSpreadPoint | null => {
      const columns = row.split(",");
      const raw = (columns[valueIndex] ?? "").replaceAll('"', "").trim();
      // FRED 用 "." 表示当天没有观测值
      if (raw === "" || raw === ".") return null;
      const value = Number.parseFloat(raw);
      if (!Number.isFinite(value)) return null;
      const date = (columns[dateIndex] ?? "").replaceAll('"', "").trim().slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
      return { date, value };
    })
    .filter((point): point is CreditSpreadPoint => point !== null)
    .sort((left, right) => left.date.localeCompare(right.date));

  if (points.length === 0) throw new Error(`FRED CSV 中没有有效数据（${HY_OAS_SERIES_ID}）`);

  return points;
}

async function fetchCreditSeries(forceRefresh: boolean): Promise<CreditSpreadPoint[]> {
  if (!FRED_API_KEY) return fetchCreditSeriesViaCsv(forceRefresh);

  try {
    return await fetchCreditSeriesViaApi(forceRefresh);
  } catch (apiError) {
    // 400/401/403 基本就是 key 不对，退回 CSV 也没用，直接把原因报出来。
    if (apiError instanceof Error && /FRED API HTTP (400|401|403)/.test(apiError.message)) throw apiError;
    try {
      return await fetchCreditSeriesViaCsv(forceRefresh);
    } catch (csvError) {
      const apiMessage = apiError instanceof Error ? apiError.message : "FRED API 请求失败";
      const csvMessage = csvError instanceof Error ? csvError.message : "FRED CSV 请求失败";
      throw new Error(`${apiMessage}；${csvMessage}`);
    }
  }
}

function staleReason(fallback: boolean) {
  return fallback ? "（沿用上一次成功获取的样本）" : "";
}

export async function fetchCreditSpreadInputs(forceRefresh: boolean): Promise<CreditSpreadInputs> {
  const now = Date.now();
  if (!forceRefresh && now < cooldownUntil) {
    const minutes = Math.max(1, Math.ceil((cooldownUntil - now) / 60_000));
    return {
      points: lastGoodPoints,
      error: `FRED 最近一次请求失败，${minutes} 分钟内暂停重试${staleReason(lastGoodPoints.length > 0)}`,
    };
  }

  const task = fetchCreditSeries(forceRefresh);
  // 后台任务即使没人等，也要把 rejection 收掉，避免 unhandledRejection；成功时顺手记住样本。
  task.then(
    (points) => {
      lastGoodPoints = points;
    },
    () => undefined,
  );

  // 有 key 时走官方接口（实测国内访问约 3–5s），给更宽松的等待时间；CSV 端点则保持短等待。
  const softDeadlineMs = FRED_API_KEY ? 12_000 : SOFT_DEADLINE_MS;
  const outcome = await Promise.race([
    task.then(
      (points) => ({ ok: true as const, points }),
      (error: unknown) => ({ ok: false as const, error }),
    ),
    delay(softDeadlineMs).then(() => ({ ok: false as const, error: new Error(`FRED 超过 ${softDeadlineMs / 1000} 秒未返回`) })),
  ]);

  if (outcome.ok) {
    cooldownUntil = 0;
    return { points: outcome.points, error: null };
  }

  cooldownUntil = Date.now() + FAILURE_COOLDOWN_MS;
  const message = outcome.error instanceof Error ? outcome.error.message : "FRED 请求失败";
  if (lastGoodPoints.length > 0) {
    return { points: lastGoodPoints, error: `${message}${staleReason(true)}` };
  }
  return { points: [], error: message };
}

function shiftYears(date: string, years: number) {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  parsed.setUTCFullYear(parsed.getUTCFullYear() + years);
  return parsed.toISOString().slice(0, 10);
}

/** 分位：近 5 年样本中「小于或等于当前值」的占比（0–100）。样本不足半年时返回 null。 */
function percentileRank(points: CreditSpreadPoint[], asOf: string, value: number, years = 5) {
  const from = shiftYears(asOf, -years);
  const window = points.filter((point) => point.date >= from && point.date <= asOf);
  if (window.length < 120) return null;
  const below = window.filter((point) => point.value <= value).length;
  return (below / window.length) * 100;
}

function resolveCreditSpreadState(value: number | null): CreditSpreadState {
  if (value === null || !Number.isFinite(value)) return "missing";
  if (value >= CREDIT_SPREAD_BANDS.stress) return "stress";
  if (value >= CREDIT_SPREAD_BANDS.elevated) return "elevated";
  return "normal";
}

export function buildCreditSpread(inputs: CreditSpreadInputs): CreditSpreadData {
  const latest = inputs.points.at(-1) ?? null;
  if (latest === null) {
    return {
      latest: null,
      percentile5y: null,
      change20d: null,
      state: "missing",
      asOf: null,
      source: SOURCE,
      error: inputs.error,
    };
  }

  const reference = inputs.points.at(-21) ?? null;
  return {
    latest: latest.value,
    percentile5y: percentileRank(inputs.points, latest.date, latest.value),
    change20d: reference ? latest.value - reference.value : null,
    state: resolveCreditSpreadState(latest.value),
    asOf: latest.date,
    source: SOURCE,
    error: inputs.error,
  };
}
