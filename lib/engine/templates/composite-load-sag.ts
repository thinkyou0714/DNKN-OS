/**
 * テンプレート: 電線の合成荷重とたるみ（法規B問題・五肢択一）。
 *
 * 既存の「電線のたるみ」は単一荷重 W から D=WS²/(8T) を出すだけ。本試のB問題は
 * その手前に「垂直荷重（自重＋氷雪）と水平荷重（風圧）のベクトル合成」が入る連鎖問題で、
 * この合成の段こそが落としどころになる。
 *
 *   合成荷重  W = √(W垂直² + W水平²) 〔N/m〕
 *   たるみ    D = W・S² / (8T)        〔m〕   (T=水平張力〔N〕)
 *
 * 合成荷重が割り切れるようピタゴラス数の組だけを使う。variant=1 は D を先に決めて
 * T を逆算し、与件の張力が現実的（数kN〜数十kN）かつ綺麗な値になる draw のみ採用する。
 */
import { formatClean, isCleanAnswer } from "../clean.js";
import { buildRoundedMcChoices, defineTemplate, pick } from "./helpers.js";

/** [垂直荷重, 水平荷重, 合成荷重] のピタゴラス数（N/m）。合成が整数になる組だけを持つ。 */
const LOAD_TRIPLES: ReadonlyArray<readonly [number, number, number]> = [
  [3, 4, 5],
  [6, 8, 10],
  [9, 12, 15],
  [12, 16, 20],
  [15, 20, 25],
  [18, 24, 30],
  [21, 28, 35],
  [24, 32, 40],
  [5, 12, 13],
  [10, 24, 26],
  [15, 36, 39],
  [8, 15, 17],
  [16, 30, 34],
  [7, 24, 25],
  [14, 48, 50],
  [20, 21, 29],
  [9, 40, 41],
  [12, 35, 37],
  [28, 45, 53],
  [33, 56, 65],
];
const SPAN_SET = [80, 100, 120, 125, 150, 160, 175, 180, 200, 250];
const SAG_SET = [1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6];

type Params = {
  triple_index: number;
  span: number;
  sag: number;
  variant: number;
};

export const compositeLoadSag = defineTemplate<Params>({
  topic: "電線の合成荷重とたるみ",
  subject: "法規",
  exam: "denken3",
  difficulty: 3,
  pastExam: {
    area: "風圧荷重・機械的強度",
    frequency: "mid",
    years: [2010, 2014, 2017, 2021, 2024],
  },
  paramSpecs: {
    triple_index: { realistic_range: [0, LOAD_TRIPLES.length - 1] },
    span: { unit: "m", realistic_range: [50, 250] },
    sag: { unit: "m", realistic_range: [0.5, 10] },
    variant: { realistic_range: [0, 1] },
  },
  paramOrder: ["triple_index", "span", "sag", "variant"],
  draw(rng) {
    return {
      triple_index: Math.floor(rng() * LOAD_TRIPLES.length),
      span: pick(SPAN_SET, rng),
      sag: pick(SAG_SET, rng),
      variant: Math.floor(rng() * 2),
    };
  },
  buildFrom(p) {
    const triple = LOAD_TRIPLES[p.triple_index];
    if (!triple) return null;
    const [wv, wh, w] = triple;
    const S = p.span;
    const D = p.sag;

    const params = {
      triple_index: { value: p.triple_index, realistic_range: [0, LOAD_TRIPLES.length - 1] as [number, number] },
      span: { value: S, unit: "m", realistic_range: [50, 250] as [number, number] },
      sag: { value: D, unit: "m", realistic_range: [0.5, 10] as [number, number] },
      variant: { value: p.variant, realistic_range: [0, 1] as [number, number] },
    };
    const wT = formatClean(w);

    if (p.variant === 0) {
      const mc = buildRoundedMcChoices(
        w,
        [
          { value: wv + wh, reason: "垂直荷重と水平荷重を単純に足した（直交するのでベクトル合成が必要）" },
          { value: Math.abs(wh - wv), reason: "2つの荷重の差をとった（合成は差ではない）" },
          { value: (wv + wh) / 2, reason: "2つの荷重の平均をとった" },
          { value: Math.max(wv, wh), reason: "大きい方の荷重がそのまま合成荷重になると誤解した" },
        ],
        formatClean,
      );
      if (!mc) return null;
      return {
        params,
        answerValue: w,
        answerUnit: "N/m",
        answerText: mc.answerText,
        choices: mc.choices,
        distractors: mc.distractors,
        likelyWrongChoice: formatClean(wv + wh),
        facts: { Wv: wv, Wh: wh, W: w },
        defaultStatement:
          `架空電線に、電線の自重と氷雪による垂直荷重${wv}N/m と、風圧による水平荷重${wh}N/m が同時に加わっている。` +
          "この電線に加わる合成荷重〔N/m〕として、最も近い値を選べ。",
        defaultSolution: [
          "垂直荷重と水平荷重は互いに直交するのでベクトル合成する",
          "W = √(W垂直² + W水平²)",
          `W = √(${wv}² + ${wh}²) = √(${wv * wv} + ${wh * wh}) = ${wT}N/m`,
          "（注意: 単純な足し算 W垂直+W水平 は誤り）",
        ],
        physicallyValid: true,
      };
    }

    // variant=1: 合成荷重からたるみ。D を先に決めて T を逆算し、与件を綺麗な値にする。
    const T = (w * S * S) / (8 * D);
    if (!Number.isFinite(T) || T < 1000 || T > 100_000) return null;
    if (!isCleanAnswer(T)) return null;
    const tT = formatClean(T);
    const dT = formatClean(D);
    const mc = buildRoundedMcChoices(
      D,
      [
        { value: ((wv + wh) * S * S) / (8 * T), reason: "合成荷重を単純な足し算で求めた（ベクトル合成が必要）" },
        { value: (w * S * S) / (4 * T), reason: "たるみの式の分母を 8T でなく 4T とした" },
        { value: (w * S) / (8 * T), reason: "径間を2乗し忘れた（D=WS²/8T）" },
        { value: (w * S * S) / (2 * T), reason: "分母の係数8を2と誤記した" },
      ],
      formatClean,
    );
    if (!mc) return null;
    return {
      params,
      answerValue: D,
      answerUnit: "m",
      answerText: mc.answerText,
      choices: mc.choices,
      distractors: mc.distractors,
      likelyWrongChoice: formatClean(((wv + wh) * S * S) / (8 * T)),
      facts: { Wv: wv, Wh: wh, W: w, S, T, D },
      defaultStatement:
        `径間${S}m の架空電線に、垂直荷重${wv}N/m と水平荷重${wh}N/m が同時に加わっている。` +
        `電線の水平張力が${tT}N であるとき、この電線のたるみ〔m〕として、最も近い値を選べ。`,
      defaultSolution: [
        "まず垂直荷重と水平荷重をベクトル合成する",
        `W = √(${wv}² + ${wh}²) = ${wT}N/m`,
        "たるみ D = W・S² / (8T)",
        `D = ${wT}×${S}²/(8×${tT}) = ${dT}m`,
      ],
      physicallyValid: true,
    };
  },
});
