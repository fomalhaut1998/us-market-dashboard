import type {
  DashboardTab,
  MultiplierLevel,
  SignalGuideItem,
  StatusLegendItem,
  TradingLocationData,
} from "@/types/dashboard";

export type {
  ChangeTone,
  ConclusionRow,
  DashboardPayload,
  DashboardTab,
  DashboardTabId,
  IndexMetric,
  IndexSummary,
  MetricCardData,
  MultiplierLevel,
  StatusLegendItem,
  StatusTone,
  StrategyData,
  TradingLocationData,
  VixPeHistoryData,
  VixPeHistoryPoint,
} from "@/types/dashboard";

export const dashboardMeta = {
  title: "美股估值与情绪监控看板",
  updateSchedule: "日线数据服务端缓存 30 分钟；VIX 盘中报价随刷新更新（延迟约 15 分钟）",
  scheduleBadge: "真实数据 · 30 分钟缓存 · VIX 盘中延迟",
};

export const dashboardTabs: DashboardTab[] = [
  { id: "index", label: "指数指标" },
  { id: "sentiment", label: "情绪与说明" },
  { id: "strategy", label: "策略与纪律" },
];

export const indexSection = {
  title: "主要指数概览",
  description: "展示六项真实市场行情；ETF 代理均明确标注，价格不作为指数点位使用。",
};

export const indexConclusionSection = {
  title: "指数综合判断",
};

export const relativeStrengthSection = {
  title: "相对强弱（相对 SPY 的超额）",
  description:
    "把各标的近 20 / 60 个交易日的涨跌幅减去 SPY 同期涨跌幅，单位是百分点：正数说明跑赢大盘，负数说明跑输。用来判断这波行情是普涨，还是少数在拉。",
};

export const multiplierHistorySection = {
  title: "倍率轨迹",
  description:
    "每次收盘后的计算都会写一条本地快照（data/snapshots.jsonl）；这里按交易日去重，只看倍率本身怎么变。",
};

export const sensitivitySection = {
  title: "触发敏感性",
  description: "每个信号离触发还差多少、已触发的离退出还差多少。都是确定性算术，不预测方向。",
};

export const tradingLocationsSection = {
  title: "美国主要交易地点",
  description:
    "以点阵地球展示美国交易所与市场基础设施的代表性地点。悬停、点击或使用键盘选择节点查看说明；以下为固定地点信息，不代表实时交易状态。",
};

export const tradingLocations: TradingLocationData[] = [
  {
    id: "san-francisco",
    city: "旧金山",
    region: "加利福尼亚州",
    institution: "NYSE Arca（沿革）",
    detail: "太平洋交易所的历史所在地，也是美国西海岸电子交易发展的代表节点。",
    longitude: -122.4194,
    latitude: 37.7749,
    labelSide: "right",
  },
  {
    id: "chicago",
    city: "芝加哥",
    region: "伊利诺伊州",
    institution: "CME Group · Cboe",
    detail: "美国期货、期权与波动率产品的重要交易中心。",
    longitude: -87.6298,
    latitude: 41.8781,
    labelSide: "left",
  },
  {
    id: "new-york",
    city: "纽约",
    region: "纽约州",
    institution: "NYSE · Nasdaq MarketSite",
    detail: "美国股票上市、现货交易与资本市场活动最集中的城市节点。",
    longitude: -74.006,
    latitude: 40.7128,
    labelSide: "left",
  },
  {
    id: "mahwah",
    city: "马瓦",
    region: "新泽西州",
    institution: "NYSE 流动性中心",
    detail: "为纽约证券交易所市场数据与电子交易提供核心托管和连接服务。",
    longitude: -74.1438,
    latitude: 41.0887,
    labelSide: "left",
  },
  {
    id: "philadelphia",
    city: "费城",
    region: "宾夕法尼亚州",
    institution: "Nasdaq PHLX",
    detail: "费城证券交易所的历史所在地，与半导体指数和期权市场联系紧密。",
    longitude: -75.1652,
    latitude: 39.9526,
    labelSide: "left",
  },
  {
    id: "atlanta",
    city: "亚特兰大",
    region: "佐治亚州",
    institution: "Intercontinental Exchange",
    detail: "ICE 总部所在地；ICE 是纽约证券交易所集团的母公司。",
    longitude: -84.388,
    latitude: 33.749,
    labelSide: "left",
  },
];

