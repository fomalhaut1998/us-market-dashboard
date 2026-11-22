import type { SignalConfidence, SignalDimension, SignalMetricKey } from "@/types/market";

/**
 * 估值数据"陈旧"门槛（天）。
 * 当真实值已滞后但 Multpl 提供近期估算值时，会以估算口径参与判断；
 * 若连最新可用观测都超过该天数，则视为陈旧：只展示、不参与倍率计算。
 */
export const VALUATION_STALE_DAYS = 45;

export interface ValuationMultiplierBand {
  minPercentile: number;
  multiplier: "0.25×" | "0.5×";
  label: string;
}

/**
 * 估值档（从高到低匹配）：标普500 PE 近5年分位达到下限，就把投入倍率压到该档。
 * 估值优先于情绪加码——高位不追、只留小额定投。
 */
export const VALUATION_MULTIPLIER_BANDS: ValuationMultiplierBand[] = [
  { minPercentile: 90, multiplier: "0.25×", label: "处于极高估值区间" },
  { minPercentile: 80, multiplier: "0.5×", label: "处于偏高估值区间" },
];

/**
 * 信号置信度。RSI(6) 是纯短线噪声指标；QQQ 200 日均线是慢变量，
 * 且与 52 周回撤高度相关。两者单独触发（或仅同维度触发）都不足以把倍率顶到 2×，
 * 必须有跨维度指标来确认。
 */
export const SIGNAL_CONFIDENCE: Record<SignalMetricKey, SignalConfidence> = {
  vix: "high",
  fearGreed: "high",
  rsi6: "low",
  pePercentile: "high",
  drawdown52w: "high",
  qqq200d: "low",
};

/** 信号独立维度：避免同一维度的低置信指标自我确认。 */
export const SIGNAL_DIMENSION: Record<SignalMetricKey, SignalDimension> = {
  vix: "volatility",
  fearGreed: "sentiment",
  rsi6: "price",
  pePercentile: "valuation",
  drawdown52w: "price",
  qqq200d: "price",
};

/** 低置信信号需要凑满几项触发，才算互相确认、允许升到 2×。 */
export const LOW_CONFIDENCE_CONFIRMATIONS = 2;

/** 低置信确认至少需要跨越几个独立维度。 */
export const MIN_CONFIRMATION_DIMENSIONS = 2;
