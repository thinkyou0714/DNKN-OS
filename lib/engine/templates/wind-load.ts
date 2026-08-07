/**
 * テンプレート: 架空電線への風圧荷重（法規・numeric）。
 *
 *   風圧荷重  P = q · A   〔N〕
 *     q = 風圧〔Pa = N/m²〕（甲種=980Pa / 乙種=490Pa）
 *     A = 受風面積〔m²〕。円筒導体では「投影面積 = 直径 d × 径間 L」で与えられる。
 *         A = (d/1000)·L   （d は mm、L は m で与えるため 1/1000 で m に換算）
 *   よって  P = q · (d/1000) · L   〔N〕
 *
 * 甲種・乙種風圧（電技解釈 第58条）:
 *   甲種=高温季の標準（電線 980Pa）、乙種=低温季・着氷雪（電線 490Pa）。
 *   本問は電線（高圧絶縁電線等）の値を用いる。
 */
import { formatClean, isCleanAnswer } from "../clean.js";
import { defineTemplate, pick } from "./helpers.js";

// 風圧クラス: 甲種980Pa / 乙種490Pa（電線の構成材料別風圧）。
const Q_SET: ReadonlyArray<readonly [number, string]> = [
  [980, "甲種"],
  [490, "乙種"],
];
const D_SET: ReadonlyArray<number> = [10, 20, 25, 40, 50, 12, 14, 15, 16, 18, 22, 30, 32, 35, 38, 45, 48]; // 電線直径〔mm〕
const L_SET: ReadonlyArray<number> = [50, 100, 150, 200, 60, 70, 75, 80, 90, 110, 120, 125, 160, 175, 180]; // 径間〔m〕

type Params = {
  wind_pressure: number;
  diameter: number;
  span: number;
};

export const windLoad = defineTemplate<Params>({
  topic: "風圧荷重",
  subject: "法規",
  exam: "denken2_primary",
  difficulty: 2,
  pastExam: { area: "風圧荷重・機械的強度", frequency: "mid", years: [2009, 2014, 2019, 2024] },
  paramSpecs: {
    wind_pressure: { unit: "Pa", realistic_range: [490, 980] },
    diameter: { unit: "mm", realistic_range: [10, 50] },
    span: { unit: "m", realistic_range: [50, 200] },
  },
  paramOrder: ["wind_pressure", "diameter", "span"],
  draw(rng) {
    const [q] = pick(Q_SET, rng);
    return {
      wind_pressure: q,
      diameter: pick(D_SET, rng),
      span: pick(L_SET, rng),
    };
  },
  buildFrom({ wind_pressure: q, diameter: d, span: L }) {
    if (q <= 0 || d <= 0 || L <= 0) return null;
    const A = (d / 1000) * L; // 受風面積〔m²〕＝直径×径間
    const P = q * A; // 風圧荷重〔N〕
    if (!isCleanAnswer(A) || !isCleanAnswer(P)) return null;
    const klass = Q_SET.find(([qq]) => qq === q)?.[1] ?? "";
    const answerText = formatClean(P);
    return {
      format: "numeric",
      params: {
        wind_pressure: { value: q, unit: "Pa", realistic_range: [490, 980] },
        diameter: { value: d, unit: "mm", realistic_range: [10, 50] },
        span: { value: L, unit: "m", realistic_range: [50, 200] },
      },
      answerValue: P,
      answerUnit: "N",
      answerText,
      facts: { q, d, L, A, P },
      defaultStatement:
        `直径 d=${d}mm の架空電線が径間 L=${L}m で施設されている。この電線に${klass}風圧 q=${q}Pa が作用するとき、` +
        `電線1径間に加わる風圧荷重 P〔N〕は? ただし受風面積は投影面積（直径×径間）とする。`,
      defaultSolution: [
        `受風面積（投影面積）A=直径×径間=(${d}/1000)×${L}=${formatClean(A)}m²`,
        `風圧荷重 P=q·A（Pa=N/m²、${klass}風圧 q=${q}Pa）`,
        `P=${q}×${formatClean(A)}`,
        `P=${answerText}N`,
      ],
      physicallyValid: true,
    };
  },
});
