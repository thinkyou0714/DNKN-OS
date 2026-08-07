/**
 * テンプレート: 自動制御系の定常位置偏差（二種二次・機械制御・descriptive）。
 *   単位ステップ入力に対する定常偏差  ess = 1 / (1 + Kp)
 *     Kp=位置偏差定数（開ループゲイン）
 */
import { formatClean, isCleanAnswer } from "../clean.js";
import { defineTemplate, pick } from "./helpers.js";

const K_SET: ReadonlyArray<number> = [1, 3, 4, 9, 19, 24, 49, 99];

type Params = {
  gain: number;
};

export const steadyStateError = defineTemplate<Params>({
  topic: "制御系の定常偏差",
  subject: "機械制御",
  exam: "denken2_secondary",
  difficulty: 4,
  pastExam: { area: "自動制御理論", frequency: "high", years: [2007, 2012, 2018, 2023] },
  paramSpecs: {
    gain: { unit: "", realistic_range: [1, 100] },
  },
  paramOrder: ["gain"],
  draw(rng) {
    return { gain: pick(K_SET, rng) };
  },
  buildFrom({ gain: K }) {
    if (K <= 0) return null;
    const ess = 1 / (1 + K);
    if (!isCleanAnswer(ess)) return null;
    const answerText = formatClean(ess);
    return {
      format: "descriptive",
      params: {
        gain: { value: K, unit: "", realistic_range: [1, 100] },
      },
      answerValue: ess,
      answerUnit: "",
      answerText,
      facts: { K, ess },
      defaultStatement:
        `位置偏差定数 Kp=${K} の単位フィードバック制御系に、単位ステップ入力を加える。` +
        `定常位置偏差 ess を ess=1/(1+Kp) により導出過程とともに求めよ。`,
      defaultSolution: [
        `最終値の定理より定常位置偏差 ess=1/(1+Kp)`,
        `ess=1/(1+${K})`,
        `ess=${answerText}`,
        `ポイント: Kp を大きくすると定常偏差は小さくなる（精度向上）。`,
      ],
      physicallyValid: true,
    };
  },
});
