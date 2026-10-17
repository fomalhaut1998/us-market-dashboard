# 美股估值与情绪监控看板

一个用 Next.js 搭的美股大盘位置与情绪看板：把指数行情、波动率结构、恐惧贪婪、估值分位、市场宽度、信用利差放在同一屏，再按固定规则给出定投倍率提示。

> 本项目只做数据展示与研究记录，不构成任何投资建议。

![桌面端浅色主题](docs/screenshots/dashboard-desktop.png)

![移动端深色主题](docs/screenshots/dashboard-mobile-dark.png)

## 功能

- **指数概览**：SPY、QQQ、DIA、SOXX、IWM 与纳斯达克综合指数，含 52 周区间、距高点、数据来源与日期。
- **相对强弱**：各标的近 20 / 60 个交易日相对 SPY 的超额收益。
- **极端信号监控**：VIX、CNN 恐惧贪婪、RSI(6)、标普 500 PE 近 5 年分位、52 周回撤、25 日涨跌幅；分触发 / 观察 / 陈旧三态。
- **波动率结构**：9 天、30 天、3 个月 VIX，期限结构比值，以及 SKEW / VVIX 的 5 年分位。
- **市场宽度**：RSP（标普 500 等权）与 SPY（市值权）的强弱差与比值分位。
- **信用市场**：美国高收益债 OAS、5 年分位与 20 日变化。
- **策略与纪律**：倍率规则、倍率轨迹（本地每日快照）与触发敏感性。
- **体验**：浅色 / 深色主题、移动端适配、服务端 30 分钟缓存、冷启动骨架屏、数据源提示。

## 技术栈

Next.js 16（App Router / Server Components） · React 19 · TypeScript · Tailwind CSS 4

## 快速开始

要求 Node.js **20.9+**（推荐 22 LTS）。

```bash
git clone <仓库地址>
cd us-market-dashboard
npm install

# 配置环境变量
cp .env.example .env.local      # Windows: copy .env.example .env.local

npm run dev
```

打开 <http://localhost:3000>。

不配置任何 key 也能启动：Cboe、CNN、Multpl 的公开页面仍可读取，但 Twelve Data 的行情会缺失。想看到完整面板，建议至少配置 `TWELVE_DATA_API_KEY`。

## 环境变量

| 变量 | 必填 | 用途 |
| --- | --- | --- |
| `TWELVE_DATA_API_KEY` | 推荐 | SPY / QQQ / DIA / SOXX / IWM 等日线。免费档约 8 credits/分钟，整页一次刷新会用到 7 个符号。 |
| `FMP_API_KEY` | 可选 | Twelve Data 不提供纳斯达克综合指数时，用 `^IXIC` 兜底。免费档可用范围有限。 |
| `FRED_API_KEY` | 可选 | 高收益债 OAS（`BAMLH0A0HYM2`）。不填会回退到 fredgraph CSV，速度较慢。免费申请：<https://fredaccount.stlouisfed.org/apikeys> |
| `TWELVE_DATA_NASDAQ_SYMBOL` | 可选 | 纳斯达克综合指数代码，默认 `IXIC`。 |
| `TWELVE_DATA_VIX_SYMBOL` | 可选 | VIX 代码，默认 `VIX`。 |

## 数据来源与延迟

| 数据 | 来源 | 说明 |
| --- | --- | --- |
| 指数 / ETF 行情 | Twelve Data → Nasdaq → Financial Modeling Prep | 依次回退；Twelve Data 返回 429 后冷却 5 分钟，再失败则使用最近一次成功的数据。 |
| VIX、SKEW、VVIX | Cboe | 官方日线收盘。 |
| 恐惧贪婪 | CNN | 公开页面上的当前分数。 |
| 标普 500 PE | Multpl | 月度数据，只取非估算值；滞后超过 45 天时只标注、不参与倍率计算。 |
| 高收益债 OAS | FRED | `BAMLH0A0HYM2`，T+1 公布的日频数据。 |
| 市场宽度 | RSP / SPY | RSP 行情单独缓存 2 小时；SPY 走整页 30 分钟缓存。 |

所有行情都是日线收盘或延迟数据，不是实时报价。仓库不附带行情数据，运行时从上述公开来源获取；使用前请遵守各数据源的条款。

## 倍率规则

倍率只由固定规则计算，不做预测：

- 估值优先：标普 500 PE 近 5 年分位 **≥ 90% → 0.25×**，**≥ 80% → 0.5×**；数据陈旧时不参与。
- 有 1 项高置信信号触发，或 2 项信号互相确认 → **2×**。
- 只有 RSI(6) 一项低置信信号触发 → **1.5×**；有信号进入观察区也记 **1.5×**。
- 其余情况维持 **1×**。

阈值集中在 [`src/config/thresholds.ts`](src/config/thresholds.ts)，信号置信度与倍率档位在 [`src/config/strategy.ts`](src/config/strategy.ts)。

## 缓存与快照

- 服务端缓存 30 分钟；手动刷新走 `/api/dashboard?refresh=1`，并做 60 秒节流，避免打爆免费额度。
- 每次有效计算会向 `data/snapshots.jsonl` 追加一条每日快照（本地文件，已在 `.gitignore` 中排除），策略页的倍率轨迹从这里读取。
- 首次冷启动需要抓取多个数据源，通常 10–20 秒；之后 30 分钟内直接读缓存。

## 目录结构

```text
src/app                   页面、布局与 /api/dashboard
src/components/dashboard  面板、图表与交互组件
src/lib/server            取数、缓存、备用源与数据组装
src/lib                   指标计算与策略判断
src/config                阈值、策略与市场配置
src/data                  Natural Earth 点云（地球背景）
docs/screenshots          README 截图
```

## 脚本

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 本地开发 |
| `npm run build` | 生产构建 |
| `npm run start` | 启动生产服务 |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript 类型检查 |

## 已知限制

- 免费数据源有限流与延迟；限流时页面会提示并自动切换备用源。
- CNN、Multpl 走公开页面解析，页面结构变化可能导致该卡片失效。
- 只覆盖美股，不含 A 股、港股或其他市场。
- 所有结论都是对历史数据的描述，不预测方向，也不构成投资建议。

## 数据与许可

- 代码以 [MIT](LICENSE) 许可发布。
- 行情、指数、波动率、情绪与估值数据的版权归各来源所有，本项目不重新分发这些数据。
- 地球点云来自 Natural Earth 1:50m（公有领域），经 `topojson/world-atlas` 生成。

## 免责声明

本项目仅用于数据展示与个人研究，不构成任何投资建议。据此操作，风险自负。
