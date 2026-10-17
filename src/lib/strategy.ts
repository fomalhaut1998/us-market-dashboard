import {
  LOW_CONFIDENCE_CONFIRMATIONS,
  VALUATION_MULTIPLIER_BANDS,
} from "@/config/strategy";
import type { SignalEvaluation, SignalMetricKey } from "@/types/market";

export type StrategyMultiplier = "0.25×" | "0.5×" | "1×" | "1.5×" | "2×";

export type StrategyStatus = "normal" | "near" | "triggered" | "insufficient" | "valuation";

/** 估值上下文：分位 + 时效。陈旧数据不参与倍率计算。 */
export interface StrategyValuationInput {
  percentile: number | null;
  stale: boolean;
  ageDays: number | null;
}

export interface StrategyDecision {
  multiplier: StrategyMultiplier;
  status: StrategyStatus;
  reason: string;
  missingCount: number;
  valuationBand: string | null;
}

const SIGNAL_LABELS: Record<SignalMetricKey, string> = {
  vix: "VIX",
  fearGreed: "CNN恐惧贪婪",
  rsi6: "RSI(6)",
  pePercentile: "PE近5年分位",
  drawdown52w: "52周回撤",
  momentum25d: "25日涨跌幅",
};

function staleNote(valuation?: StrategyValuationInput) {
  if (!valuation?.stale) return "";
  const lag = valuation.ageDays === null ? "多日" : `${valuation.ageDays} 天`;
  return `PE 分位数据已滞后 ${lag}，本次不参与倍率计算。`;
}

export function calculateStrategy(
  signals: SignalEvaluation[],
  valuation?: StrategyValuationInput,
): StrategyDecision {
  const missingCount = signals.filter((signal) => signal.state === "missing").length;
  const triggered = signals.filter((signal) => signal.state === "triggered");
  const nearCount = signals.filter((signal) => signal.state === "near").length;
  const triggeredHighCount = triggered.filter((signal) => signal.confidence === "high").length;
  const note = staleNote(valuation);

  if (missingCount >= 2) {
    return {
      multiplier: "1×",
      status: "insufficient",
      reason: `有 ${missingCount} 项真实数据缺失，按规则回到常态倍率并标记“数据不足”。${note}`,
      missingCount,
      valuationBand: null,
    };
  }

  const percentile = valuation && !valuation.stale ? valuation.percentile : null;

  if (percentile !== null) {
    const band = VALUATION_MULTIPLIER_BANDS.find((item) => percentile >= item.minPercentile);
    if (band) {
      return {
        multiplier: band.multiplier,
        status: "valuation",
        reason: `标普500 PE 近5年分位 ${percentile.toFixed(1)}%，${band.label}：按纪律压制加码，本次采用 ${band.multiplier} 小额定投。${note}`,
        missingCount,
        valuationBand: band.label,
      };
    }
  }

  if (triggeredHighCount >= 1 || triggered.length >= LOW_CONFIDENCE_CONFIRMATIONS) {
    const confirmation =
      triggeredHighCount >= 1
        ? `其中 ${triggeredHighCount} 项为高置信指标，已满足确认条件`
        : `共 ${triggered.length} 项指标同时触发，已互相确认`;
    return {
      multiplier: "2×",
      status: "triggered",
      reason: `有 ${triggered.length} 项指标触发极端买入信号（${confirmation}），按纪律采用 2× 分批投入。${note}`,
      missingCount,
      valuationBand: null,
    };
  }

  if (triggered.length === 1) {
    const only = triggered[0];
    return {
      multiplier: "1.5×",
      status: "near",
      reason: `只有 ${SIGNAL_LABELS[only.key]} 一项低置信指标触发，缺少第二项确认，按纪律只提到 1.5×；再出现一项触发即升级到 2×。${note}`,
      missingCount,
      valuationBand: null,
    };
  }

  if (nearCount >= 1) {
    return {
      multiplier: "1.5×",
      status: "near",
      reason: `没有指标触发，但有 ${nearCount} 项进入观察区，按纪律采用 1.5× 分批投入。${note}`,
      missingCount,
      valuationBand: null,
    };
  }

  return {
    multiplier: "1×",
    status: "normal",
    reason: `参与计算的真实指标均处于正常区间，维持 1× 常态投入。${note}`,
    missingCount,
    valuationBand: null,
  };
}
