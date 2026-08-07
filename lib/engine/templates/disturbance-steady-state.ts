/**
 * テンプレート: 外乱に対する定常偏差（二種二次・機械制御・descriptive）。
 *   直流ゲイン1の一次遅れプラントの入力側に一定外乱 d が加わる比例制御系
 *   （ゲイン K・単位フィードバック）では、最終値の定理より出力の定常変化は
 *     e = d/(1+K)
 *   過去問頻出の「定常偏差」を、目標値追従ではなく外乱抑圧にひねった改作。
 */
import { formatClean, isCleanAnswer } from "../clean.js";
import { defineTemplate, pick } from "./helpers.js";

const D_SET: ReadonlyArray<number> = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 75, 80, 100];
const K_SET: ReadonlyArray<number> = [1, 3, 4, 9, 19, 24, 49, 99, 199];

type Params = {
  disturbance: number;
  proportional_gain: number;
};

export const disturbanceSteadyState = defineTemplate<Params>({
  topic: "外乱に対する定常偏差",
  subject: "機械制御",
  exam: "denken2_secondary",
  difficulty: 4,
  pastExam: { area: "自動制御理論", frequency: "high", years: [2007, 2012, 2018, 2022] },
  paramSpecs: {
    disturbance: { unit: "", realistic_range: [1, 100] },
    proportional_gain: { unit: "", realistic_range: [1, 200] },
  },
  paramOrder: ["disturbance", "proportional_gain"],
  draw(rng) {
    return {
      disturbance: pick(D_SET, rng),
      proportional_gain: pick(K_SET, rng),
    };
  },
  buildFrom({ disturbance: d, proportional_gain: k }) {
    if (d <= 0 || k <= 0) return null;
    const error = d / (1 + k);
    if (error <= 0 || !isCleanAnswer(error)) return null;
    const answerText = formatClean(error);
    return {
      format: "descriptive",
      params: {
        disturbance: { value: d, unit: "", realistic_range: [1, 100] },
        proportional_gain: { value: k, unit: "", realistic_range: [1, 200] },
      },
      answerValue: error,
      answerUnit: "",
      answerText,
      facts: { d, k, error },
      defaultStatement:
        `直流ゲイン1の一次遅れ要素 G(s)=1/(1+Ts) を、比例ゲイン K=${k} の単位フィードバックで` +
        `制御している。目標値一定のもと、制御対象の入力側に大きさ ${d} の一定値外乱が加わった。` +
        `十分時間が経過した後の出力の定常偏差（外乱による出力変化）を求めよ。`,
      defaultSolution: [
        `着眼点: 外乱から出力までの伝達関数は G/(1+KG)。最終値の定理で s→0 とする。`,
        `s→0 で G→1 だから、定常値は d×1/(1+K)`,
        `e=${d}/(1+${k})=${answerText}`,
        `ポイント: 比例制御では外乱の影響は 1/(1+K) 倍に減るだけで零にはならない。零にするには積分動作が要る。`,
      ],
      physicallyValid: true,
    };
  },
});
