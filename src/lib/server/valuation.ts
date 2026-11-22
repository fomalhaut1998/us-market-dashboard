import "server-only";

import { MARKET_CACHE_SECONDS } from "@/config/market";
import { VALUATION_STALE_DAYS } from "@/config/strategy";
import { calculatePePercentile } from "@/lib/peHistory";
import type { HistoricalPePoint, ValuationData } from "@/types/market";

const MULTPL_MONTHLY_PE_URL = "https://www.multpl.com/s-p-500-pe-ratio/table/by-month";

export interface ParsedPePoint extends HistoricalPePoint {
  estimated: boolean;
}

const MONTHS: Record<string, number> = {
  Jan: 1,
  Feb: 2,
  Mar: 3,
  Apr: 4,
  May: 5,
  Jun: 6,
  Jul: 7,
  Aug: 8,
  Sep: 9,
  Oct: 10,
  Nov: 11,
  Dec: 12,
};

function decodeTableText(html: string) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&dagger;|&#8224;|&#x2020;/gi, "†")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function parseEnglishDate(value: string) {
  const match = value.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),\s+(\d{4})\b/i);
  if (!match) return null;
  const normalizedMonth = `${match[1][0].toUpperCase()}${match[1].slice(1, 3).toLowerCase()}`;
  const month = MONTHS[normalizedMonth];
  const day = Number.parseInt(match[2], 10);
  const year = Number.parseInt(match[3], 10);
  if (!month || day < 1 || day > 31 || year < 1900) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseMultplPeTable(html: string): ParsedPePoint[] {
  const points: ParsedPePoint[] = [];
  const rows = html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi);

  for (const row of rows) {
    const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) =>
      decodeTableText(cell[1]),
    );
    if (cells.length < 2) continue;

    const date = parseEnglishDate(cells[0]);
    const peMatch = cells[1].match(/\b(\d{1,3}(?:\.\d+)?)\b/);
    const pe = peMatch ? Number.parseFloat(peMatch[1]) : Number.NaN;
    if (!date || !Number.isFinite(pe) || pe <= 0) continue;

    points.push({
      date,
      pe,
      estimated: /estimate|†/i.test(cells[1]),
    });
  }

  return [...new Map(points.map((point) => [point.date, point])).values()].sort((left, right) =>
    left.date.localeCompare(right.date),
  );
}

/**
 * 截取近 5 年月度 PE 历史并按 YYYY-MM 去重：
 * 同月内优先取最新的非估算实际值；仅当该月全部为估算值时取最新估算值，保证最近数月不留空白断档。
 */
export function monthlyHistoryInFiveYears(points: ParsedPePoint[], latestDate: string): HistoricalPePoint[] {
  const cutoffDate = new Date(`${latestDate}T00:00:00Z`);
  cutoffDate.setUTCFullYear(cutoffDate.getUTCFullYear() - 5);
  const cutoff = cutoffDate.toISOString().slice(0, 10);

  const byMonth = new Map<string, ParsedPePoint>();
  const sorted = [...points]
    .filter((point) => point.date >= cutoff && point.date <= latestDate)
    .sort((left, right) => left.date.localeCompare(right.date));

  for (const point of sorted) {
    const monthKey = point.date.slice(0, 7);
    const existing = byMonth.get(monthKey);
    if (!existing) {
      byMonth.set(monthKey, point);
      continue;
    }
    // 实际值始终优先于估算值；同类别则取日期更晚的观测。
    if (existing.estimated && !point.estimated) {
      byMonth.set(monthKey, point);
    } else if (existing.estimated === point.estimated && point.date >= existing.date) {
      byMonth.set(monthKey, point);
    }
  }

  return [...byMonth.values()]
    .sort((left, right) => left.date.localeCompare(right.date))
    .map(({ date, pe, estimated }) => ({ date, pe, estimated }));
}

export function fiveYearActualHistory(points: ParsedPePoint[], latestDate: string): HistoricalPePoint[] {
  const cutoffDate = new Date(`${latestDate}T00:00:00Z`);
  cutoffDate.setUTCFullYear(cutoffDate.getUTCFullYear() - 5);
  const cutoff = cutoffDate.toISOString().slice(0, 10);

  return points
    .filter((point) => !point.estimated && point.date >= cutoff && point.date <= latestDate)
    .map(({ date, pe }) => ({ date, pe }));
}

