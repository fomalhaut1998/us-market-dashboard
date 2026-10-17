import "server-only";

import { MARKET_CACHE_SECONDS, MARKET_INSTRUMENTS, VIX_INSTRUMENT } from "@/config/market";
import type { DailyBar, MarketKey, MarketSeries } from "@/types/market";

interface TwelveDataValue {
  datetime?: string;
  open?: string | number;
  high?: string | number;
  low?: string | number;
  close?: string | number;
  volume?: string | number | null;
}

interface TwelveDataResponse {
  status?: string;
  code?: number;
  message?: string;
  values?: TwelveDataValue[];
}

interface NasdaqRow {
  date?: string;
  open?: string;
  high?: string;
  low?: string;
  close?: string;
  volume?: string;
}

interface NasdaqResponse {
  data?: {
    tradesTable?: {
      rows?: NasdaqRow[];
    };
  };
}

interface FmpRow {
  date?: string;
  open?: number | string;
  high?: number | string;
  low?: number | string;
  close?: number | string;
  /** light 接口只返回收盘价，字段名是 price。 */
  price?: number | string;
  volume?: number | string | null;
}

/** Twelve Data 触发 429 后暂停请求的时间：免费档 8 credit/分钟，冷却期间直接走备用源。 */
const TWELVE_COOLDOWN_MS = 5 * 60 * 1000;
const FALLBACK_TIMEOUT_MS = 15_000;

let twelveCooldownUntil = 0;
/** 进程内记住每个符号最近一次成功的数据：所有源都失败时不清空面板。 */
const lastGoodBars = new Map<string, DailyBar[]>();

function twelveCooldownRemainingMs() {
  return Math.max(0, twelveCooldownUntil - Date.now());
}

function markTwelveLimited() {
  twelveCooldownUntil = Date.now() + TWELVE_COOLDOWN_MS;
}

function asFiniteNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function toDailyBar(value: TwelveDataValue): DailyBar | null {
  if (!value.datetime) return null;
  const open = asFiniteNumber(value.open);
  const high = asFiniteNumber(value.high);
  const low = asFiniteNumber(value.low);
  const close = asFiniteNumber(value.close);
  if (open === null || high === null || low === null || close === null) return null;

  return {
    date: value.datetime.slice(0, 10),
    open,
    high,
    low,
    close,
    volume: asFiniteNumber(value.volume),
  };
}

function toNasdaqDailyBar(row: NasdaqRow): DailyBar | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(row.date ?? "");
  if (!match) return null;
  const open = asFiniteNumber(row.open);
  const high = asFiniteNumber(row.high);
  const low = asFiniteNumber(row.low);
  const close = asFiniteNumber(row.close);
  if (open === null || high === null || low === null || close === null) return null;

  return {
    date: `${match[3]}-${match[1]}-${match[2]}`,
    open,
    high,
    low,
    close,
    volume: asFiniteNumber(row.volume),
  };
}

function toFmpDailyBar(row: FmpRow): DailyBar | null {
  const close = asFiniteNumber(row.close ?? row.price);
  const open = asFiniteNumber(row.open) ?? close;
  const high = asFiniteNumber(row.high) ?? close;
  const low = asFiniteNumber(row.low) ?? close;
  if (!row.date || close === null || open === null || high === null || low === null) return null;

  return {
    date: row.date.slice(0, 10),
    open,
    high,
    low,
    close,
    volume: asFiniteNumber(row.volume),
  };
}

function getProviderSymbol(key: MarketKey, defaultSymbol: string) {
  if (key === "ixic") return process.env.TWELVE_DATA_NASDAQ_SYMBOL?.trim() || defaultSymbol;
  if (key === "vix") return process.env.TWELVE_DATA_VIX_SYMBOL?.trim() || defaultSymbol;
  return defaultSymbol;
}

function sortBars(bars: DailyBar[]) {
  return bars.sort((left, right) => left.date.localeCompare(right.date));
}

function cacheHit(source: string, providerSymbol: string) {
  const bars = lastGoodBars.get(providerSymbol);
  return bars && bars.length > 0 ? { bars, source, error: null } : null;
}

export interface TwelveDataBarsResult {
  bars: DailyBar[];
  error: string | null;
}

