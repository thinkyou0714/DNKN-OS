/**
 * tests/toolkit/resistor-derating.test.ts — 抵抗ディレーティングの手計算照合。
 * 期待値は実装と独立に電卓計算した値（ratio=(Tz-Ta)/(Tz-Ts) の直線カーブ）。
 */
import { describe, expect, it } from "vitest";
import { computeResistorDerating, resistorDeratingModule } from "../../lib/toolkit/resistor-derating.js";

const BASE = {
  ratedPower: 0.25,
  actualPower: 0.1,
  ambientTemp: 25,
  derateStart: 70,
  fullDerate: 155,
  threshold: 50,
};

describe("computeResistorDerating", () => {
  it("折れ点以下では定格 100%（0.25W・0.1W 使用 → 負荷率 40% = ok）", () => {
    const r = computeResistorDerating({ ...BASE });
    expect(r.ok).toBe(true);
    expect(r.items?.[0]?.value).toBeCloseTo(0.25, 10);
    expect(r.usagePercent).toBeCloseTo(40, 10);
    expect(r.verdict).toBe("ok");
  });

  it("カーブ中間: Ta=100℃ → 許容 0.1618W・負荷率 61.82% = ng（手計算 0.1×85/(0.25×55)）", () => {
    const r = computeResistorDerating({ ...BASE, ambientTemp: 100 });
    expect(r.items?.[0]?.value).toBeCloseTo(0.16176470588, 8);
    expect(r.usagePercent).toBeCloseTo(61.81818181818181, 8);
    expect(r.verdict).toBe("ng");
  });

  it("warn 帯: 閾値50%に対し負荷率 48%（0.12W 使用）は warn", () => {
    const r = computeResistorDerating({ ...BASE, actualPower: 0.12 });
    expect(r.usagePercent).toBeCloseTo(48, 10);
    expect(r.verdict).toBe("warn");
  });

  it("全ディレーティング温度以上では許容 0W・使用不可（ng）", () => {
    const r = computeResistorDerating({ ...BASE, ambientTemp: 155 });
    expect(r.items?.[0]?.value).toBe(0);
    expect(r.usagePercent).toBe(Number.POSITIVE_INFINITY);
    expect(r.verdict).toBe("ng");
    expect(r.notes?.[0]).toContain("使用できません");
  });

  it("バリデーション: 定格0W・負値・NaN・カーブ逆転を日本語で弾く", () => {
    expect(computeResistorDerating({ ...BASE, ratedPower: 0 }).ok).toBe(false);
    expect(computeResistorDerating({ ...BASE, actualPower: -1 }).ok).toBe(false);
    expect(computeResistorDerating({ ...BASE, ambientTemp: Number.NaN }).ok).toBe(false);
    const r = computeResistorDerating({ ...BASE, fullDerate: 70 });
    expect(r.ok).toBe(false);
    expect(r.errors?.[0]?.message).toContain("全ディレーティング温度");
  });

  it("モジュール定義: 無料枠・解説5セクションが揃っている", () => {
    expect(resistorDeratingModule.tier).toBe("free");
    for (const sec of [
      resistorDeratingModule.explanation.conclusion,
      resistorDeratingModule.explanation.formula,
      resistorDeratingModule.explanation.terms,
      resistorDeratingModule.explanation.pitfalls,
      resistorDeratingModule.explanation.primarySources,
    ]) {
      expect(sec.length).toBeGreaterThan(0);
    }
  });
});
