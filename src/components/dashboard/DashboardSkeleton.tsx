import { dashboardMeta, dashboardTabs } from "@/data/mockData";

/**
 * 首屏骨架：服务端还在抓行情时先画出来，保持和真实页面同样的版式，
 * 避免用户只看到一整片空白。纯静态组件，不读任何数据。
 */
export function DashboardSkeleton() {
  return (
    <main
      className="relative isolate min-h-screen px-4 py-9 sm:px-6 sm:py-12 lg:px-8 lg:py-14"
      aria-busy="true"
    >
      <div className="relative z-10 mx-auto w-full max-w-[1180px]">
        <header>
          <div className="flex items-start justify-between gap-3 sm:items-center">
            <h1 className="text-[1.72rem] font-black tracking-[-0.035em] text-ink sm:text-[2.15rem] lg:text-[2.45rem]">
              {dashboardMeta.title}
            </h1>
            <span className="hidden h-11 w-24 shrink-0 animate-pulse items-center justify-center rounded-full border border-line bg-surface-soft sm:flex" aria-hidden="true">
              <span className="h-2.5 w-12 rounded-full bg-line/60" />
            </span>
          </div>
          <p className="mt-3 max-w-4xl text-[0.82rem] leading-6 text-muted sm:text-base sm:leading-7">
            正在读取真实市场数据
            <span className="mx-2 text-tertiary" aria-hidden="true">
              ·
            </span>
            {dashboardMeta.updateSchedule}
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="inline-flex min-w-0 items-center gap-2 text-[0.82rem] font-bold leading-5 text-brand sm:text-base">
              <span
                className="h-2.5 w-2.5 shrink-0 animate-ping rounded-full bg-[#4c8df5] shadow-[0_0_0_5px_rgba(76,141,245,0.09)]"
                aria-hidden="true"
              />
              {dashboardMeta.scheduleBadge}
            </p>
          </div>
        </header>

        <div className="sticky top-0 z-30 -mx-4 mt-6 bg-page/85 px-4 py-3 backdrop-blur-md sm:static sm:mx-0 sm:mt-9 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
          <div className="grid grid-cols-3 gap-2.5 sm:gap-4" aria-hidden="true">
            {dashboardTabs.map((tab, index) => (
              <div
                key={tab.id}
                className={`flex min-h-14 items-center justify-center rounded-[18px] border px-1.5 py-3 text-[0.86rem] font-bold shadow-[var(--shadow-tab)] sm:min-h-16 sm:rounded-[20px] sm:px-4 sm:text-lg ${
                  index === 0
                    ? "border-brand-solid bg-brand-solid text-white"
                    : "border-line bg-surface text-muted"
                }`}
              >
                {tab.label}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 sm:mt-7">
          <section className="rounded-[26px] border border-line/70 bg-surface px-4 py-5 shadow-[var(--shadow-section)] sm:rounded-[28px] sm:px-7 sm:py-7 lg:px-9 lg:py-8">
            <header className="mb-4 sm:mb-6">
              <div className="flex items-center gap-3">
                <span className="h-8 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden="true" />
                <h2 className="text-[1.14rem] leading-7 font-extrabold tracking-[-0.02em] text-ink sm:text-[1.45rem] sm:leading-normal">
                  正在加载真实市场数据
                </h2>
              </div>
              <p className="mt-2.5 text-[0.85rem] leading-6 text-muted sm:mt-3 sm:ml-[18px] sm:text-base sm:leading-7">
                首次打开要先抓取行情、估值与情绪数据，通常需要 10–20 秒；之后 30 分钟内会直接读缓存。
              </p>
            </header>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3" aria-hidden="true">
              {Array.from({ length: 6 }, (_, index) => (
                <div
                  key={index}
                  className="min-h-[220px] animate-pulse rounded-[22px] border border-line bg-surface-soft p-4"
                >
                  <div className="h-2.5 w-3/4 rounded-full bg-line/70" />
                  <div className="mt-2 h-2.5 w-1/2 rounded-full bg-line/45" />
                  <div className="mt-5 h-6 w-4/5 rounded-full bg-line/55" />
                  <div className="mt-4 h-2 w-2/3 rounded-full bg-line/40" />
                  <div className="mt-7 h-1.5 w-full rounded-full bg-line/35" />
                  <div className="mt-2 h-1.5 w-1/2 rounded-full bg-line/25" />
                </div>
              ))}
            </div>
          </section>
        </div>

        <p className="mt-4 text-center text-[0.72rem] leading-5 text-tertiary sm:text-xs" role="status">
          数据到手后会自动替换这一屏，不需要手动刷新。
        </p>
      </div>
    </main>
  );
}
