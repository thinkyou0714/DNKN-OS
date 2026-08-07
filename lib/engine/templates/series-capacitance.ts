/**
 * テンプレート: コンデンサの直列合成容量（理論・numeric）。
 *   直列: C = C1·C2/(C1+C2)（和分の積）。並列の単純和との取り違えが最頻誤答。
 */
import { formatClean, isCleanAnswer } from "../clean.js";
import { defineTemplate, pick } from "./helpers.js";

/** 合成値が綺麗になる (C1, C2) μF の組。 */
const C_PAIRS: ReadonlyArray<readonly [number, number]> = [
  [3, 6],
  [6, 3],
  [4, 12],
  [12, 4],
  [6, 12],
  [12, 6],
  [10, 40],
  [40, 10],
  [20, 30],
  [30, 20],
  [12, 24],
  [24, 12],
  [15, 30],
  [10, 15],
  [5, 20],
  [1, 4],
  [4, 1],
  [2, 3],
  [3, 2],
  [2, 6],
  [6, 2],
  [2, 8],
  [8, 2],
  [3, 7],
  [7, 3],
  [4, 6],
  [6, 4],
  [6, 9],
  [9, 6],
  [4, 16],
  [16, 4],
  [5, 15],
  [15, 5],
  [5, 45],
  [45, 5],
  [6, 10],
  [10, 6],
  [3, 15],
  [15, 3],
  [3, 12],
  [12, 3],
  [8, 24],
  [24, 8],
  [9, 18],
  [18, 9],
  [10, 90],
  [90, 10],
  [20, 80],
  [80, 20],
  [30, 60],
  [60, 30],
  [16, 48],
  [48, 16],
  [9, 72],
  [72, 9],
  [7, 42],
  [42, 7],
  [14, 35],
  [35, 14],
  [12, 60],
  [60, 12],
];

type Params = {
  cap1: number;
  cap2: number;
};

export const seriesCapacitance = defineTemplate<Params>({
  topic: "コンデンサの直列合成容量",
  subject: "理論",
  exam: "denken2_primary",
  difficulty: 2,
  pastExam: { area: "静電気", frequency: "mid", years: [2010, 2016, 2022] },
  paramSpecs: {
    cap1: { unit: "μF", realistic_range: [1, 100] },
    cap2: { unit: "μF", realistic_range: [1, 100] },
  },
  paramOrder: ["cap1", "cap2"],
  draw(rng) {
    const [c1, c2] = pick(C_PAIRS, rng);
    return { cap1: c1, cap2: c2 };
  },
  buildFrom({ cap1: c1, cap2: c2 }) {
    if (c1 <= 0 || c2 <= 0) return null;
    const c = (c1 * c2) / (c1 + c2);
    if (!isCleanAnswer(c)) return null;
    const answerText = formatClean(c);
    return {
      format: "numeric",
      params: {
        cap1: { value: c1, unit: "μF", realistic_range: [1, 100] },
        cap2: { value: c2, unit: "μF", realistic_range: [1, 100] },
      },
      answerValue: c,
      answerUnit: "μF",
      answerText,
      facts: { c1, c2, c, parallel: c1 + c2 },
      defaultStatement: `静電容量 ${formatClean(c1)}μF と ${formatClean(c2)}μF のコンデンサを直列に接続したときの合成静電容量〔μF〕は?`,
      defaultSolution: [
        `直列接続の合成容量 C=C1·C2/(C1+C2)（並列なら単純和 ${formatClean(c1 + c2)}μF になることと混同しない）`,
        `=${formatClean(c1)}×${formatClean(c2)}/(${formatClean(c1)}+${formatClean(c2)})`,
        `=${answerText}μF`,
      ],
      physicallyValid: true,
    };
  },
});