function daysBetween(fromDate: string, toDate: string) {
  const from = Date.parse(`${fromDate}T00:00:00Z`);
  const to = Date.parse(`${toDate}T00:00:00Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  return Math.round((to - from) / 86_400_000);
}

/**
 * 判断 PE 数据的时效。
 * 超过 VALUATION_STALE_DAYS 时标为陈旧，不参与倍率计算。
 */
export function assessPeFreshness(
  currentDate: string | null,
  referenceDate = new Date().toISOString().slice(0, 10),
) {
  if (!currentDate) return { ageDays: null as number | null, stale: false };
  const ageDays = daysBetween(currentDate, referenceDate);
  return {
    ageDays,
    stale: ageDays !== null && ageDays > VALUATION_STALE_DAYS,
  };
}

export interface ActiveValuationSelection {
  active: ParsedPePoint | null;
  latestActual: ParsedPePoint | null;
  ageDays: number | null;
  stale: boolean;
  isEstimated: boolean;
}

/**
 * 优先选用最新的非估算实际值；当实际值已超过陈旧门槛时，
 * 回退到 Multpl 提供的近期财报估算值并明确标注估算口径，避免估值压制长期休眠。
 */
export function selectActiveValuationPoint(
  points: ParsedPePoint[],
  referenceDate = new Date().toISOString().slice(0, 10),
): ActiveValuationSelection {
  const sorted = [...points].sort((left, right) => left.date.localeCompare(right.date));
  const latestActual = sorted.filter((point) => !point.estimated).at(-1) ?? null;
  const latestAny = sorted.at(-1) ?? null;

  if (latestActual) {
    const actualFreshness = assessPeFreshness(latestActual.date, referenceDate);
    if (!actualFreshness.stale) {
      return {
        active: latestActual,
        latestActual,
        ageDays: actualFreshness.ageDays,
        stale: false,
        isEstimated: false,
      };
    }
  }

  if (!latestAny) {
    return {
      active: null,
      latestActual,
      ageDays: null,
      stale: false,
      isEstimated: false,
    };
  }

  const anyFreshness = assessPeFreshness(latestAny.date, referenceDate);
  return {
    active: latestAny,
    latestActual,
    ageDays: anyFreshness.ageDays,
    stale: anyFreshness.stale,
    isEstimated: Boolean(latestAny.estimated),
  };
}

export async function fetchSpyValuation(forceRefresh: boolean): Promise<ValuationData> {
  const base = {
    source: "Multpl" as const,
  };

  try {
    const response = await fetch(MULTPL_MONTHLY_PE_URL, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "US-Stock-Sentiment-Dashboard/1.0",
      },
      ...(forceRefresh ? { cache: "no-store" as const } : { next: { revalidate: MARKET_CACHE_SECONDS } }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const points = parseMultplPeTable(await response.text());
    const selection = selectActiveValuationPoint(points);
    if (!selection.active) throw new Error("页面中没有可用的 PE 数据");

    const history = monthlyHistoryInFiveYears(points, selection.active.date);
    if (history.length === 0) throw new Error("页面中没有可用的近5年 PE 历史");

    return {
      ...base,
      currentPe: selection.active.pe,
      currentDate: selection.active.date,
      isEstimated: selection.isEstimated,
      latestActualPe: selection.latestActual?.pe ?? null,
      latestActualDate: selection.latestActual?.date ?? null,
      history,
      percentile: calculatePePercentile(selection.active.pe, history),
      dataKind: selection.isEstimated ? "标普500 PE（含近期财报估算）" : "标普500 PE（月度实际值）",
      historySupported: true,
      error: null,
      ageDays: selection.ageDays,
      stale: selection.stale,
    };
  } catch (error) {
    return {
      ...base,
      currentPe: null,
      currentDate: null,
      isEstimated: false,
      latestActualPe: null,
      latestActualDate: null,
      history: [],
      percentile: null,
      dataKind: "标普500 PE（月度实际值）",
      historySupported: false,
      error: error instanceof Error ? error.message : "Multpl 估值请求失败",
      ageDays: null,
      stale: false,
    };
  }
}
