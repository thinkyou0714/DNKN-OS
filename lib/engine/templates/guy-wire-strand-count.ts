/**
 * テンプレート: 支線の張力と所要素線条数（法規B問題・五肢択一）。
 *
 * 既存 `guy-wire-safety.ts` は「張力×安全率」の単純積で終わる。本試のB問題は
 * 「支線の取付角度から張力を分解 → 安全率をかけて所要条数を切り上げる」連鎖で問われる。
 *
 *   支線張力      T = P / sinθ          (P=支持物頂部の水平荷重、θ=支線と支持物のなす角)
 *   所要条数      n = ⌈T × 安全率 / 素線1条の引張荷重⌉   （電技解釈61条: 安全率2.5・素線3条以上）
 *
 * 根開き:高さ を 3:4（斜辺5）に固定すると sinθ = 3/5 = 0.6 となり、T = P/0.6 が
 * 3の倍数の P に対して割り切れる。条数は切り上げなので常に整数＝clean。
 */
import { formatClean, isCleanAnswer } from "../clean.js";
import { buildRoundedMcChoices, defineTemplate, pick } from "./helpers.js";

/** 電技解釈61条: 支線の安全率（引留箇所等を除く一般値）。 */
const SAFETY_FACTOR = 2.5;
/** 同条: より線の素線は3条以上。 */
const MIN_STRANDS = 3;

/** [根開き〔m〕, 支線取付高さ〔m〕]。3:4:5 の直角三角形で sinθ=0.6。 */
const GEOMETRY_SET: ReadonlyArray<readonly [number, number]> = [
  [3, 4],
  [6, 8],
  [9, 12],
  [4.5, 6],
  [7.5, 10],
];
/** 支持物頂部に加わる水平荷重〔kN〕。P/0.6 が割り切れるよう3の倍数中心。 */
const LOAD_SET = [3, 4.5, 6, 7.5, 9, 12, 15, 18, 21, 24, 30];
/** 支線用素線1条あたりの引張荷重〔kN〕。 */
const STRAND_SET = [4.9, 5.9, 7.8, 9.8, 11.8, 14.7, 19.6];

type Params = {
  geometry_index: number;
  horizontal_load: number;
  strand_strength: number;
  variant: number;
};

