import { relativeStrengthSection } from "@/data/mockData";
import type { ChangeTone, RelativeStrengthView } from "@/types/dashboard";
import { SectionCard } from "./SectionCard";

const toneText: Record<ChangeTone, string> = {
  positive: "text-success",
  negative: "text-danger",
  neutral: "text-tertiary",
};

export function RelativeStrengthPanel({ data }: { data: RelativeStrengthView }) {
  return (
    <SectionCard
      title={relativeStrengthSection.title}
      description={relativeStrengthSection.description}
      icon="⚖️"
    >
      <p className="text-[0.68rem] font-semibold leading-5 text-tertiary sm:text-xs">{data.asOfLabel}</p>

      <div className="mt-3 overflow-hidden rounded-[18px] border border-line sm:max-w-[820px]">
        <div className="grid grid-cols-[minmax(0,1fr)_4rem_4rem] items-center gap-2 border-b border-line bg-surface-soft px-3 py-2 text-[0.6rem] font-bold text-tertiary sm:grid-cols-[minmax(0,1fr)_5rem_5rem] sm:px-4 sm:text-xs">
          <span>标的</span>
          <span className="text-right">近 20 日</span>
          <span className="text-right">近 60 日</span>
        </div>
        {data.rows.map((row, index) => (
          <div
            key={row.id}
            className={`grid grid-cols-[minmax(0,1fr)_4rem_4rem] items-center gap-2 px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_5rem_5rem] sm:px-4 ${index === 0 ? "" : "border-t border-line/70"}`}
          >
            <div className="min-w-0">
              <p className="truncate text-[0.82rem] font-extrabold text-ink sm:text-sm">{row.name}</p>
              <p className="mt-0.5 text-[0.6rem] font-bold tracking-[0.1em] text-tertiary">{row.symbol}</p>
            </div>
            <p className={`text-right text-[0.78rem] font-black tabular-nums sm:text-sm ${toneText[row.excess20dTone]}`}>
              {row.excess20dLabel}
            </p>
            <p className={`text-right text-[0.78rem] font-black tabular-nums sm:text-sm ${toneText[row.excess60dTone]}`}>
              {row.excess60dLabel}
            </p>
          </div>
        ))}
      </div>

      <p className="mt-2.5 text-[0.66rem] font-semibold leading-5 text-tertiary sm:text-xs">{data.baselineLabel}</p>
      <p className="mt-2 rounded-2xl bg-surface-soft px-4 py-3 text-[0.75rem] font-semibold leading-6 text-secondary sm:text-sm sm:leading-7">
        {data.note}
      </p>
    </SectionCard>
  );
}
