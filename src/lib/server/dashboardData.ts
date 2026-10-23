import "server-only";

import { unstable_cache } from "next/cache";
import { MARKET_CACHE_SECONDS, MARKET_INSTRUMENTS } from "@/config/market";
import {
  BREADTH_BANDS,
  CREDIT_SPREAD_BANDS,
  SIGNAL_THRESHOLDS,
  TAIL_RISK_BANDS,
  TERM_STRUCTURE_BANDS,
  evaluateSignal,
} from "@/config/thresholds";
import {
  breadthSection,
  creditSpreadSection,
  indexConclusionSection,
  strategySection,
  tailRiskSection,
  termStructureSection,
  vixPeHistorySection,
} from "@/data/mockData";
import {
  calculateDistanceFrom200DayAverage,
  calculateDrawdown52Week,
  calculateRange52Week,
  calculateReturn25Day,
  calculateReturnOverDays,
  calculateWilderRsi,
} from "@/lib/indicators";
import { buildMonthlyPePoints, latestOnOrBefore } from "@/lib/peHistory";
import { calculateStrategy } from "@/lib/strategy";
import type {
  BreadthView,
  ChangeTone,
  ConclusionRow,
  CreditSpreadView,
  DashboardPayload,
  IndexSummary,
  MetricCardData,
  MultiplierHistoryPoint,
  MultiplierHistoryView,
  RelativeStrengthRow,
  RelativeStrengthView,
  SensitivityRow,
  SensitivityView,
  StatusTone,
  StrategyData,
  TailRiskView,
  ToneLegend,
  TermStructureView,
  VixPeHistoryData,
  VixPeHistoryPoint,
} from "@/types/dashboard";
import type {
  BreadthData,
  BreadthState,
  CreditSpreadData,
  CreditSpreadState,
  FearGreedData,
  MarketKey,
  MarketSeries,
  SignalEvaluation,
  SignalMetricKey,
  SignalState,
  TailRiskData,
  TermStructureData,
  TermStructureState,
  ValuationData,
  VixQuoteData,
} from "@/types/market";
import { buildBreadth, fetchBreadthInputs } from "./breadth";
import { buildCreditSpread, fetchCreditSpreadInputs } from "./credit";
import { fetchCnnFearGreed } from "./fearGreed";
import { fetchMacroView } from "./macro";
import {
  latestPerMarketDate,
  readSnapshots,
  recordDashboardSnapshot,
  type DashboardSnapshotRecord,
} from "./snapshotStore";
import { fetchAllMarketSeries } from "./marketData";
import { fetchSpyValuation } from "./valuation";
import {
  buildTailRisk,
  buildTermStructure,
  fetchCboeTailRiskInputs,
  fetchCboeTermStructureInputs,
  fetchVixQuote,
  resolveVixSeries,
} from "./vix";

