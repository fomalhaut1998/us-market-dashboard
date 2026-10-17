import { indexSection } from "@/data/mockData";
import type { DashboardPayload } from "@/types/dashboard";
import { IndexCard } from "./IndexCard";
import { MarketConclusion } from "./MarketConclusion";
import { RelativeStrengthPanel } from "./RelativeStrengthPanel";
import { SectionCard } from "./SectionCard";

export function IndexView({ data }: { data: DashboardPayload }) {
  return (
    <div className="space-y-5 sm:space-y-7">
      <SectionCard title={indexSection.title} description={indexSection.description} icon="📈">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data.indexSummaries.map((index) => (
            <IndexCard key={index.id} index={index} />
          ))}
        </div>
      </SectionCard>

      <RelativeStrengthPanel data={data.relativeStrength} />

      <SectionCard title={data.indexConclusion.title} icon="🧭">
        <MarketConclusion rows={data.indexConclusion.rows} />
      </SectionCard>
    </div>
  );
}
