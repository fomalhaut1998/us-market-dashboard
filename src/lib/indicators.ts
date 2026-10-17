import type { DailyBar } from "@/types/market";

function closesFromBars(bars: DailyBar[]) {
  return bars.map((bar) => bar.close).filter(Number.isFinite);
}

export function calculateWilderRsi(bars: DailyBar[], period = 6): number | null {
  const closes = closesFromBars(bars);
  if (closes.length < period + 1) return null;

  let averageGain = 0;
  let averageLoss = 0;

  for (let index = 1; index <= period; index += 1) {
    const change = closes[index] - closes[index - 1];
    averageGain += Math.max(change, 0);
    averageLoss += Math.max(-change, 0);
  }

  averageGain /= period;
  averageLoss /= period;

  for (let index = period + 1; index < closes.length; index += 1) {
    const change = closes[index] - closes[index - 1];
    const gain = Math.max(change, 0);
    const loss = Math.max(-change, 0);
    averageGain = (averageGain * (period - 1) + gain) / period;
    averageLoss = (averageLoss * (period - 1) + loss) / period;
  }

  if (averageGain === 0 && averageLoss === 0) return 50;
  if (averageLoss === 0) return 100;
  if (averageGain === 0) return 0;

  const relativeStrength = averageGain / averageLoss;
  return 100 - 100 / (1 + relativeStrength);
}

export function calculateDrawdown52Week(bars: DailyBar[]): number | null {
  const closes = closesFromBars(bars);
  if (closes.length < 252) return null;
  const recent = closes.slice(-252);
  const highestClose = Math.max(...recent);
  const currentClose = recent.at(-1);
  if (currentClose === undefined || highestClose <= 0) return null;
  return currentClose / highestClose - 1;
}

export function calculateReturn25Day(bars: DailyBar[]): number | null {
  const closes = closesFromBars(bars);
  if (closes.length < 26) return null;
  const currentClose = closes.at(-1);
  const priorClose = closes.at(-26);
  if (currentClose === undefined || priorClose === undefined || priorClose <= 0) return null;
  return currentClose / priorClose - 1;
}

export interface Range52Week {
  low: number;
  high: number;
  /** 现价在区间里的位置，0 = 一年最低，100 = 一年最高。 */
  position: number;
  /** 距离 52 周最高收盘的涨跌幅（<= 0）。 */
  fromHigh: number;
}

/** 取最近 window 个交易日的收盘价区间；样本不足 60 根时返回 null。 */
export function calculateRange52Week(bars: DailyBar[], window = 252): Range52Week | null {
  const closes = closesFromBars(bars);
  if (closes.length < 60) return null;
  const recent = closes.slice(-window);
  const low = Math.min(...recent);
  const high = Math.max(...recent);
  const currentClose = recent.at(-1);
  if (currentClose === undefined || high <= low) return null;
  return {
    low,
    high,
    position: ((currentClose - low) / (high - low)) * 100,
    fromHigh: currentClose / high - 1,
  };
}

/** 最近 days 个交易日的涨跌幅（小数）。 */
export function calculateReturnOverDays(bars: DailyBar[], days: number): number | null {
  const closes = closesFromBars(bars);
  if (closes.length < days + 1) return null;
  const currentClose = closes.at(-1);
  const priorClose = closes.at(-(days + 1));
  if (currentClose === undefined || priorClose === undefined || priorClose <= 0) return null;
  return currentClose / priorClose - 1;
}

export function calculateDistanceFrom200DayAverage(bars: DailyBar[]): number | null {
  const closes = closesFromBars(bars);
  if (closes.length < 200) return null;
  const recent = closes.slice(-200);
  const average = recent.reduce((sum, value) => sum + value, 0) / recent.length;
  const currentClose = recent.at(-1);
  if (currentClose === undefined || average <= 0) return null;
  return currentClose / average - 1;
}
