import "server-only";

import { BREADTH_BANDS } from "@/config/thresholds";
import type { BreadthData, BreadthState, DailyBar } from "@/types/market";
import { fetchBarsWithFallback } from "./marketData";

const SOURCE = "RSP（标普500等权）与 SPY";
/** 等权 ETF：和 SPY 同口径（都是美国大盘 ETF），只差加权方式。 */
const RSP_SYMBOL = "RSP";
/**
 * 单独给 2 小时缓存：这一条每天只用一次，没必要跟着整页 30 分钟刷。
 * 手动刷新也不会重复消耗额度 —— 免费档是 8 次/分钟，整页一次刷新正好 8 个 credit。
 */
const RSP_CACHE_SECONDS = 2 * 60 * 60;

/** 进程内记住上一次成功拉到的序列：遇到 429 时不清空面板。 */
let lastGoodRsp: DailyBar[] = [];

export interface BreadthInputs {
  rsp: DailyBar[];
  source: string | null;
  error: string | null;
}

export async function fetchBreadthInputs(): Promise<BreadthInputs> {
  const { bars, source, error } = await fetchBarsWithFallback(RSP_SYMBOL, {
    forceRefresh: false,
    cacheSeconds: RSP_CACHE_SECONDS,
    nasdaqSymbol: RSP_SYMBOL,
  });
  if (bars.length > 0) {
    lastGoodRsp = bars;
    return { rsp: bars, source, error };
  }
  if (lastGoodRsp.length > 0) {
    return {
      rsp: lastGoodRsp,
      source: "缓存（最近一次成功）",
      error: error ? `${error}（沿用上一次成功获取的样本）` : null,
    };
  }
  return { rsp: [], source: null, error };
}

function average(bars: DailyBar[], end: number, window: number) {
  if (end - window + 1 < 0) return null;
  let sum = 0;
  for (let index = end - window + 1; index <= end; index += 1) sum += bars[index].close;
  return sum / window;
}

/** 最后一个交易日相对 N 日均线的距离（小数，0.0356 表示 +3.56%）。 */
function distanceFromAverage(bars: DailyBar[], window: number) {
  if (bars.length < window) return null;
  const mean = average(bars, bars.length - 1, window);
  if (mean === null || mean === 0) return null;
  return bars[bars.length - 1].close / mean - 1;
}

function returnOver(bars: DailyBar[], sessions: number) {
  if (bars.length <= sessions) return null;
  const past = bars[bars.length - 1 - sessions].close;
  if (!Number.isFinite(past) || past === 0) return null;
  return bars[bars.length - 1].close / past - 1;
}

function resolveBreadthState(gap200: number | null, percentile: number | null): BreadthState {
  if (gap200 === null && percentile === null) return "missing";
  const narrow =
    (gap200 !== null && gap200 <= BREADTH_BANDS.narrowGap) ||
    (percentile !== null && percentile <= BREADTH_BANDS.narrowPercentile);
  const broad =
    gap200 !== null &&
    gap200 >= BREADTH_BANDS.broadGap &&
    percentile !== null &&
    percentile >= BREADTH_BANDS.broadPercentile;
  if (narrow) return "narrow";
  if (broad) return "broad";
  return "neutral";
}

/**
 * 市场宽度：同一天里等权指数与市值权指数谁更强。
 * 比值用可用样本（约 400 个交易日）算分位，所以文案写「近 N 个交易日」而不是「近 5 年」。
 */
export function buildBreadth(spyBars: DailyBar[], inputs: BreadthInputs): BreadthData {
  const rspByDate = new Map(inputs.rsp.map((bar) => [bar.date, bar.close]));
  const spyByDate = new Map(spyBars.map((bar) => [bar.date, bar.close]));

  // 两边都有的交易日在同一条时间轴上对齐，避免拿不同日期相除
  const dates = spyBars.map((bar) => bar.date).filter((date) => rspByDate.has(date));
  const alignedSpy: DailyBar[] = dates.map((date) => ({
    date,
    open: 0,
    high: 0,
    low: 0,
    close: spyByDate.get(date) ?? 0,
    volume: null,
  }));
  const alignedRsp: DailyBar[] = dates.map((date) => ({
    date,
    open: 0,
    high: 0,
    low: 0,
    close: rspByDate.get(date) ?? 0,
    volume: null,
  }));

  const asOf = dates.at(-1) ?? null;
  if (alignedSpy.length < 220 || asOf === null) {
    return {
      rspClose: inputs.rsp.at(-1)?.close ?? null,
      rspDistance200: null,
      spyDistance200: null,
      gap200: null,
      relative20d: null,
      ratioPercentile: null,
      ratioSampleDays: alignedSpy.length,
      state: "missing",
      asOf,
      source: inputs.source ? `${inputs.source} · ${SOURCE}` : SOURCE,
      error: inputs.error ?? (alignedSpy.length < 220 ? "重叠交易日不足，无法计算宽度" : null),
    };
  }

  const rspDistance = distanceFromAverage(alignedRsp, 200);
  const spyDistance = distanceFromAverage(alignedSpy, 200);
  const gap200 = rspDistance !== null && spyDistance !== null ? (rspDistance - spyDistance) * 100 : null;

  const rspReturn = returnOver(alignedRsp, 20);
  const spyReturn = returnOver(alignedSpy, 20);
  const relative20d = rspReturn !== null && spyReturn !== null ? (rspReturn - spyReturn) * 100 : null;

  const ratios = alignedSpy.map((bar, index) => alignedRsp[index].close / bar.close);
  const lastRatio = ratios[ratios.length - 1];
  const ratioPercentile = (ratios.filter((value) => value <= lastRatio).length / ratios.length) * 100;

  return {
    rspClose: alignedRsp[alignedRsp.length - 1].close,
    rspDistance200: rspDistance,
    spyDistance200: spyDistance,
    gap200,
    relative20d,
    ratioPercentile,
    ratioSampleDays: ratios.length,
    state: resolveBreadthState(gap200, ratioPercentile),
    asOf,
    source: inputs.source ? `${inputs.source} · ${SOURCE}` : SOURCE,
    error: inputs.error,
  };
}
