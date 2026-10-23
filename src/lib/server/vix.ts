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
  VixQuoteData,
  VixQuoteSession,
} from "@/types/market";

const CBOE_INDEX_BASE_URL = "https://cdn.cboe.com/api/global/us_indices/daily_prices";
const YAHOO_VIX_CHART_URL =
  "https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1m&range=1d&includePrePost=true";
const CBOE_VIX_QUOTE_URL = "https://cdn.cboe.com/api/global/delayed_quotes/quotes/_VIX.json";
/** 盘中报价刷新频率：比整页 30 分钟缓存短，整页缓存重建时能拿到较新的 VIX。 */
const VIX_QUOTE_CACHE_SECONDS = 60;
const VIX_QUOTE_HEADERS = {
  Accept: "application/json",
  "User-Agent":
    "Mozilla/5.0 (compatible; us-market-dashboard; +https://github.com/fomalhaut1998/us-market-dashboard)",
} as const;

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

export interface VixQuoteResult {
  quote: VixQuoteData | null;
  error: string | null;
}

interface YahooVixChartResponse {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        regularMarketTime?: number;
        chartPreviousClose?: number;
        previousClose?: number;
        regularMarketChangePercent?: number;
      };
    }>;
  };
}

interface CboeVixQuoteResponse {
  timestamp?: string;
  data?: {
    current_price?: number;
    prev_day_close?: number;
    close?: number;
  };
}

function resolveUsSession(now = new Date()): { session: VixQuoteSession; label: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  const weekday = part("weekday");
  const hour = Number(part("hour"));
  const minute = Number(part("minute"));

  if (weekday === "Sat" || weekday === "Sun") return { session: "closed", label: "最近收盘" };

  const minutes = hour * 60 + minute;
  if (minutes >= 9 * 60 + 30 && minutes < 16 * 60) return { session: "regular", label: "盘中" };
  return { session: "closed", label: "最近收盘" };
}

function quoteKind(session: VixQuoteSession) {
  if (session === "regular") return "盘中延迟约15–20分钟";
  return "最近收盘（延迟）";
}

function formatEtQuoteTime(iso: string) {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  const formatted = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  })
    .format(parsed)
    .replaceAll("/", "-");
  return `${formatted} 美东`;
}

/** 盘中但报价超过 60 分钟没更新时，按最近收盘标记，避免把昨天的收盘说成盘中价。 */
function settleQuoteSession(
  market: { session: VixQuoteSession; label: string },
  quoteTime: string,
): { session: VixQuoteSession; label: string } {
  if (market.session !== "regular") return market;
  const age = Date.now() - new Date(quoteTime).getTime();
  if (Number.isFinite(age) && age > 60 * 60 * 1000) {
    return { session: "closed", label: "最近收盘" };
  }
  return market;
}

function parseCboeQuoteTime(value: string | undefined) {
  if (!value) return new Date().toISOString();
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const withZone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(normalized) ? normalized : `${normalized}Z`;
  const parsed = new Date(withZone);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

async function fetchYahooVixQuote(forceRefresh: boolean): Promise<VixQuoteData> {
  const response = await fetch(YAHOO_VIX_CHART_URL, {
    headers: VIX_QUOTE_HEADERS,
    ...(forceRefresh ? { cache: "no-store" as const } : { next: { revalidate: VIX_QUOTE_CACHE_SECONDS } }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const payload = (await response.json()) as YahooVixChartResponse;
  const meta = payload.chart?.result?.[0]?.meta;
  const value = Number(meta?.regularMarketPrice);
  const quoteTimeSeconds = Number(meta?.regularMarketTime);
  if (!Number.isFinite(value) || value <= 0) throw new Error("返回中没有有效的 regularMarketPrice");
  if (!Number.isFinite(quoteTimeSeconds) || quoteTimeSeconds <= 0) {
    throw new Error("返回中没有有效的 regularMarketTime");
  }

  const previousCloseValue = Number(meta?.chartPreviousClose ?? meta?.previousClose);
  const previousClose = Number.isFinite(previousCloseValue) && previousCloseValue > 0 ? previousCloseValue : null;
  const changePercent =
    previousClose !== null
      ? (value / previousClose - 1) * 100
      : Number.isFinite(Number(meta?.regularMarketChangePercent))
        ? Number(meta?.regularMarketChangePercent)
        : null;
  const quoteTime = new Date(quoteTimeSeconds * 1000).toISOString();
  const market = settleQuoteSession(resolveUsSession(), quoteTime);

  return {
    value,
    previousClose,
    changePercent,
    quoteTime,
    quoteTimeLabel: formatEtQuoteTime(quoteTime),
    session: market.session,
    sessionLabel: market.label,
    source: "Yahoo Finance",
    dataKind: quoteKind(market.session),
  };
}

async function fetchCboeVixQuote(forceRefresh: boolean): Promise<VixQuoteData> {
  const response = await fetch(CBOE_VIX_QUOTE_URL, {
    headers: VIX_QUOTE_HEADERS,
    ...(forceRefresh ? { cache: "no-store" as const } : { next: { revalidate: VIX_QUOTE_CACHE_SECONDS } }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const payload = (await response.json()) as CboeVixQuoteResponse;
  const value = Number(payload.data?.current_price);
  if (!Number.isFinite(value) || value <= 0) throw new Error("返回中没有有效的 current_price");

  const previousCloseValue = Number(payload.data?.prev_day_close ?? payload.data?.close);
  const previousClose = Number.isFinite(previousCloseValue) && previousCloseValue > 0 ? previousCloseValue : null;
  const quoteTime = parseCboeQuoteTime(payload.timestamp);
  const market = settleQuoteSession(resolveUsSession(), quoteTime);

  return {
    value,
    previousClose,
    changePercent: previousClose !== null ? (value / previousClose - 1) * 100 : null,
    quoteTime,
    quoteTimeLabel: formatEtQuoteTime(quoteTime),
    session: market.session,
    sessionLabel: market.label,
    source: "Cboe 延迟报价",
    dataKind: market.session === "regular" ? "Cboe 延迟盘中（时间取抓取时刻）" : quoteKind(market.session),
  };
}

/**
 * 取 VIX 盘中报价：Yahoo 的 chart meta 带真实报价时间，作为首选；
 * Cboe 官方 delayed_quotes 只作兜底（它的 last_trade_time 对指数不更新，不能拿来当报价时间）。
 * 两条都失败时返回 null，调用方回退到日线收盘，并在 notices 里说明。
 */
export async function fetchVixQuote(forceRefresh: boolean): Promise<VixQuoteResult> {
  const [yahoo, cboe] = await Promise.allSettled([
    fetchYahooVixQuote(forceRefresh),
    fetchCboeVixQuote(forceRefresh),
  ]);

  if (yahoo.status === "fulfilled") return { quote: yahoo.value, error: null };
  if (cboe.status === "fulfilled") return { quote: cboe.value, error: null };

  const errorText = (reason: unknown) => (reason instanceof Error ? reason.message : "请求失败");
  return {
    quote: null,
    error: `Yahoo Finance：${errorText(yahoo.reason)}；Cboe：${errorText(cboe.reason)}`,
  };
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
