/**
 * tests/toolkit/voltage-drop.test.ts — 電圧降下計算の手計算照合。
 * 期待値は e = k×I×L×(r·cosθ + x·sinθ) を実装と独立に電卓計算した値。
 * ケース1は内線規程で知られる簡易式 e = 35.6×L×I/(1000×A) とも一致する
 * （35.6 = 2×1000×0.0178 の検証を兼ねる）。
 */
import { describe, expect, it } from "vitest";
import {
  CIRCUIT_COEFFICIENT,
  computeVoltageDrop,
  RESISTIVITY,
  voltageDropModule,
} from "../../lib/toolkit/voltage-drop.js";
import { hasItem, hasNote, itemValue } from "../helpers/toolkit.js";

const BASE = {
  circuit: "single2",
  material: "cuPractical",
  area: 2,
  length: 20,
  current: 10,
  powerFactor: 1,
  reactance: 0,
  supplyVoltage: 100,
  threshold: 2,
};

describe("computeVoltageDrop — 単相2線・直流（k=2）", () => {
  it("簡易式一致: 2sq・20m・10A・銅0.0178 → 3.56V（35.6×20×10/(1000×2) と同値）・3.56% = ng", () => {
    const r = computeVoltageDrop({ ...BASE });
    expect(itemValue(r, "電圧降下")).toBeCloseTo(3.56, 10);
    expect(itemValue(r, "電圧降下")).toBeCloseTo((35.6 * 20 * 10) / (1000 * 2), 10);
    expect(r.usagePercent).toBeCloseTo(3.56, 8);
    expect(r.verdict).toBe("ng");
  });

  it("軟銅20℃: 5.5sq・25m・16A → 2.5078V（2×0.017241×25×16/5.5）・200Vで1.25% = ok", () => {
    const r = computeVoltageDrop({ ...BASE, material: "cu20", area: 5.5, length: 25, current: 16, supplyVoltage: 200 });
    expect(itemValue(r, "電圧降下")).toBeCloseTo(2.5077818181818183, 8);
    expect(r.usagePercent).toBeCloseTo(1.2538909090909, 8);
    expect(r.verdict).toBe("ok");
  });

  it("硬アルミ: 14sq・10m・30A → 1.2113V（2×0.028264×10×30/14）・200Vで0.61% = ok", () => {
    const r = computeVoltageDrop({ ...BASE, material: "al20", area: 14, length: 10, current: 30, supplyVoltage: 200 });
    expect(itemValue(r, "電圧降下")).toBeCloseTo(1.2113142857142858, 8);
    expect(r.verdict).toBe("ok");
  });

  it("直流2線式は力率・リアクタンスを無視して抵抗のみで計算する（単相2線・力率1と同値）", () => {
    const ac = computeVoltageDrop({ ...BASE });
    // 直流では力率・リアクタンスのフィールドが非表示になり、入力があっても使われない。
    const dc = computeVoltageDrop({ ...BASE, circuit: "dc2", powerFactor: 0.5, reactance: 5 });
    expect(itemValue(dc, "電圧降下")).toBeCloseTo(itemValue(ac, "電圧降下"), 10);
    expect(itemValue(dc, "回路係数 k")).toBe(2);
  });

  it("カスタム抵抗率と受電端電圧: ρ=0.02・1sq・10m・5A → 2V降下・98V受電", () => {
    const r = computeVoltageDrop({ ...BASE, material: "custom", customRho: 0.02, area: 1, length: 10, current: 5 });
    expect(itemValue(r, "電圧降下")).toBeCloseTo(2, 10);
    expect(itemValue(r, "受電端（負荷端）電圧")).toBeCloseTo(98, 10);
  });
});

