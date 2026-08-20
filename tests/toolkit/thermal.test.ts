/**
 * tests/toolkit/thermal.test.ts — 半導体熱計算の手計算照合。
 * 期待値は Tj = Ta + P×θ（定常）および Tj = Ta + Pp×(D×Rth + (1−D)×Zth(tp))（繰り返しパルス）
 * を実装と独立に電卓計算した値。
 */
import { describe, expect, it } from "vitest";
import { computeThermal, repetitiveZth, thermalModule } from "../../lib/toolkit/thermal.js";
import { hasNote, itemValue } from "../helpers/toolkit.js";

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

describe("computeThermal — 定常", () => {
  it("θja モデル: Ta=50・P=2W・θja=40 → Tj=130℃・86.67% = ng", () => {
    const r = computeThermal({ ...SIMPLE });
    expect(itemValue(r, "ジャンクション温度 Tj")).toBeCloseTo(130, 10);
    expect(itemValue(r, "Tj(max) までの余裕")).toBeCloseTo(20, 10);
    expect(r.usagePercent).toBeCloseTo(86.66666666666667, 8);
    expect(r.verdict).toBe("ng");
  });

  it("ヒートシンクモデル: θ合成=4.0・Tj=80℃・45.71% = ok", () => {
    const r = computeThermal({ ...HEATSINK });
    expect(itemValue(r, "定常の合成熱抵抗 Rth")).toBeCloseTo(4.0, 10);
    expect(itemValue(r, "ジャンクション温度 Tj")).toBeCloseTo(80, 10);
    expect(r.usagePercent).toBeCloseTo(45.714285714285715, 8);
    expect(r.verdict).toBe("ok");
  });

  it("warn 帯: Tj=115℃（P=1.625W）は 76.67% で warn（閾値80%の90%=72%超）", () => {
    const r = computeThermal({ ...SIMPLE, power: 1.625 });
    expect(itemValue(r, "ジャンクション温度 Tj")).toBeCloseTo(115, 10);
    expect(r.verdict).toBe("warn");
  });

  it("Tj(max) 超過は ng＋使用不可の注記、P=0 では Tj=Ta", () => {
    const over = computeThermal({ ...SIMPLE, power: 3 });
    expect(itemValue(over, "ジャンクション温度 Tj")).toBeCloseTo(170, 10);
    expect(over.verdict).toBe("ng");
    expect(over.notes?.[0]).toContain("絶対最大定格");
    const idle = computeThermal({ ...SIMPLE, power: 0 });
    expect(itemValue(idle, "ジャンクション温度 Tj")).toBe(50);
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
    expect(hasNote(computeThermal({ ...SIMPLE }), "JEDEC")).toBe(true);
  });
});

describe("repetitiveZth / 繰り返しパルス（第2弾）", () => {
  it("Zth(D,tp) は D=1 で定常 Rth に、D=0 で単発 Zth(tp) に一致する", () => {
    expect(repetitiveZth(1, 4, 0.5)).toBeCloseTo(4, 10);
    expect(repetitiveZth(0, 4, 0.5)).toBeCloseTo(0.5, 10);
    expect(repetitiveZth(0.1, 4, 0.5)).toBeCloseTo(0.85, 10);
  });

  const PULSE = {
    ...HEATSINK,
    loadMode: "pulse",
    pulsePower: 100,
    pulseWidth: 0.001,
    period: 0.01,
    zthSingle: 0.5,
  };

  it("D=0.1・Zth=0.85・Pp=100W → ピーク Tj=125℃（Ta=40）・71.43% = ok、平均損失は 10W", () => {
    const r = computeThermal({ ...PULSE });
    expect(itemValue(r, "デューティ比 D")).toBeCloseTo(0.1, 10);
    expect(itemValue(r, "実効熱インピーダンス Zth(D,tp)")).toBeCloseTo(0.85, 10);
    expect(itemValue(r, "平均損失")).toBeCloseTo(10, 10);
    expect(itemValue(r, "ピークジャンクション温度 Tj")).toBeCloseTo(125, 8);
    expect(r.usagePercent).toBeCloseTo(71.42857142857144, 8);
    expect(r.verdict).toBe("ok");
    expect(hasNote(r, "Zth(D,tp)")).toBe(true);
  });

  it("平均損失だけで定常評価すると Tj を過小評価する（80℃ vs ピーク 125℃）", () => {
    const peak = computeThermal({ ...PULSE });
    const naiveAverage = computeThermal({ ...HEATSINK, power: 10 });
    expect(itemValue(naiveAverage, "ジャンクション温度 Tj")).toBeCloseTo(80, 10);
    expect(itemValue(peak, "ピークジャンクション温度 Tj")).toBeGreaterThan(
      itemValue(naiveAverage, "ジャンクション温度 Tj"),
    );
  });

  it("デューティが上がるほどピーク Tj は定常値へ近づく（D=1 で完全一致）", () => {
    const full = computeThermal({ ...PULSE, pulseWidth: 0.01, period: 0.01 });
    const steadyEquivalent = computeThermal({ ...HEATSINK, power: 100 });
    expect(itemValue(full, "デューティ比 D")).toBeCloseTo(1, 10);
    expect(itemValue(full, "ピークジャンクション温度 Tj")).toBeCloseTo(
      itemValue(steadyEquivalent, "ジャンクション温度 Tj"),
      8,
    );
  });

  it("バリデーション: 周期 < パルス幅（D>1）と Zth(tp) > Rth を弾く", () => {
    const badDuty = computeThermal({ ...PULSE, pulseWidth: 0.02, period: 0.01 });
    expect(badDuty.ok).toBe(false);
    expect(badDuty.errors?.[0]?.message).toContain("デューティ比");
    const badZth = computeThermal({ ...PULSE, zthSingle: 5 });
    expect(badZth.ok).toBe(false);
    expect(badZth.errors?.[0]?.message).toContain("定常の合成熱抵抗以下");
  });

  it("負荷モード未指定は定常として扱う（既存入力の互換）", () => {
    const explicit = computeThermal({ ...SIMPLE, loadMode: "steady" });
    const implicit = computeThermal({ ...SIMPLE });
    expect(implicit.items).toEqual(explicit.items);
  });
});
