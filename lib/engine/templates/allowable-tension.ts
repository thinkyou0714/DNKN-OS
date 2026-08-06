/**
 * テンプレート: 電線の許容引張荷重（法規・numeric）。
 *   許容張力  T_a = T_b / f   〔N〕（T_b=引張強さ, f=安全率）
 *
 * 【出題シナリオ】電線路設計で安全率を考慮した許容張力の計算。
 * 【正解導出式】T_a = T_b / f
 * 【既定params】tensile_strength: 2000〜20000N, safety_factor: 2〜5
 * 【境界】T_b, f > 0
 */
import { formatClean, isCleanAnswer } from "../clean.js";
import { defineTemplate, pick } from "./helpers.js";

const TB_SET: ReadonlyArray<number> = [
  2000, 2100, 2400, 2700, 3000, 3600, 4000, 4200, 4800, 5400, 6000, 6600, 7200, 7800, 8000, 8400, 9000, 9600, 9800,
  10000, 10500, 12000, 13500, 15000, 16500, 18000, 19500, 20000,
];
const F_SET: ReadonlyArray<number> = [2, 2.5, 3, 4, 5];

type Params = {
  tensile_strength: number;
  safety_factor: number;
};

export const allowableTension = defineTemplate<Params>({
  topic: "電線の許容張力",
  subject: "法規",
  exam: "denken2_primary",
  difficulty: 2,
  pastExam: { area: "電線路・架空配電", frequency: "mid", years: [2010, 2015, 2020, 2025] },
  paramSpecs: {
    tensile_strength: { unit: "N", realistic_range: [2000, 20000] },
    safety_factor: { unit: "", realistic_range: [2, 5] },
  },
  paramOrder: ["tensile_strength", "safety_factor"],
  draw(rng) {
    return {
      tensile_strength: pick(TB_SET, rng),
      safety_factor: pick(F_SET, rng),
    };
  },
  buildFrom({ tensile_strength: Tb, safety_factor: f }) {
    if (Tb <= 0 || f <= 0) return null;
    const Ta = Tb / f;
    if (!isCleanAnswer(Ta)) return null;
    const answerText = formatClean(Ta);
    return {
      format: "numeric",
      params: {
        tensile_strength: { value: Tb, unit: "N", realistic_range: [2000, 20000] },
        safety_factor: { value: f, unit: "", realistic_range: [2, 5] },
      },
      answerValue: Ta,
      answerUnit: "N",
      answerText,
      facts: { Tb, f, Ta },
      defaultStatement: `引張強さ T_b=${Tb}N の電線を安全率 f=${f} で使用する。許容引張荷重 T_a〔N〕は?`,
      defaultSolution: [`許容張力 T_a=引張強さ/安全率=T_b/f`, `T_a=${Tb}/${f}`, `T_a=${answerText}N`],
      physicallyValid: true,
    };
  },
});
