/**
 * tests/toolkit/power-factor.test.ts — 力率改善コンデンサ容量の手計算照合。
 * 期待値は Qc = P(tanθ1 − tanθ2)、C = Qc/(3ωV²)（Δ）を実装と独立に電卓計算した値。
 */
import { describe, expect, it } from "vitest";
import { computePowerFactor, pfFrom, powerFactorModule, tanFromPf } from "../../lib/toolkit/power-factor.js";
import { hasNote, itemValue } from "../helpers/toolkit.js";

const BASE = {
  activePower: 100,
  pfBefore: 0.7,
  pfTarget: 0.95,
  lineVoltage: 400,
  frequency: "60",
  connection: "delta",
  installedQc: 0,
};

describe("tanFromPf / pfFrom", () => {
  it("力率1は tan0、0.8 は 0.75（3-4-5 の直角三角形）", () => {
    expect(tanFromPf(1)).toBeCloseTo(0, 12);
    expect(tanFromPf(0.8)).toBeCloseTo(0.75, 12);
    expect(tanFromPf(0.6)).toBeCloseTo(4 / 3, 12);
  });

  it("有効・無効電力から力率を戻せる（進み側も絶対値）", () => {
    expect(pfFrom(80, 60)).toBeCloseTo(0.8, 12);
    expect(pfFrom(80, -60)).toBeCloseTo(0.8, 12);
    expect(pfFrom(100, 0)).toBe(1);
  });
});

describe("computePowerFactor — 必要容量の算出", () => {
  it("100kW・0.7→0.95 → Qc=69.15kvar・Δ結線で 382.1μF（60Hz・400V）", () => {
    const r = computePowerFactor({ ...BASE });
    expect(itemValue(r, "改善前の無効電力 Q1")).toBeCloseTo(102.02040612204071, 8);
    expect(itemValue(r, "必要なコンデンサ容量 Qc")).toBeCloseTo(69.1519956041544, 8);
    expect(itemValue(r, "必要な静電容量（Δ結線・1相あたり）")).toBeCloseTo(382.14867795382605, 6);
    expect(r.verdict).toBe("ok");
    expect(hasNote(r, "規格容量")).toBe(true);
  });

  it("Y結線は同じ容量にΔの3倍の静電容量が要る", () => {
    const delta = computePowerFactor({ ...BASE });
    const star = computePowerFactor({ ...BASE, connection: "star" });
    expect(itemValue(star, "必要な静電容量（Y結線・1相あたり）")).toBeCloseTo(
      itemValue(delta, "必要な静電容量（Δ結線・1相あたり）") * 3,
      6,
    );
    // 必要 kvar は結線によらない。
    expect(itemValue(star, "必要なコンデンサ容量 Qc")).toBeCloseTo(itemValue(delta, "必要なコンデンサ容量 Qc"), 10);
  });

  it("線電流は 206.2A→151.9A（低減率 26.3%）", () => {
    const r = computePowerFactor({ ...BASE });
    expect(itemValue(r, "改善前の線電流")).toBeCloseTo(206.19652471058063, 8);
    expect(itemValue(r, "目標力率での線電流")).toBeCloseTo(151.934281365691, 8);
    expect(itemValue(r, "線電流の低減率")).toBeCloseTo(26.315789473684216, 8);
  });

  it("周波数が下がると同じ kvar により大きい静電容量が要る（50Hz は 60Hz の 1.2倍）", () => {
    const hz60 = computePowerFactor({ ...BASE });
    const hz50 = computePowerFactor({ ...BASE, frequency: "50" });
    expect(itemValue(hz50, "必要な静電容量（Δ結線・1相あたり）")).toBeCloseTo(
      itemValue(hz60, "必要な静電容量（Δ結線・1相あたり）") * 1.2,
      6,
    );
  });
});

describe("computePowerFactor — 設置容量の判定", () => {
  it("必要 69.15kvar に 50kvar だと力率 0.887 で不足 = ng", () => {
    const r = computePowerFactor({ ...BASE, installedQc: 50 });
    expect(itemValue(r, "設置後の無効電力 Q2")).toBeCloseTo(52.02040612204071, 8);
    expect(itemValue(r, "設置後の力率")).toBeCloseTo(0.8871426900282805, 8);
    expect(r.verdict).toBe("ng");
    expect(hasNote(r, "不足")).toBe(true);
  });

  it("70kvar なら目標達成 = ok", () => {
    const r = computePowerFactor({ ...BASE, installedQc: 70 });
    expect(itemValue(r, "設置後の力率")).toBeGreaterThanOrEqual(0.95);
    expect(r.verdict).toBe("ok");
  });

  it("過補償（120kvar）は進み力率になり ng＋注意喚起", () => {
    const r = computePowerFactor({ ...BASE, installedQc: 120 });
    expect(itemValue(r, "設置後の無効電力 Q2")).toBeCloseTo(-17.97959387795929, 8);
    expect(r.verdict).toBe("ng");
    expect(r.notes?.[0]).toContain("過補償");
  });

  it("わずかに届かない場合は warn（目標 0.95 に対し 0.94 台）", () => {
    // 目標との差が 0.02 以内に収まる容量を選ぶ。
    const r = computePowerFactor({ ...BASE, installedQc: 67 });
    const pf = itemValue(r, "設置後の力率");
    expect(pf).toBeLessThan(0.95);
    expect(pf).toBeGreaterThan(0.93);
    expect(r.verdict).toBe("warn");
  });
});

describe("バリデーションとモジュール定義", () => {
  it("目標力率が改善前より低いのは弾く（コンデンサでは下げられない）", () => {
    const r = computePowerFactor({ ...BASE, pfBefore: 0.95, pfTarget: 0.8 });
    expect(r.ok).toBe(false);
    expect(r.errors?.[0]?.message).toContain("目標力率");
  });

  it("力率0・1超・負の電力・NaN を弾く", () => {
    expect(computePowerFactor({ ...BASE, pfBefore: 0 }).ok).toBe(false);
    expect(computePowerFactor({ ...BASE, pfTarget: 1.5 }).ok).toBe(false);
    expect(computePowerFactor({ ...BASE, activePower: 0 }).ok).toBe(false);
    expect(computePowerFactor({ ...BASE, lineVoltage: Number.NaN }).ok).toBe(false);
  });

  it("無料枠（電験の論点と重なるため集客の入口）", () => {
    expect(powerFactorModule.tier).toBe("free");
  });
});
