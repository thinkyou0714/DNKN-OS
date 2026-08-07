/**
 * テンプレート: 支線の安全率（法規・numeric）。
 *   電技解釈 第61条: 支線の安全率は原則 2.5 以上。
 *   必要な引張強さ = 想定最大張力 × 2.5〔kN〕
 */
import { formatClean, isCleanAnswer } from "../clean.js";
import { defineTemplate, pick } from "./helpers.js";

const SAFETY_FACTOR = 2.5;
const T_SET: ReadonlyArray<number> = [2, 4, 6, 8, 10, 12, 16, 20, 3, 5, 7, 9, 14, 15, 18, 24, 25, 30, 35, 40];

type Params = {
  max_tension: number;
};

export const guyWireSafety = defineTemplate<Params>({
  topic: "支線の安全率",
  subject: "法規",
  exam: "denken2_primary",
  difficulty: 2,
  pastExam: { area: "風圧荷重・機械的強度", frequency: "mid", years: [2011, 2016, 2021] },
  paramSpecs: {
    max_tension: { unit: "kN", realistic_range: [1, 50] },
  },
  paramOrder: ["max_tension"],
  draw(rng) {
    return { max_tension: pick(T_SET, rng) };
  },
  buildFrom({ max_tension: tension }) {
    if (tension <= 0) return null;
    const required = tension * SAFETY_FACTOR;
    if (!isCleanAnswer(required)) return null;
    const answerText = formatClean(required);
    return {
      format: "numeric",
      params: {
        max_tension: { value: tension, unit: "kN", realistic_range: [1, 50] },
      },
      answerValue: required,
      answerUnit: "kN",
      answerText,
      facts: { tension, safetyFactor: SAFETY_FACTOR, required },
      defaultStatement:
        `架空電線路の支持物を支える支線に想定される最大張力が ${formatClean(tension)}kN である。` +
        `この支線に最低限必要な引張強さ〔kN〕は?（安全率は電技解釈第61条の原則による）`,
      defaultSolution: [
        `電技解釈第61条: 支線の安全率は原則2.5以上（特定の施設条件では1.5まで緩和され得るが本問は原則）`,
        `必要引張強さ=想定最大張力×安全率=${formatClean(tension)}×${formatClean(SAFETY_FACTOR)}`,
        `=${answerText}kN`,
      ],
      physicallyValid: true,
    };
  },
});
