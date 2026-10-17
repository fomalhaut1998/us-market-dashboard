import type { StrategyData } from "@/types/dashboard";
import { DisciplineList } from "./DisciplineList";
import { MarketConclusion } from "./MarketConclusion";
import { MultiplierHistoryPanel } from "./MultiplierHistoryPanel";
import { MultiplierSelector } from "./MultiplierSelector";
import { SectionCard } from "./SectionCard";
import { SensitivityPanel } from "./SensitivityPanel";

export function StrategyView({ data }: { data: StrategyData }) {
  return (
    <div className="space-y-5 sm:space-y-7">
      <SectionCard title={data.title} description={data.description}>
        <MultiplierSelector
          levels={data.levels}
          currentMultiplier={data.currentMultiplier}
        />
        <div className="mt-5 rounded-2xl bg-surface-soft px-4 py-4 sm:mt-6 sm:px-6 sm:py-5">
          <p className="text-sm text-secondary sm:text-base">
            当前建议投入倍数：
            <strong className="ml-1 text-lg font-black text-ink sm:text-xl">
              {data.currentMultiplier}
            </strong>
          </p>
          <p className="mt-1.5 text-sm leading-6 text-muted sm:text-base sm:leading-7">
            {data.currentReason}
          </p>
        </div>
      </SectionCard>

      <MultiplierHistoryPanel data={data.history} />

      <SectionCard title={data.conclusionTitle} icon="📋">
        <MarketConclusion rows={data.conclusionRows} />
      </SectionCard>

      <SensitivityPanel data={data.sensitivity} />

      <SectionCard title={data.disciplineTitle} icon="📌">
        <DisciplineList
          subtitle={data.disciplineSubtitle}
          items={data.disciplineItems}
        />
      </SectionCard>
    </div>
  );
}
