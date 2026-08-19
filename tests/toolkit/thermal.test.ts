/**
 * tests/toolkit/thermal.test.ts — 半導体熱計算の手計算照合。
 * 期待値は Tj = Ta + P×θ の直接計算。
 */
import { describe, expect, it } from "vitest";
import { computeThermal, thermalModule } from "../../lib/toolkit/thermal.js";

const SIMPLE = { model: "simple", ambientTemp: 50, power: 2, thetaJa: 40, tjMax: 150, threshold: 80 };
const HEATSINK = {
  model: "heatsink",
  ambientTemp: 40,
  power: 10,
  thetaJc: 1.5,
  thetaCs: 0.3,
  thetaSa: 2.2,
  tjMax: 175,
  threshold: 80,
};

describe("computeThermal", () => {
  it("θja モデル: Ta=50・P=2W・θja=40 → Tj=130℃・86.67% = ng", () => {
    const r = computeThermal({ ...SIMPLE });
    expect(r.items?.[1]?.value).toBeCloseTo(130, 10);
    expect(r.items?.[2]?.value).toBeCloseTo(20, 10);
    expect(r.usagePercent).toBeCloseTo(86.66666666666667, 8);
    expect(r.verdict).toBe("ng");
  });

  it("ヒートシンクモデル: θ合成=4.0・Tj=80℃・45.71% = ok", () => {
    const r = computeThermal({ ...HEATSINK });
    expect(r.items?.[0]?.value).toBeCloseTo(4.0, 10);
    expect(r.items?.[1]?.value).toBeCloseTo(80, 10);
    expect(r.usagePercent).toBeCloseTo(45.714285714285715, 8);
    expect(r.verdict).toBe("ok");
  });

  it("warn 帯: Tj=115℃（P=1.625W）は 76.67% で warn（閾値80%の90%=72%超）", () => {
    const r = computeThermal({ ...SIMPLE, power: 1.625 });
    expect(r.items?.[1]?.value).toBeCloseTo(115, 10);
    expect(r.verdict).toBe("warn");
  });

  it("Tj(max) 超過は ng＋使用不可の注記、P=0 では Tj=Ta", () => {
    const over = computeThermal({ ...SIMPLE, power: 3 });
    expect(over.items?.[1]?.value).toBeCloseTo(170, 10);
    expect(over.verdict).toBe("ng");
    expect(over.notes?.[0]).toContain("絶対最大定格");
    const idle = computeThermal({ ...SIMPLE, power: 0 });
    expect(idle.items?.[1]?.value).toBe(50);
  });

  it("バリデーション: θja=0・負の損失・θ合成=0 を弾く", () => {
    expect(computeThermal({ ...SIMPLE, thetaJa: 0 }).ok).toBe(false);
    expect(computeThermal({ ...SIMPLE, power: -1 }).ok).toBe(false);
    const zeroSum = computeThermal({ ...HEATSINK, thetaJc: 0, thetaCs: 0, thetaSa: 0 });
    expect(zeroSum.ok).toBe(false);
    expect(zeroSum.errors?.[0]?.message).toContain("θjc + θcs + θsa");
  });

  it("モジュール定義: 有料枠・注記にモデル前提が含まれる", () => {
    expect(thermalModule.tier).toBe("paid");
    const r = computeThermal({ ...SIMPLE });
    expect(r.notes?.some((n) => n.includes("JEDEC"))).toBe(true);
  });
});
