/**
 * テンプレート: 複素インピーダンスの並列合成（理論・単相交流回路・numeric）。
 *
 * 抵抗 R〔Ω〕と誘導性リアクタンス jXL〔Ω〕（純インダクタ）の並列接続。
 *   合成インピーダンス  Z = (R·jXL)/(R+jXL)
 *   その大きさ          |Z| = R·XL/√(R²+XL²)   〔Ω〕
 *
 * √(R²+XL²) が整数になるピタゴラス数の (R, XL) を用い、|Z| を綺麗な値に収める。
 *
 * 誤答（成立する典型ミス）:
 *   ① 直列合成の大きさ √(R²+XL²)（並列を直列と取り違え）
 *   ② 抵抗だけの並列  R·XL/(R+XL)（複素数を実数のように加算）
 *   ③ 積/和の単純化   R·XL/(R+XL) の別表現や R/2 等
 */
import { formatClean, isCleanAnswer } from "../clean.js";
import { defineTemplate, pick } from "./helpers.js";

// (R, XL)。√(R²+XL²) が整数になるピタゴラス対（|Z|が綺麗になるものを採用、汚いものはgate）。
const RX_PAIRS: ReadonlyArray<readonly [number, number]> = [
  [3, 4],
  [4, 3],
  [6, 8],
  [8, 6],
  [9, 12],
  [12, 9],
  [12, 16],
  [16, 12],
  [20, 15],
  [15, 20],
  [7, 24],
  [24, 7],
  [30, 40],
  [40, 30],
  [9, 12],
  [12, 9],
  [14, 48],
  [48, 14],
  [18, 24],
  [24, 18],
  [21, 28],
  [28, 21],
  [24, 32],
  [32, 24],
  [27, 36],
  [36, 27],
  [33, 44],
  [44, 33],
  [36, 48],
  [48, 36],
];

type Params = {
  resistance: number;
  reactance: number;
};

export const parallelImpedanceMagnitude = defineTemplate<Params>({
  topic: "複素インピーダンスの並列合成",
  subject: "理論",
  exam: "denken2_primary",
  difficulty: 3,
  pastExam: { area: "単相交流回路", frequency: "high", years: [2008, 2013, 2017, 2022] },
  paramSpecs: {
    resistance: { unit: "Ω", realistic_range: [1, 50] },
    reactance: { unit: "Ω", realistic_range: [1, 50] },
  },
  paramOrder: ["resistance", "reactance"],
  draw(rng) {
    const [r, x] = pick(RX_PAIRS, rng);
    return { resistance: r, reactance: x };
  },
  buildFrom({ resistance: R, reactance: X }) {
    if (R <= 0 || X <= 0) return null;
    const root = Math.sqrt(R * R + X * X);
    const Zmag = (R * X) / root; // 並列合成インピーダンスの大きさ（正解）
    if (Zmag <= 0 || !isCleanAnswer(Zmag)) return null;
    // 参考: 典型ミスの値（numeric 形式のため選択肢には出さず facts と解説の説明にのみ用いる）。
    const seriesMag = root; // ① 直列合成と取り違え（√(R²+X²)）
    const answerText = formatClean(Zmag);
    return {
      format: "numeric",
      params: {
        resistance: { value: R, unit: "Ω", realistic_range: [1, 50] },
        reactance: { value: X, unit: "Ω", realistic_range: [1, 50] },
      },
      answerValue: Zmag,
      answerUnit: "Ω",
      answerText,
      facts: { R, X, root, Zmag, seriesMag },
      defaultStatement:
        `抵抗 R=${R}Ω と誘導性リアクタンス XL=${X}Ω（純インダクタ）を並列に接続した。` +
        `この並列回路の合成インピーダンスの大きさ |Z|〔Ω〕は?`,
      defaultSolution: [
        `並列合成: Z=(R·jXL)/(R+jXL)`,
        `大きさは |Z|=R·XL/√(R²+XL²)`,
        `√(R²+XL²)=√(${R}²+${X}²)=${formatClean(root)}`,
        `|Z|=${R}×${X}/${formatClean(root)}`,
        `|Z|=${answerText}Ω`,
      ],
      physicallyValid: true,
    };
  },
});
