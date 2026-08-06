/**
 * テンプレート: 支持物の根入れ深さ（法規・numeric）。
 *   電技解釈第59条（簡略化）: 全長 15m 以下の支持物の根入れ深さは
 *     根入れ ≥ 全長 × 1/6
 *   本テンプレは最小根入れ深さ depth = 全長/6〔m〕を求める。
 *
 * 典型ミス（解説で言及）:
 *   ・1/6 ではなく 1/10 や 1/3 で計算する
 *   ・全長と地上高を取り違える
 */
import { formatClean, isCleanAnswer } from "../clean.js";
import { defineTemplate, pick } from "./helpers.js";

const POLE_SET: ReadonlyArray<number> = [3, 4.5, 6, 7.5, 9, 10.5, 12, 13.5, 15]; // 〔m〕

type Params = {
  pole_length: number;
};

export const poleEmbedmentDepth = defineTemplate<Params>({
  topic: "支持物の根入れ深さ",
  subject: "法規",
  exam: "denken2_primary",
  difficulty: 1,
  pastExam: {
    area: "電線路・架空配電",
    frequency: "low",
    years: [2014, 2020],
    note: "電技解釈59条：全長15m以下の支持物の根入れは全長×1/6以上（簡略化）",
  },
  paramSpecs: {
    pole_length: { unit: "m", realistic_range: [3, 15] },
  },
  paramOrder: ["pole_length"],
  draw(rng) {
    return {
      pole_length: pick(POLE_SET, rng),
    };
  },
  buildFrom({ pole_length: poleLength }) {
    if (poleLength <= 0) return null;
    const depth = poleLength / 6; // 最小根入れ深さ〔m〕
    if (!isCleanAnswer(depth)) return null;
    const answerText = formatClean(depth);
    return {
      format: "numeric",
      params: {
        pole_length: { value: poleLength, unit: "m", realistic_range: [3, 15] },
      },
      answerValue: depth,
      answerUnit: "m",
      answerText,
      facts: { poleLength, depth },
      defaultStatement:
        `全長 ${formatClean(poleLength)}m（15m以下）の支持物を施設する。` +
        `電技解釈に基づく最小の根入れ深さ〔m〕は?（根入れは全長の1/6以上とする）`,
      defaultSolution: [
        `全長15m以下の支持物の根入れは全長×1/6以上`,
        `depth=${formatClean(poleLength)}/6`,
        `depth=${answerText}m`,
      ],
      physicallyValid: true,
    };
  },
});
