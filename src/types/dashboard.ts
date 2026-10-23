export type DashboardTabId = "index" | "sentiment" | "strategy";

export type StatusTone = "triggered" | "near" | "normal" | "risk" | "stale";

/** 一块面板的颜色图例：每个色点对应一档数值范围。 */
export interface ToneLegendItem {
  tone: StatusTone;
  label: string;
  range: string;
}

export interface ToneLegend {
  caption: string;
  items: ToneLegendItem[];
}

export type ChangeTone = "positive" | "negative" | "neutral";

export interface DashboardTab {
  id: DashboardTabId;
  label: string;
}

export interface IndexMetric {
  label: string;
  value: string;
}

export interface IndexRange52Week {
  lowLabel: string;
  highLabel: string;
  /** 高位 / 中位 / 低位。 */
  positionLabel: string;
  /** 现价在区间里的位置，用于画进度条。 */
  positionPct: number;
  fromHighLabel: string;
}

export interface IndexSummary {
  id: string;
  name: string;
  symbol: string;
  value: string;
  change: string;
  directionLabel: string;
  changeTone: ChangeTone;
  metrics: IndexMetric[];
  /** 最近一年高低点区间；样本不足时为 null。 */
  range52w: IndexRange52Week | null;
}

export interface RelativeStrengthRow {
  id: string;
  name: string;
  symbol: string;
  excess20dLabel: string;
  excess60dLabel: string;
  excess20dTone: ChangeTone;
  excess60dTone: ChangeTone;
}

export interface RelativeStrengthView {
  asOfLabel: string;
  baselineLabel: string;
  rows: RelativeStrengthRow[];
  note: string;
}

export interface MacroRange52Week {
  lowLabel: string;
  highLabel: string;
  /** 高位 / 中位 / 低位。 */
  positionLabel: string;
  /** 现值在区间里的位置，用于画进度条。 */
  positionPct: number;
}

export interface MacroAssetView {
  key: string;
  name: string;
  symbolLabel: string;
  value: string;
  changeLabel: string;
  changeTone: ChangeTone;
  /** 近一年高低点区间；样本不足时为 null。 */
  range52w: MacroRange52Week | null;
  hint: string;
  asOf: string | null;
  source: string;
  dataKind: string;
  error: string | null;
}

export interface MacroView {
  title: string;
  description: string;
  asOfLabel: string;
  assets: MacroAssetView[];
  note: string;
}

export interface SensitivityRow {
  key: string;
  name: string;
  valueLabel: string;
  triggerLabel: string;
  gapLabel: string;
  stateLabel: string;
  tone: StatusTone;
}

export interface SensitivityView {
  rows: SensitivityRow[];
  note: string;
}

export interface MultiplierHistoryPoint {
  date: string;
  shortDate: string;
  multiplier: string;
  tone: StatusTone;
}

export interface MultiplierHistoryView {
  points: MultiplierHistoryPoint[];
  rangeLabel: string;
  last2xLabel: string;
  sinceLabel: string;
  insufficientLabel: string | null;
}

export interface MetricCardData {
  id: string;
  name: string;
  value: string;
  badgeLabel: string;
  stateLabel: string;
  triggerCondition: string;
  description: string;
  tone: StatusTone;
}

export type GuideBandTone = "triggered" | "near" | "normal";

export interface SignalGuideBand {
  tone: GuideBandTone;
  range: string;
  label: string;
}

export interface SignalGuideItem {
  name: string;
  /** 一句话：这个指标量的是什么。 */
  meaning: string;
  /** 数据来源与算法。 */
  calc: string;
  /** 三档阈值，与卡片上的配色一一对应。 */
  bands: SignalGuideBand[];
  /** 用的时候要打的折扣。 */
  caveat: string;
}

export interface StatusLegendItem {
  tone: StatusTone;
  label: string;
}

export interface MultiplierLevel {
  value: string;
  label: string;
}

export interface ConclusionRow {
  label: string;
  value: string;
  prominent?: boolean;
}

export interface VixPeHistoryPoint {
  month: string;
  vix: number | null;
  pePercentile: number | null;
}

export interface VixPeHistoryData {
  title: string;
  description: string;
  vixLabel: string;
  peLabel: string;
  currentVix: string;
  currentPePercentile: string;
  analysis: string;
  points: VixPeHistoryPoint[];
}

export interface StrategyData {
  title: string;
  description: string;
  levels: MultiplierLevel[];
  currentMultiplier: string;
  currentReason: string;
  conclusionTitle: string;
  conclusionRows: ConclusionRow[];
  /** 历史快照里按交易日去重后的倍率变化。 */
  history: MultiplierHistoryView;
  /** 每个信号离触发 / 离退出还差多少的确定性算术。 */
  sensitivity: SensitivityView;
  disciplineTitle: string;
  disciplineSubtitle: string;
  disciplineItems: string[];
}

export interface TermStructurePoint {
  label: string;
  value: string;
  hint: string;
}

export interface TermStructureView {
  title: string;
  description: string;
  points: TermStructurePoint[];
  ratioLabel: string;
  stateLabel: string;
  tone: StatusTone;
  legend: ToneLegend;
  note: string;
}

export interface TailRiskItemView {
  label: string;
  value: string;
  percentileLabel: string;
  hint: string;
  tone: StatusTone;
}

export interface TailRiskView {
  title: string;
  asOfLabel: string;
  items: TailRiskItemView[];
  legend: ToneLegend;
  note: string;
}

export interface BreadthFactView {
  label: string;
  value: string;
}

export interface BreadthView {
  title: string;
  description: string;
  asOfLabel: string;
  value: string;
  valueLabel: string;
  stateLabel: string;
  facts: BreadthFactView[];
  tone: StatusTone;
  legend: ToneLegend;
  note: string;
}

export interface CreditSpreadFactView {
  label: string;
  value: string;
}

export interface CreditSpreadView {
  title: string;
  description: string;
  asOfLabel: string;
  value: string;
  stateLabel: string;
  facts: CreditSpreadFactView[];
  tone: StatusTone;
  legend: ToneLegend;
  note: string;
}

export interface TradingLocationData {
  id: string;
  city: string;
  region: string;
  institution: string;
  detail: string;
  longitude: number;
  latitude: number;
  labelSide: "left" | "right";
}

export interface DashboardPayload {
  status: "success" | "partial" | "unavailable";
  lastUpdated: string;
  indexSummaries: IndexSummary[];
  indexConclusion: {
    title: string;
    rows: ConclusionRow[];
  };
  relativeStrength: RelativeStrengthView;
  macro: MacroView;
  sentimentMetrics: MetricCardData[];
  termStructure: TermStructureView;
  tailRisk: TailRiskView;
  creditSpread: CreditSpreadView;
  breadth: BreadthView;
  vixPeHistory: VixPeHistoryData;
  strategyData: StrategyData;
  missingCount: number;
  notices: string[];
}