/** 只走 Twelve Data 的日线请求；429 后进入冷却，冷却期内不再发请求。 */
export async function fetchTwelveDataBars(
  providerSymbol: string,
  forceRefresh: boolean,
  cacheSeconds: number = MARKET_CACHE_SECONDS,
): Promise<TwelveDataBarsResult> {
  const apiKey = process.env.TWELVE_DATA_API_KEY?.trim();
  if (!apiKey) return { bars: [], error: "缺少 TWELVE_DATA_API_KEY" };

  const cooling = twelveCooldownRemainingMs();
  if (cooling > 0) {
    return { bars: [], error: `Twelve Data 限流冷却中（约 ${Math.ceil(cooling / 60_000)} 分钟后重试）` };
  }

  const url = new URL("https://api.twelvedata.com/time_series");
  url.searchParams.set("symbol", providerSymbol);
  url.searchParams.set("interval", "1day");
  url.searchParams.set("outputsize", "400");
  url.searchParams.set("order", "asc");
  url.searchParams.set("adjust", "splits");

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `apikey ${apiKey}`,
      },
      ...(forceRefresh ? { cache: "no-store" as const } : { next: { revalidate: cacheSeconds } }),
      signal: AbortSignal.timeout(15_000),
    });

    if (response.status === 429) {
      markTwelveLimited();
      throw new Error("HTTP 429（额度用尽）");
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const payload = (await response.json()) as TwelveDataResponse;
    if (payload.code === 429 || payload.status === "error" || !Array.isArray(payload.values)) {
      const message = payload.message || `Twelve Data 返回错误 ${payload.code ?? "unknown"}`;
      if (payload.code === 429 || /limit|quota|credits/i.test(message)) markTwelveLimited();
      throw new Error(message);
    }

    const bars = sortBars(
      payload.values.map(toDailyBar).filter((bar): bar is DailyBar => bar !== null),
    );
    if (bars.length === 0) throw new Error("行情响应中没有有效日线");

    lastGoodBars.set(providerSymbol, bars);
    return { bars, error: null };
  } catch (error) {
    return { bars: [], error: error instanceof Error ? error.message : "行情请求失败" };
  }
}

/** 备用源一：Nasdaq 官方历史行情（ETF 免费、无需 key）。 */
async function fetchNasdaqBars(symbol: string, forceRefresh: boolean, cacheSeconds: number) {
  const today = new Date();
  const from = new Date(today);
  from.setUTCFullYear(from.getUTCFullYear() - 2);

  const url = new URL(`https://api.nasdaq.com/api/quote/${encodeURIComponent(symbol)}/historical`);
  url.searchParams.set("assetclass", "etf");
  url.searchParams.set("fromdate", from.toISOString().slice(0, 10));
  url.searchParams.set("todate", today.toISOString().slice(0, 10));
  url.searchParams.set("limit", "500");

  try {
    // 备用源在高并发下偶发超时，重试一次即可。
    let response: Response | null = null;
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        response = await fetch(url, {
          headers: {
            Accept: "application/json, text/plain, */*",
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
          },
          ...(forceRefresh ? { cache: "no-store" as const } : { next: { revalidate: cacheSeconds } }),
          signal: AbortSignal.timeout(FALLBACK_TIMEOUT_MS),
        });
        break;
      } catch (error) {
        lastError = error;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
    if (!response) throw lastError instanceof Error ? lastError : new Error("Nasdaq 请求失败");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const payload = (await response.json()) as NasdaqResponse;
    const rows = payload.data?.tradesTable?.rows ?? [];
    // 裁到 400 根，和 Twelve Data 的 outputsize 对齐，避免换源后分位样本长度变化。
    const bars = sortBars(rows.map(toNasdaqDailyBar).filter((bar): bar is DailyBar => bar !== null)).slice(-400);
    if (bars.length < 120) throw new Error(`仅取得 ${bars.length} 个交易日`);

    lastGoodBars.set(symbol, bars);
    return { bars, error: null as string | null };
  } catch (error) {
    return { bars: [] as DailyBar[], error: error instanceof Error ? error.message : "Nasdaq 行情请求失败" };
  }
}

/** 备用源二：FMP 新版 stable 接口（免费 key 覆盖 SPY、^IXIC 等）。 */
async function fetchFmpBars(symbol: string, forceRefresh: boolean, cacheSeconds: number) {
  const apiKey = process.env.FMP_API_KEY?.trim();
  if (!apiKey) return { bars: [] as DailyBar[], error: "缺少 FMP_API_KEY" };

  const url = new URL("https://financialmodelingprep.com/stable/historical-price-eod/light");
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("apikey", apiKey);

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      ...(forceRefresh ? { cache: "no-store" as const } : { next: { revalidate: cacheSeconds } }),
      signal: AbortSignal.timeout(FALLBACK_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) throw new Error("FMP 返回了无法识别的行情格式");

    const bars = sortBars(
      payload.map((row) => toFmpDailyBar(row as FmpRow)).filter((bar): bar is DailyBar => bar !== null),
    ).slice(-400);
    if (bars.length < 120) throw new Error(`仅取得 ${bars.length} 个交易日`);

    lastGoodBars.set(symbol, bars);
    return { bars, error: null as string | null };
  } catch (error) {
    return { bars: [] as DailyBar[], error: error instanceof Error ? error.message : "FMP 行情请求失败" };
  }
}

