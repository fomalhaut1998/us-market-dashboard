import type { ConclusionRow } from "@/types/dashboard";

interface MarketConclusionProps {
  rows: ConclusionRow[];
}

export function MarketConclusion({ rows }: MarketConclusionProps) {
  return (
    <dl>
      {rows.map((row, index) => (
        <div
          key={row.label}
          className={`grid ${
            row.prominent
              ? "mt-2 items-start gap-2 rounded-[18px] border border-soft-blue-line bg-soft-blue px-4 py-4 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-center sm:gap-6 sm:px-5"
              : `gap-1.5 py-4 first:pt-0 last:pb-0 sm:grid-cols-[140px_minmax(0,1fr)] sm:gap-6 ${
                  index > 0 ? "border-t border-dashed border-line" : ""
                }`
          }`}
        >
          <dt
            className={`text-sm font-bold sm:text-base ${
              row.prominent ? "text-brand" : "text-muted"
            }`}
          >
            {row.label}
          </dt>
          <dd
            className={`text-sm leading-6 sm:text-base sm:leading-7 ${
              row.prominent ? "font-bold text-ink" : "font-semibold text-secondary"
            }`}
          >
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
