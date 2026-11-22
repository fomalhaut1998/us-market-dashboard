import type { HistoricalPePoint } from "@/types/market";

/** 近5年分位：历史中"小于或等于当前 PE"的样本占比。 */
export function calculatePePercentile(currentPe: number | null, history: HistoricalPePoint[]) {
  if (currentPe === null || history.length === 0) return null;
  const valid = history.filter((point) => Number.isFinite(point.pe) && point.pe > 0);
  if (valid.length === 0) return null;
  const lessOrEqual = valid.filter((point) => point.pe <= currentPe).length;
  return (lessOrEqual / valid.length) * 100;
}

export interface PeMonth {
  label: string;
  end: string;
}

export interface MonthlyPePoint {
  month: string;
  end: string;
  pe: number | null;
  percentile: number | null;
  estimated: boolean;
}

export function latestOnOrBefore<T extends { date: string }>(values: T[], end: string) {
  return values.filter((value) => value.date <= end).at(-1) ?? null;
}

/**
 * 每个月只取当月区间内最新的一条 PE 观测：
 * 第一个月取月末基准，之后没有新观测的月份返回 null（图上留空），
 * 避免把同一个 PE 值重复画成连续几个月的假平线。
 */
export function buildMonthlyPePoints(
  months: PeMonth[],
  history: HistoricalPePoint[],
): MonthlyPePoint[] {
  const sorted = [...history].sort((left, right) => left.date.localeCompare(right.date));

  return months.map((month, index) => {
    const previousEnd = index === 0 ? "" : months[index - 1].end;
    const freshPoint =
      index === 0
        ? latestOnOrBefore(sorted, month.end)
        : (sorted.filter((point) => point.date > previousEnd && point.date <= month.end).at(-1) ??
          null);
    const pe = freshPoint?.pe ?? null;

    return {
      month: month.label,
      end: month.end,
      pe,
      percentile: pe === null ? null : calculatePePercentile(pe, sorted),
      estimated: Boolean(freshPoint?.estimated),
    };
  });
}
