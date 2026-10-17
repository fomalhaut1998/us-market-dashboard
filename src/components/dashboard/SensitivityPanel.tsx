import { sensitivitySection } from "@/data/mockData";
import type { SensitivityView } from "@/types/dashboard";
import { statusToneStyles } from "./MetricCard";
import { SectionCard } from "./SectionCard";

export function SensitivityPanel({ data }: { data: SensitivityView }) {
  return (
    <SectionCard
      title={sensitivitySection.title}
      description={sensitivitySection.description}
      icon="📏"
    >
      <div className="space-y-2">
        {data.rows.map((row) => {
          const styles = statusToneStyles[row.tone];
          return (
            <div key={row.key} className="rounded-2xl border border-line bg-surface-soft px-3 py-2.5 sm:px-4">
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-[0.82rem] font-extrabold text-ink sm:text-sm">{row.name}</p>
                <span
                  className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[0.6rem] font-extrabold sm:text-[0.68rem] ${styles.badge}`}
                >
                  {row.stateLabel}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[0.66rem] leading-5 text-tertiary sm:text-xs">
                <span className="font-black tabular-nums text-secondary">{row.valueLabel}</span>
                <span>触发 {row.triggerLabel}</span>
                <span>{row.gapLabel}</span>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 rounded-2xl bg-surface-soft px-4 py-3 text-[0.75rem] font-semibold leading-6 text-secondary sm:text-sm sm:leading-7">
        {data.note}
      </p>
    </SectionCard>
  );
}
