import type { BreadthView } from "@/types/dashboard";
import { statusToneStyles } from "./MetricCard";
import { SectionCard } from "./SectionCard";
import { ToneLegend } from "./ToneLegend";

export function BreadthPanel({ data }: { data: BreadthView }) {
  const styles = statusToneStyles[data.tone];

  return (
    <SectionCard title={data.title} description={data.description} icon="🧭">
      <p className="text-[0.68rem] font-semibold leading-5 text-tertiary sm:text-xs">{data.asOfLabel}</p>

      <div className="mt-3 flex flex-wrap items-end gap-x-3 gap-y-2 sm:mt-4">
        <p className={`text-[1.9rem] leading-none font-black tracking-[-0.03em] tabular-nums sm:text-[2.6rem] ${styles.value}`}>
          {data.value}
        </p>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.68rem] font-extrabold sm:text-xs ${styles.badge}`}
        >
          <span className={`h-2 w-2 rounded-full ${styles.dot}`} aria-hidden="true" />
          {data.stateLabel}
        </span>
      </div>
      <p className="mt-1.5 text-[0.66rem] font-semibold text-tertiary sm:text-xs">{data.valueLabel}</p>

      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:mt-5 sm:gap-4">
        {data.facts.map((fact) => (
          <div
            key={fact.label}
            className="min-w-0 rounded-[18px] border border-line bg-surface-soft px-3 py-3 sm:px-4 sm:py-3.5"
          >
            <p className="text-[0.6rem] leading-4 font-bold text-tertiary sm:text-xs">{fact.label}</p>
            <p className="mt-1 text-[0.95rem] leading-5 font-black tracking-[-0.02em] tabular-nums text-ink sm:text-lg">
              {fact.value}
            </p>
          </div>
        ))}
      </div>

      <ToneLegend legend={data.legend} />

      <p className="mt-3 rounded-2xl bg-surface-soft px-4 py-3 text-[0.75rem] font-semibold leading-6 text-secondary sm:text-sm sm:leading-7">
        {data.note}
      </p>
    </SectionCard>
  );
}
