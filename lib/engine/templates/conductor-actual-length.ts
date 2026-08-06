/**
 * テンプレート: 電線の実長（法規・numeric）。
 *   径間 S・たるみ D の架空電線の実長（放物線近似）:
 *     L ≈ S + 8D²/(3S)    〔m〕
 *   電線路の架空配電（電技解釈）で扱う電線実長・たるみの関係。
 *
 * 典型ミス（解説で言及）:
 *   ・係数を 8/3 でなく 8 や 3 にする
 *   ・たるみ補正項を 2乗せず D のまま扱う
 */
import { formatClean, isCleanAnswer } from "../clean.js";
import { defineTemplate, pick } from "./helpers.js";

const SPAN_SET: ReadonlyArray<number> = [100, 120, 140, 150, 160, 180, 200, 240, 250, 270, 300, 320, 360, 400]; // 〔m〕
const DIP_SET: ReadonlyArray<number> = [3, 4.5, 6, 7.5, 9]; // 〔m〕

type Params = {
  span: number;
  dip: number;
};

export const conductorActualLength = defineTemplate<Params>({
  topic: "電線の実長",
  subject: "法規",
  exam: "denken2_primary",
  difficulty: 2,
  pastExam: {
    area: "電線路・架空配電",
    frequency: "mid",
    years: [2010, 2016, 2021],
    note: "径間S・たるみDからの電線実長 L≈S+8D²/(3S)",
  },
  paramSpecs: {
    span: { unit: "m", realistic_range: [100, 400] },
    dip: { unit: "m", realistic_range: [3, 9] },
  },
  paramOrder: ["span", "dip"],
  draw(rng) {
    return {
      span: pick(SPAN_SET, rng),
      dip: pick(DIP_SET, rng),
    };
  },
  buildFrom({ span, dip }) {
    if (span <= 0 || dip <= 0) return null;
    const l = span + (8 * dip * dip) / (3 * span); // 電線実長〔m〕
    if (!isCleanAnswer(l)) return null;
    const answerText = formatClean(l);
    return {
      format: "numeric",
      params: {
        span: { value: span, unit: "m", realistic_range: [100, 400] },
        dip: { value: dip, unit: "m", realistic_range: [3, 9] },
      },
      answerValue: l,
      answerUnit: "m",
      answerText,
      facts: { span, dip, l },
      defaultStatement:
        `径間 S=${formatClean(span)}m、たるみ D=${formatClean(dip)}m の架空電線がある。` +
        `この電線の実長 L〔m〕は?（放物線近似）`,
      defaultSolution: [
        `電線の実長 L≈S+8D²/(3S)`,
        `L=${formatClean(span)}+8×${formatClean(dip * dip)}/(3×${formatClean(span)})`,
        `L=${answerText}m`,
      ],
      physicallyValid: true,
    };
  },
});