function formatNumber(value: number | null, digits = 2) {
  if (value === null || !Number.isFinite(value)) return "暂无数据";
  return new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatPrice(value: number | null, isEtf: boolean) {
  const formatted = formatNumber(value, 2);
  return formatted === "暂无数据" ? formatted : isEtf ? `$${formatted}` : formatted;
}

function formatPercent(value: number | null, digits = 2, withPlus = false) {
  if (value === null || !Number.isFinite(value)) return "暂无数据";
  const sign = withPlus && value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

function formatRatioPercent(value: number | null, digits = 2, withPlus = false) {
  return formatPercent(value === null ? null : value * 100, digits, withPlus);
}

function formatPe(value: number | null) {
  return value === null || !Number.isFinite(value) ? "暂无数据" : `${value.toFixed(2)}×`;
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .format(date)
    .replaceAll("/", "-");
}

function latestBar(series: MarketSeries) {
  return series.bars.at(-1) ?? null;
}

function dailyChange(series: MarketSeries) {
  const latest = series.bars.at(-1);
  const previous = series.bars.at(-2);
  if (!latest || !previous || previous.close <= 0) return null;
  return (latest.close / previous.close - 1) * 100;
}

function direction(change: number | null): Pick<IndexSummary, "directionLabel" | "changeTone"> {
  if (change === null) return { directionLabel: "暂无数据", changeTone: "neutral" };
  if (change > 0) return { directionLabel: "上涨", changeTone: "positive" };
  if (change < 0) return { directionLabel: "下跌", changeTone: "negative" };
  return { directionLabel: "平盘", changeTone: "neutral" };
}

function formatPriceShort(value: number, isEtf: boolean) {
  const formatted = formatNumber(value, 0);
  return isEtf ? `$${formatted}` : formatted;
}

function rangeBandLabel(position: number) {
  if (position >= 75) return "接近一年高点";
  if (position >= 25) return "区间中部";
  return "接近一年低点";
}

function buildIndexSummaries(seriesByKey: Record<MarketKey, MarketSeries>): IndexSummary[] {
  return MARKET_INSTRUMENTS.map((instrument) => {
    const series = seriesByKey[instrument.key];
    const latest = latestBar(series);
    const change = dailyChange(series);
    const isEtf = instrument.assetType === "etf";
    const range = calculateRange52Week(series.bars);
    return {
      id: instrument.key,
      name: instrument.name,
      symbol: instrument.symbolLabel,
      value: formatPrice(latest?.close ?? null, isEtf),
      change: formatPercent(change, 2, true),
      ...direction(change),
      range52w: range
        ? {
            lowLabel: formatPriceShort(range.low, isEtf),
            highLabel: formatPriceShort(range.high, isEtf),
            positionLabel: rangeBandLabel(range.position),
            positionPct: Math.min(100, Math.max(0, range.position)),
            fromHighLabel: formatPercent(range.fromHigh * 100, 2),
          }
        : null,
      metrics: [
        { label: "数据来源", value: series.bars.length > 0 ? series.source : "暂无数据" },
        { label: "数据日期", value: latest?.date ?? "暂无数据" },
        { label: "数据类型", value: series.bars.length > 0 ? series.dataKind : "暂不可用" },
        {
          label: "距52周高点",
          value: range ? formatPercent(range.fromHigh * 100, 2) : "暂无数据",
        },
      ],
    };
  });
}

function excessTone(value: number | null): ChangeTone {
  if (value === null || !Number.isFinite(value) || Math.abs(value) < 0.05) return "neutral";
  return value > 0 ? "positive" : "negative";
}

function formatExcess(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "暂无数据";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)} pp`;
}

function shortInstrumentName(name: string) {
  return name.replace(/（[^）]*）/g, "").trim();
}

function buildRelativeStrength(seriesByKey: Record<MarketKey, MarketSeries>): RelativeStrengthView {
  const spy = seriesByKey.spy;
  const spy20 = calculateReturnOverDays(spy.bars, 20);
  const spy60 = calculateReturnOverDays(spy.bars, 60);
  const rows = MARKET_INSTRUMENTS.filter((instrument) => instrument.key !== "spy")
    .map((instrument) => {
      const series = seriesByKey[instrument.key];
      const ret20 = calculateReturnOverDays(series.bars, 20);
      const ret60 = calculateReturnOverDays(series.bars, 60);
      const excess20 = ret20 === null || spy20 === null ? null : (ret20 - spy20) * 100;
      const excess60 = ret60 === null || spy60 === null ? null : (ret60 - spy60) * 100;
      return { instrument, excess20, excess60 };
    })
    .sort((a, b) => (b.excess20 ?? -1e9) - (a.excess20 ?? -1e9))
    .map<RelativeStrengthRow>(({ instrument, excess20, excess60 }) => ({
      id: instrument.key,
      name: shortInstrumentName(instrument.name),
      symbol: instrument.providerSymbol,
      excess20dLabel: formatExcess(excess20),
      excess60dLabel: formatExcess(excess60),
      excess20dTone: excessTone(excess20),
      excess60dTone: excessTone(excess60),
    }));

  return {
    asOfLabel: `Twelve Data · ${latestBar(spy)?.date ?? "暂无数据"} 收盘（相对 SPY）`,
    baselineLabel: `基准 SPY：近 20 日 ${formatPercent(spy20 === null ? null : spy20 * 100, 2, true)}，近 60 日 ${formatPercent(spy60 === null ? null : spy60 * 100, 2, true)}`,
    rows,
    note: "超额 = 标的涨跌幅 − SPY 同期涨跌幅，单位是百分点。正数说明跑赢大盘，负数说明跑输；只描述结构强弱，不参与倍率计算。",
  };
}

function stateTone(state: SignalState): StatusTone {
  if (state === "triggered") return "triggered";
  if (state === "near") return "near";
  if (state === "stale") return "stale";
  return "normal";
}

function badgeLabel(state: SignalState) {
  if (state === "triggered") return "触发";
  if (state === "near") return "接近";
  if (state === "stale") return "数据陈旧";
  if (state === "missing") return "暂无数据";
  return "未触发";
}

/** PE 卡片的时效说明：陈旧时写明停更日期，避免把旧分位当成当日口径。 */
function peStateLabel(valuation: ValuationData) {
  if (valuation.currentPe === null) return "最新标普500 PE：暂无数据";
  const base = `最新标普500 PE：${formatPe(valuation.currentPe)}`;
  if (!valuation.stale) return base;
  return `${base}（${valuation.currentDate ?? "日期暂无数据"} 后未更新，已滞后 ${valuation.ageDays ?? "多"} 天）`;
}

function peDescription(valuation: ValuationData) {
  const source = `标普500 · ${valuation.source} · ${valuation.currentDate ?? "时间暂无数据"}`;
  if (valuation.currentPe === null) return `${source} · 暂不可用`;
  if (valuation.stale) {
    return `${source} · 已滞后 ${valuation.ageDays ?? "多"} 天，仅展示、不参与倍率计算`;
  }
  return `${source} · ${valuation.dataKind}`;
}

function valuationVintageSuffix(valuation: ValuationData) {
  if (!valuation.stale) return "";
  return `（${valuation.currentDate ?? "日期未知"} 口径，已滞后 ${valuation.ageDays ?? "多"} 天，未参与倍率）`;
}

function stateDescription(state: SignalState, labels: { triggered: string; near: string; normal: string }) {
  if (state === "triggered") return labels.triggered;
  if (state === "near") return labels.near;
  if (state === "normal") return labels.normal;
  return "数据：暂无数据";
}

function marketCalculationDescription(
  qqqValue: string,
  spyValue: string,
  date: string | null,
  calculation: string,
) {
  return `QQQ ${qqqValue} · SPY ${spyValue} · Twelve Data · ${date ?? "时间暂无数据"} · ${calculation}`;
}

function termStructureStateLabel(state: TermStructureState) {
  if (state === "backwardation") return "近高远低（倒挂）";
  if (state === "flat") return "曲线走平";
  if (state === "contango") return "正常升水";
  return "数据不足";
}

function termStructureNote(data: TermStructureData) {
  if (data.ratio === null) {
    return `${data.error ?? "Cboe 期限结构数据暂不可用"}；本条只作背景读数，不参与倍率计算。`;
  }
  if (data.state === "backwardation") {
    return "30 天 VIX 已经高于 3 个月，这是历史上快速下跌期的典型形态；现货恐慌和远期定价同时抬升时，一次性买点往往就出现在这种结构里。参考项，不参与倍率计算。";
  }
  if (data.state === "flat") {
    return `近端已经贴到远端（30 天 ÷ 3 个月 = ${data.ratio.toFixed(2)}×），说明市场对三个月内并不乐观；继续倒挂通常才是急性恐慌的开始。参考项，不参与倍率计算。`;
  }
  return "曲线保持向上（近低远高），市场把这次波动当成短期扰动，没有为未来几个月额外定价恐慌。参考项，不参与倍率计算。";
}

function termStructureLegend(): ToneLegend {
  const backwardation = TERM_STRUCTURE_BANDS.backwardation.toFixed(2);
  const flat = TERM_STRUCTURE_BANDS.flat.toFixed(2);
  return {
    caption:
      "绿＝倒挂：近端恐慌已经高过远端，历史上这种结构常出现在急跌末段，属于买点侧信号；黄＝走平；灰＝正常升水。颜色只标结构，不参与倍率。",
    items: [
      { tone: "triggered", label: "倒挂", range: `比值 ≥ ${backwardation}` },
      { tone: "near", label: "走平", range: `${flat} – ${backwardation}` },
      { tone: "normal", label: "正常升水", range: `< ${flat}` },
    ],
  };
}

function buildTermStructureView(data: TermStructureData): TermStructureView {
  const asOfText = data.asOf ? `${data.source} · ${data.asOf} 收盘` : data.source;
  return {
    ...termStructureSection,
    description: `${asOfText}；9 天、30 天、3 个月取同一个交易日的收盘价，比值为 30 天 VIX ÷ 3 个月 VIX。`,
    points: [
      { label: "9 天", value: formatNumber(data.vix9d, 2), hint: "超短期恐慌" },
      { label: "30 天", value: formatNumber(data.vix30d, 2), hint: "基准（VIX）" },
      { label: "3 个月", value: formatNumber(data.vix3m, 2), hint: "中期定价" },
    ],
    ratioLabel:
      data.ratio === null ? "比值：暂无数据" : `${data.ratio.toFixed(2)}× · 30 天 ÷ 3 个月`,
    stateLabel: termStructureStateLabel(data.state),
    tone: data.state === "backwardation" ? "triggered" : data.state === "flat" ? "near" : "normal",
    legend: termStructureLegend(),
    note: termStructureNote(data),
  };
}

function termStructureConclusionText(data: TermStructureData) {
  if (data.ratio === null) return "波动率期限结构：暂无数据";
  return `9 天 / 30 天 / 3 个月 VIX ${formatNumber(data.vix9d, 2)} / ${formatNumber(data.vix30d, 2)} / ${formatNumber(data.vix3m, 2)}，30 天 ÷ 3 个月 ${data.ratio.toFixed(2)}×（${termStructureStateLabel(data.state)}）· 日线收盘口径`;
}

function tailRiskTone(percentile: number | null): StatusTone {
  if (percentile === null) return "stale";
  if (percentile >= TAIL_RISK_BANDS.extreme) return "risk";
  if (percentile >= TAIL_RISK_BANDS.elevated) return "near";
  return "normal";
}

function tailRiskPercentileLabel(percentile: number | null) {
  return percentile === null ? "近5年分位暂无" : `近5年分位 ${formatPercent(percentile, 1)}`;
}

function tailRiskNote(data: TailRiskData) {
  if (data.skew === null && data.vvix === null) {
    return `${data.error ?? "Cboe SKEW / VVIX 数据暂不可用"}；本条只作背景读数，不参与倍率计算。`;
  }
  const hot: string[] = [];
  if (data.skewPercentile !== null && data.skewPercentile >= TAIL_RISK_BANDS.elevated) hot.push("偏斜");
  if (data.vvixPercentile !== null && data.vvixPercentile >= TAIL_RISK_BANDS.elevated) hot.push("波动率的波动率");
  if (hot.length === 0) {
    return "两项都在历史中位数附近，既没有人在抢着买保险，波动率本身也不躁动。参考项，不参与倍率计算。";
  }
  return `${hot.join("、")}处于历史偏高分位：说明除了现货跌多少，市场还在额外为「未来更坏的情况」付费。这类读数偏高不是买点，而是提醒恐慌可能还没走完。参考项，不参与倍率计算。`;
}

function tailRiskLegend(): ToneLegend {
  return {
    caption:
      "越红＝越拥挤：分位越高说明越多人已经在为下跌买保险。这里用红黄灰，和上面期限结构「绿＝买点侧」不是同一套语义。",
    items: [
      { tone: "risk", label: "极端", range: `≥ ${TAIL_RISK_BANDS.extreme} 分位` },
      { tone: "near", label: "偏高", range: `${TAIL_RISK_BANDS.elevated} – ${TAIL_RISK_BANDS.extreme} 分位` },
      { tone: "normal", label: "常态", range: `< ${TAIL_RISK_BANDS.elevated} 分位` },
    ],
  };
}

function buildTailRiskView(data: TailRiskData): TailRiskView {
  const asOfText = data.asOf ? `${data.source} · ${data.asOf} 收盘` : data.source;
  return {
    ...tailRiskSection,
    asOfLabel: `${asOfText}；与上面同一交易日收盘价，分位取近 5 年样本。`,
    items: [
      {
        label: "SKEW",
        value: formatNumber(data.skew, 2),
        percentileLabel: tailRiskPercentileLabel(data.skewPercentile),
        hint: "偏斜指数：越高说明越多人愿意为极端下跌付溢价",
        tone: tailRiskTone(data.skewPercentile),
      },
      {
        label: "VVIX",
        value: formatNumber(data.vvix, 2),
        percentileLabel: tailRiskPercentileLabel(data.vvixPercentile),
        hint: "VIX 的波动率：越高说明恐慌本身在剧烈摆动",
        tone: tailRiskTone(data.vvixPercentile),
      },
    ],
    legend: tailRiskLegend(),
    note: tailRiskNote(data),
  };
}

function breadthStateLabel(state: BreadthState) {
  switch (state) {
    case "narrow":
      return "宽度：偏窄";
    case "broad":
      return "宽度：普涨";
    case "neutral":
      return "宽度：中性";
    default:
      return "宽度：暂无数据";
  }
}

function breadthTone(data: BreadthData): StatusTone {
  if (data.state === "missing") return "stale";
  if (data.state !== "narrow") return "normal";
  const extreme =
    (data.gap200 !== null && data.gap200 <= BREADTH_BANDS.extremeGap) ||
    (data.ratioPercentile !== null && data.ratioPercentile <= BREADTH_BANDS.extremePercentile);
  return extreme ? "risk" : "near";
}

function breadthNote(data: BreadthData) {
  if (data.gap200 === null && data.ratioPercentile === null) {
    return `${data.error ?? "RSP / SPY 数据暂不可用"}；这条只作背景读数，不参与倍率计算。`;
  }
  const detail = [
    data.rspDistance200 === null ? null : `RSP ${formatPercent(data.rspDistance200 * 100, 2, true)}`,
    data.spyDistance200 === null ? null : `SPY ${formatPercent(data.spyDistance200 * 100, 2, true)}`,
  ]
    .filter((part): part is string => part !== null)
    .join(" / ");
  const head =
    data.state === "narrow"
      ? "等权跑输市值权：指数在涨、但多数股票没跟上，这种行情靠少数巨头支撑，结构上偏脆。"
      : data.state === "broad"
        ? "等权跑赢市值权：上涨面更广，行情不是只靠少数巨头撑着。"
        : "两者大致同步：既谈不上普涨，也看不出明显分化。";
  return `${head}（距 200 日均线：${detail}）比值分位越低说明等权越落后。参考项，不参与倍率计算。`;
}

function breadthLegend(): ToneLegend {
  return {
    caption:
      "越红＝上涨越依赖少数大盘股，结构越脆。差值 = RSP 距 200 日均线 − SPY 距 200 日均线；两个条件满足任意一个，就按更严重的那档上色。",
    items: [
      {
        tone: "risk",
        label: "极窄",
        range: `差值 ≤ ${BREADTH_BANDS.extremeGap}pp，或比值分位 ≤ ${BREADTH_BANDS.extremePercentile}%`,
      },
      {
        tone: "near",
        label: "偏窄",
        range: `差值 ≤ ${BREADTH_BANDS.narrowGap}pp，或比值分位 ≤ ${BREADTH_BANDS.narrowPercentile}%`,
      },
      { tone: "normal", label: "中性 / 普涨", range: "其余情况" },
    ],
  };
}

function buildBreadthView(data: BreadthData): BreadthView {
  return {
    ...breadthSection,
    asOfLabel: data.asOf ? `${data.source} · ${data.asOf} 收盘（这条行情缓存 2 小时，不跟整页 30 分钟刷新）` : data.source,
    value: data.gap200 === null ? "暂无数据" : `${data.gap200 > 0 ? "+" : ""}${data.gap200.toFixed(2)} 个百分点`,
    valueLabel: "200 日均线距离差（RSP − SPY）",
    stateLabel: breadthStateLabel(data.state),
    facts: [
      {
        label: `RSP/SPY 比值分位（近 ${data.ratioSampleDays ?? 0} 个交易日）`,
        value: data.ratioPercentile === null ? "暂无" : formatPercent(data.ratioPercentile, 1),
      },
      {
        label: "近 20 个交易日相对表现",
        value: data.relative20d === null ? "暂无" : `${data.relative20d > 0 ? "+" : ""}${data.relative20d.toFixed(2)} 个百分点`,
      },
    ],
    tone: breadthTone(data),
    legend: breadthLegend(),
    note: breadthNote(data),
  };
}

function creditSpreadTone(state: CreditSpreadState): StatusTone {
  if (state === "stress") return "risk";
  if (state === "elevated") return "near";
  if (state === "missing") return "stale";
  return "normal";
}

function creditSpreadStateLabel(state: CreditSpreadState) {
  switch (state) {
    case "stress":
      return "信用环境：紧张";
    case "elevated":
      return "信用环境：偏高";
    case "normal":
      return "信用环境：宽松";
    default:
      return "信用环境：暂无数据";
  }
}

function creditSpreadNote(data: CreditSpreadData) {
  if (data.latest === null) {
    return `${data.error ?? "FRED 高收益债 OAS 暂不可用"}；这条只作背景读数，不参与倍率计算。`;
  }
  const trend =
    data.change20d === null
      ? ""
      : `${data.change20d > 0.005 ? "近 20 个交易日在走阔" : data.change20d < -0.005 ? "近 20 个交易日在收窄" : "近 20 个交易日基本持平"}。`;
  if (data.state === "stress") {
    return `信用利差处在紧张区间（≥ ${CREDIT_SPREAD_BANDS.stress}%）：企业融资成本明显抬升。这个读数通常出现在股市已经下跌之后，用来判断恐慌有没有蔓延到信用市场。${trend}参考项，不参与倍率计算。`;
  }
  if (data.state === "elevated") {
    return `信用利差偏高（≥ ${CREDIT_SPREAD_BANDS.elevated}%）：信用市场开始跟着股市一起紧张，但还没到恐慌定价的程度。${trend}参考项，不参与倍率计算。`;
  }
  const percentileNote =
    data.percentile5y !== null && data.percentile5y >= 70
      ? `放在近 5 年样本里它处在 ${formatPercent(data.percentile5y, 1)} 分位，比过去多数时候更宽，只是绝对水平还没到报警线。`
      : "";
  return `信用利差处在宽松区间：企业借钱的风险溢价不高，信用市场没有额外报警。利差过窄本身也意味着风险补偿不足，不能当成利好。${percentileNote}${trend}参考项，不参与倍率计算。`;
}

function creditSpreadFactValue(percentile: number | null, change: number | null, kind: "percentile" | "change") {
  if (kind === "percentile") {
    return percentile === null ? "暂无" : formatPercent(percentile, 1);
  }
  if (change === null) return "暂无";
  const bps = Math.round(change * 100);
  if (bps === 0) return "持平";
  return `${bps > 0 ? "+" : "-"}${Math.abs(bps)} 个基点`;
}

function creditSpreadLegend(): ToneLegend {
  const elevated = CREDIT_SPREAD_BANDS.elevated.toFixed(1);
  const stress = CREDIT_SPREAD_BANDS.stress.toFixed(1);
  return {
    caption: "越红＝企业借钱的风险溢价越高。灰＝宽松，不等于利好：利差过窄说明风险补偿不足。",
    items: [
      { tone: "risk", label: "紧张", range: `≥ ${stress}%` },
      { tone: "near", label: "偏高", range: `${elevated}% – ${stress}%` },
      { tone: "normal", label: "宽松", range: `< ${elevated}%` },
    ],
  };
}

export function buildCreditSpreadView(data: CreditSpreadData): CreditSpreadView {
  return {
    ...creditSpreadSection,
    asOfLabel: data.asOf
      ? `${data.source} · ${data.asOf}（美国交易日，T+1 公布）`
      : data.source,
    value: data.latest === null ? "暂无数据" : `${formatNumber(data.latest, 2)}%`,
    stateLabel: creditSpreadStateLabel(data.state),
    facts: [
      { label: "近 5 年分位", value: creditSpreadFactValue(data.percentile5y, data.change20d, "percentile") },
      { label: "20 个交易日", value: creditSpreadFactValue(data.percentile5y, data.change20d, "change") },
    ],
    tone: creditSpreadTone(data.state),
    legend: creditSpreadLegend(),
    note: creditSpreadNote(data),
  };
}

function buildSentimentMetrics(args: {
  vix: MarketSeries;
  vixQuote: VixQuoteData | null;
  fearGreed: FearGreedData;
  qqq: MarketSeries;
  spy: MarketSeries;
  valuation: ValuationData;
  qqqRsi: number | null;
  spyRsi: number | null;
  qqqDrawdown: number | null;
  spyDrawdown: number | null;
  qqqMomentum: number | null;
  spyMomentum: number | null;
}) {
  const vixBar = latestBar(args.vix);
  const vixValue = args.vixQuote?.value ?? vixBar?.close ?? null;
  const vixDescription = args.vixQuote
    ? `${args.vixQuote.source} · ${args.vixQuote.quoteTimeLabel} · ${args.vixQuote.dataKind}${args.vixQuote.changePercent === null ? "" : `（较前收 ${formatPercent(args.vixQuote.changePercent, 2, true)}）`}`
    : `${args.vix.bars.length > 0 ? args.vix.source : "来源暂无数据"} · ${vixBar?.date ?? "时间暂无数据"} · ${args.vix.bars.length > 0 ? args.vix.dataKind : "暂不可用"}`;
  const qqqDate = latestBar(args.qqq)?.date ?? null;
  const signals = {
    vix: evaluateSignal("vix", vixValue),
    fearGreed: evaluateSignal("fearGreed", args.fearGreed.score),
    rsi6: evaluateSignal("rsi6", args.qqqRsi),
    pePercentile:
      args.valuation.stale && args.valuation.percentile !== null
        ? { ...evaluateSignal("pePercentile", args.valuation.percentile), state: "stale" as const }
        : evaluateSignal("pePercentile", args.valuation.percentile),
    drawdown52w: evaluateSignal("drawdown52w", args.qqqDrawdown === null ? null : args.qqqDrawdown * 100),
    momentum25d: evaluateSignal("momentum25d", args.qqqMomentum === null ? null : args.qqqMomentum * 100),
  } satisfies Record<string, SignalEvaluation>;

  const metrics: MetricCardData[] = [
    {
      id: "vix",
      name: "VIX",
      value: formatNumber(vixValue, 2),
      badgeLabel: badgeLabel(signals.vix.state),
      stateLabel: stateDescription(signals.vix.state, {
        triggered: "VIX：高波动买入机会",
        near: "VIX：进入观察区",
        normal: "VIX：正常",
      }),
      triggerCondition: SIGNAL_THRESHOLDS.vix.triggerCondition,
      description: vixDescription,
      tone: stateTone(signals.vix.state),
    },
    {
      id: "fear-greed",
      name: "恐惧贪婪",
      value: args.fearGreed.score === null ? "暂无数据" : formatNumber(args.fearGreed.score, 0),
      badgeLabel: badgeLabel(signals.fearGreed.state),
      stateLabel:
        args.fearGreed.rating === null
          ? "情绪：暂无数据"
          : `情绪：${args.fearGreed.rating}`,
      triggerCondition: SIGNAL_THRESHOLDS.fearGreed.triggerCondition,
      description: `CNN · ${args.fearGreed.dataTime ? args.fearGreed.dataTime.slice(0, 19).replace("T", " ") : "时间暂无数据"} · ${args.fearGreed.score === null ? "暂不可用" : args.fearGreed.dataKind}`,
      tone: stateTone(signals.fearGreed.state),
    },
    {
      id: "rsi",
      name: "RSI(6)",
      value: formatNumber(args.qqqRsi, 1),
      badgeLabel: badgeLabel(signals.rsi6.state),
      stateLabel: stateDescription(signals.rsi6.state, {
        triggered: "RSI：超卖买入机会",
        near: "RSI：进入观察区",
        normal: "RSI：正常",
      }),
      triggerCondition: SIGNAL_THRESHOLDS.rsi6.triggerCondition,
      description: marketCalculationDescription(
        formatNumber(args.qqqRsi, 1),
        formatNumber(args.spyRsi, 1),
        qqqDate,
        "Wilder日线本地计算",
      ),
      tone: stateTone(signals.rsi6.state),
    },
    {
      id: "pe-percentile",
      name: "PE近5年分位",
      value:
        args.valuation.percentile !== null
          ? formatPercent(args.valuation.percentile, 1)
          : args.valuation.currentPe !== null
            ? "数据源暂不支持"
            : "暂无数据",
      badgeLabel: badgeLabel(signals.pePercentile.state),
      stateLabel: peStateLabel(args.valuation),
      triggerCondition: SIGNAL_THRESHOLDS.pePercentile.triggerCondition,
      description: peDescription(args.valuation),
      tone: stateTone(signals.pePercentile.state),
    },
    {
      id: "drawdown",
      name: "52周回撤",
      value: formatRatioPercent(args.qqqDrawdown, 2),
      badgeLabel: badgeLabel(signals.drawdown52w.state),
      stateLabel: stateDescription(signals.drawdown52w.state, {
        triggered: "回撤：极端买入机会",
        near: "回撤：进入观察区",
        normal: "回撤：正常",
      }),
      triggerCondition: SIGNAL_THRESHOLDS.drawdown52w.triggerCondition,
      description: marketCalculationDescription(
        formatRatioPercent(args.qqqDrawdown, 2),
        formatRatioPercent(args.spyDrawdown, 2),
        qqqDate,
        "252日最高收盘本地计算",
      ),
      tone: stateTone(signals.drawdown52w.state),
    },
    {
      id: "momentum-25d",
      name: "25日涨跌幅",
      value: formatRatioPercent(args.qqqMomentum, 2, true),
      badgeLabel: badgeLabel(signals.momentum25d.state),
      stateLabel: stateDescription(signals.momentum25d.state, {
        triggered: "涨跌：极端买入机会",
        near: "涨跌：进入观察区",
        normal: "涨跌：正常",
      }),
      triggerCondition: SIGNAL_THRESHOLDS.momentum25d.triggerCondition,
      description: marketCalculationDescription(
        formatRatioPercent(args.qqqMomentum, 2, true),
        formatRatioPercent(args.spyMomentum, 2, true),
        qqqDate,
        "25个交易日前收盘本地计算",
      ),
      tone: stateTone(signals.momentum25d.state),
    },
  ];

  return { metrics, signals: Object.values(signals) };
}

function monthKeys(baseDate: string) {
  const [year, month] = baseDate.split("-").map(Number);
  const points: Array<{ key: string; label: string; end: string }> = [];
  for (let offset = 5; offset >= 0; offset -= 1) {
    const date = new Date(Date.UTC(year, month - 1 - offset, 1));
    const y = date.getUTCFullYear();
    const m = date.getUTCMonth() + 1;
    const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    points.push({ key: `${y}-${String(m).padStart(2, "0")}`, label: `${m}月`, end });
  }
  return points;
}

function buildVixPeHistory(vix: MarketSeries, valuation: ValuationData): VixPeHistoryData {
  const vixLatest = latestBar(vix);
  const baseDate = vixLatest?.date ?? valuation.currentDate ?? new Date().toISOString().slice(0, 10);
  const months = monthKeys(baseDate);
  // 每月只取“当月新出现的非估算 PE”：没有新观测的月份留空，不再把上月数值重复画平。
  const pePoints = buildMonthlyPePoints(months, valuation.history);

  const points: VixPeHistoryPoint[] = months.map((month, index) => {
    const monthVix = latestOnOrBefore(
      vix.bars.filter((bar) => bar.date.startsWith(month.key)),
      month.end,
    );
    return {
      month: month.label,
      vix: monthVix?.close ?? null,
      pePercentile: pePoints[index]?.percentile ?? null,
    };
  });

  const peUnavailable = valuation.percentile === null;
  const staleText = valuation.stale
    ? `标普500 PE 最新非估算值停在 ${valuation.currentDate ?? "未知日期"}（已滞后 ${valuation.ageDays ?? "多"} 天），此后各月没有新的非估算值，图上对应月份留空；当前分位仅供参照，不参与倍率计算。`
    : "";

  return {
    ...vixPeHistorySection,
    currentVix: formatNumber(vixLatest?.close ?? null, 2),
    currentPePercentile:
      valuation.percentile !== null
        ? valuation.stale
          ? `${formatPercent(valuation.percentile, 1)} · ${valuation.currentDate ?? "日期未知"} 口径`
          : formatPercent(valuation.percentile, 1)
        : valuation.currentPe !== null
          ? "数据源暂不支持"
          : "暂无数据",
    analysis: peUnavailable
      ? `VIX 使用 ${vix.bars.length > 0 ? vix.source : "暂无来源"} 的月末日线收盘；${valuation.source} 估值数据暂不可用。`
      : `VIX 使用 ${vix.source} 月末日线收盘；PE 每月只取当月新出现的非估算值，分位按近5年有效历史 PE 中“小于或等于当期 PE”的样本占比计算。${staleText}`,
    points,
  };
}

function buildIndexConclusion(args: {
  valuation: ValuationData;
  qqqDistance200: number | null;
  qqqMomentum: number | null;
  strategyMultiplier: string;
  strategyReason: string;
}) {
  const valuationText =
    args.valuation.currentPe === null
      ? "暂无数据"
      : args.valuation.percentile === null
        ? `标普500 最新 PE ${formatPe(args.valuation.currentPe)}；近5年分位数据源暂不支持`
        : `标普500 最新 PE ${formatPe(args.valuation.currentPe)}，近5年分位 ${formatPercent(args.valuation.percentile, 1)}${valuationVintageSuffix(args.valuation)}`;
  const trendText =
    args.qqqDistance200 === null
      ? "QQQ 距离200日均线：暂无数据"
      : `QQQ 距离200日均线 ${formatRatioPercent(args.qqqDistance200, 2, true)}（Twelve Data 日线本地计算）`;
  const momentumText =
    args.qqqMomentum === null
      ? "QQQ 25日涨跌幅：暂无数据"
      : `QQQ 25日涨跌幅 ${formatRatioPercent(args.qqqMomentum, 2, true)}（日线收盘）`;

  return {
    title: indexConclusionSection.title,
    rows: [
      { label: "整体估值", value: valuationText },
      { label: "趋势位置", value: trendText },
      { label: "短期表现", value: momentumText },
      {
        label: "操作提示",
        value: `${args.strategyMultiplier}：${args.strategyReason} 维持分批投入，不追逐单日波动。`,
        prominent: true,
      },
    ] satisfies ConclusionRow[],
  };
}

function tailRiskConclusionText(data: TailRiskData) {
  if (data.skew === null && data.vvix === null) return "尾部对冲：暂无数据";
  const parts: string[] = [];
  if (data.skew !== null) {
    parts.push(
      `SKEW ${formatNumber(data.skew, 2)}${data.skewPercentile === null ? "" : `（${formatPercent(data.skewPercentile, 1)} 分位）`}`,
    );
  }
  if (data.vvix !== null) {
    parts.push(
      `VVIX ${formatNumber(data.vvix, 2)}${data.vvixPercentile === null ? "" : `（${formatPercent(data.vvixPercentile, 1)} 分位）`}`,
    );
  }
  const hot =
    (data.skewPercentile ?? 0) >= TAIL_RISK_BANDS.elevated || (data.vvixPercentile ?? 0) >= TAIL_RISK_BANDS.elevated;
  return `${parts.join("、")}，${hot ? "结构性对冲需求偏高" : "对冲需求平稳"} · 背景读数，不参与倍率`;
}

function breadthConclusionText(data: BreadthData) {
  if (data.gap200 === null) return "市场宽度：暂无数据";
  const percentile = data.ratioPercentile === null ? "" : `（比值 ${formatPercent(data.ratioPercentile, 1)} 分位）`;
  return `等权 − 市值权 200 日均线距离差 ${data.gap200 > 0 ? "+" : ""}${data.gap200.toFixed(2)} 个百分点${percentile} · 背景读数，不参与倍率`;
}

function creditSpreadConclusionText(data: CreditSpreadData) {
  if (data.latest === null) return "信用环境：暂无数据";
  const percentile = data.percentile5y === null ? "" : `（${formatPercent(data.percentile5y, 1)} 分位）`;
  const state = creditSpreadStateLabel(data.state).replace("信用环境：", "");
  return `高收益债 OAS ${formatNumber(data.latest, 2)}%${percentile}，${state} · 背景读数，不参与倍率`;
}

const SIGNAL_NAMES: Record<SignalMetricKey, string> = {
  vix: "VIX",
  fearGreed: "CNN恐惧贪婪",
  rsi6: "RSI(6)",
  pePercentile: "PE近5年分位",
  drawdown52w: "52周回撤",
  momentum25d: "25日涨跌幅",
};

function sensitivityValueLabel(key: SignalMetricKey, value: number | null) {
  if (value === null) return "暂无数据";
  switch (key) {
    case "vix":
      return formatNumber(value, 2);
    case "fearGreed":
      return formatNumber(value, 0);
    case "rsi6":
      return formatNumber(value, 1);
    case "pePercentile":
      return `${value.toFixed(1)}%`;
    default:
      return `${value.toFixed(2)}%`;
  }
}

function sensitivityGapUnit(key: SignalMetricKey) {
  if (key === "fearGreed") return " 分";
  if (key === "pePercentile" || key === "drawdown52w" || key === "momentum25d") return " 个百分点";
  return " 点";
}

function buildSensitivity(signals: SignalEvaluation[], decision: ReturnType<typeof calculateStrategy>): SensitivityView {
  const rows = signals.map<SensitivityRow>((signal) => {
    const rule = SIGNAL_THRESHOLDS[signal.key];
    const unit = sensitivityGapUnit(signal.key);
    const distance = signal.value === null ? null : Math.abs(rule.triggerAt - signal.value);
    const digits = signal.key === "vix" ? 2 : signal.key === "fearGreed" ? 0 : 1;
    const gapLabel =
      signal.value === null || distance === null
        ? "暂无数据"
        : signal.state === "triggered"
          ? `距退出 ${distance.toFixed(digits)}${unit}`
          : `距触发 ${distance.toFixed(digits)}${unit}`;
    const stateLabel =
      signal.state === "triggered"
        ? "已触发"
        : signal.state === "near"
          ? "观察区"
          : signal.state === "stale"
            ? "数据陈旧"
            : signal.state === "missing"
              ? "暂无数据"
              : "正常";
    return {
      key: signal.key,
      name: SIGNAL_NAMES[signal.key],
      valueLabel: sensitivityValueLabel(signal.key, signal.value),
      triggerLabel: rule.triggerCondition,
      gapLabel: signal.state === "stale" ? "数据陈旧，不参与倍率" : gapLabel,
      stateLabel,
      tone: stateTone(signal.state),
    };
  });

  const triggeredHigh = signals.filter((s) => s.state === "triggered" && s.confidence === "high");
  const triggeredLow = signals.filter((s) => s.state === "triggered" && s.confidence === "low");
  const near = signals.filter((s) => s.state === "near");
  const parts: string[] = [];
  if (decision.status === "insufficient") {
    parts.push("数据缺失达到 2 项以上，倍率按规则退回 1×；补齐数据后本表会自动更新。");
  } else {
    if (triggeredHigh.length > 0) parts.push(`高置信触发：${triggeredHigh.map((s) => SIGNAL_NAMES[s.key]).join("、")}`);
    if (triggeredLow.length > 0)
      parts.push(`低置信触发：${triggeredLow.map((s) => SIGNAL_NAMES[s.key]).join("、")}（单独一项只到 1.5×，需第二项确认）`);
    if (near.length > 0) parts.push(`观察区：${near.map((s) => SIGNAL_NAMES[s.key]).join("、")}`);
    if (triggeredHigh.length === 0 && triggeredLow.length === 0 && near.length === 0)
      parts.push("六项信号都远离临界值");
    parts.push(`当前规则判定为 ${decision.multiplier}。`);
  }

  return { rows, note: parts.join("；") };
}

const MULTIPLIER_TONE: Record<string, StatusTone> = {
  "2×": "triggered",
  "1.5×": "near",
  "1×": "normal",
  "0.5×": "stale",
  "0.25×": "stale",
};

export function buildMultiplierHistory(records: DashboardSnapshotRecord[], qqq: MarketSeries): MultiplierHistoryView {
  const byDay = latestPerMarketDate(records);
  const points = byDay.slice(-12).map<MultiplierHistoryPoint>((record) => ({
    date: record.marketDate,
    shortDate: record.marketDate.slice(5),
    multiplier: record.multiplier,
    tone: MULTIPLIER_TONE[record.multiplier] ?? "normal",
  }));
  const rangeLabel =
    points.length === 0
      ? "暂无历史快照"
      : points.length === 1
        ? `仅 1 个交易日记录（${points[0]?.date}）`
        : `${points[0]?.date} ～ ${points.at(-1)?.date} · ${points.length} 个交易日`;
  const latestPoint = points.at(-1) ?? null;
  const latestDate = latestPoint?.date ?? null;
  let referenceDate: string | null = null;
  if (latestPoint?.multiplier === "2×") {
    // 取当前这段连续 2× 的起点，而不是“今天”本身。
    let index = points.length - 1;
    while (index > 0 && points[index - 1]?.multiplier === "2×") index -= 1;
    referenceDate = points[index]?.date ?? null;
  } else {
    referenceDate = [...points].reverse().find((point) => point.multiplier === "2×")?.date ?? null;
  }
  const last2xLabel =
    points.length < 2
      ? `当前倍率：${latestPoint?.multiplier ?? "—"}（${latestDate ?? "—"}）`
      : referenceDate
        ? latestPoint?.multiplier === "2×"
          ? `当前 2× 从 ${referenceDate} 开始`
          : `上次 2×：${referenceDate}`
        : "还没有出现过 2×";
  const bars = qqq.bars;
  let sinceLabel = "之后 QQQ 涨跌：暂无数据";
  if (points.length < 2) {
    sinceLabel = "至少要两个交易日的记录，才能算出「之后涨了多少」。";
  } else if (referenceDate === latestDate) {
    sinceLabel = "这是 2× 的第一天，之后涨跌要看下一次收盘。";
  } else if (referenceDate && bars.length > 0) {
    const startBar = bars.find((bar) => bar.date >= referenceDate);
    const endBar = bars.at(-1);
    if (startBar && endBar && startBar.close > 0) {
      const change = (endBar.close / startBar.close - 1) * 100;
      sinceLabel = `自 ${referenceDate} 以来 QQQ ${formatPercent(change, 2, true)}（${startBar.date} 收盘 → ${endBar.date} 收盘）`;
    }
  }
  return {
    points,
    rangeLabel,
    last2xLabel,
    sinceLabel,
    insufficientLabel: null,
  };
}

function buildStrategyData(args: {
  valuation: ValuationData;
  fearGreed: FearGreedData;
  vix: MarketSeries;
  vixQuote: VixQuoteData | null;
  qqq: MarketSeries;
  qqqDistance200: number | null;
  termStructure: TermStructureData;
  tailRisk: TailRiskData;
  creditSpread: CreditSpreadData;
  breadth: BreadthData;
  signals: SignalEvaluation[];
  history: MultiplierHistoryView;
  decision: ReturnType<typeof calculateStrategy>;
}): StrategyData {
  const vixLatest = latestBar(args.vix);
  const vixValue = args.vixQuote?.value ?? vixLatest?.close ?? null;
  const qqqLatest = latestBar(args.qqq);
  const valuationText =
    args.valuation.currentPe === null
      ? "暂无数据"
      : args.valuation.percentile === null
        ? `标普500最新 PE ${formatPe(args.valuation.currentPe)}；近5年分位数据源暂不支持`
        : `标普500最新 PE ${formatPe(args.valuation.currentPe)}，近5年分位 ${formatPercent(args.valuation.percentile, 1)}${valuationVintageSuffix(args.valuation)}`;
  const emotionParts = [
    args.fearGreed.score === null
      ? "CNN恐惧贪婪：暂无数据"
      : `CNN恐惧贪婪 ${formatNumber(args.fearGreed.score, 0)}（${args.fearGreed.rating}）`,
    vixValue === null
      ? "VIX：暂无数据"
      : `VIX ${formatNumber(vixValue, 2)}${args.vixQuote ? `（${args.vixQuote.sessionLabel}）` : ""}`,
  ];
  const trendText =
    args.qqqDistance200 === null
      ? "QQQ 距离200日均线：暂无数据"
      : `QQQ 距离200日均线 ${formatRatioPercent(args.qqqDistance200, 2, true)}`;
  const actionText =
    args.decision.status === "insufficient"
      ? "真实数据不足，按规则维持 1× 常态投入；待数据恢复后再重新计算。"
      : args.decision.status === "valuation"
        ? `当前建议 ${args.decision.multiplier} 小额定投。${args.decision.reason} 估值偏高时不加码，也不建议一次性重仓。`
        : `当前建议 ${args.decision.multiplier}。${args.decision.reason} 不建议一次性重仓。`;

  return {
    title: strategySection.title,
    description: strategySection.description,
    levels: strategySection.levels,
    currentMultiplier: args.decision.multiplier,
    currentReason: args.decision.reason,
    conclusionTitle: `今日市场结论（${qqqLatest?.date ?? vixLatest?.date ?? "暂无数据"}）`,
    conclusionRows: [
      { label: "市场估值", value: valuationText },
      { label: "市场情绪", value: emotionParts.join("；") },
      { label: "趋势", value: trendText },
      { label: "市场宽度", value: breadthConclusionText(args.breadth) },
      { label: "波动结构", value: termStructureConclusionText(args.termStructure) },
      { label: "尾部对冲", value: tailRiskConclusionText(args.tailRisk) },
      { label: "信用环境", value: creditSpreadConclusionText(args.creditSpread) },
      { label: "今日操作建议", value: actionText, prominent: true },
    ],
    history: args.history,
    sensitivity: buildSensitivity(args.signals, args.decision),
    disciplineTitle: strategySection.disciplineTitle,
    disciplineSubtitle: strategySection.disciplineSubtitle,
    disciplineItems: strategySection.disciplineItems,
  };
}

function collectNotices(args: {
  seriesByKey: Record<MarketKey, MarketSeries>;
  fearGreed: FearGreedData;
  valuation: ValuationData;
  termStructure: TermStructureData;
  tailRisk: TailRiskData;
  creditSpread: CreditSpreadData;
  breadth: BreadthData;
  vixQuoteError: string | null;
}) {
  const notices = Object.values(args.seriesByKey)
    .filter((series) => series.bars.length === 0 && series.error)
    .map((series) => `${series.providerSymbol}: ${series.error}`);
  if (args.fearGreed.error) notices.push(`CNN: ${args.fearGreed.error}`);
  if (args.valuation.error) notices.push(`${args.valuation.source}: ${args.valuation.error}`);
  if (args.termStructure.error) notices.push(`Cboe 期限结构: ${args.termStructure.error}`);
  if (args.tailRisk.error) notices.push(`Cboe SKEW/VVIX: ${args.tailRisk.error}`);
  if (args.creditSpread.error) notices.push(`FRED 高收益债 OAS: ${args.creditSpread.error}`);
  if (args.breadth.error) notices.push(`Twelve Data RSP: ${args.breadth.error}`);
  if (args.vixQuoteError) notices.push(`VIX 盘中报价: ${args.vixQuoteError}（已回退到日线收盘）`);

  const fallbackCounts = new Map<string, number>();
  Object.values(args.seriesByKey).forEach((series) => {
    if (series.bars.length === 0) return;
    // Cboe 是 VIX 的既有取数路径，不算兜底换源。
    if (!series.source || series.source === "Twelve Data" || series.source === "Cboe") return;
    fallbackCounts.set(series.source, (fallbackCounts.get(series.source) ?? 0) + 1);
  });
  if (fallbackCounts.size > 0) {
    const detail = Array.from(fallbackCounts.entries())
      .map(([source, count]) => `${source} ${count} 项`)
      .join("、");
    notices.push(`行情已切换到备用源：${detail}（Twelve Data 限流或不可用时自动切换，不影响计算结果）`);
  }

  return notices;
}

export async function buildDashboardData({ forceRefresh = false } = {}): Promise<DashboardPayload> {
  const [
    initialSeries,
    fearGreed,
    valuation,
    termStructureInputs,
    tailRiskInputs,
    creditSpreadInputs,
    breadthInputs,
    vixQuoteResult,
    macroResult,
  ] = await Promise.all([
    fetchAllMarketSeries(forceRefresh),
    fetchCnnFearGreed(forceRefresh),
    fetchSpyValuation(forceRefresh),
    fetchCboeTermStructureInputs(forceRefresh),
    fetchCboeTailRiskInputs(forceRefresh),
    fetchCreditSpreadInputs(forceRefresh),
    fetchBreadthInputs(),
    fetchVixQuote(forceRefresh),
    fetchMacroView(forceRefresh),
  ]);

  const vix = await resolveVixSeries(initialSeries.vix, forceRefresh);
  const vixQuote = vixQuoteResult.quote;
  const termStructure = buildTermStructure(vix, termStructureInputs);
  const tailRisk = buildTailRisk(tailRiskInputs);
  const creditSpread = buildCreditSpread(creditSpreadInputs);
  const seriesByKey = { ...initialSeries, vix };
  const qqq = seriesByKey.qqq;
  const spy = seriesByKey.spy;
  const breadth = buildBreadth(spy.bars, breadthInputs);

  const qqqRsi = calculateWilderRsi(qqq.bars, 6);
  const spyRsi = calculateWilderRsi(spy.bars, 6);
  const qqqDrawdown = calculateDrawdown52Week(qqq.bars);
  const spyDrawdown = calculateDrawdown52Week(spy.bars);
  const qqqMomentum = calculateReturn25Day(qqq.bars);
  const spyMomentum = calculateReturn25Day(spy.bars);
  const qqqDistance200 = calculateDistanceFrom200DayAverage(qqq.bars);

  const { metrics: sentimentMetrics, signals } = buildSentimentMetrics({
    vix,
    vixQuote,
    fearGreed,
    qqq,
    spy,
    valuation,
    qqqRsi,
    spyRsi,
    qqqDrawdown,
    spyDrawdown,
    qqqMomentum,
    spyMomentum,
  });
  const decision = calculateStrategy(signals, {
    percentile: valuation.percentile,
    stale: valuation.stale,
    ageDays: valuation.ageDays,
  });
  const notices = collectNotices({
    seriesByKey,
    fearGreed,
    valuation,
    termStructure,
    tailRisk,
    creditSpread,
    breadth,
    vixQuoteError: vixQuoteResult.error,
  });
  if (macroResult.errors.length > 0) {
    notices.push(...macroResult.errors.map((error) => `跨资产: ${error}`));
  }
  const marketAvailable = MARKET_INSTRUMENTS.some(
    (instrument) => seriesByKey[instrument.key].bars.length > 0,
  );
  const status: DashboardPayload["status"] =
    !marketAvailable && decision.missingCount === signals.length
      ? "unavailable"
      : notices.length > 0 || decision.missingCount > 0
        ? "partial"
        : "success";

  const qqqLatestBar = latestBar(qqq);
  const spyLatestBar = latestBar(spy);
  const vixLatestBar = latestBar(vix);
  const snapshotInput = {
    marketDate:
      qqqLatestBar?.date ??
      vixLatestBar?.date ??
      spyLatestBar?.date ??
      new Date().toISOString().slice(0, 10),
    multiplier: decision.multiplier,
    status: decision.status,
    reason: decision.reason,
    missingCount: decision.missingCount,
    signals,
    valuation: {
      pe: valuation.currentPe,
      percentile: valuation.percentile,
      asOf: valuation.currentDate,
      ageDays: valuation.ageDays,
      stale: valuation.stale,
      participates: !valuation.stale && valuation.percentile !== null,
    },
    fearGreed: {
      score: fearGreed.score,
      rating: fearGreed.rating,
      dataTime: fearGreed.dataTime,
    },
    termStructure: {
      vix9d: termStructure.vix9d,
      vix30d: termStructure.vix30d,
      vix3m: termStructure.vix3m,
      ratio: termStructure.ratio,
      state: termStructure.state,
      asOf: termStructure.asOf,
    },
    tailRisk: {
      skew: tailRisk.skew,
      skewPercentile: tailRisk.skewPercentile,
      vvix: tailRisk.vvix,
      vvixPercentile: tailRisk.vvixPercentile,
      asOf: tailRisk.asOf,
    },
    breadth: {
      gap200: breadth.gap200,
      relative20d: breadth.relative20d,
      ratioPercentile: breadth.ratioPercentile,
      state: breadth.state,
      asOf: breadth.asOf,
    },
    creditSpread: {
      latest: creditSpread.latest,
      percentile5y: creditSpread.percentile5y,
      change20d: creditSpread.change20d,
      state: creditSpread.state,
      asOf: creditSpread.asOf,
    },
    markets: {
      qqq: {
        date: qqqLatestBar?.date ?? null,
        close: qqqLatestBar?.close ?? null,
        rsi6: qqqRsi,
        drawdown52w: qqqDrawdown,
        return25d: qqqMomentum,
        distance200d: qqqDistance200,
      },
      spy: {
        date: spyLatestBar?.date ?? null,
        close: spyLatestBar?.close ?? null,
        rsi6: spyRsi,
        drawdown52w: spyDrawdown,
        return25d: spyMomentum,
        distance200d: null,
      },
      vixClose: vixLatestBar?.close ?? null,
    },
    health: { status, notices },
  };

  // 数据大面积缺失（限流、断网）时那一次计算不是真实市场状态，不写进历史。
  if (status !== "unavailable" && decision.missingCount < 2) {
    await recordDashboardSnapshot(snapshotInput);
  }
  const historyRecords = await readSnapshots();

  return {
    status,
    lastUpdated: formatDateTime(new Date()),
    indexSummaries: buildIndexSummaries(seriesByKey),
    indexConclusion: buildIndexConclusion({
      valuation,
      qqqDistance200,
      qqqMomentum,
      strategyMultiplier: decision.multiplier,
      strategyReason: decision.reason,
    }),
    relativeStrength: buildRelativeStrength(seriesByKey),
    macro: macroResult.view,
    sentimentMetrics,
    termStructure: buildTermStructureView(termStructure),
    tailRisk: buildTailRiskView(tailRisk),
    creditSpread: buildCreditSpreadView(creditSpread),
    breadth: buildBreadthView(breadth),
    vixPeHistory: buildVixPeHistory(vix, valuation),
    strategyData: buildStrategyData({
      valuation,
      fearGreed,
      vix,
      vixQuote,
      qqq,
      qqqDistance200,
      termStructure,
      tailRisk,
      creditSpread,
      breadth,
      signals,
      history: buildMultiplierHistory(historyRecords, qqq),
      decision,
    }),
    missingCount: decision.missingCount,
    notices,
  };
}

const unstableDashboardData = unstable_cache(
  async () => buildDashboardData({ forceRefresh: false }),
  ["us-stock-dashboard-real-data-v6"],
  { revalidate: MARKET_CACHE_SECONDS },
);

/**
 * 进程内再兜一层缓存：首次构建要抓 7 个行情符号 + 估值/情绪/信用，耗时 10 秒左右，
 * 并发请求必须共用同一个 Promise，否则会一起打爆免费额度。TTL 与 unstable_cache 一致。
 */
let dashboardMemoryCache: { storedAt: number; pending: Promise<DashboardPayload> } | null = null;

export function getCachedDashboardData(): Promise<DashboardPayload> {
  const cached = dashboardMemoryCache;
  if (cached && Date.now() - cached.storedAt < MARKET_CACHE_SECONDS * 1000) return cached.pending;

  const pending = unstableDashboardData();
  dashboardMemoryCache = { storedAt: Date.now(), pending };
  pending.catch(() => {
    if (dashboardMemoryCache?.pending === pending) dashboardMemoryCache = null;
  });
  return pending;
}

/** 手动刷新拿到新数据后回填内存缓存，避免下一次打开又走一遍网络。 */
export function rememberDashboardData(payload: DashboardPayload) {
  dashboardMemoryCache = { storedAt: Date.now(), pending: Promise.resolve(payload) };
}
