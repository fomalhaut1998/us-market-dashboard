import { NextResponse } from "next/server";
import {
  buildDashboardData,
  getCachedDashboardData,
  rememberDashboardData,
} from "@/lib/server/dashboardData";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 手动刷新最小间隔：免费行情额度是 8 credit/分钟，连点两下就会把整页打成 429。 */
const REFRESH_MIN_INTERVAL_MS = 60_000;
let lastRefreshAt = 0;

export async function GET(request: Request) {
  try {
    const wantsRefresh = new URL(request.url).searchParams.get("refresh") === "1";
    const now = Date.now();
    const refresh = wantsRefresh && now - lastRefreshAt >= REFRESH_MIN_INTERVAL_MS;
    if (refresh) lastRefreshAt = now;

    const payload = refresh
      ? await buildDashboardData({ forceRefresh: true })
      : await getCachedDashboardData();

    if (refresh) rememberDashboardData(payload);

    return NextResponse.json(payload, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "真实数据加载失败",
        detail: error instanceof Error ? error.message : "未知错误",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
