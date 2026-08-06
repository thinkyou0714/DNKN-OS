/**
 * pastexam-regulation3-templates.test.ts — 法規の在庫補強で追加した
 * 低圧屋内配線の計算テンプレ2本（低圧幹線の許容電流 / 電線の許容電流と電流減少係数）の検証。
 *
 * どちらも電技解釈の「区分によって係数が変わる」型なので、区分の境界前後で
 * 正しい係数が選ばれることを固定値で押さえる（境界の取り違えは本試験の典型ミス）。
 * （横断的な物理成立・レンジ・解説整合は tests/engine/template-invariants.test.ts が担保）
 */
import { describe, expect, it } from "vitest";
import { isCleanAnswer } from "../../lib/engine/clean.js";
import { currentReductionFactor } from "../../lib/engine/templates/current-reduction-factor.js";
import { getTemplate } from "../../lib/engine/templates/index.js";
import { mainLineAllowableCurrent } from "../../lib/engine/templates/main-line-allowable-current.js";
import type { Template } from "../../lib/engine/templates/types.js";
import { seededRng } from "../helpers/rng.js";

function expectCleanGeneration(t: Template, seed: number, runs = 40): void {
  const rng = seededRng(seed);
  let drawn = 0;
  for (let i = 0; i < runs * 4 && drawn < runs; i++) {
    const g = t.generate(rng);
    if (!g) continue;
    drawn += 1;
    const n = Number(g.answerText);
    expect(Number.isFinite(n), `${t.topic}: answerText=${g.answerText} は有限数であるべき`).toBe(true);
    expect(isCleanAnswer(n), `${t.topic}: answerText=${g.answerText} は綺麗な値であるべき`).toBe(true);
  }
  expect(drawn, `${t.topic}: 有効な draw が得られない`).toBeGreaterThan(0);
}

describe("低圧幹線の許容電流（電技解釈148条）", () => {
  it("レジストリに登録され、科目が法規である", () => {
    expect(getTemplate("低圧幹線の許容電流")).toBe(mainLineAllowableCurrent);
    expect(mainLineAllowableCurrent.subject).toBe("法規");
  });

  it("IM=40A(≤50A)・IH=20A → 1.25倍が適用され 70A", () => {
    const g = mainLineAllowableCurrent.generateFrom({ motor_current: 40, other_current: 20 });
    expect(g).not.toBeNull();
    expect(g?.answerText).toBe("70");
    expect(g?.answerUnit).toBe("A");
    expect(g?.format).toBe("numeric");
    expect(g?.choices).toBeUndefined();
  });

  it("IM=50A(境界・以下側)は1.25倍 → 62.5+IH", () => {
    const g = mainLineAllowableCurrent.generateFrom({ motor_current: 50, other_current: 0 });
    expect(g?.answerText).toBe("62.5");
  });

  it("IM=60A(>50A)は1.1倍に切り替わる → 66+IH", () => {
    const g = mainLineAllowableCurrent.generateFrom({ motor_current: 60, other_current: 0 });
    expect(g?.answerText).toBe("66");
    const withOther = mainLineAllowableCurrent.generateFrom({ motor_current: 60, other_current: 25 });
    expect(withOther?.answerText).toBe("91");
  });

  it("解説に適用した割増率と条文の区分が現れる", () => {
    const g = mainLineAllowableCurrent.generateFrom({ motor_current: 100, other_current: 30 });
    expect(g?.answerText).toBe("140");
    const solution = (g?.defaultSolution ?? []).join("\n");
    expect(solution).toContain("148条");
    expect(solution).toContain("1.1");
  });

  it("非物理的な入力（IM≤0）は棄却する", () => {
    expect(mainLineAllowableCurrent.generateFrom({ motor_current: 0, other_current: 10 })).toBeNull();
  });

  it("生成される答えがすべて綺麗な有限数", () => {
    expectCleanGeneration(mainLineAllowableCurrent, 2024);
  });
});

describe("電線の許容電流と電流減少係数（電技解釈146条）", () => {
  it("レジストリに登録され、科目が法規である", () => {
    expect(getTemplate("電線の許容電流と電流減少係数")).toBe(currentReductionFactor);
    expect(currentReductionFactor.subject).toBe("法規");
  });

  it("電線数の区分ごとに係数 0.70/0.63/0.56/0.49 が選ばれる", () => {
    // I0=100A を基準にすると、答えがそのまま係数×100 になり区分を直接確認できる。
    const at = (n: number): string | undefined =>
      currentReductionFactor.generateFrom({ base_current: 100, wire_count: n })?.answerText;
    expect(at(3)).toBe("70");
    expect(at(4)).toBe("63");
    expect(at(6)).toBe("56");
    expect(at(15)).toBe("49");
  });

  it("区分の境界（3本と4本 / 4本と5本 / 6本と7本）で係数が切り替わる", () => {
    const at = (n: number): string | undefined =>
      currentReductionFactor.generateFrom({ base_current: 100, wire_count: n })?.answerText;
    expect(at(3)).not.toBe(at(4));
    expect(at(4)).not.toBe(at(5));
    expect(at(6)).not.toBe(at(7));
    expect(at(5)).toBe(at(6)); // 5本と6本は同区分
  });

  it("代表値の閉形式検算（I0=48A・4本 → 30.24A）", () => {
    const g = currentReductionFactor.generateFrom({ base_current: 48, wire_count: 4 });
    expect(g).not.toBeNull();
    expect(g?.answerText).toBe("30.24");
    expect(g?.answerUnit).toBe("A");
    expect(g?.format).toBe("numeric");
  });

  it("規定範囲外の電線数（16本以上）・非整数・I0≤0 は棄却する", () => {
    expect(currentReductionFactor.generateFrom({ base_current: 100, wire_count: 16 })).toBeNull();
    expect(currentReductionFactor.generateFrom({ base_current: 100, wire_count: 4.5 })).toBeNull();
    expect(currentReductionFactor.generateFrom({ base_current: 0, wire_count: 4 })).toBeNull();
  });

  it("生成される答えがすべて綺麗な有限数", () => {
    expectCleanGeneration(currentReductionFactor, 777);
  });
});