export interface FallbackBarsResult {
  bars: DailyBar[];
  /** 实际提供数据的源；全部失败时为 null。 */
  source: string | null;
  error: string | null;
}

export interface FallbackBarsOptions {
  forceRefresh: boolean;
  cacheSeconds?: number;
  /** 该符号在 Nasdaq 的 ETF 代码；为空表示 Nasdaq 不支持它。 */
  nasdaqSymbol?: string | null;
  /** 该符号在 FMP 的代码（指数用 ^ 前缀）。 */
  fmpSymbol?: string | null;
}

/**
 * 行情获取顺序：Twelve Data → Nasdaq → FMP → 上一次成功的数据。
 * 任何一层拿到 >=120 根日线就停；全部失败时把三层的错误合并成一条。
 */
export async function fetchBarsWithFallback(
  providerSymbol: string,
  options: FallbackBarsOptions,
): Promise<FallbackBarsResult> {
  const cacheSeconds = options.cacheSeconds ?? MARKET_CACHE_SECONDS;
  const errors: string[] = [];

  const primary = await fetchTwelveDataBars(providerSymbol, options.forceRefresh, cacheSeconds);
  if (primary.bars.length > 0) {
    lastGoodBars.set(providerSymbol, primary.bars);
    return { bars: primary.bars, source: "Twelve Data", error: null };
  }
  if (primary.error) errors.push(`Twelve Data: ${primary.error}`);

  if (options.nasdaqSymbol) {
    const nasdaq = await fetchNasdaqBars(options.nasdaqSymbol, options.forceRefresh, cacheSeconds);
    if (nasdaq.bars.length > 0) {
      lastGoodBars.set(providerSymbol, nasdaq.bars);
      return { bars: nasdaq.bars, source: "Nasdaq", error: null };
    }
    if (nasdaq.error) errors.push(`Nasdaq: ${nasdaq.error}`);
  }

  if (options.fmpSymbol) {
    const fmp = await fetchFmpBars(options.fmpSymbol, options.forceRefresh, cacheSeconds);
    if (fmp.bars.length > 0) {
      lastGoodBars.set(providerSymbol, fmp.bars);
      return { bars: fmp.bars, source: "Financial Modeling Prep", error: null };
    }
    if (fmp.error) errors.push(`FMP: ${fmp.error}`);
  }

  const cached = cacheHit("缓存", providerSymbol);
  if (cached) {
    return { bars: cached.bars, source: "缓存（最近一次成功）", error: `${errors.join("；")}（沿用上一次成功获取的样本）` };
  }

  return { bars: [], source: null, error: errors.join("；") || "所有行情源都不可用" };
}

function instrumentFor(key: MarketKey) {
  return [...MARKET_INSTRUMENTS, VIX_INSTRUMENT].find((instrument) => instrument.key === key) ?? null;
}

export async function fetchTwelveDataSeries(
  key: MarketKey,
  defaultSymbol: string,
  forceRefresh: boolean,
): Promise<MarketSeries> {
  const providerSymbol = getProviderSymbol(key, defaultSymbol);
  const instrument = instrumentFor(key);
  const isEtf = instrument?.assetType === "etf";

  const result = await fetchBarsWithFallback(providerSymbol, {
    forceRefresh,
    nasdaqSymbol: isEtf ? providerSymbol : null,
    fmpSymbol: key === "ixic" ? "^IXIC" : key === "spy" ? "SPY" : null,
  });

  return {
    key,
    providerSymbol,
    source: result.source ?? "Twelve Data",
    dataKind: "日线收盘（延迟）",
    bars: result.bars,
    error: result.error,
  };
}

export async function fetchAllMarketSeries(forceRefresh: boolean) {
  const instruments = [...MARKET_INSTRUMENTS, VIX_INSTRUMENT];
  const results = await Promise.all(
    instruments.map((instrument) =>
      fetchTwelveDataSeries(instrument.key, instrument.providerSymbol, forceRefresh),
    ),
  );

  return Object.fromEntries(results.map((result) => [result.key, result])) as Record<MarketKey, MarketSeries>;
}
