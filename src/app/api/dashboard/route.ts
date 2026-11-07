import { NextResponse } from "next/server";
import {
  buildDashboardData,
  getCachedDashboardData,
  rememberDashboardData,
} from "@/lib/server/dashboardData";
import type { DashboardPayload } from "@/types/dashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 强制刷新最小间隔：免费行情额度是 8 credit/分钟，连点两下就会把整页打成 429。
 * 关键：被节流时必须返回「上一次真正抓到的新数据」，绝不能退回 getCachedDashboardData()——
 * 后者在冷实例上会命中最多 30 分钟前的 unstable_cache，用户就会看到「点了刷新却还是旧数据」。
 * 抓取失败不占用节流窗口，用户可以立即重试。
 */
const REFRESH_MIN_INTERVAL_MS = 60_000;
let lastSuccessfulRefreshAt = 0;
let lastSuccessfulPayload: DashboardPayload | null = null;
/** 正在进行的强制刷新：并发请求复用同一个结果，避免重复抓取。 */
let inFlightRefresh: Promise<DashboardPayload> | null = null;

export async function GET(request: Request) {
  try {
    const wantsRefresh = new URL(request.url).searchParams.get("refresh") === "1";
    const now = Date.now();

    let payload: DashboardPayload;
    let refreshed = false;
    let retryAfter: number | null = null;

    if (!wantsRefresh) {
      payload = await getCachedDashboardData();
    } else if (inFlightRefresh) {
      // 已有强制刷新在跑：直接等它的新结果，而不是去读旧缓存。
      payload = await inFlightRefresh;
      refreshed = true;
    } else if (
      lastSuccessfulPayload &&
      now - lastSuccessfulRefreshAt < REFRESH_MIN_INTERVAL_MS
    ) {
      // 冷却期内：返回上一次真正抓到的新数据（绝不是 30 分钟前的 SSR 缓存）。
      payload = lastSuccessfulPayload;
      retryAfter = Math.max(
        1,
        Math.ceil((REFRESH_MIN_INTERVAL_MS - (now - lastSuccessfulRefreshAt)) / 1000),
      );
    } else {
      inFlightRefresh = buildDashboardData({ forceRefresh: true });
      try {
        payload = await inFlightRefresh;
        lastSuccessfulPayload = payload;
        lastSuccessfulRefreshAt = Date.now();
        refreshed = true;
        // 回填进程内缓存：同一实例下一次 SSR 首屏直接拿到这份新数据，不必再触发一次后台刷新。
        rememberDashboardData(payload);
      } finally {
        inFlightRefresh = null;
      }
    }

    // 明确告诉前端这次是不是真的重新抓了：被节流时前端不能再假装「刷新成功」。
    const headers: Record<string, string> = {
      "Cache-Control": "no-store",
      "X-Dashboard-Refreshed": refreshed ? "1" : "0",
    };
    if (typeof payload.generatedAt === "number") {
      headers["X-Dashboard-Generated-At"] = String(payload.generatedAt);
    }
    if (retryAfter !== null) headers["X-Dashboard-Retry-After"] = String(retryAfter);

    return NextResponse.json(payload, { headers });
  } catch (error) {
    // 失败不设置 lastSuccessfulRefreshAt / 不占用节流窗口，用户可立即重试。
    return NextResponse.json(
      {
        error: "真实数据加载失败",
        detail: error instanceof Error ? error.message : "未知错误",
      },
      { status: 503, headers: { "Cache-Control": "no-store", "X-Dashboard-Refreshed": "0" } },
    );
  }
}
