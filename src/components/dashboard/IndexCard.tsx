import type { IndexSummary } from "@/types/dashboard";

interface IndexCardProps {
  index: IndexSummary;
}

export function IndexCard({ index }: IndexCardProps) {
  const changeStyles = {
    positive: {
      badge: "bg-soft-green text-success",
      value: "text-success",
    },
    negative: {
      badge: "bg-soft-red text-danger",
      value: "text-danger",
    },
    neutral: {
      badge: "bg-soft-muted-badge text-tertiary",
      value: "text-tertiary",
    },
  }[index.changeTone];

  return (
    <article className="group rounded-[22px] border border-line bg-surface p-4 transition duration-200 hover:-translate-y-1 hover:border-brand/35 hover:shadow-[var(--shadow-card-hover)] sm:p-6">
      <div className="flex items-start justify-between gap-2.5 sm:gap-3">
        <div className="min-w-0">
          <p className="text-[1.05rem] leading-6 font-extrabold text-ink sm:text-xl sm:leading-7">{index.name}</p>
          <p className="mt-1 text-[0.68rem] font-bold tracking-[0.12em] text-tertiary">
            {index.symbol}
          </p>
        </div>
        <span className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[0.7rem] font-bold sm:text-xs ${changeStyles.badge}`}>
          {index.directionLabel}
        </span>
      </div>

      <div className="mt-5 border-b border-dashed border-line pb-4 sm:mt-6 sm:pb-5">
        <div className="flex items-end justify-between gap-3">
          <p className="text-[1.6rem] leading-none font-black tracking-[-0.035em] tabular-nums text-ink sm:text-[2.15rem]">
            {index.value}
          </p>
          <p className={`shrink-0 pb-0.5 text-sm font-extrabold tabular-nums sm:pb-1 sm:text-base ${changeStyles.value}`}>{index.change}</p>
        </div>
        {index.range52w ? (
          <div className="mt-3 sm:mt-3.5">
            <div className="flex items-center justify-between gap-3 text-[0.66rem] font-semibold text-tertiary sm:text-xs">
              <span className="truncate">
                52 周区间 {index.range52w.lowLabel} – {index.range52w.highLabel}
              </span>
              <span className="shrink-0 whitespace-nowrap">{index.range52w.positionLabel}</span>
            </div>
            <div className="relative mt-1.5 h-1.5 rounded-full bg-surface-soft">
              <div
                className="h-full rounded-full bg-brand/45"
                style={{ width: `${index.range52w.positionPct}%` }}
              />
              <span
                className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-brand"
                style={{ left: `${index.range52w.positionPct}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>

      <dl className="mt-3.5 grid grid-cols-2 gap-x-4 gap-y-3.5 sm:mt-4 sm:gap-y-4">
        {index.metrics.map((metric) => (
          <div key={metric.label}>
            <dt className="text-xs font-medium text-tertiary">{metric.label}</dt>
            <dd className="mt-1 text-sm font-extrabold text-secondary sm:text-base">
              {metric.value}
            </dd>
          </div>
        ))}
      </dl>
    </article>
  );
}
