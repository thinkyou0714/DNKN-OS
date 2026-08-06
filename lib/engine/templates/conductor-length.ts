/**
 * テンプレート: 架空電線の実長（電力・numeric）。
 *   実長 L = S + 8D²/(3S)（S: 径間, D: たるみ）— たるみ計算（既存テンプレ）の姉妹問題。
 *
 * 新規テンプレートはこの形（defineTemplate ファクトリ）を標準とする。
 */
import { formatClean, isCleanAnswer } from "../clean.js";
import { defineTemplate, pick } from "./helpers.js";

/** (径間S, たるみD) — 8D²/(3S) が綺麗になる組。 */
const SD_PAIRS: ReadonlyArray<readonly [number, number]> = [
  [120, 3],
  [150, 3],
  [240, 6],
  [160, 4],
  [300, 7.5],
  [200, 5],
  [240, 3],
  [120, 1.5],
  [160, 2],
  [300, 4.5],
  [100, 3],
  [100, 4.5],
  [100, 6],
  [100, 7.5],
  [100, 9],
  [120, 4.5],
  [120, 6],
  [120, 7.5],
  [120, 9],
  [150, 4.5],
  [150, 6],
  [150, 7.5],
  [150, 9],
  [160, 6],
  [160, 9],
  [180, 4.5],
  [180, 9],
  [200, 3],
  [200, 4.5],
  [200, 6],
  [200, 7.5],
  [200, 9],
  [240, 9],
  [250, 7.5],
  [270, 4.5],
  [270, 9],
  [300, 3],
  [300, 6],
  [300, 9],
  [320, 6],
  [360, 4.5],
  [360, 9],
  [400, 3],
  [400, 6],
  [400, 9],
  // span/sag のレンジが広い（50〜500m / 0.5〜12m）ことを活かした組。
  [50, 1.5],
  [50, 3],
  [50, 4.5],
  [60, 1.5],
  [60, 3],
  [60, 4.5],
  [60, 6],
  [80, 3],
  [80, 6],
  [90, 4.5],
  [90, 9],
  [120, 10.5],
  [120, 12],
  [140, 10.5],
  [150, 10.5],
  [150, 12],
  [160, 12],
  [240, 12],
  [300, 10.5],
  [300, 12],
  [500, 7.5],
];

type Params = {
  span: number;
  sag: number;
};

export const conductorLength = defineTemplate<Params>({
  topic: "架空電線の実長",
  subject: "電力",
  exam: "denken2_primary",
  difficulty: 3,
  pastExam: { area: "送電・線路計算", frequency: "mid", years: [2011, 2016, 2021] },
  paramSpecs: {
    span: { unit: "m", realistic_range: [50, 500] },
    sag: { unit: "m", realistic_range: [0.5, 12] },
  },
  paramOrder: ["span", "sag"],
  draw(rng) {
    const [s, d] = pick(SD_PAIRS, rng);
    return {
      span: s,
      sag: d,
    };
  },
  buildFrom({ span, sag }) {
    if (span <= 0 || sag <= 0 || sag > span / 10) return null;
    const extra = (8 * sag * sag) / (3 * span);
    const len = span + extra;
    if (!isCleanAnswer(len) || !isCleanAnswer(extra)) return null;
    const answerText = formatClean(len);
    return {
      format: "numeric",
      params: {
        span: { value: span, unit: "m", realistic_range: [50, 500] },
        sag: { value: sag, unit: "m", realistic_range: [0.5, 12] },
      },
      answerValue: len,
      answerUnit: "m",
      answerText,
      facts: { span, sag, extra, len },
      defaultStatement: `径間 ${formatClean(span)}m、たるみ ${formatClean(sag)}m の架空電線の実長〔m〕は?`,
      defaultSolution: [
        `実長 L=S+8D²/(3S)`,
        `=${formatClean(span)}+8×${formatClean(sag * sag)}/(3×${formatClean(span)})=${formatClean(span)}+${formatClean(extra)}`,
        `=${answerText}m`,
      ],
      physicallyValid: true,
    };
  },
});
