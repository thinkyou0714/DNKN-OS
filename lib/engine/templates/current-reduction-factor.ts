/**
 * テンプレート: 電線の許容電流と電流減少係数（法規・低圧屋内配線・numeric）。
 *   電技解釈第146条: 同一の管・線ぴ等に収める絶縁電線は、放熱が悪くなるぶん
 *   許容電流を電流減少係数 k で低減する。
 *     I = I0 × k     〔A〕
 *   同一管内の電線数 n に対する k:
 *     n≤3 → 0.70 /  n=4 → 0.63 /  n=5,6 → 0.56 /  7≤n≤15 → 0.49
 *
 * 典型ミス（解説で言及）:
 *   ・電線数の区分（3以下／4／5〜6／7以上）を取り違える
 *   ・減少係数を掛け忘れて素の許容電流 I0 をそのまま答える
 *   ・係数を割ってしまう（低減なので掛ける）
 */
import { formatClean, isCleanAnswer } from "../clean.js";
import { defineTemplate, pick } from "./helpers.js";

/** 絶縁電線（600Vビニル絶縁電線）のがいし引き工事での許容電流 I0〔A〕（代表値）。 */
const BASE_CURRENT_SET: ReadonlyArray<number> = [27, 35, 48, 49, 61, 62, 88, 115, 139, 162];
/** 同一管内の電線数 n（区分の境界を網羅する）。 */
const WIRE_COUNT_SET: ReadonlyArray<number> = [2, 3, 4, 5, 6, 7, 10, 15];

/** 電線数 → 電流減少係数（電技解釈146条）。 */
function reductionFactor(n: number): number | null {
  if (n < 1 || !Number.isInteger(n)) return null;
  if (n <= 3) return 0.7;
  if (n === 4) return 0.63;
  if (n <= 6) return 0.56;
  if (n <= 15) return 0.49;
  return null;
}

type Params = {
  base_current: number;
  wire_count: number;
};

export const currentReductionFactor = defineTemplate<Params>({
  topic: "電線の許容電流と電流減少係数",
  subject: "法規",
  exam: "denken2_primary",
  difficulty: 2,
  pastExam: {
    area: "低圧・引込・屋内配線",
    frequency: "mid",
    years: [2011, 2015, 2020, 2024],
    note: "電技解釈146条: 同一管内の電線数による電流減少係数 0.70/0.63/0.56/0.49",
  },
  paramSpecs: {
    base_current: { unit: "A", realistic_range: [20, 200] },
    wire_count: { unit: "本", realistic_range: [1, 15] },
  },
  paramOrder: ["base_current", "wire_count"],
  draw(rng) {
    return { base_current: pick(BASE_CURRENT_SET, rng), wire_count: pick(WIRE_COUNT_SET, rng) };
  },
  buildFrom({ base_current: i0, wire_count: n }) {
    if (i0 <= 0) return null;
    const k = reductionFactor(n);
    if (k === null) return null;
    const allowable = i0 * k;
    if (!isCleanAnswer(allowable)) return null;
    const answerText = formatClean(allowable);
    const band = n <= 3 ? "3本以下" : n === 4 ? "4本" : n <= 6 ? "5〜6本" : "7〜15本";
    return {
      format: "numeric",
      params: {
        base_current: { value: i0, unit: "A", realistic_range: [20, 200] },
        wire_count: { value: n, unit: "本", realistic_range: [1, 15] },
      },
      answerValue: allowable,
      answerUnit: "A",
      answerText,
      facts: { i0, n, k, allowable },
      defaultStatement:
        `許容電流 I0=${formatClean(i0)}A の絶縁電線を、同一の金属管内に ${formatClean(n)}本 収めて施設する。` +
        `電流減少係数を考慮したこの電線1本あたりの許容電流 I〔A〕はいくらか。`,
      defaultSolution: [
        `電技解釈第146条: 同一管内の電線数により許容電流を低減する（3本以下 0.70／4本 0.63／5〜6本 0.56／7〜15本 0.49）`,
        `本問は${band}なので電流減少係数 k=${formatClean(k)}`,
        `I=I0×k=${formatClean(i0)}×${formatClean(k)}`,
        `I=${answerText}A`,
        `ポイント: 電線を束ねるほど放熱が悪くなるため係数は「掛けて減らす」。割らない。`,
      ],
      physicallyValid: true,
    };
  },
});
