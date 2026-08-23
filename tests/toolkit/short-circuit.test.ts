/**
 * tests/toolkit/short-circuit.test.ts — 短絡電流・遮断容量の手計算照合。
 * 期待値は Ps = Pn×100/%Z、Is = Ps/(√3·V) を実装と独立に電卓計算した値。
 */
import { describe, expect, it } from "vitest";
import { computeShortCircuit, shortCircuitModule } from "../../lib/toolkit/short-circuit.js";
import { hasNote, itemValue } from "../helpers/toolkit.js";

const BASE = {
  mode: "percentZ",
  baseCapacity: 10,
  percentZ: 5,
  voltage: 6.6,
  breakingCurrent: 12.5,
  threshold: 80,
};

describe("computeShortCircuit — %Z 方式", () => {
  it("10MVA・%Z5%・6.6kV → Ps=200MVA・Is=17.50kA、12.5kA 遮断器では 140% = ng", () => {
    const r = computeShortCircuit({ ...BASE });
    expect(itemValue(r, "短絡容量 Ps")).toBeCloseTo(200, 10);
    expect(itemValue(r, "三相短絡電流 Is")).toBeCloseTo(17.495462702715933, 8);
    expect(r.usagePercent).toBeCloseTo(139.96370162172747, 8);
    expect(r.verdict).toBe("ng");
    expect(r.notes?.[0]).toContain("定格遮断電流を超えて");
  });

  it("%Z を倍にすると短絡電流は半分（反比例）", () => {
    const z5 = computeShortCircuit({ ...BASE });
    const z10 = computeShortCircuit({ ...BASE, percentZ: 10 });
    expect(itemValue(z10, "三相短絡電流 Is")).toBeCloseTo(itemValue(z5, "三相短絡電流 Is") / 2, 10);
  });

  it("遮断器の容量で判定が変わる（25kA=70%は ok、20kA=87.5%は既定閾値80%超で ng）", () => {
    const ok = computeShortCircuit({ ...BASE, breakingCurrent: 25 });
    expect(ok.usagePercent).toBeCloseTo(69.97, 1);
    expect(ok.verdict).toBe("ok");
    const tight = computeShortCircuit({ ...BASE, breakingCurrent: 20 });
    expect(tight.usagePercent).toBeCloseTo(87.48, 1);
    expect(tight.verdict).toBe("ng");
    // 閾値を 100%（定格ぎりぎりまで許容）にすると、87.5% は「合格だが余裕小」に落ち着く。
    expect(computeShortCircuit({ ...BASE, breakingCurrent: 20, threshold: 100 }).verdict).toBe("ok");
    // 94.6%（18.5kA）なら閾値100%でも warn 帯に入る。
    expect(computeShortCircuit({ ...BASE, breakingCurrent: 18.5, threshold: 100 }).verdict).toBe("warn");
  });

  it("余裕の行は定格遮断電流との差", () => {
    const r = computeShortCircuit({ ...BASE, breakingCurrent: 25 });
    expect(itemValue(r, "定格遮断電流までの余裕")).toBeCloseTo(25 - 17.495462702715933, 8);
  });
});

describe("computeShortCircuit — 変圧器方式", () => {
  it("500kVA・%Z4%・0.42kV → Ps=12.5MVA・Is=17.18kA", () => {
    const r = computeShortCircuit({
      ...BASE,
      mode: "transformer",
      transformerCapacity: 500,
      transformerPercentZ: 4,
      voltage: 0.42,
      breakingCurrent: 25,
    });
    expect(itemValue(r, "短絡容量 Ps")).toBeCloseTo(12.5, 10);
    expect(itemValue(r, "三相短絡電流 Is")).toBeCloseTo(17.18304372588172, 8);
    expect(hasNote(r, "電源側インピーダンスを無視")).toBe(true);
  });

  it("変圧器方式では基準容量・合成%Z のフィールドは検証対象外（非表示）", () => {
    const r = computeShortCircuit({
      mode: "transformer",
      transformerCapacity: 500,
      transformerPercentZ: 4,
      voltage: 0.42,
      breakingCurrent: 25,
      threshold: 80,
      // baseCapacity / percentZ を渡さなくても成立する
    });
    expect(r.ok).toBe(true);
  });
});

describe("バリデーションとモジュール定義", () => {
  it("%Z0・電圧0・定格遮断電流0・NaN を弾く", () => {
    expect(computeShortCircuit({ ...BASE, percentZ: 0 }).ok).toBe(false);
    expect(computeShortCircuit({ ...BASE, voltage: 0 }).ok).toBe(false);
    expect(computeShortCircuit({ ...BASE, breakingCurrent: 0 }).ok).toBe(false);
    expect(computeShortCircuit({ ...BASE, baseCapacity: Number.NaN }).ok).toBe(false);
  });

  it("有料枠・三相短絡である旨の注記が付く", () => {
    expect(shortCircuitModule.tier).toBe("paid");
    expect(hasNote(computeShortCircuit({ ...BASE }), "三相短絡")).toBe(true);
  });
});
