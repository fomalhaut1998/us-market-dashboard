export type MacroAssetKey = "oil" | "rates" | "gold" | "bitcoin";

export type MacroValueKind = "price" | "yield";

export interface MacroAssetConfig {
  key: MacroAssetKey;
  /** Yahoo Finance chart 使用的代码。 */
  symbol: string;
  name: string;
  symbolLabel: string;
  kind: MacroValueKind;
  /** 价格资产展示的小数位；收益率固定两位。 */
  decimals: number;
  /** 52 周区间样本长度：美股/ETF 取 252 个交易日，7×24 交易的比特币取 365 个自然日。 */
  range52wWindow: number;
  /** 卡片变化率的时间窗口文案。 */
  changeWindowLabel: string;
  /** 一句话说明这个读数在股市里看什么。 */
  hint: string;
}

/** 跨资产是背景数据，不需要跟主行情一样每 30 分钟重取。 */
export const MACRO_CACHE_SECONDS = 4 * 60 * 60;

export const macroSection = {
  title: "跨资产背景（不参与倍率）",
  description:
    "四个跨资产读数，只用来补充背景：原油、长端利率、黄金、比特币。它们不参与定投倍率，也不是买卖信号。",
  note: "颜色只表示近 20 日数值变化方向，不表示利好或利空。传统资产按 252 个交易日算 52 周区间、近 20 个交易日算变化；7×24 交易的比特币按 365 个自然日算 52 周区间、近 20 个自然日算变化。原油、黄金、比特币是价格涨跌；美债是收益率变动（bp）。ETF 代理有跟踪误差，收益率与债券价格反向；跨资产关系会随市场状态变化。",
};

export const MACRO_ASSETS: MacroAssetConfig[] = [
  {
    key: "oil",
    symbol: "USO",
    name: "原油（WTI）",
    symbolLabel: "USO · WTI ETF 代理",
    kind: "price",
    decimals: 2,
    range52wWindow: 252,
    changeWindowLabel: "近20交易日",
    hint: "油价上行 → 通胀与成本压力",
  },
  {
    key: "rates",
    symbol: "^TNX",
    name: "美债 10Y 收益率",
    symbolLabel: "TNX · 10Y 收益率",
    kind: "yield",
    decimals: 2,
    range52wWindow: 252,
    changeWindowLabel: "近20交易日",
    hint: "收益率上行 → 折现率压力",
  },
  {
    key: "gold",
    symbol: "GLD",
    name: "黄金",
    symbolLabel: "GLD · 黄金 ETF",
    kind: "price",
    decimals: 2,
    range52wWindow: 252,
    changeWindowLabel: "近20交易日",
    hint: "金价走弱 → 实际利率偏强",
  },
  {
    key: "bitcoin",
    symbol: "BTC-USD",
    name: "比特币",
    symbolLabel: "BTC-USD · 现货",
    kind: "price",
    decimals: 0,
    range52wWindow: 365,
    changeWindowLabel: "近20日",
    hint: "风险偏好与流动性温度计",
  },
];
