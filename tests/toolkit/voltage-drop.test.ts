/**
 * tests/toolkit/voltage-drop.test.ts — 電圧降下計算の手計算照合。
 * 期待値は e = 2×I×ρ×L/A の直接計算。ケース1は内線規程で知られる簡易式
 * e = 35.6×L×I/(1000×A) とも一致する（35.6 = 2×1000×0.0178 の検証を兼ねる）。
 */
import { describe, expect, it } from "vitest";
import { computeVoltageDrop, RESISTIVITY, voltageDropModule } from "../../lib/toolkit/voltage-drop.js";

const BASE = {
  circuit: "single2",
  material: "cuPractical",
  area: 2,
  length: 20,
  current: 10,
  supplyVoltage: 100,
  threshold: 2,
};

describe("computeVoltageDrop", () => {
  it("簡易式一致: 2sq・20m・10A・銅0.0178 → 3.56V（35.6×20×10/(1000×2) と同値）・3.56% = ng", () => {
    const r = computeVoltageDrop({ ...BASE });
    expect(r.items?.[1]?.value).toBeCloseTo(3.56, 10);
    expect(r.items?.[1]?.value).toBeCloseTo((35.6 * 20 * 10) / (1000 * 2), 10);
    expect(r.usagePercent).toBeCloseTo(3.56, 8);
    expect(r.verdict).toBe("ng");
  });

  it("軟銅20℃: 5.5sq・25m・16A → 2.5078V（2×0.017241×25×16/5.5）", () => {
    const r = computeVoltageDrop({ ...BASE, material: "cu20", area: 5.5, length: 25, current: 16, supplyVoltage: 200 });
    expect(r.items?.[1]?.value).toBeCloseTo(2.5077818181818183, 8);
    expect(r.usagePercent).toBeCloseTo(1.2538909090909, 8);
    expect(r.verdict).toBe("ok");
  });

  it("硬アルミ: 14sq・10m・30A → 1.2113V（2×0.028264×10×30/14）・200Vで0.61% = ok", () => {
    const r = computeVoltageDrop({ ...BASE, material: "al20", area: 14, length: 10, current: 30, supplyVoltage: 200 });
    expect(r.items?.[1]?.value).toBeCloseTo(1.2113142857142858, 8);
    expect(r.verdict).toBe("ok");
  });

  it("カスタム抵抗率と受電端電圧: ρ=0.02・1sq・10m・5A → 2V降下・98V受電", () => {
    const r = computeVoltageDrop({
      ...BASE,
      material: "custom",
      customRho: 0.02,
      area: 1,
      length: 10,
      current: 5,
    });
    expect(r.items?.[1]?.value).toBeCloseTo(2, 10);
    expect(r.items?.[3]?.value).toBeCloseTo(98, 10);
  });

  it("バリデーション: 断面積0・こう長負値・NaN を弾く", () => {
    expect(computeVoltageDrop({ ...BASE, area: 0 }).ok).toBe(false);
    expect(computeVoltageDrop({ ...BASE, length: -5 }).ok).toBe(false);
    expect(computeVoltageDrop({ ...BASE, current: Number.NaN }).ok).toBe(false);
  });

  it("プリセット定数と無料枠の線引きが仕様どおり", () => {
    expect(RESISTIVITY.cu20).toBeCloseTo(0.017241, 10);
    expect(RESISTIVITY.cuPractical).toBeCloseTo(0.0178, 10);
    expect(RESISTIVITY.al20).toBeCloseTo(0.028264, 10);
    expect(voltageDropModule.tier).toBe("free");
  });
});