export const sentimentSection = {
  title: "极端买入信号监控（三档）",
  descriptionParts: [
    { text: "每格显示当前值、触发条件；", tone: "default" },
    { text: "绿=触发（极端买入）", tone: "triggered" },
    { text: "、", tone: "default" },
    { text: "黄=接近触发（进入观察区）", tone: "near" },
    {
      text: "。无论数值高（如VIX飙升）或低（如RSI超卖、恐贪极低），同属「买入机会」逻辑即同色提醒。",
      tone: "default",
    },
  ] as const,
};

export const statusLegend: StatusLegendItem[] = [
  { tone: "triggered", label: "触发（极端买入）" },
  { tone: "near", label: "接近触发（观察区）" },
  { tone: "stale", label: "数据陈旧（不参与计算）" },
  { tone: "normal", label: "未触发 / 暂无数据" },
];

export const signalGuideSection = {
  title: "六个指标分别在看什么",
  description:
    "点开任意一项：它量的是什么、数据从哪来、三档阈值具体卡在哪个数字。颜色只有三种含义——绿=已触发（极端买入区）、黄=进入观察区、灰=未触发；红色只出现在「波动率结构」里，那是「越红越危险」的风险读数，不是买点。",
};

export const signalGuideItems: SignalGuideItem[] = [
  {
    name: "VIX（波动率指数）",
    meaning:
      "标普500未来 30 天的隐含波动率，由期权价格反推出来——本质是「恐慌保险」的报价：买保险的人越多、越急，它越高。",
    calc: "Cboe 官方 VIX 日线历史；盘中现价用 Yahoo Finance / Cboe 延迟报价（约 15 分钟），点击「刷新数据」更新。",
    bands: [
      { tone: "triggered", range: "≥ 30", label: "触发：市场已经在为恐慌付费" },
      { tone: "near", range: "25 – 30", label: "观察：情绪开始紧张" },
      { tone: "normal", range: "< 25", label: "未触发：常态" },
    ],
    caveat:
      "绝对值受长期波动中枢影响：低波年份 25 就已经很慌，高波年份 30 也平常。它只回答「保险贵不贵」，不回答「跌了多少」。",
  },
  {
    name: "恐惧贪婪（CNN Fear & Greed）",
    meaning:
      "CNN 用 7 个子因子（股价动量、股价强度、市场宽度、看跌看涨比、垃圾债需求、避险需求、股价与均线关系）合成的 0–100 情绪分。",
    calc: "CNN 官方接口实时读数，每次刷新重新取；它只给当前值，不带历史序列。",
    bands: [
      { tone: "triggered", range: "< 25", label: "触发：极度恐惧" },
      { tone: "near", range: "25 – 45", label: "观察：恐惧 / 偏谨慎" },
      { tone: "normal", range: "≥ 45", label: "未触发：中性偏贪婪" },
    ],
    caveat:
      "这是别人算好的综合分，子因子权重不公开、天天变。当「情绪温度计」用可以，别当精确刻度，也别拿它做单因子决策。",
  },
  {
    name: "RSI(6)（六日相对强弱）",
    meaning:
      "近 6 个交易日的涨跌力量对比，0–100：越低说明最近卖压越集中。卡片上的判定值取 QQQ（纳指代理），副行同时给 SPY。",
    calc: "本地用 Wilder 平滑对 Twelve Data 日线现算 6 日 RSI，不依赖第三方指标值。",
    bands: [
      { tone: "triggered", range: "≤ 22", label: "触发：短线超卖" },
      { tone: "near", range: "22 – 28", label: "观察：偏弱" },
      { tone: "normal", range: "> 28", label: "未触发：常态" },
    ],
    caveat:
      "低置信信号：6 天窗口太短，单靠它顶到 2× 很容易被噪声骗。所以规则里 RSI 单独触发只给 1.5×，必须等第二项指标确认。",
  },
  {
    name: "PE 百分位（标普500 TTM PE 近5年分位）",
    meaning:
      "标普500 滚动市盈率在过去 5 年里排第几：20% 表示比过去五年 80% 的时间都便宜，80% 表示比八成时间都贵。",
    calc:
      "Multpl 月度 PE 表，剔除以 † 标注的估算值、只留实际值；分位 = 近 5 年非估算样本中不高于当前值的占比。",
    bands: [
      { tone: "triggered", range: "≤ 20%", label: "触发：估值便宜" },
      { tone: "near", range: "20% – 30%", label: "观察：偏低" },
      { tone: "normal", range: "> 30%", label: "未触发：正常 / 偏贵（≥80% 压到 0.5×，≥90% 压到 0.25×）" },
    ],
    caveat:
      "月度发布、天生滞后。滞后超过 45 天只标注不参与倍率——所以你常看到「已滞后 N 天，未参与倍率」。它是唯一会「反向」压低倍率的指标。",
  },
  {
    name: "52 周回撤",
    meaning: "当前收盘价相对过去 52 周最高收盘跌了多少，回答「离前高还有多远」。",
    calc: "Twelve Data 日线，取最近 252 个交易日的最高收盘作基准，按 QQQ 计算。",
    bands: [
      { tone: "triggered", range: "≤ -20%", label: "触发：技术性熊市门槛" },
      { tone: "near", range: "-15% – -20%", label: "观察：中度回撤" },
      { tone: "normal", range: "> -15%", label: "未触发：常态" },
    ],
    caveat:
      "和「25 日急跌」「RSI」量的是同一件事的不同切面（价格跌了多少），会同时亮灯。看到三项齐绿不是三重证据，是一件事说了三遍。",
  },
  {
    name: "25 日急跌",
    meaning: "近 25 个交易日的累计涨跌幅，专门抓「一个月内跌得很急」的行情。",
    calc: "Twelve Data 日线，最新收盘 ÷ 25 个交易日前收盘 − 1，按 QQQ 计算。",
    bands: [
      { tone: "triggered", range: "≤ -12%", label: "触发：一个月跌掉一成多" },
      { tone: "near", range: "-8% – -12%", label: "观察：下跌在加速" },
      { tone: "normal", range: "> -8%", label: "未触发：常态" },
    ],
    caveat:
      "同样属于价格动量类，与回撤、RSI 高度相关。这类信号擅长确认「恐慌已经发生」，不擅长预测「还会跌多少」。",
  },
];

