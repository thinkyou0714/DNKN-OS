/**
 * テンプレート: B種接地工事の接地抵抗（法規・numeric 形式）。
 *   基本式 R = 150 / Ig 〔Ω〕   (Ig = 1線地絡電流〔A〕)
 *   ※緩和: 高圧電路を1〜2秒で遮断する装置があれば 300/Ig、1秒以内なら 600/Ig。
 * 正解はコードで算出（出典: 電気設備技術基準・電験法規の標準式）。
 */
import { isCleanAnswer } from "../clean.js";
import { defineTemplate, pick } from "./helpers.js";

// 150/Ig が綺麗な値になる 1線地絡電流〔A〕。
const IG_SET = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 7.5, 8, 10, 12, 12.5, 15, 20, 24, 25, 30];

type Params = {
  ground_fault_current: number;
};

export const groundingResistance = defineTemplate<Params>({
  topic: "B種接地抵抗",
  subject: "法規",
  exam: "denken3",
  difficulty: 2,
  pastExam: { area: "接地工事", frequency: "high", years: [2007, 2011, 2015, 2019, 2023] },
  paramSpecs: { ground_fault_current: { unit: "A", realistic_range: [1, 30] } },
  paramOrder: ["ground_fault_current"],
  draw(rng) {
    return { ground_fault_current: pick(IG_SET, rng) };
  },
  buildFrom({ ground_fault_current: ig }) {
    if (ig <= 0) return null;
    const R = 150 / ig;
    if (!isCleanAnswer(R)) return null;
    const answerText = String(Number(R.toFixed(2)));
    return {
      format: "numeric",
      params: { ground_fault_current: { value: ig, unit: "A", realistic_range: [1, 30] } },
      answerValue: R,
      answerUnit: "Ω",
      answerText,
      facts: { Ig: ig, R },
      defaultStatement: `高圧電路の1線地絡電流が${ig}Aである。B種接地工事の接地抵抗の最大値〔Ω〕を、基本式 R=150/Ig により求めよ。`,
      defaultSolution: [
        "B種接地抵抗の基本式: R = 150 / Ig",
        `R = 150 / ${ig} = ${answerText}Ω`,
        "（参考: 高圧電路を1〜2秒で自動遮断する装置があれば300/Ig、1秒以内なら600/Ig まで緩和される）",
      ],
      physicallyValid: true,
    };
  },
});