describe("computeVoltageDrop — 三相3線（k=√3）・力率・リアクタンス", () => {
  const THREE = {
    ...BASE,
    circuit: "three3",
    material: "cu20",
    area: 38,
    length: 50,
    current: 100,
    supplyVoltage: 210,
  };

  it("力率0.8・x=0.1mΩ/m: e=√3×100×(0.022686×0.8+0.005×0.6)=3.663V・1.744%", () => {
    const r = computeVoltageDrop({ ...THREE, powerFactor: 0.8, reactance: 0.1 });
    expect(itemValue(r, "回路係数 k")).toBeCloseTo(Math.sqrt(3), 12);
    expect(itemValue(r, "導体抵抗（片道）")).toBeCloseTo(0.022685526315789472, 10);
    expect(itemValue(r, "リアクタンス（片道）")).toBeCloseTo(0.005, 10);
    expect(itemValue(r, "電圧降下")).toBeCloseTo(3.6630139763017167, 8);
    expect(r.usagePercent).toBeCloseTo(1.7442923696674841, 8);
    expect(itemValue(r, "受電端（負荷端）電圧")).toBeCloseTo(206.33698602369827, 8);
  });

  it("力率1・リアクタンス0なら抵抗のみ e=√3×I×r（3.929V）で、リアクタンス行は出ない", () => {
    const r = computeVoltageDrop({ ...THREE, powerFactor: 1, reactance: 0 });
    expect(itemValue(r, "電圧降下")).toBeCloseTo(3.929248417538817, 8);
    expect(hasItem(r, "リアクタンス（片道）")).toBe(false);
    expect(hasNote(r, "リアクタンス 0 で計算")).toBe(true);
  });

  it("低力率ではリアクタンス項が上乗せされる（pf0.8 で x を無視すると 3.143V と過小評価）", () => {
    const noX = computeVoltageDrop({ ...THREE, powerFactor: 0.8, reactance: 0 });
    const withX = computeVoltageDrop({ ...THREE, powerFactor: 0.8, reactance: 0.1 });
    expect(itemValue(noX, "電圧降下")).toBeCloseTo(Math.sqrt(3) * 100 * 0.022685526315789472 * 0.8, 8);
    expect(itemValue(withX, "電圧降下")).toBeGreaterThan(itemValue(noX, "電圧降下"));
    // x·sinθ の寄与ぶんだけ増える（√3×100×0.005×0.6）。
    expect(itemValue(withX, "電圧降下") - itemValue(noX, "電圧降下")).toBeCloseTo(Math.sqrt(3) * 100 * 0.005 * 0.6, 8);
  });
});

describe("computeVoltageDrop — 単相3線（k=1）", () => {
  it("平衡時は外線1本ぶん: 5.5sq・30m・20A・銅0.0178 → 1.9418V・105Vで1.85%", () => {
    const r = computeVoltageDrop({
      ...BASE,
      circuit: "single3",
      area: 5.5,
      length: 30,
      current: 20,
      supplyVoltage: 105,
    });
    expect(itemValue(r, "回路係数 k")).toBe(1);
    expect(itemValue(r, "電圧降下")).toBeCloseTo(1.941818181818182, 8);
    expect(r.usagePercent).toBeCloseTo(1.8493506493506495, 8);
    expect(hasNote(r, "負荷平衡")).toBe(true);
  });

  it("同条件なら単相2線のちょうど半分になる（係数 2 → 1）", () => {
    const cfg = { ...BASE, area: 5.5, length: 30, current: 20, supplyVoltage: 105 };
    const two = computeVoltageDrop({ ...cfg, circuit: "single2" });
    const three = computeVoltageDrop({ ...cfg, circuit: "single3" });
    expect(itemValue(three, "電圧降下")).toBeCloseTo(itemValue(two, "電圧降下") / 2, 10);
  });
});

describe("バリデーションと定数", () => {
  it("断面積0・こう長負値・NaN・力率0/超過を弾く", () => {
    expect(computeVoltageDrop({ ...BASE, area: 0 }).ok).toBe(false);
    expect(computeVoltageDrop({ ...BASE, length: -5 }).ok).toBe(false);
    expect(computeVoltageDrop({ ...BASE, current: Number.NaN }).ok).toBe(false);
    expect(computeVoltageDrop({ ...BASE, powerFactor: 0 }).ok).toBe(false);
    expect(computeVoltageDrop({ ...BASE, powerFactor: 1.1 }).ok).toBe(false);
  });

  it("プリセット定数・回路係数・無料枠の線引きが仕様どおり", () => {
    expect(RESISTIVITY.cu20).toBeCloseTo(0.017241, 10);
    expect(RESISTIVITY.cuPractical).toBeCloseTo(0.0178, 10);
    expect(RESISTIVITY.al20).toBeCloseTo(0.028264, 10);
    expect(CIRCUIT_COEFFICIENT.single2).toBe(2);
    expect(CIRCUIT_COEFFICIENT.dc2).toBe(2);
    expect(CIRCUIT_COEFFICIENT.single3).toBe(1);
    expect(CIRCUIT_COEFFICIENT.three3).toBeCloseTo(Math.sqrt(3), 12);
    expect(voltageDropModule.tier).toBe("free");
  });
});
