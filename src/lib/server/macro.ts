import "server-only";

import { MACRO_ASSETS, MACRO_CACHE_SECONDS, macroSection, type MacroAssetConfig } from "@/config/macro";
import { calculateRange52Week, calculateReturnOverDays } from "@/lib/indicators";
import type { DailyBar } from "@/types/market";
import type { ChangeTone, MacroAssetView, MacroRange52Week, MacroView } from "@/types/dashboard";

const YAHOO_CHART_BASE = "https://query1.finance.yahoo.com/v8/finance/chart/";
const MACRO_HEADERS = {
  Accept: "application/json",
  "User-Agent":
    "Mozilla/5.0 (compatible; us-market-dashboard; +https://github.com/fomalhaut1998/us-market-dashboard)",
} as const;
const MACRO_SOURCE = "Yahoo Finance";
const MACRO_DATA_KIND = "日线收盘（延迟）";

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          close?: Array<number | null>;
        }>;
      };
    }>;
    error?: {
      code?: string;
      description?: string;
    } | null;
  };
}

interface MacroFetchResult {
  bars: DailyBar[];
  error: string | null;
}

export interface MacroResult {
  view: MacroView;
  /** 供数据源提示使用；有值不代表整页不可用。 */
  errors: string[];
}

/** 进程内保留每个资产最后一次成功样本；Yahoo 偶发 429/超时时不让卡片直接变空。 */
const lastGoodBars = new Map<string, DailyBar[]>();

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function parseYahooBars(payload: YahooChartResponse): DailyBar[] {
  const result = payload.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const closes = result?.indicators?.quote?.[0]?.close ?? [];
  const bars: DailyBar[] = [];

  for (let index = 0; index < Math.min(timestamps.length, closes.length); index += 1) {
    const timestamp = Number(timestamps[index]);
    const close = Number(closes[index]);
    if (!Number.isFinite(timestamp) || timestamp <= 0) continue;
    if (!Number.isFinite(close) || close <= 0) continue;
    bars.push({
      date: new Date(timestamp * 1000).toISOString().slice(0, 10),
      open: close,
      high: close,
      low: close,
      close,
      volume: null,
    });
  }

  return bars;
}

async function fetchYahooDaily(symbol: string, forceRefresh: boolean): Promise<MacroFetchResult> {
  const url = `${YAHOO_CHART_BASE}${encodeURIComponent(symbol)}?interval=1d&range=2y&includePrePost=false`;
  try {
    const response = await fetch(url, {
      headers: MACRO_HEADERS,
      ...(forceRefresh
        ? { cache: "no-store" as const }
        : { next: { revalidate: MACRO_CACHE_SECONDS } }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const payload = (await response.json()) as YahooChartResponse;
    if (payload.chart?.error) {
      throw new Error(payload.chart.error.description ?? payload.chart.error.code ?? "返回错误");
    }

    const bars = parseYahooBars(payload);
    if (bars.length < 60) throw new Error(`有效日线不足 60 根（${bars.length} 根）`);

    lastGoodBars.set(symbol, bars);
    return { bars, error: null };
  } catch (error) {
    const message = errorText(error);
    const cached = lastGoodBars.get(symbol);
    if (cached && cached.length > 0) {
      return { bars: cached, error: `${message}（沿用上一次成功样本）` };
    }
    return { bars: [], error: message };
  }
}

function formatPrice(value: number, decimals: number) {
  return `$${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)}`;
}

function formatValue(config: MacroAssetConfig, value: number) {
  return config.kind === "yield" ? `${value.toFixed(2)}%` : formatPrice(value, config.decimals);
}

function rangeLabel(config: MacroAssetConfig, value: number) {
  return config.kind === "yield" ? `${value.toFixed(2)}%` : formatPrice(value, config.decimals);
}

function positionBandLabel(position: number) {
  if (position >= 75) return "接近一年高点";
  if (position >= 25) return "区间中部";
  return "接近一年低点";
}

function buildRange52Week(config: MacroAssetConfig, bars: DailyBar[]): MacroRange52Week | null {
  const range = calculateRange52Week(bars);
  if (!range) return null;
  return {
    lowLabel: rangeLabel(config, range.low),
    highLabel: rangeLabel(config, range.high),
    positionLabel: positionBandLabel(range.position),
    positionPct: Math.min(100, Math.max(0, range.position)),
  };
}

function change20d(config: MacroAssetConfig, bars: DailyBar[]): number | null {
  if (config.kind === "yield") {
    const latest = bars.at(-1);
    const prior = bars.at(-21);
    if (!latest || !prior) return null;
    return latest.close - prior.close;
  }
  return calculateReturnOverDays(bars, 20);
}

function formatChange(config: MacroAssetConfig, change: number | null) {
  if (change === null || !Number.isFinite(change)) return "暂无数据";
  if (config.kind === "yield") {
    const basisPoints = change * 100;
    if (Math.abs(basisPoints) < 0.05) return "0 bp";
    const sign = basisPoints > 0 ? "+" : "";
    const decimals = Math.abs(basisPoints) < 10 ? 1 : 0;
    return `${sign}${basisPoints.toFixed(decimals)} bp`;
  }
  const percent = change * 100;
  const rounded = Math.abs(percent) < 0.05 ? 0 : percent;
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded.toFixed(1)}%`;
}

function toneOf(change: number | null): ChangeTone {
  if (change === null || !Number.isFinite(change) || Math.abs(change) < 1e-9) return "neutral";
  return change > 0 ? "positive" : "negative";
}

function buildAssetView(config: MacroAssetConfig, result: MacroFetchResult): MacroAssetView {
  const latest = result.bars.at(-1) ?? null;
  const change = latest ? change20d(config, result.bars) : null;

  return {
    key: config.key,
    name: config.name,
    symbolLabel: config.symbolLabel,
    value: latest ? formatValue(config, latest.close) : "暂无数据",
    changeLabel: formatChange(config, change),
    changeTone: toneOf(change),
    range52w: latest ? buildRange52Week(config, result.bars) : null,
    hint: config.hint,
    asOf: latest?.date ?? null,
    source: MACRO_SOURCE,
    dataKind: MACRO_DATA_KIND,
    error: result.error,
  };
}

function buildMacroView(results: Array<{ config: MacroAssetConfig; result: MacroFetchResult }>): MacroResult {
  const assets = results.map(({ config, result }) => buildAssetView(config, result));
  const errors = assets
    .filter((asset) => asset.error)
    .map((asset) => `${asset.name}: ${asset.error}`);
  const latestDate = assets
    .map((asset) => asset.asOf)
    .filter((date): date is string => Boolean(date))
    .sort()
    .at(-1);

  return {
    view: {
      title: macroSection.title,
      description: macroSection.description,
      asOfLabel: latestDate
        ? `${MACRO_SOURCE} · ${latestDate} 收盘（延迟；各资产日期可能不同）`
        : `${MACRO_SOURCE} · 暂无数据`,
      assets,
      note: macroSection.note,
    },
    errors,
  };
}

/** 四个资产并行取数；单个资产失败只影响自己的卡片，不阻塞主行情。 */
export async function fetchMacroView(forceRefresh: boolean): Promise<MacroResult> {
  const results = await Promise.all(
    MACRO_ASSETS.map(async (config) => ({
      config,
      result: await fetchYahooDaily(config.symbol, forceRefresh),
    })),
  );
  return buildMacroView(results);
}
