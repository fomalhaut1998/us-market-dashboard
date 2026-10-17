"use client";

import { useCallback, useEffect, useState } from "react";
import {
  dashboardMeta,
  dashboardTabs,
  tradingLocations,
} from "@/data/mockData";
import type { DashboardPayload, DashboardTabId } from "@/types/dashboard";
import { IndexView } from "./IndexView";
import { MarketFlowBackdrop } from "./MarketFlowBackdrop";
import { SectionCard } from "./SectionCard";
import { SentimentView } from "./SentimentView";
import { StrategyView } from "./StrategyView";
import { Tabs } from "./Tabs";
import { ThemeToggle } from "./ThemeToggle";
import { TradingLocationsGlobe } from "./TradingLocationsGlobe";

/** 上一次成功读取的 payload：刷新（或后端冷启动）期间先把旧内容顶上，避免整屏空白。 */
const DASHBOARD_CACHE_KEY = "us-stock-dashboard-payload-v1";
const DASHBOARD_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface CachedDashboard {
  savedAt: number;
  payload: DashboardPayload;
}

function readCachedDashboard(): CachedDashboard | null {
  try {
    const raw = window.localStorage.getItem(DASHBOARD_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedDashboard>;
    if (!parsed || typeof parsed.savedAt !== "number" || !parsed.payload) return null;
    if (Date.now() - parsed.savedAt > DASHBOARD_CACHE_MAX_AGE_MS) return null;
    const payload = parsed.payload;
    if (!Array.isArray(payload.indexSummaries) || !payload.strategyData) return null;
    return { savedAt: parsed.savedAt, payload };
  } catch {
    return null;
  }
}

function writeCachedDashboard(payload: DashboardPayload) {
  try {
    window.localStorage.setItem(
      DASHBOARD_CACHE_KEY,
      JSON.stringify({ savedAt: Date.now(), payload } satisfies CachedDashboard),
    );
  } catch {
    // 隐私模式或配额满时写不进去，忽略即可，不影响主流程。
  }
}

function formatCacheTime(timestamp: number) {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function DashboardLoading() {
  return (
    <SectionCard title="正在加载真实市场数据" description="正在从服务端读取日线、估值与情绪数据。">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3" aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            className="min-h-[220px] animate-pulse rounded-[22px] border border-line bg-surface-soft"
          />
        ))}
      </div>
    </SectionCard>
  );
}

function DashboardUnavailable({ message }: { message: string }) {
  return (
    <SectionCard title="真实数据暂不可用" description={message}>
      <div className="rounded-2xl border border-line bg-surface-soft px-4 py-5 text-sm leading-6 text-muted">
        页面没有使用模拟数值作为回退。请检查服务端环境变量或稍后点击“刷新数据”。
      </div>
    </SectionCard>
  );
}

interface DashboardProps {
  /** 服务端首屏已经取到的数据；有值时浏览器端不再重复请求。 */
  initialData?: DashboardPayload | null;
  initialError?: string | null;
}