export const guyWireStrandCount = defineTemplate<Params>({
  topic: "支線の張力と所要素線条数",
  subject: "法規",
  exam: "denken3",
  difficulty: 3,
  pastExam: {
    area: "電線路・架空配電",
    frequency: "mid",
    years: [2009, 2013, 2018, 2022],
  },
  paramSpecs: {
    geometry_index: { realistic_range: [0, GEOMETRY_SET.length - 1] },
    horizontal_load: { unit: "kN", realistic_range: [1, 40] },
    strand_strength: { unit: "kN", realistic_range: [1, 25] },
    variant: { realistic_range: [0, 1] },
  },
  paramOrder: ["geometry_index", "horizontal_load", "strand_strength", "variant"],
  draw(rng) {
    return {
      geometry_index: Math.floor(rng() * GEOMETRY_SET.length),
      horizontal_load: pick(LOAD_SET, rng),
      strand_strength: pick(STRAND_SET, rng),
      variant: Math.floor(rng() * 2),
    };
  },
  buildFrom(p) {
    const geom = GEOMETRY_SET[p.geometry_index];
    if (!geom) return null;
    const [base, height] = geom;
    const hypot = Math.hypot(base, height);
    const sinTheta = base / hypot;
    const P = p.horizontal_load;
    const tension = P / sinTheta;
    if (!Number.isFinite(tension) || tension <= 0 || !isCleanAnswer(tension)) return null;

    const params = {
      geometry_index: { value: p.geometry_index, realistic_range: [0, GEOMETRY_SET.length - 1] as [number, number] },
      horizontal_load: { value: P, unit: "kN", realistic_range: [1, 40] as [number, number] },
      strand_strength: { value: p.strand_strength, unit: "kN", realistic_range: [1, 25] as [number, number] },
      variant: { value: p.variant, realistic_range: [0, 1] as [number, number] },
    };
    const tT = formatClean(tension);
    const given =
      `支持物の頂部に水平荷重${P}kN が加わっている。支線は支持物の高さ${height}m の点に取り付け、` +
      `地面での根開きを${base}m とする。`;

    if (p.variant === 0) {
      const mc = buildRoundedMcChoices(
        tension,
        [
          { value: P * sinTheta, reason: "sinθ で割るべきところを掛けた" },
          { value: P / (height / hypot), reason: "根開きでなく高さを使って角度を分解した（cosθ で割った）" },
          { value: P, reason: "水平荷重をそのまま支線張力とした（角度による割り増しを忘れた）" },
          { value: P * (height / base), reason: "支線長を使わず高さ/根開きの比を掛けた" },
        ],
        formatClean,
      );
      if (!mc) return null;
      return {
        params,
        answerValue: tension,
        answerUnit: "kN",
        answerText: mc.answerText,
        choices: mc.choices,
        distractors: mc.distractors,
        likelyWrongChoice: formatClean(P),
        facts: { P, base, height, T: tension },
        defaultStatement: `${given}このとき支線に加わる張力〔kN〕として、最も近い値を選べ。`,
        defaultSolution: [
          "支線の張力は水平荷重を支線方向へ分解して求める",
          `支線の長さ = √(${base}² + ${height}²) = ${formatClean(hypot)}m`,
          `sinθ = 根開き/支線長 = ${base}/${formatClean(hypot)} = ${formatClean(sinTheta)}`,
          `T = P / sinθ = ${P}/${formatClean(sinTheta)} = ${tT}kN`,
          "（注意: 水平荷重をそのまま支線張力とするのは誤り。必ず角度で割り増す）",
        ],
        physicallyValid: true,
      };
    }

    // variant=1: 所要素線条数（切り上げ・3条以上）。
    const strand = p.strand_strength;
    const required = (tension * SAFETY_FACTOR) / strand;
    if (!Number.isFinite(required) || required <= 0) return null;
    const n = Math.max(MIN_STRANDS, Math.ceil(required - 1e-9));
    // 実際の支線は数条〜10条程度。荷重と素線強度の組合せ次第で数十条という
    // 非現実的な答えになる draw は出題しない。
    if (n > 10) return null;
    const nT = formatClean(n);
    const minNote =
      n === MIN_STRANDS && required <= MIN_STRANDS
        ? "（計算値が3条未満でも、電技解釈61条により素線は3条以上必要）"
        : "";
    const mc = buildRoundedMcChoices(
      n,
      [
        { value: Math.max(1, Math.ceil(tension / strand - 1e-9)), reason: "安全率2.5を掛け忘れた" },
        {
          value: Math.max(1, Math.ceil((P * SAFETY_FACTOR) / strand - 1e-9)),
          reason: "角度分解を忘れ、水平荷重をそのまま使った",
        },
        { value: Math.max(1, Math.floor(required)), reason: "切り上げるべきところを切り捨てた（不足する条数）" },
        { value: n + 2, reason: "余裕を見て条数を上乗せした（規定は切り上げた値でよい）" },
      ],
      formatClean,
    );
    if (!mc) return null;
    return {
      params,
      answerValue: n,
      answerUnit: "条",
      answerText: mc.answerText,
      choices: mc.choices,
      distractors: mc.distractors,
      likelyWrongChoice: formatClean(Math.max(1, Math.ceil(tension / strand - 1e-9))),
      facts: { P, T: tension, strand, required, n },
      defaultStatement:
        `${given}支線用素線1条の引張荷重が${strand}kN であるとき、` +
        "電技解釈で定める安全率を満たすために必要な素線の条数として、最も近い値を選べ。",
      defaultSolution: [
        `支線張力 T = P/sinθ = ${P}/${formatClean(sinTheta)} = ${tT}kN`,
        `支線の安全率は${SAFETY_FACTOR}なので、必要な引張荷重の合計 = ${tT}×${SAFETY_FACTOR} = ${formatClean(tension * SAFETY_FACTOR)}kN`,
        `条数 = ${formatClean(tension * SAFETY_FACTOR)}/${strand} = ${formatClean(required)} → 切り上げて${nT}条`,
        `答: ${nT}条${minNote}`,
      ],
      physicallyValid: true,
    };
  },
});
