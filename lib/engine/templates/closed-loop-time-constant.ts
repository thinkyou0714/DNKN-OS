/**
 * テンプレート: フィードバックによる時定数の短縮（二種二次・機械制御・descriptive）。
 *   一次遅れ G(s)=1/(1+Ts) に比例ゲイン K・単位フィードバックを施すと、閉ループは
 *     W(s) = K/(1+K) × 1/{1+ (T/(1+K))s }
 *   となり、時定数は Tc = T/(1+K) に短縮される。
 *   過去問頻出の「一次遅れ系の応答」を、フィードバックの効用（速応化）にひねった改作。
 */
import { formatClean, isCleanAnswer } from "../clean.js";
import { defineTemplate, pick } from "./helpers.js";

const T_SET: ReadonlyArray<number> = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 15, 20];
const K_SET: ReadonlyArray<number> = [1, 3, 4, 9, 19, 24, 49];

type Params = {
  open_loop_time_constant: number;
  proportional_gain: number;
};

export const closedLoopTimeConstant = defineTemplate<Params>({
  topic: "フィードバックによる時定数短縮",
  subject: "機械制御",
  exam: "denken2_secondary",
  difficulty: 4,
  pastExam: { area: "自動制御理論", frequency: "high", years: [2009, 2015, 2021] },
  paramSpecs: {
    open_loop_time_constant: { unit: "s", realistic_range: [0.5, 20] },
    proportional_gain: { unit: "", realistic_range: [1, 50] },
  },
  paramOrder: ["open_loop_time_constant", "proportional_gain"],
  draw(rng) {
    return {
      open_loop_time_constant: pick(T_SET, rng),
      proportional_gain: pick(K_SET, rng),
    };
  },
  buildFrom({ open_loop_time_constant: t, proportional_gain: k }) {
    if (t <= 0 || k <= 0) return null;
    const tc = t / (1 + k);
    const dcGain = k / (1 + k);
    if (tc <= 0 || !isCleanAnswer(tc) || !isCleanAnswer(dcGain, 4)) return null;
    const answerText = formatClean(tc);
    const gainText = formatClean(dcGain, 4);
    return {
      format: "descriptive",
      params: {
        open_loop_time_constant: { value: t, unit: "s", realistic_range: [0.5, 20] },
        proportional_gain: { value: k, unit: "", realistic_range: [1, 50] },
      },
      answerValue: tc,
      answerUnit: "s",
      answerText,
      facts: { t, k, tc, dcGain },
      defaultStatement:
        `時定数 ${t}s・直流ゲイン1の一次遅れ要素 G(s)=1/(1+${t}s) の前に比例ゲイン K=${k} を置き、` +
        `単位フィードバック系を構成した。閉ループ伝達関数を一次遅れの標準形に整理し、` +
        `閉ループ系の時定数〔s〕を求めよ。`,
      defaultSolution: [
        `着眼点: W(s)=KG/(1+KG)。分母分子を整理して 1+(何)s の形の「何」を読む。`,
        `W(s)=K/(1+K+${t}s)=K/(1+K) × 1/{1+${t}/(1+K)·s}`,
        `Tc=T/(1+K)=${t}/(1+${k})=${answerText}s`,
        `（直流ゲインは K/(1+K)=${gainText} となり1にはならない）`,
        `ポイント: ゲインを上げるほど速応化する一方、実系では飽和や振動とのトレードオフになる。`,
      ],
      physicallyValid: true,
    };
  },
});
