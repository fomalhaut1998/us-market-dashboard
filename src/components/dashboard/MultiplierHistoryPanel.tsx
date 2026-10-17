import { multiplierHistorySection } from "@/data/mockData";
import type { MultiplierHistoryView, StatusTone } from "@/types/dashboard";
import { SectionCard } from "./SectionCard";

const multiplierBadge: Record<StatusTone, string> = {
  triggered: "bg-soft-green-badge text-success",
  near: "bg-soft-yellow-badge text-warning-strong",
  normal: "bg-brand/10 text-brand",
  risk: "bg-soft-danger-badge text-danger",
  stale: "bg-soft-muted-badge text-tertiary",
};

export function MultiplierHistoryPanel({ data }: { data: MultiplierHistoryView }) {
  return (
    <SectionCard
      title={multiplierHistorySection.title}
      description={multiplierHistorySection.description}
      icon="📊"
    >
      {data.points.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {data.points.map((point) => (
            <div
              key={point.date}
              className="flex shrink-0 flex-col items-center rounded-[14px] border border-line bg-surface-soft px-2 py-1.5"
            >
              <span className="text-[0.58rem] font-bold tabular-nums text-tertiary">{point.shortDate}</span>
              <span
                className={`mt-1 rounded-full px-1.5 py-0.5 text-[0.72rem] font-black tabular-nums ${multiplierBadge[point.tone]}`}
              >
                {point.multiplier}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      <p className="mt-2 text-[0.68rem] font-semibold text-tertiary sm:text-xs">{data.rangeLabel}</p>
      <div className="mt-2 space-y-1 text-[0.78rem] leading-6 font-semibold text-secondary sm:text-sm">
        <p>{data.last2xLabel}</p>
        <p>{data.sinceLabel}</p>
      </div>
      {data.insufficientLabel ? (
        <p className="mt-2.5 rounded-2xl border border-dashed border-line px-4 py-3 text-[0.72rem] leading-5 font-semibold text-tertiary sm:text-xs">
          {data.insufficientLabel}
        </p>
      ) : null}
    </SectionCard>
  );
}
