import { Suspense } from "react";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { getCachedDashboardData } from "@/lib/server/dashboardData";
import type { DashboardPayload } from "@/types/dashboard";

/** 首屏直接由服务端取数：服务端缓存命中时 HTML 里就带真实内容，不再等浏览器洗完 JS 再发请求。 */
export const dynamic = "force-dynamic";

async function DashboardWithData() {
  let initialData: DashboardPayload | null = null;
  let initialError: string | null = null;

  try {
    initialData = await getCachedDashboardData();
  } catch (error) {
    initialError = error instanceof Error ? error.message : "真实数据加载失败";
  }

  return <Dashboard initialData={initialData} initialError={initialError} />;
}

export default function Home() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardWithData />
    </Suspense>
  );
}
