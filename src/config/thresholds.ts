import { SIGNAL_CONFIDENCE } from "@/config/strategy";
import type { SignalEvaluation, SignalMetricKey, SignalState } from "@/types/market";

interface ThresholdRule {
  triggerCondition: string;
  /** up：数值越高越危险（如 VIX）；down：数值越低越危险（如恐惧贪婪、RSI）。 */
  direction: "up" | "down";
  /** 进入触发区的临界值。 */
  triggerAt: number;
  /** 进入观察区的临界值。 */
  nearAt: number;
  evaluate: (value: number) => Exclude<SignalState, "missing" | "stale">;
}

export const SIGNAL_THRESHOLDS: Record<SignalMetricKey, ThresholdRule> = {
  vix: {
    triggerCondition: "≥ 30",
    direction: "up",
    triggerAt: 30,
    nearAt: 25,
    evaluate: (value) => (value >= 30 ? "triggered" : value >= 25 ? "near" : "normal"),
  },
  fearGreed: {
    triggerCondition: "< 25",
    direction: "down",
    triggerAt: 25,
    nearAt: 45,
    evaluate: (value) => (value < 25 ? "triggered" : value < 45 ? "near" : "normal"),
  },
  rsi6: {
    triggerCondition: "≤ 22",
    direction: "down",
    triggerAt: 22,
    nearAt: 28,
    evaluate: (value) => (value <= 22 ? "triggered" : value <= 28 ? "near" : "normal"),
  },
  pePercentile: {
    triggerCondition: "≤ 20%",
    direction: "down",
    triggerAt: 20,
    nearAt: 30,
    evaluate: (value) => (value <= 20 ? "triggered" : value <= 30 ? "near" : "normal"),
  },
  drawdown52w: {
    triggerCondition: "≤ -20%",
    direction: "down",
    triggerAt: -20,
    nearAt: -15,
    evaluate: (value) => (value <= -20 ? "triggered" : value <= -15 ? "near" : "normal"),
  },
  momentum25d: {
    triggerCondition: "≤ -12%",
    direction: "down",
    triggerAt: -12,
    nearAt: -8,
    evaluate: (value) => (value <= -12 ? "triggered" : value <= -8 ? "near" : "normal"),
  },
};

/** 波动率期限结构分档：30 天 VIX ÷ 3 个月 VIX 的比值。 */
export const TERM_STRUCTURE_BANDS = {
  /** ≥ 1 视为倒挂：近端恐慌已经高于远端。 */
  backwardation: 1,
  /** ≥ 0.95 视为走平：两边几乎同价。 */
  flat: 0.95,
} as const;

/** 尾部对冲读数分档：SKEW / VVIX 的近 5 年分位（百分数）。只影响配色，不参与倍率。 */
export const TAIL_RISK_BANDS = {
  /** ≥ 90 分位：极端，历史上少见。 */
  extreme: 90,
  /** ≥ 75 分位：偏高。 */
  elevated: 75,
} as const;

/** 信用利差分档：高收益债 OAS（百分点）。只影响配色与文案，不参与倍率。 */
export const CREDIT_SPREAD_BANDS = {
  /** ≥ 5.0%：信用市场已经在为衰退定价。 */
  stress: 5,
  /** ≥ 3.5%：利差偏高。 */
  elevated: 3.5,
} as const;

/** 市场宽度分档：200 日均线距离差（百分点）与 RSP/SPY 比值分位。只影响配色与文案。 */
export const BREADTH_BANDS = {
  /** 差距 ≤ -5pp，或比值分位 ≤ 10：宽度极窄。 */
  extremeGap: -5,
  extremePercentile: 10,
  /** 差距 ≤ -2pp，或比值分位 ≤ 25：偏窄。 */
  narrowGap: -2,
  narrowPercentile: 25,
  /** 差距 ≥ 0pp 且比值分位 ≥ 50：同步或更广。 */
  broadGap: 0,
  broadPercentile: 50,
} as const;

export function evaluateSignal(key: SignalMetricKey, value: number | null): SignalEvaluation {
  return {
    key,
    value,
    state: value === null || !Number.isFinite(value) ? "missing" : SIGNAL_THRESHOLDS[key].evaluate(value),
    confidence: SIGNAL_CONFIDENCE[key],
  };
}
