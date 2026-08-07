/**
 * テンプレート: フィードバック系の合成ゲイン（機械制御・二次・numeric）。
 *   負帰還系の合成伝達関数 W = G/(1+G·H)。定常状態（DC）のゲインを数値で求める。
 *   ブロック線図の等価変換の最初の一歩（二次・機械制御の頻出基礎）。
 */
import { formatClean, isCleanAnswer } from "../clean.js";
import { defineTemplate, pick } from "./helpers.js";

/** (G, H) — W=G/(1+GH) が綺麗になる組。 */
const GH_PAIRS: ReadonlyArray<readonly [number, number]> = [
  [4, 1],
  [9, 1],
  [19, 1],
  [99, 1],
  [4, 0.25],
  [6, 0.5],
  [8, 0.5],
  [12, 0.25],
  [20, 0.2],
  [15, 0.2],
  [24, 1],
  [49, 1],
  [10, 0.1],
  [30, 0.1],
  [40, 0.1],
  [16, 0.25],
  [36, 0.25],
  [10, 0.3],
];

type Params = {
  forward_gain: number;
  feedback_gain: number;
};

export const blockDiagramGain = defineTemplate<Params>({
  topic: "負帰還系の合成ゲイン",
  subject: "機械制御",
  exam: "denken2_secondary",
  difficulty: 3,
  pastExam: { area: "自動制御理論", frequency: "high", years: [2006, 2011, 2017, 2022] },
  paramSpecs: {
    forward_gain: { realistic_range: [1, 200] },
    feedback_gain: { realistic_range: [0.1, 2] },
  },
  paramOrder: ["forward_gain", "feedback_gain"],
  draw(rng) {
    const [g, hh] = pick(GH_PAIRS, rng);
    return { forward_gain: g, feedback_gain: hh };
  },
  buildFrom({ forward_gain: g, feedback_gain: hh }) {
    if (g <= 0 || hh <= 0) return null;
    const w = g / (1 + g * hh);
    if (!isCleanAnswer(w) || !isCleanAnswer(1 + g * hh)) return null;
    const answerText = formatClean(w);
    return {
      format: "numeric",
      params: {
        forward_gain: { value: g, realistic_range: [1, 200] },
        feedback_gain: { value: hh, realistic_range: [0.1, 2] },
      },
      answerValue: w,
      answerUnit: "",
      answerText,
      facts: { g, hh, w },
      defaultStatement:
        `前向き要素のゲイン G=${formatClean(g)}、フィードバック要素のゲイン H=${formatClean(hh)} の` +
        `負帰還制御系がある。系全体の合成ゲイン W=G/(1+GH) の値は?`,
      defaultSolution: [
        `負帰還系の合成伝達関数 W=G/(1+G·H)`,
        `=${formatClean(g)}/(1+${formatClean(g)}×${formatClean(hh)})=${formatClean(g)}/${formatClean(1 + g * hh)}`,
        `=${answerText}`,
      ],
      physicallyValid: true,
    };
  },
});
