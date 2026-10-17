import type { SignalConfidence, SignalMetricKey } from "@/types/market";

/**
 * 估值数据"陈旧"门槛（天）。
 * Multpl 是月度数据，且最近几个月常被标注为估算值、会被剔除，
 * 因此留 45 天余量；超过即视为陈旧：只在界面标注，不参与倍率计算。
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
 * 信号置信度。RSI(6) 是纯短线噪声指标，单独触发不足以把倍率顶到 2×，
 * 必须再有一项触发来确认。
 */
export const SIGNAL_CONFIDENCE: Record<SignalMetricKey, SignalConfidence> = {
  vix: "high",
  fearGreed: "high",
  rsi6: "low",
  pePercentile: "high",
  drawdown52w: "high",
  momentum25d: "high",
};

/** 低置信信号需要凑满几项触发，才算互相确认、允许升到 2×。 */
export const LOW_CONFIDENCE_CONFIRMATIONS = 2;
