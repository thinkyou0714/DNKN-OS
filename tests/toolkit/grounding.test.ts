/**
 * tests/toolkit/grounding.test.ts — 接地抵抗の許容値判定。
 * B種は R = k/I1、他は種別ごとの上限値。数値は一般に知られた設計指針（規程原文は転載しない）。
 */
import { describe, expect, it } from "vitest";
import { allowableGroundResistance, computeGrounding, groundingModule } from "../../lib/toolkit/grounding.js";
import { hasNote, itemValue } from "../helpers/toolkit.js";

const B_BASE = {
  groundType: "B",
  breakTime: "within1s",
  groundFaultCurrent: 5,
  hasEarthLeakageBreaker: "no",
  measured: 100,
};

describe("allowableGroundResistance", () => {
  it("B種は遮断時間の係数を1線地絡電流で割る（150/300/600）", () => {
    expect(allowableGroundResistance({ groundType: "B", breakTime: "none", groundFaultCurrent: 5 })).toBe(30);
    expect(allowableGroundResistance({ groundType: "B", breakTime: "within2s", groundFaultCurrent: 5 })).toBe(60);
    expect(allowableGroundResistance({ groundType: "B", breakTime: "within1s", groundFaultCurrent: 5 })).toBe(120);
  });

  it("A種は10Ω、C種は10Ω、D種は100Ω（緩和なし）", () => {
    expect(allowableGroundResistance({ groundType: "A" })).toBe(10);
    expect(allowableGroundResistance({ groundType: "C" })).toBe(10);
    expect(allowableGroundResistance({ groundType: "D" })).toBe(100);
  });

  it("地絡遮断装置があると C種・D種は 500Ω へ緩和され、A種・B種は変わらない", () => {
    expect(allowableGroundResistance({ groundType: "C", relaxed: true })).toBe(500);
    expect(allowableGroundResistance({ groundType: "D", relaxed: true })).toBe(500);
    expect(allowableGroundResistance({ groundType: "A", relaxed: true })).toBe(10);
    expect(
      allowableGroundResistance({ groundType: "B", breakTime: "none", groundFaultCurrent: 5, relaxed: true }),
    ).toBe(30);
  });
});

describe("computeGrounding", () => {
  it("B種・1秒以内・I1=5A → 許容120Ω。実測100Ωは 83.3% で ok", () => {
    const r = computeGrounding({ ...B_BASE });
    expect(itemValue(r, "許容接地抵抗値")).toBe(120);
    expect(r.usagePercent).toBeCloseTo(83.33333333333334, 8);
    expect(itemValue(r, "許容値までの余裕")).toBe(20);
    expect(r.verdict).toBe("ok");
  });

  it("同条件で遮断装置なし（許容30Ω）だと実測100Ωは超過 = ng", () => {
    const r = computeGrounding({ ...B_BASE, breakTime: "none" });
    expect(itemValue(r, "許容接地抵抗値")).toBe(30);
    expect(r.verdict).toBe("ng");
    expect(r.notes?.[0]).toContain("超えています");
  });

  it("1線地絡電流が増えると許容値は反比例で下がる", () => {
    const i5 = computeGrounding({ ...B_BASE });
    const i10 = computeGrounding({ ...B_BASE, groundFaultCurrent: 10 });
    expect(itemValue(i10, "許容接地抵抗値")).toBe(itemValue(i5, "許容接地抵抗値") / 2);
  });

  it("D種・漏電遮断器あり → 許容500Ω。実測100Ωは 20% で ok", () => {
    const r = computeGrounding({ groundType: "D", hasEarthLeakageBreaker: "yes", measured: 100 });
    expect(itemValue(r, "許容接地抵抗値")).toBe(500);
    expect(r.usagePercent).toBeCloseTo(20, 10);
    expect(r.verdict).toBe("ok");
  });

  it("D種・遮断器なし → 許容100Ω。実測100Ωちょうどは warn（上限ぴったり）", () => {
    const r = computeGrounding({ groundType: "D", hasEarthLeakageBreaker: "no", measured: 100 });
    expect(itemValue(r, "許容接地抵抗値")).toBe(100);
    expect(r.verdict).toBe("warn");
  });

  it("B種以外では1線地絡電流のフィールドを渡さなくても成立する（非表示）", () => {
    expect(computeGrounding({ groundType: "A", measured: 5 }).ok).toBe(true);
  });

  it("規程原文の確認を促す注記と季節変動の注記が常に付く", () => {
    const r = computeGrounding({ ...B_BASE });
    expect(hasNote(r, "原文で確認")).toBe(true);
    expect(hasNote(r, "季節")).toBe(true);
    expect(hasNote(r, "1線地絡電流")).toBe(true);
  });

  it("バリデーション: 1線地絡電流0・実測負値・NaN を弾く", () => {
    expect(computeGrounding({ ...B_BASE, groundFaultCurrent: 0 }).ok).toBe(false);
    expect(computeGrounding({ ...B_BASE, measured: -1 }).ok).toBe(false);
    expect(computeGrounding({ ...B_BASE, measured: Number.NaN }).ok).toBe(false);
  });

  it("モジュール定義: 有料枠", () => {
    expect(groundingModule.tier).toBe("paid");
  });
});
