/**
 * tests/toolkit/capacitor.test.ts — コンデンサのディレーティング＋寿命推定の手計算照合。
 * 寿命の期待値は 10℃2倍則 L = L0×2^((T0−Ta−ΔT)/10)、ΔT = ΔT0×(Ir/Ir0)² を
 * 実装と独立に電卓計算した値。
 */
import { describe, expect, it } from "vitest";
import { capacitorModule, computeCapacitor, estimateElectrolyticLife } from "../../lib/toolkit/capacitor.js";

const ELEC = {
  capType: "electrolytic",
  ratedVoltage: 35,
  appliedVoltage: 24,
  voltThresholdElec: 80,
  ratedLife: 5000,
  ratedTemp: 105,
  ambientTemp: 65,
  rippleCurrent: 0,
  ratedRipple: 1,
  coreRise: 5,
  requiredLife: 87600,
};

describe("computeCapacitor — セラミック", () => {
  it("16V 定格に 5V 印加 → 31.25% = ok", () => {
    const r = computeCapacitor({ capType: "ceramic", ratedVoltage: 16, appliedVoltage: 5, voltThresholdCeramic: 50 });
    expect(r.usagePercent).toBeCloseTo(31.25, 10);
    expect(r.verdict).toBe("ok");
  });

  it("16V 定格に 12V 印加 → 75% = ng、8V 印加 → 50% = warn", () => {
    const ng = computeCapacitor({ capType: "ceramic", ratedVoltage: 16, appliedVoltage: 12, voltThresholdCeramic: 50 });
    expect(ng.usagePercent).toBeCloseTo(75, 10);
    expect(ng.verdict).toBe("ng");
    const warn = computeCapacitor({
      capType: "ceramic",
      ratedVoltage: 16,
      appliedVoltage: 8,
      voltThresholdCeramic: 50,
    });
    expect(warn.verdict).toBe("warn");
    expect(warn.notes?.[0]).toContain("DC バイアス");
  });
});

describe("estimateElectrolyticLife / computeCapacitor — アルミ電解", () => {
  it("リプルなし: 105℃5000h 品を 65℃ で使用 → 2^4 倍 = 80,000h", () => {
    const { lifeHours, rippleRise } = estimateElectrolyticLife({
      ratedLife: 5000,
      ratedTemp: 105,
      ambientTemp: 65,
      rippleCurrent: 0,
      ratedRipple: 1,
      coreRise: 5,
    });
    expect(rippleRise).toBe(0);
    expect(lifeHours).toBeCloseTo(80000, 6);
  });

  it("定格リプル時: Ta=45℃・Ir=Ir0 → ΔT=5K・2^5.5 倍 = 226,274.17h", () => {
    const { lifeHours, rippleRise } = estimateElectrolyticLife({
      ratedLife: 5000,
      ratedTemp: 105,
      ambientTemp: 45,
      rippleCurrent: 1,
      ratedRipple: 1,
      coreRise: 5,
    });
    expect(rippleRise).toBeCloseTo(5, 10);
    expect(lifeHours).toBeCloseTo(226274.1699796952, 4);
  });

  it("リプル比 √2: Ta=75℃ → ΔT=10K・2^2 倍 = 20,000h", () => {
    const { lifeHours } = estimateElectrolyticLife({
      ratedLife: 5000,
      ratedTemp: 105,
      ambientTemp: 75,
      rippleCurrent: Math.SQRT2,
      ratedRipple: 1,
      coreRise: 5,
    });
    expect(lifeHours).toBeCloseTo(20000, 6);
  });

  it("要求寿命 10年 vs 推定 80,000h → 寿命充足率 109.5% = ng（電圧 68.6% は ok でも総合 ng）", () => {
    const r = computeCapacitor({ ...ELEC });
    expect(r.items?.[2]?.value).toBeCloseTo(80000, 6);
    expect(r.items?.[4]?.value).toBeCloseTo(109.5, 3);
    expect(r.verdict).toBe("ng");
  });

  it("周囲温度＋自己発熱が定格上限を超えると ng＋使用不可の注記", () => {
    const r = computeCapacitor({ ...ELEC, ambientTemp: 103, rippleCurrent: 1 });
    expect(r.verdict).toBe("ng");
    expect(r.notes?.[0]).toContain("使用できません");
  });

  it("15年超の推定寿命には上限注記が付く", () => {
    const r = computeCapacitor({ ...ELEC, ambientTemp: 45, requiredLife: 87600 });
    expect(r.items?.[2]?.value).toBeGreaterThan(15 * 8760);
    expect(r.notes?.some((n) => n.includes("15年"))).toBe(true);
  });

  it("バリデーション: 定格リプル 0 は弾く（ゼロ割り防止）", () => {
    const r = computeCapacitor({ ...ELEC, ratedRipple: 0 });
    expect(r.ok).toBe(false);
  });

  it("モジュール定義: 有料枠", () => {
    expect(capacitorModule.tier).toBe("paid");
  });
});