export function Dashboard({ initialData = null, initialError = null }: DashboardProps = {}) {
  const [activeTab, setActiveTab] = useState<DashboardTabId>("index");
  const [data, setData] = useState<DashboardPayload | null>(initialData);
  const [loading, setLoading] = useState(initialData === null && initialError === null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [cachedAt, setCachedAt] = useState<number | null>(null);

  const refreshData = useCallback(async () => {
    setRefreshing(true);
    setError(null);

    try {
      const response = await fetch("/api/dashboard?refresh=1", {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("服务端未能返回真实数据");
      const payload = (await response.json()) as DashboardPayload;
      setData(payload);
      setCachedAt(null);
      writeCachedDashboard(payload);
    } catch (requestError) {
      setData((current) => current);
      setError(requestError instanceof Error ? requestError.message : "真实数据加载失败");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // 服务端已经把数据塞进首屏 HTML 了，这里只负责把它写进本地缓存，供下次冷启动兜底。
    if (initialData) {
      writeCachedDashboard(initialData);
      return;
    }

    const cached = readCachedDashboard();
    if (cached) {
      setData(cached.payload);
      setCachedAt(cached.savedAt);
      setLoading(false);
    }

    const controller = new AbortController();

    fetch("/api/dashboard", { cache: "no-store", signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("服务端未能返回真实数据");
        return response.json() as Promise<DashboardPayload>;
      })
      .then((payload) => {
        setData(payload);
        setCachedAt(null);
        writeCachedDashboard(payload);
        setError(null);
      })
      .catch((requestError: unknown) => {
        if (requestError instanceof DOMException && requestError.name === "AbortError") return;
        setError(requestError instanceof Error ? requestError.message : "真实数据加载失败");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [initialData]);

  let panel: React.ReactNode;
  if (loading && !data) {
    panel = <DashboardLoading />;
  } else if (!data) {
    panel = <DashboardUnavailable message={error ?? "暂无数据"} />;
  } else if (activeTab === "index") {
    panel = <IndexView data={data} />;
  } else if (activeTab === "sentiment") {
    panel = <SentimentView data={data} />;
  } else {
    panel = <StrategyView data={data.strategyData} />;
  }

  return (
    <main className="relative isolate min-h-screen px-4 py-9 sm:px-6 sm:py-12 lg:px-8 lg:py-14">
      <MarketFlowBackdrop />
      <TradingLocationsGlobe locations={tradingLocations} />
      <div className="relative z-10 mx-auto w-full max-w-[1180px]">
        <header>
          <div className="flex items-start justify-between gap-3 sm:items-center">
            <h1 className="text-[1.72rem] font-black tracking-[-0.035em] text-ink sm:text-[2.15rem] lg:text-[2.45rem]">
              {dashboardMeta.title}
            </h1>
            <div className="hidden items-center gap-2 sm:flex">
              <button
                type="button"
                onClick={() => void refreshData()}
                disabled={refreshing}
                aria-busy={refreshing}
                className="h-11 rounded-full border border-line bg-surface px-4 text-sm font-bold text-brand shadow-[var(--shadow-tab)] outline-none transition hover:border-brand/55 disabled:cursor-wait disabled:opacity-60 focus-visible:ring-4 focus-visible:ring-brand/25"
              >
                {refreshing ? "刷新中…" : "刷新数据"}
              </button>
              <ThemeToggle />
            </div>
          </div>
          <p className="mt-3 max-w-4xl text-[0.82rem] leading-6 text-muted sm:text-base sm:leading-7">
            最后更新：{loading && !data ? "加载中…" : data?.lastUpdated ?? "暂无数据"}
            <span className="mx-2 text-tertiary" aria-hidden="true">
              ·
            </span>
            {dashboardMeta.updateSchedule}
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="inline-flex items-center gap-2 text-[0.82rem] font-bold leading-5 text-brand sm:text-base">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#4c8df5] shadow-[0_0_0_5px_rgba(76,141,245,0.09)]" aria-hidden="true" />
              {dashboardMeta.scheduleBadge}
            </p>
            <div className="flex shrink-0 items-center gap-2 self-end sm:hidden">
              <button
                type="button"
                onClick={() => void refreshData()}
                disabled={refreshing}
                aria-busy={refreshing}
                className="h-10 shrink-0 whitespace-nowrap rounded-full border border-line bg-surface px-3.5 text-xs font-bold text-brand shadow-[var(--shadow-tab)] outline-none disabled:cursor-wait disabled:opacity-60 focus-visible:ring-4 focus-visible:ring-brand/25"
              >
                {refreshing ? "刷新中…" : "刷新数据"}
              </button>
              <ThemeToggle />
            </div>
          </div>
        </header>

        <div className="sticky top-0 z-30 -mx-4 mt-6 bg-page/85 px-4 py-3 backdrop-blur-md sm:static sm:mx-0 sm:mt-9 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
          <Tabs tabs={dashboardTabs} activeTab={activeTab} onChange={setActiveTab} />
        </div>

        {data && cachedAt !== null ? (
          <p
            className="mt-4 rounded-[18px] border border-brand/25 bg-brand/5 px-4 py-2.5 text-[0.76rem] leading-5 font-semibold text-brand sm:mt-5 sm:text-xs"
            role="status"
          >
            先显示上次读取的数据（{formatCacheTime(cachedAt)}），正在后台更新…
          </p>
        ) : null}

        {data && data.notices.length > 0 ? (
          <details className="group mt-4 rounded-[18px] border border-warning/35 bg-soft-yellow/60 px-4 py-3 sm:mt-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[0.8rem] font-bold leading-6 text-warning-strong sm:text-sm">
              <span>数据源提示 · {data.notices.length} 条</span>
              <span className="text-tertiary group-open:hidden">展开 ›</span>
              <span className="hidden text-tertiary group-open:inline">收起 ›</span>
            </summary>
            <ul className="mt-1.5 space-y-1 text-[0.76rem] leading-5 text-secondary sm:text-xs sm:leading-6">
              {data.notices.map((notice) => (
                <li key={notice}>{notice}</li>
              ))}
            </ul>
          </details>
        ) : null}

        <div className="mt-5 sm:mt-7">
          <div
            id={`panel-${activeTab}`}
            role="tabpanel"
            aria-labelledby={`tab-${activeTab}`}
            tabIndex={0}
            className="outline-none focus-visible:ring-4 focus-visible:ring-brand/15"
          >
            {panel}
          </div>
        </div>

        {error && data ? (
          <p className="mt-4 text-center text-xs font-semibold text-danger" role="status">
            本次刷新失败，仍显示上一次成功读取的数据。
          </p>
        ) : null}

        <footer className="space-y-1 pb-2 pt-8 text-center text-[0.72rem] leading-5 text-tertiary sm:space-y-0 sm:pt-10 sm:text-xs">
          <span className="block">
            数据来源：行情 Twelve Data（限流或失败时自动切换 Nasdaq / FMP 备用源）；波动率与期权数据
            Cboe；情绪 CNN Fear &amp; Greed；估值 Multpl 月度非估算值；信用利差 FRED
          </span>
          <span className="block">
            口径：全部取最近一个交易日收盘，服务端缓存 30 分钟；PE 为月度数据，滞后超过 45 天只标注、不参与倍率计算
          </span>
          <span className="block">
            本页只是把固定规则按阈值算给你看，不构成投资建议；规则与阈值见「策略与纪律」与情绪页的指标说明
          </span>
        </footer>
      </div>
    </main>
  );
}
