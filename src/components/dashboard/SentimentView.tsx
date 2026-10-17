import {
  sentimentSection,
  statusLegend,
} from "@/data/mockData";
import type { DashboardPayload } from "@/types/dashboard";
import { BreadthPanel } from "./BreadthPanel";
import { CreditSpreadPanel } from "./CreditSpreadPanel";
import { MetricCard, statusToneStyles } from "./MetricCard";
import { SectionCard } from "./SectionCard";
import { SignalGuide } from "./SignalGuide";
import { TermStructurePanel } from "./TermStructurePanel";
import { VixPeHistoryChart } from "./VixPeHistoryChart";

export function SentimentView({ data }: { data: DashboardPayload }) {
  return (
    <div className="space-y-5 sm:space-y-7">
      <SectionCard
        title={sentimentSection.title}
        description={sentimentSection.descriptionParts.map((part, index) => {
          const emphasisClass =
            part.tone === "triggered"
              ? "font-black text-success"
              : part.tone === "near"
                ? "font-black text-warning-strong"
                : "";

          return emphasisClass ? (
            <strong key={`${part.tone}-${index}`} className={emphasisClass}>
              {part.text}
            </strong>
          ) : (
            <span key={`${part.tone}-${index}`}>{part.text}</span>
          );
        })}
        icon="📡"
      >
        <div className="mb-5 flex flex-wrap gap-x-4 gap-y-2 rounded-2xl bg-surface-soft px-4 py-3 sm:mb-6">
          {statusLegend.map((item) => (
            <span key={item.tone} className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted">
              <span
                className={`h-2.5 w-2.5 rounded-full ${statusToneStyles[item.tone].dot}`}
                aria-hidden="true"
              />
              {item.label}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          {data.sentimentMetrics.map((metric) => (
            <MetricCard key={metric.id} metric={metric} />
          ))}
        </div>
      </SectionCard>

      <SignalGuide />

      <TermStructurePanel data={data.termStructure} tailRisk={data.tailRisk} />

      <BreadthPanel data={data.breadth} />

      <CreditSpreadPanel data={data.creditSpread} />

      <SectionCard title={data.vixPeHistory.title} description={data.vixPeHistory.description} icon="📅">
        <VixPeHistoryChart data={data.vixPeHistory} />
      </SectionCard>
    </div>
  );
}
