import type { MarketKey } from "@/types/market";

export const MARKET_CACHE_SECONDS = 30 * 60;

export interface MarketInstrumentConfig {
  key: MarketKey;
  providerSymbol: string;
  name: string;
  symbolLabel: string;
  assetType: "etf" | "index";
}

export const MARKET_INSTRUMENTS: MarketInstrumentConfig[] = [
  {
    key: "spy",
    providerSymbol: "SPY",
    name: "标普500（SPY代理）",
    symbolLabel: "SPY · ETF代理",
    assetType: "etf",
  },
  {
    key: "qqq",
    providerSymbol: "QQQ",
    name: "纳斯达克100（QQQ代理）",
    symbolLabel: "QQQ · ETF代理",
    assetType: "etf",
  },
  {
    key: "dia",
    providerSymbol: "DIA",
    name: "道琼斯（DIA代理）",
    symbolLabel: "DIA · ETF代理",
    assetType: "etf",
  },
  {
    key: "soxx",
    providerSymbol: "SOXX",
    name: "半导体指数（SOXX代理）",
    symbolLabel: "SOXX · ETF代理",
    assetType: "etf",
  },
  {
    key: "iwm",
    providerSymbol: "IWM",
    name: "罗素2000（IWM代理）",
    symbolLabel: "IWM · ETF代理",
    assetType: "etf",
  },
  {
    key: "ixic",
    providerSymbol: "IXIC",
    name: "纳斯达克综合指数",
    symbolLabel: "IXIC · 指数",
    assetType: "index",
  },
];

export const VIX_INSTRUMENT: MarketInstrumentConfig = {
  key: "vix",
  providerSymbol: "VIX",
  name: "VIX",
  symbolLabel: "VIX · 指数",
  assetType: "index",
};