export const termStructureSection = {
  title: "波动率结构",
};

export const tailRiskSection = {
  title: "尾部对冲需求",
};

export const breadthSection = {
  title: "市场宽度（等权 vs 市值权）",
  description:
    "RSP 是标普500的等权版本、SPY 是市值权版本：同一批公司，只是权重不同。两者的强弱差，量的是「这波涨跌是大多数股票在动，还是少数巨头在拉」。",
};

export const creditSpreadSection = {
  title: "信用市场（高收益债 OAS）",
  description:
    "高收益债相对同期限国债的利差：量的是企业借钱要多付多少风险溢价，与股市涨跌是两条不同的轴。它是 T+1 公布的日频数据，只作背景读数。",
};

export const vixPeHistorySection = {
  title: "过去六个月 VIX 与 PE 分位",
  description:
    "对比真实月末 VIX 与标普500月度 PE 近5年分位；PE 每月只取当月新出现的非估算值，没有新数据的月份留空，不再重复上月数值。",
  vixLabel: "VIX（月末）",
  peLabel: "标普500 PE近5年分位",
};

export const strategySection = {
  title: "智能定投策略（估值动能 DCA）",
  description:
    "五档投入倍率（0.25–2×）：PE 分位 ≥80% / ≥90% 时按估值档压到 0.5× / 0.25×；无估值压力时，一项高置信指标触发（或两项任意指标同时触发）→ 2×，仅进入观察区 → 1.5×。陈旧数据不参与计算。",
  levels: [
    { value: "0.25×", label: "估值极高\n微量投入" },
    { value: "0.5×", label: "估值偏高\n减量" },
    { value: "1×", label: "常态基准" },
    { value: "1.5×", label: "接近信号\n增配" },
    { value: "2×", label: "恐慌深跌\n加倍" },
  ] satisfies MultiplierLevel[],
  disciplineTitle: "我的操作纪律（自省提醒）",
  disciplineSubtitle: "买入纪律",
  disciplineItems: [
    "严格按定投指标执行常规定投，不因单日涨跌临时改变规则。",
    "一项高置信指标触发，或任意两项指标同时触发（绿）→ 2×；只有 RSI(6) 单项触发时按 1.5× 处理，等第二项确认。",
    "没有触发但至少一项进入观察区（黄）→ 1.5×。",
    "PE 近5年分位 ≥ 80% → 0.5×、≥ 90% → 0.25×：估值越高投入越少，不为情绪加码。",
    "数据陈旧（PE 滞后超过 45 天）只标注、不参与倍率计算。",
    "两项以上真实数据缺失时回到 1×，并明确标记“数据不足”。",
    "不追涨、不恐慌割肉，不使用一次性重仓替代分批布局。",
  ],
};
