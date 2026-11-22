import { Suspense } from "react";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { getCachedDashboardData } from "@/lib/server/dashboardData";
import type { DashboardPayload, DashboardTabId } from "@/types/dashboard";

/** 首屏直接由服务端取数：服务端缓存命中时 HTML 里就带真实内容，不再等浏览器洗完 JS 再发请求。 */
export const dynamic = "force-dynamic";

function parseTab(raw: string | string[] | undefined): DashboardTabId {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === "sentiment" || value === "strategy") return value;
  return "index";
}

async function DashboardWithData({ initialTab }: { initialTab: DashboardTabId }) {
  let initialData: DashboardPayload | null = null;
  let initialError: string | null = null;

  try {
    initialData = await getCachedDashboardData();
  } catch (error) {
    initialError = error instanceof Error ? error.message : "真实数据加载失败";
  }

  return (
    <Dashboard
      initialData={initialData}
      initialError={initialError}
      initialTab={initialTab}
    />
  );
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const resolved = await searchParams;
  const initialTab = parseTab(resolved?.tab);

  return (
    <Suspense fallback={<DashboardSkeleton activeTab={initialTab} />}>
      <DashboardWithData initialTab={initialTab} />
    </Suspense>
  );
}
