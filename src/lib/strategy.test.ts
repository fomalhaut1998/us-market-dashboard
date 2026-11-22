import { describe, expect, it } from "vitest";
import { evaluateSignal } from "@/config/thresholds";
import { calculateStrategy } from "@/lib/strategy";
import type { SignalEvaluation } from "@/types/market";

function normalSignals(overrides: Partial<Record<SignalEvaluation["key"], SignalEvaluation>> = {}): SignalEvaluation[] {
  const base: Record<SignalEvaluation["key"], SignalEvaluation> = {
    vix: evaluateSignal("vix", 16),
    fearGreed: evaluateSignal("fearGreed", 55),
    rsi6: evaluateSignal("rsi6", 50),
    pePercentile: evaluateSignal("pePercentile", 50),
    drawdown52w: evaluateSignal("drawdown52w", -3),
    qqq200d: evaluateSignal("qqq200d", 5),
  };
  return Object.values({ ...base, ...overrides });
}

describe("calculateStrategy", () => {
  it("returns 1x normal when all signals are in normal range", () => {
    const decision = calculateStrategy(normalSignals(), {
      percentile: 50,
      stale: false,
      ageDays: 10,
    });
    expect(decision.multiplier).toBe("1×");
    expect(decision.status).toBe("normal");
  });

  it("falls back to 1x insufficient when 2 or more signals are missing", () => {
    const signals = normalSignals({
      vix: evaluateSignal("vix", 35),
      fearGreed: evaluateSignal("fearGreed", null),
      rsi6: evaluateSignal("rsi6", null),
    });
    const decision = calculateStrategy(signals, {
      percentile: 50,
      stale: false,
      ageDays: 10,
    });
    expect(decision.multiplier).toBe("1×");
    expect(decision.status).toBe("insufficient");
    expect(decision.missingCount).toBe(2);
  });

  it("prioritizes valuation suppression (0.5x and 0.25x) over bullish triggers when fresh", () => {
    const signals = normalSignals({
      vix: evaluateSignal("vix", 34),
      pePercentile: evaluateSignal("pePercentile", 85),
    });
    const band05 = calculateStrategy(signals, {
      percentile: 85,
      stale: false,
      ageDays: 5,
      isEstimated: true,
    });
    expect(band05.multiplier).toBe("0.5×");
    expect(band05.status).toBe("valuation");
    expect(band05.reason).toContain("估算口径");

    const band025 = calculateStrategy(signals, {
      percentile: 92,
      stale: false,
      ageDays: 5,
      isEstimated: false,
    });
    expect(band025.multiplier).toBe("0.25×");
    expect(band025.status).toBe("valuation");
    expect(band025.reason).not.toContain("估算口径");
  });

  it("excludes stale PE from valuation suppression and notes the lag", () => {
    const signals = normalSignals({
      vix: evaluateSignal("vix", 32),
      pePercentile: { ...evaluateSignal("pePercentile", 95), state: "stale" },
    });
    const decision = calculateStrategy(signals, {
      percentile: 95,
      stale: true,
      ageDays: 60,
    });
    expect(decision.multiplier).toBe("2×");
    expect(decision.status).toBe("triggered");
    expect(decision.reason).toContain("已滞后 60 天");
  });

  it("requires cross-dimension confirmation for low-confidence signals", () => {
    // 单项低置信 -> 1.5x
    const singleLow = calculateStrategy(
      normalSignals({ rsi6: evaluateSignal("rsi6", 18) }),
      { percentile: 50, stale: false, ageDays: 5 },
    );
    expect(singleLow.multiplier).toBe("1.5×");
    expect(singleLow.status).toBe("near");

    // 两项同属 price 维度的低置信指标同时触发 -> 仍维持 1.5x，不自我确认升 2x
    const sameDimensionLow = calculateStrategy(
      normalSignals({
        rsi6: evaluateSignal("rsi6", 18),
        qqq200d: evaluateSignal("qqq200d", -10),
      }),
      { percentile: 50, stale: false, ageDays: 5 },
    );
    expect(sameDimensionLow.multiplier).toBe("1.5×");
    expect(sameDimensionLow.status).toBe("near");
    expect(sameDimensionLow.reason).toContain("同维度低置信指标");

    // 跨维度两项低置信触发 -> 升级 2x
    const crossDimensionLow = calculateStrategy(
      normalSignals({
        rsi6: { ...evaluateSignal("rsi6", 18), dimension: "price" },
        qqq200d: { ...evaluateSignal("qqq200d", -10), dimension: "sentiment" },
      }),
      { percentile: 50, stale: false, ageDays: 5 },
    );
    expect(crossDimensionLow.multiplier).toBe("2×");
    expect(crossDimensionLow.status).toBe("triggered");
    expect(crossDimensionLow.reason).toContain("跨维度");
  });

  it("upgrades to 1.5x on near signals and 2x on high-confidence triggers", () => {
    const near = calculateStrategy(
      normalSignals({ vix: evaluateSignal("vix", 24) }),
      { percentile: 40, stale: false, ageDays: 5 },
    );
    expect(near.multiplier).toBe("1.5×");
    expect(near.status).toBe("near");

    const highTrigger = calculateStrategy(
      normalSignals({ fearGreed: evaluateSignal("fearGreed", 20) }),
      { percentile: 40, stale: false, ageDays: 5 },
    );
    expect(highTrigger.multiplier).toBe("2×");
    expect(highTrigger.status).toBe("triggered");
  });
});
