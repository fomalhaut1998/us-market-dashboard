import type { ChangeTone, MacroAssetView, MacroView } from "@/types/dashboard";
import { SectionCard } from "./SectionCard";

const toneText: Record<ChangeTone, string> = {
  positive: "text-success",
  negative: "text-danger",
  neutral: "text-tertiary",
};

function MacroCard({ asset }: { asset: MacroAssetView }) {
  return (
    <article className="flex h-full flex-col rounded-[20px] border border-line bg-surface-soft/55 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-[0.92rem] font-extrabold leading-5 tracking-[-0.01em] text-ink">
            {asset.name}
          </h3>
          <p className="mt-1 truncate text-[0.58rem] font-bold tracking-[0.08em] text-tertiary">
            {asset.symbolLabel}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-line bg-surface px-2 py-0.5 text-[0.55rem] font-bold text-tertiary">
          背景
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-x-2 gap-y-1">
        <p className="text-[1.38rem] font-black leading-none tracking-[-0.03em] text-ink tabular-nums sm:text-[1.55rem]">
          {asset.value}
        </p>
        <p className={`text-[0.78rem] font-black tabular-nums ${toneText[asset.changeTone]}`}>
          {asset.changeLabel}
          <span className="ml-1 text-[0.55rem] font-bold tracking-[0.06em] text-tertiary">近20日</span>
        </p>
      </div>

      {asset.range52w ? (
        <div className="mt-4">
          <div className="grid grid-cols-3 gap-1 text-[0.55rem] font-semibold leading-4 text-tertiary">
            <span className="truncate">{asset.range52w.lowLabel}</span>
            <span className="truncate text-center">{asset.range52w.positionLabel}</span>
            <span className="truncate text-right">{asset.range52w.highLabel}</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line/50" aria-hidden="true">
            <div
              className="h-full rounded-full bg-brand/40"
              style={{ width: `${asset.range52w.positionPct}%` }}
            />
          </div>
        </div>
      ) : (
        <div className="mt-4 h-[1.9rem]" aria-hidden="true" />
      )}

      <p className="mt-3 text-[0.7rem] font-semibold leading-5 text-secondary">{asset.hint}</p>

      <div className="mt-auto pt-4">
        <p className="text-[0.58rem] font-semibold leading-4 text-tertiary">
          {asset.asOf ?? "暂无日期"} · {asset.source}
        </p>
        <p className="text-[0.56rem] font-medium leading-4 text-tertiary/80">{asset.dataKind}</p>
      </div>
    </article>
  );
}

export function MacroPanel({ data }: { data: MacroView }) {
  return (
    <SectionCard title={data.title} description={data.description} icon="🌐">
      <p className="text-[0.68rem] font-semibold leading-5 text-tertiary sm:text-xs">{data.asOfLabel}</p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {data.assets.map((asset) => (
          <MacroCard key={asset.key} asset={asset} />
        ))}
      </div>

      <p className="mt-3 rounded-2xl bg-surface-soft px-4 py-3 text-[0.72rem] font-semibold leading-6 text-secondary sm:text-xs sm:leading-6">
        {data.note}
      </p>
    </SectionCard>
  );
}
