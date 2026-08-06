/**
 * テンプレート: 単相直列回路の電流と力率（理論・numeric）。
 *   |Z| = √(R²+X²),  I = V/|Z|,  cosφ = R/|Z|
 *   R,X はピタゴラス数の組に限定し、|Z|・I・cosφ を全て綺麗な値にする。
 */
import { formatClean, isCleanAnswer } from "../clean.js";
import { defineTemplate, pick } from "./helpers.js";

const RX_PAIRS: ReadonlyArray<readonly [number, number]> = [
  [3, 4],
  [4, 3],
  [6, 8],
  [8, 6],
  [5, 12],
  [12, 5],
  [9, 12],
  [12, 16],
  [8, 15],
  [15, 8],
  [12, 9],
  [16, 12],
  [10, 24],
  [24, 10],
  [7, 24],
  [24, 7],
  [15, 20],
  [20, 15],
  [20, 21],
  [21, 20],
  [18, 24],
  [24, 18],
  [16, 30],
  [30, 16],
  [21, 28],
  [28, 21],
  [12, 35],
  [35, 12],
  [24, 32],
  [32, 24],
  [9, 40],
  [40, 9],
  [27, 36],
  [36, 27],
  [30, 40],
  [40, 30],
  [14, 48],
  [48, 14],
  [36, 48],
  [48, 36],
];
const V_SET: ReadonlyArray<number> = [100, 200, 300, 400];

type Params = {
  voltage: number;
  resistance: number;
  reactance: number;
};

export const seriesRlCurrent = defineTemplate<Params>({
  topic: "単相直列回路の電流",
  subject: "理論",
  exam: "denken2_primary",
  difficulty: 2,
  pastExam: { area: "単相交流回路", frequency: "high", years: [2006, 2012, 2017, 2022] },
  paramSpecs: {
    voltage: { unit: "V", realistic_range: [50, 400] },
    resistance: { unit: "Ω", realistic_range: [1, 50] },
    reactance: { unit: "Ω", realistic_range: [1, 50] },
  },
  paramOrder: ["voltage", "resistance", "reactance"],
  draw(rng) {
    const [r, x] = pick(RX_PAIRS, rng);
    return {
      voltage: pick(V_SET, rng),
      resistance: r,
      reactance: x,
    };
  },
  buildFrom({ voltage: v, resistance: r, reactance: x }) {
    if (v <= 0 || r <= 0 || x <= 0) return null;
    const z = Math.sqrt(r * r + x * x);
    const i = v / z;
    const pf = r / z;
    if (!isCleanAnswer(z) || !isCleanAnswer(i) || !isCleanAnswer(pf)) return null;
    const answerText = formatClean(i);
    return {
      format: "numeric",
      params: {
        voltage: { value: v, unit: "V", realistic_range: [50, 400] },
        resistance: { value: r, unit: "Ω", realistic_range: [1, 50] },
        reactance: { value: x, unit: "Ω", realistic_range: [1, 50] },
      },
      answerValue: i,
      answerUnit: "A",
      answerText,
      facts: { v, r, x, z, i, pf },
      defaultStatement:
        `抵抗 ${formatClean(r)}Ω と誘導性リアクタンス ${formatClean(x)}Ω を直列接続し、` +
        `交流電圧 ${formatClean(v)}V を加えた。回路に流れる電流〔A〕は?`,
      defaultSolution: [
        `|Z|=√(R²+X²)=√(${formatClean(r * r)}+${formatClean(x * x)})=${formatClean(z)}Ω`,
        `このとき力率 cosφ=R/|Z|=${formatClean(pf)}`,
        `I=V/|Z|=${formatClean(v)}/${formatClean(z)}=${answerText}A`,
      ],
      physicallyValid: true,
    };
  },
});
