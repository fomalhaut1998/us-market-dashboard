import type { ToneLegend } from "@/types/dashboard";
import { statusToneStyles } from "./MetricCard";

/**
 * 颜色图例：把面板里用的色点和对应数值区间并列出来。
 * 语义由服务端视图决定（阈值改动时图例跟着变），组件本身不写死数字。
 */
export function ToneLegend({ legend }: { legend: ToneLegend }) {
  return (
    <div className="mt-3 rounded-2xl border border-line bg-surface-soft/70 px-3 py-2.5 sm:px-4 sm:py-3">
      <p className="text-[0.62rem] font-extrabold tracking-[-0.01em] text-tertiary sm:text-[0.7rem]">
        颜色说明
      </p>
      <ul className="mt-1.5 flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:gap-x-4 sm:gap-y-1">
        {legend.items.map((item) => (
          <li
            key={item.label}
            className="flex min-w-0 items-baseline gap-1.5 text-[0.66rem] leading-5 font-semibold text-secondary sm:text-xs"
          >
            <span
              className={`mt-0.5 h-2 w-2 shrink-0 self-center rounded-full ${statusToneStyles[item.tone].dot}`}
              aria-hidden="true"
            />
            <span className="font-extrabold text-ink">{item.label}</span>
            <span className="text-tertiary">{item.range}</span>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-[0.62rem] leading-5 text-tertiary sm:text-[0.7rem]">{legend.caption}</p>
    </div>
  );
}
