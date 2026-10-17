import { signalGuideItems, signalGuideSection } from "@/data/mockData";
import { statusToneStyles } from "./MetricCard";
import { SectionCard } from "./SectionCard";

export function SignalGuide() {
  return (
    <SectionCard
      title={signalGuideSection.title}
      description={signalGuideSection.description}
      icon="📖"
    >
      <div className="divide-y divide-line">
        {signalGuideItems.map((item) => (
          <details key={item.name} className="group py-3 first:pt-0 last:pb-0">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
              <span className="text-[0.84rem] font-extrabold tracking-[-0.01em] text-ink sm:text-base">
                {item.name}
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 text-[0.68rem] font-bold text-tertiary sm:text-xs">
                <span className="group-open:hidden">展开</span>
                <span className="hidden group-open:inline">收起</span>
                <span className="transition group-open:rotate-90" aria-hidden="true">
                  ›
                </span>
              </span>
            </summary>

            <div className="mt-3 space-y-2.5">
              <p className="text-[0.75rem] font-semibold leading-6 text-secondary sm:text-[0.84rem] sm:leading-7">
                {item.meaning}
              </p>
              <p className="text-[0.68rem] leading-5 text-tertiary sm:text-xs sm:leading-6">
                口径：{item.calc}
              </p>

              <div className="space-y-1.5">
                {item.bands.map((band) => {
                  const styles = statusToneStyles[band.tone];
                  return (
                    <div
                      key={band.label}
                      className="flex items-start gap-2 rounded-xl border border-line bg-surface-soft px-2.5 py-1.5"
                    >
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${styles.dot}`} aria-hidden="true" />
                      <span className="w-[5.6rem] shrink-0 text-[0.72rem] font-extrabold text-ink sm:w-24 sm:text-[0.8rem]">
                        {band.range}
                      </span>
                      <span className="text-[0.7rem] font-semibold leading-5 text-secondary sm:text-[0.8rem]">
                        {band.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              <p className="rounded-xl bg-surface-soft px-3 py-2 text-[0.7rem] font-semibold leading-5 text-tertiary sm:text-[0.78rem] sm:leading-6">
                注意：{item.caveat}
              </p>
            </div>
          </details>
        ))}
      </div>
    </SectionCard>
  );
}
