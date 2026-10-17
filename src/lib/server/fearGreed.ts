import "server-only";

import { MARKET_CACHE_SECONDS } from "@/config/market";
import type { FearGreedData } from "@/types/market";

const CNN_FEAR_GREED_URL = "https://production.dataviz.cnn.io/index/fearandgreed/graphdata";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asFiniteNumber(value: unknown) {
  const number = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(number) ? number : null;
}

function normalizeRating(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase().replaceAll("_", " ").replaceAll("-", " ");
  const labels: Record<string, string> = {
    "extreme fear": "极度恐惧",
    fear: "恐惧",
    neutral: "中性",
    greed: "贪婪",
    "extreme greed": "极度贪婪",
  };
  return labels[normalized] ?? null;
}

function ratingFromScore(score: number) {
  if (score < 25) return "极度恐惧";
  if (score < 45) return "恐惧";
  if (score <= 55) return "中性";
  if (score <= 75) return "贪婪";
  return "极度贪婪";
}

function formatTimestamp(value: unknown) {
  if (typeof value === "string" && value.trim()) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value.trim() : date.toISOString();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const milliseconds = value > 10_000_000_000 ? value : value * 1000;
    const date = new Date(milliseconds);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  return null;
}

function findScoreObject(value: unknown, depth = 0): Record<string, unknown> | null {
  if (depth > 5) return null;
  const record = asRecord(value);
  if (!record) return null;

  if ("score" in record && ("rating" in record || "status" in record)) return record;

  for (const child of Object.values(record)) {
    const found = findScoreObject(child, depth + 1);
    if (found) return found;
  }
  return null;
}

export function parseCnnFearGreed(payload: unknown): Omit<FearGreedData, "source" | "dataKind" | "error"> | null {
  const root = asRecord(payload);
  const candidate =
    asRecord(root?.fear_and_greed) ??
    asRecord(root?.fearGreed) ??
    asRecord(root?.data) ??
    findScoreObject(payload);

  if (!candidate) return null;
  const score = asFiniteNumber(candidate.score ?? candidate.value);
  if (score === null) return null;
  const rating = normalizeRating(candidate.rating ?? candidate.status) ?? ratingFromScore(score);

  return {
    score,
    rating,
    dataTime: formatTimestamp(candidate.timestamp ?? candidate.last_updated ?? candidate.date),
  };
}

export async function fetchCnnFearGreed(forceRefresh: boolean): Promise<FearGreedData> {
  try {
    const response = await fetch(CNN_FEAR_GREED_URL, {
      headers: {
        Accept: "application/json, text/plain, */*",
        Referer: "https://www.cnn.com/markets/fear-and-greed",
        "User-Agent": "Mozilla/5.0 (compatible; USStockDashboard/1.0)",
      },
      ...(forceRefresh ? { cache: "no-store" as const } : { next: { revalidate: MARKET_CACHE_SECONDS } }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const parsed = parseCnnFearGreed(await response.json());
    if (!parsed) throw new Error("CNN 页面数据结构已变化");

    return {
      ...parsed,
      source: "CNN",
      dataKind: "公开页面当前分数",
      error: null,
    };
  } catch (error) {
    return {
      score: null,
      rating: null,
      source: "CNN",
      dataTime: null,
      dataKind: "公开页面当前分数",
      error: error instanceof Error ? error.message : "CNN 恐惧贪婪请求失败",
    };
  }
}
