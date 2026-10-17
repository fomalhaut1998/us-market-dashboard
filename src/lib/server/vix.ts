import "server-only";

import { MARKET_CACHE_SECONDS } from "@/config/market";
import { TERM_STRUCTURE_BANDS } from "@/config/thresholds";
import { latestOnOrBefore } from "@/lib/peHistory";
import type {
  DailyBar,
  MarketSeries,
  TailRiskData,
  TermStructureData,
  TermStructureState,
} from "@/types/market";

const CBOE_INDEX_BASE_URL = "https://cdn.cboe.com/api/global/us_indices/daily_prices";

const CBOE_FILES = {
  vix: "VIX_History.csv",
  vix9d: "VIX9D_History.csv",
  vix3m: "VIX3M_History.csv",
  skew: "SKEW_History.csv",
  vvix: "VVIX_History.csv",
} as const;

function parseCboeDate(value: string) {
  const trimmed = value.trim();
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (!match) return trimmed.slice(0, 10);
  return `${match[3]}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
}

/** 多个请求的错误合并成一条：相同文案只留一次（同一个网络错误会被两条曲线各报一次）。 */
function joinErrors(errors: Array<string | null>) {
  const unique = [...new Set(errors.filter((error): error is string => Boolean(error)))];
  return unique.join("；") || null;
}

function parseNumber(value: string) {
  const parsed = Number.parseFloat(value.replaceAll('"', "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

interface CboeBarsResult {
  bars: DailyBar[];
  error: string | null;
}

/** Cboe 指数日线 CSV 都是同一套表头（DATE/OPEN/HIGH/LOW/CLOSE），按文件名复用解析。 */
async function fetchCboeDailyBars(file: string, forceRefresh: boolean): Promise<CboeBarsResult> {
  try {
    const response = await fetch(`${CBOE_INDEX_BASE_URL}/${file}`, {
      headers: { Accept: "text/csv" },
      ...(forceRefresh ? { cache: "no-store" as const } : { next: { revalidate: MARKET_CACHE_SECONDS } }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const rows = (await response.text()).trim().split(/\r?\n/);
    const header = rows.shift()?.split(",").map((value) => value.replaceAll('"', "").trim().toUpperCase());
    if (!header) throw new Error("Cboe CSV 缺少表头");

    const indexes = {
      date: header.indexOf("DATE"),
      open: header.indexOf("OPEN"),
      high: header.indexOf("HIGH"),
      low: header.indexOf("LOW"),
      close: header.indexOf("CLOSE"),
    };

    if (Object.values(indexes).some((index) => index < 0)) {
      throw new Error(`Cboe CSV 字段结构已变化（${file}）`);
    }

    const bars = rows
      .map((row): DailyBar | null => {
        const columns = row.split(",");
        const open = parseNumber(columns[indexes.open] ?? "");
        const high = parseNumber(columns[indexes.high] ?? "");
        const low = parseNumber(columns[indexes.low] ?? "");
        const close = parseNumber(columns[indexes.close] ?? "");
        if (open === null || high === null || low === null || close === null) return null;
        return {
          date: parseCboeDate(columns[indexes.date] ?? ""),
          open,
          high,
          low,
          close,
          volume: null,
        };
      })
      .filter((bar): bar is DailyBar => bar !== null)
      .sort((left, right) => left.date.localeCompare(right.date));

    if (bars.length === 0) throw new Error(`Cboe CSV 中没有有效日线（${file}）`);

    return { bars, error: null };
  } catch (error) {
    return {
      bars: [],
      error: error instanceof Error ? error.message : `Cboe ${file} 请求失败`,
    };
  }
}

export interface LevelPoint {
  date: string;
  value: number;
}

interface CboeLevelsResult {
  points: LevelPoint[];
  error: string | null;
}

/**
 * SKEW / VVIX 的 CSV 只有两列（DATE + 指标名），没有 OHLC，
 * 所以单独一个解析器：取 DATE 之后第一个能解析成数字的列。
 */
async function fetchCboeLevelSeries(file: string, forceRefresh: boolean): Promise<CboeLevelsResult> {
  try {
    const response = await fetch(`${CBOE_INDEX_BASE_URL}/${file}`, {
      headers: { Accept: "text/csv" },
      ...(forceRefresh ? { cache: "no-store" as const } : { next: { revalidate: MARKET_CACHE_SECONDS } }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const rows = (await response.text()).trim().split(/\r?\n/);
    const header = rows.shift()?.split(",").map((value) => value.replaceAll('"', "").trim().toUpperCase());
    if (!header) throw new Error("Cboe CSV 缺少表头");

    const dateIndex = header.indexOf("DATE");
    const valueIndex = header.findIndex((name, index) => index !== dateIndex && name !== "");
    if (dateIndex < 0 || valueIndex < 0) {
      throw new Error(`Cboe CSV 字段结构已变化（${file}）`);
    }

    const points = rows
      .map((row): LevelPoint | null => {
        const columns = row.split(",");
        const value = parseNumber(columns[valueIndex] ?? "");
        if (value === null) return null;
        return { date: parseCboeDate(columns[dateIndex] ?? ""), value };
      })
      .filter((point): point is LevelPoint => point !== null)
      .sort((left, right) => left.date.localeCompare(right.date));

    if (points.length === 0) throw new Error(`Cboe CSV 中没有有效数据（${file}）`);

    return { points, error: null };
  } catch (error) {
    return {
      points: [],
      error: error instanceof Error ? error.message : `Cboe ${file} 请求失败`,
    };
  }
}

export async function fetchCboeVixHistory(forceRefresh: boolean): Promise<MarketSeries> {
  const { bars, error } = await fetchCboeDailyBars(CBOE_FILES.vix, forceRefresh);
  return {
    key: "vix",
    providerSymbol: "VIX",
    source: "Cboe",
    dataKind: "官方日线收盘",
    bars,
    error,
  };
}

export async function resolveVixSeries(primary: MarketSeries, forceRefresh: boolean) {
  if (primary.bars.length > 0) return primary;
  return fetchCboeVixHistory(forceRefresh);
}

export interface TermStructureInputs {
  vix9d: DailyBar[];
  vix3m: DailyBar[];
  error: string | null;
}

/** 只负责把 9 天 / 3 个月的日线拿回来，和 VIX 主序列并行请求。 */
export async function fetchCboeTermStructureInputs(forceRefresh: boolean): Promise<TermStructureInputs> {
  const [nine, three] = await Promise.all([
    fetchCboeDailyBars(CBOE_FILES.vix9d, forceRefresh),
    fetchCboeDailyBars(CBOE_FILES.vix3m, forceRefresh),
  ]);
  return {
    vix9d: nine.bars,
    vix3m: three.bars,
    error: joinErrors([nine.error, three.error]),
  };
}

function resolveTermStructureState(ratio: number | null): TermStructureState {
  if (ratio === null) return "missing";
  if (ratio >= TERM_STRUCTURE_BANDS.backwardation) return "backwardation";
  if (ratio >= TERM_STRUCTURE_BANDS.flat) return "flat";
  return "contango";
}

/**
 * 把三条曲线对齐到同一个交易日再相除。
 * 取三条序列最新日期的"最小值"作为基准日，避免某一条更新得早导致跨日相除。
 */
export function buildTermStructure(vix: MarketSeries, inputs: TermStructureInputs): TermStructureData {
  const latestDates = [vix.bars.at(-1)?.date, inputs.vix9d.at(-1)?.date, inputs.vix3m.at(-1)?.date]
    .filter((date): date is string => Boolean(date))
    .sort();
  const asOf = latestDates[0] ?? null;

  const closeOn = (bars: DailyBar[]) =>
    asOf === null ? (bars.at(-1)?.close ?? null) : (latestOnOrBefore(bars, asOf)?.close ?? null);

  const vix30d = closeOn(vix.bars);
  const vix9d = closeOn(inputs.vix9d);
  const vix3m = closeOn(inputs.vix3m);

  const ratio = vix30d !== null && vix3m !== null && vix3m > 0 ? vix30d / vix3m : null;
  const frontRatio = vix9d !== null && vix30d !== null && vix30d > 0 ? vix9d / vix30d : null;

  return {
    vix9d,
    vix30d,
    vix3m,
    ratio,
    frontRatio,
    state: resolveTermStructureState(ratio),
    asOf,
    source: "Cboe 指数日线",
    error: inputs.error,
  };
}

export interface TailRiskInputs {
  skew: LevelPoint[];
  vvix: LevelPoint[];
  error: string | null;
}

/** 只负责把 SKEW / VVIX 拿回来，和期限结构并行请求。 */
export async function fetchCboeTailRiskInputs(forceRefresh: boolean): Promise<TailRiskInputs> {
  const [skew, vvix] = await Promise.all([
    fetchCboeLevelSeries(CBOE_FILES.skew, forceRefresh),
    fetchCboeLevelSeries(CBOE_FILES.vvix, forceRefresh),
  ]);
  return {
    skew: skew.points,
    vvix: vvix.points,
    error: joinErrors([skew.error, vvix.error]),
  };
}

function latestLevelOnOrBefore(points: LevelPoint[], asOf: string) {
  for (let index = points.length - 1; index >= 0; index -= 1) {
    if (points[index].date <= asOf) return points[index];
  }
  return null;
}

function shiftYears(date: string, years: number) {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  parsed.setUTCFullYear(parsed.getUTCFullYear() + years);
  return parsed.toISOString().slice(0, 10);
}

/** 分位：近 5 年样本中「小于或等于当前值」的占比（0–100）。样本不足半年时返回 null。 */
function percentileRank(points: LevelPoint[], asOf: string, value: number, years = 5) {
  const from = shiftYears(asOf, -years);
  const window = points.filter((point) => point.date >= from && point.date <= asOf);
  if (window.length < 120) return null;
  const below = window.filter((point) => point.value <= value).length;
  return (below / window.length) * 100;
}

/** SKEW / VVIX 也按同一个交易日对齐，避免一条更新得早导致日期错位。 */
export function buildTailRisk(inputs: TailRiskInputs): TailRiskData {
  const dates = [inputs.skew.at(-1)?.date, inputs.vvix.at(-1)?.date]
    .filter((date): date is string => Boolean(date))
    .sort();
  const asOf = dates[0] ?? null;

  const skew = asOf === null ? null : latestLevelOnOrBefore(inputs.skew, asOf);
  const vvix = asOf === null ? null : latestLevelOnOrBefore(inputs.vvix, asOf);

  return {
    skew: skew?.value ?? null,
    skewPercentile: skew && asOf ? percentileRank(inputs.skew, asOf, skew.value) : null,
    vvix: vvix?.value ?? null,
    vvixPercentile: vvix && asOf ? percentileRank(inputs.vvix, asOf, vvix.value) : null,
    asOf: skew?.date ?? vvix?.date ?? asOf,
    source: "Cboe 指数日线",
    error: inputs.error,
  };
}
