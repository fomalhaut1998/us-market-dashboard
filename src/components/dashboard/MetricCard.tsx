import type { MetricCardData, StatusTone } from "@/types/dashboard";

interface MetricCardProps {
  metric: MetricCardData;
}

const toneStyles: Record<
  StatusTone,
  { card: string; value: string; badge: string; dot: string }
> = {
  triggered: {
    card: "border-success bg-soft-green shadow-[0_0_0_3px_rgba(32,167,95,0.16),0_12px_24px_rgba(27,129,76,0.09)]",
    value: "text-success",
    badge: "bg-soft-green-badge text-success",
    dot: "bg-success",
  },
  near: {
    card: "border-warning bg-soft-yellow shadow-[0_0_0_3px_rgba(228,180,0,0.16),0_12px_24px_rgba(161,132,16,0.08)]",
    value: "text-warning-strong",
    badge: "bg-soft-yellow-badge text-warning-strong",
    dot: "bg-warning",
  },
  normal: {
    card: "border-line bg-surface shadow-[0_8px_18px_rgba(42,55,82,0.035)]",
    value: "text-ink",
    badge: "bg-soft-muted-badge text-tertiary",
    dot: "bg-tertiary",
  },
  risk: {
    card: "border-danger bg-soft-danger shadow-[0_0_0_3px_rgba(217,71,85,0.13),0_12px_24px_rgba(160,42,55,0.08)]",
    value: "text-danger",
    badge: "bg-soft-danger-badge text-danger",
    dot: "bg-danger",
  },
  // 数据陈旧：虚线边框 + 灰阶，和“触发/接近”明显区分，只表示“这条不值当参考”。
  stale: {
    card: "border-dashed border-line bg-surface-subtle shadow-none",
    value: "text-tertiary",
    badge: "bg-soft-muted-badge text-tertiary",
    dot: "bg-tertiary",
  },
};

export const statusToneStyles = toneStyles;

export function MetricCard({ metric }: MetricCardProps) {
  const styles = toneStyles[metric.tone];

  return (
    <article
      className={`flex min-h-[188px] flex-col rounded-[20px] border-2 p-3 sm:min-h-[280px] sm:rounded-[22px] sm:p-6 ${styles.card}`}
    >
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-2">
        <h3 className="text-[0.9rem] font-extrabold leading-5 tracking-[-0.02em] text-ink sm:text-xl sm:leading-7">
          {metric.name}
        </h3>
        <span
          className={`inline-flex shrink-0 items-center self-start whitespace-nowrap rounded-full px-2 py-0.5 text-[0.62rem] font-extrabold sm:px-2.5 sm:py-1 sm:text-xs ${styles.badge}`}
        >
          {metric.badgeLabel}
          {metric.tone === "triggered" ? " ▲" : ""}
        </span>
      </div>

      <p className={`mt-3 text-[1.55rem] leading-none font-black tracking-[-0.04em] tabular-nums sm:mt-5 sm:text-[2.7rem] ${styles.value}`}>
        {metric.value}
      </p>

      <div className="mt-3 space-y-1 text-[0.75rem] font-semibold leading-5 text-secondary sm:mt-5 sm:space-y-1.5 sm:text-sm">
        <p>{metric.stateLabel}</p>
        <p>触发：{metric.triggerCondition}</p>
      </div>

      <p className="mt-auto pt-2.5 text-[0.7rem] leading-[1.1rem] text-tertiary sm:pt-4 sm:text-[0.82rem] sm:leading-6">
        {metric.description}
      </p>
    </article>
  );
}
