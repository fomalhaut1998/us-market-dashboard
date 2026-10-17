import type { TailRiskView, TermStructureView } from "@/types/dashboard";
import { statusToneStyles } from "./MetricCard";
import { SectionCard } from "./SectionCard";
import { ToneLegend } from "./ToneLegend";

interface TermStructurePanelProps {
  data: TermStructureView;
  tailRisk: TailRiskView;
}

export function TermStructurePanel({ data, tailRisk }: TermStructurePanelProps) {
  const styles = statusToneStyles[data.tone];

  return (
    <SectionCard title={data.title} description={data.description} icon="📐">
      <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
        {data.points.map((point) => (
          <div
            key={point.label}
            className="rounded-[18px] border border-line bg-surface-soft px-2.5 py-4 text-center sm:px-4 sm:py-5"
          >
            <p className="text-[0.72rem] font-extrabold tracking-[-0.01em] text-secondary sm:text-sm">
              {point.label}
            </p>
            <p className="mt-2 text-[1.25rem] font-black tracking-[-0.03em] text-ink sm:text-[1.9rem]">
              {point.value}
            </p>
            <p className="mt-1 text-[0.6rem] font-semibold leading-4 text-tertiary sm:text-xs">
              {point.hint}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 sm:mt-5">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.68rem] font-extrabold sm:text-xs ${styles.badge}`}
        >
          <span className={`h-2 w-2 rounded-full ${styles.dot}`} aria-hidden="true" />
          {data.stateLabel}
        </span>
        <span className="text-[0.72rem] font-bold text-secondary sm:text-sm">{data.ratioLabel}</span>
      </div>

      <ToneLegend legend={data.legend} />

      <p className="mt-3 rounded-2xl bg-surface-soft px-4 py-3 text-[0.75rem] font-semibold leading-6 text-secondary sm:text-sm sm:leading-7">
        {data.note}
      </p>

      <div className="mt-5 border-t border-line pt-4 sm:mt-6 sm:pt-5">
        <h3 className="text-[0.85rem] font-extrabold tracking-[-0.02em] text-ink sm:text-base">
          {tailRisk.title}
        </h3>
        <p className="mt-1 text-[0.68rem] font-semibold leading-5 text-tertiary sm:text-xs">
          {tailRisk.asOfLabel}
        </p>

        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:mt-4 sm:gap-4">
          {tailRisk.items.map((item) => {
            const itemStyles = statusToneStyles[item.tone];
            return (
              <div
                key={item.label}
                className={`min-w-0 rounded-[18px] border px-2.5 py-3.5 sm:px-4 sm:py-4 ${itemStyles.card}`}
              >
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-2">
                  <p className="text-[0.72rem] font-extrabold tracking-[-0.01em] text-secondary sm:text-sm">
                    {item.label}
                  </p>
                  <span
                    className={`inline-flex shrink-0 items-center self-start whitespace-nowrap rounded-full px-2 py-0.5 text-[0.58rem] font-extrabold sm:text-[0.66rem] ${itemStyles.badge}`}
                  >
                    {item.percentileLabel}
                  </span>
                </div>
                <p className={`mt-2 text-[1.15rem] leading-none font-black tracking-[-0.03em] tabular-nums sm:text-[1.9rem] sm:leading-normal ${itemStyles.value}`}>
                  {item.value}
                </p>
                <p className="mt-1 text-[0.6rem] font-semibold leading-4 text-tertiary sm:text-xs sm:leading-5">
                  {item.hint}
                </p>
              </div>
            );
          })}
        </div>

        <ToneLegend legend={tailRisk.legend} />

        <p className="mt-3 rounded-2xl bg-surface-soft px-4 py-3 text-[0.75rem] font-semibold leading-6 text-secondary sm:text-sm sm:leading-7">
          {tailRisk.note}
        </p>
      </div>
    </SectionCard>
  );
}
