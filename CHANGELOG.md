# 更新日志

本项目遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)，版本号维护在 `package.json`。

## [1.0.1] - 2026-10-17

### 修复

- 手机端吸顶标签栏被背景地球的固定拖拽层与热区遮挡，导致「策略与纪律」等标签无法点击；触摸设备上禁用地球命中测试并隐藏提示框，桌面端交互保持不变。

## [1.0.0] - 2026-10-17

首个开源版本。

### 新增

- 美股指数看板：SPY、QQQ、DIA、SOXX、IWM、纳斯达克综合指数的价格、52 周区间、距 52 周高点与数据来源。
- 相对强弱面板：各标的近 20 / 60 个交易日相对 SPY 的超额收益。
- 情绪指标：VIX、CNN 恐惧贪婪、RSI(6)、标普 500 PE 近 5 年分位、52 周回撤、25 日涨跌幅。
- 波动率结构：VIX 9 天 / 30 天 / 3 个月期限结构，SKEW 与 VVIX 的 5 年分位。
- 市场宽度与信用利差：RSP / SPY 强弱差，美国高收益债 OAS 与 20 日变化。
- VIX / PE 历史走势图，以及每个面板的口径说明和注意事项。
- 策略页：固定倍率规则、倍率轨迹、触发敏感性与纪律清单。
- 服务端 30 分钟缓存、手动刷新 60 秒节流与多数据源自动回退。
- 浅色 / 深色主题、移动端适配、冷启动骨架屏与浏览器端数据缓存。
- `GET /api/dashboard` 接口与可选的每日倍率快照（JSONL）。
- 页头开源标识与页脚项目信息：GitHub 仓库、版本号、Release、更新日志、许可与问题反馈入口。
- Open Graph / Twitter 元信息与站点图标。
- README、环境变量示例、MIT 许可与 GitHub Actions CI。

### 说明

- 行情为日线收盘或延迟数据，不是实时报价。
- 所有指标只描述历史数据，不构成投资建议。

[1.0.1]: https://github.com/fomalhaut1998/us-market-dashboard/releases/tag/v1.0.1
[1.0.0]: https://github.com/fomalhaut1998/us-market-dashboard/releases/tag/v1.0.0
