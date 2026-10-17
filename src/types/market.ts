export type MarketKey = "spy" | "qqq" | "dia" | "soxx" | "iwm" | "ixic" | "vix";

export interface DailyBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
}

export interface MarketSeries {
  key: MarketKey;
  providerSymbol: string;
  source: string;
  dataKind: string;
  bars: DailyBar[];
  error: string | null;
}

export interface FearGreedData {
  score: number | null;
  rating: string | null;
  source: "CNN";
  dataTime: string | null;
  dataKind: string;
  error: string | null;
}

export interface HistoricalPePoint {
  date: string;
  pe: number;
}

export interface ValuationData {
  currentPe: number | null;
  currentDate: string | null;
  history: HistoricalPePoint[];
  percentile: number | null;
  source: "Multpl";
  dataKind: string;
  historySupported: boolean;
  error: string | null;
  /** 最新非估算 PE 距今天数；没有数据时为 null。 */
  ageDays: number | null;
  /** 数据是否已陈旧（超过 VALUATION_STALE_DAYS）：陈旧值只展示，不参与倍率计算。 */
  stale: boolean;
}

export type SignalMetricKey =
  | "vix"
  | "fearGreed"
  | "rsi6"
  | "pePercentile"
  | "drawdown52w"
  | "momentum25d";

export type SignalState = "triggered" | "near" | "normal" | "missing" | "stale";

/** 信号置信度：低置信指标单独触发时不能把倍率顶到 2×。 */
export type SignalConfidence = "high" | "low";

export interface SignalEvaluation {
  key: SignalMetricKey;
  value: number | null;
  state: SignalState;
  confidence: SignalConfidence;
}

/** 波动率期限结构：9 天 / 30 天 / 3 个月 VIX 指数的相对位置。 */
export type TermStructureState = "contango" | "flat" | "backwardation" | "missing";

/** 尾部对冲需求：SKEW（偏斜）与 VVIX（VIX 的波动率），只作背景读数，不参与倍率。 */
export interface TailRiskData {
  skew: number | null;
  /** SKEW 在近 5 年样本中的分位（0–100）。 */
  skewPercentile: number | null;
  vvix: number | null;
  /** VVIX 在近 5 年样本中的分位（0–100）。 */
  vvixPercentile: number | null;
  asOf: string | null;
  source: string;
  error: string | null;
}

export interface TermStructureData {
  vix9d: number | null;
  vix30d: number | null;
  vix3m: number | null;
  /** 30 天 VIX ÷ 3 个月 VIX；≥1 表示近端高于远端（倒挂）。 */
  ratio: number | null;
  /** 9 天 VIX ÷ 30 天 VIX。 */
  frontRatio: number | null;
  state: TermStructureState;
  asOf: string | null;
  source: string;
  error: string | null;
}

/** 市场宽度：等权（RSP）与市值权（SPY）的相对位置。只作背景读数，不参与倍率。 */
export type BreadthState = "narrow" | "neutral" | "broad" | "missing";

export interface BreadthData {
  rspClose: number | null;
  /** RSP 相对 200 日均线的距离（百分数，3.56 表示 +3.56%）。 */
  rspDistance200: number | null;
  spyDistance200: number | null;
  /** RSP 距 200 日均线 － SPY 距 200 日均线，单位百分点；为负表示等权落后。 */
  gap200: number | null;
  /** 近 20 个交易日 RSP − SPY 相对表现，单位百分点。 */
  relative20d: number | null;
  /** RSP/SPY 比值在可用样本中的分位（0–100）。 */
  ratioPercentile: number | null;
  /** 比值分位用到的样本交易日数。 */
  ratioSampleDays: number | null;
  state: BreadthState;
  asOf: string | null;
  source: string;
  error: string | null;
}

/** 信用利差环境：高收益债期权调整利差（OAS）。只作背景读数，不参与倍率。 */
export type CreditSpreadState = "normal" | "elevated" | "stress" | "missing";

export interface CreditSpreadData {
  /** 高收益债 OAS，单位百分点（3.23 表示 3.23%）。 */
  latest: number | null;
  /** 近 5 年样本中的分位（0–100）。 */
  percentile5y: number | null;
  /** 相对 20 个交易日前的变化，单位百分点。 */
  change20d: number | null;
  state: CreditSpreadState;
  asOf: string | null;
  source: string;
  error: string | null;
}
