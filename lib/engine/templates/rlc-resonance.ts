/**
 * テンプレート: RLC直列回路の共振角周波数（理論・numeric）。
 *   共振条件 ωL = 1/(ωC) ⇒ ω0 = 1/√(LC)〔rad/s〕（共振時のインピーダンスは R のみ）
 *   L〔mH〕×C〔μF〕の積が「平方数×10^偶数」になる組だけ採用し、ω0 を綺麗な値にする。
 */
import { formatClean, isCleanAnswer } from "../clean.js";
import { defineTemplate, pick } from "./helpers.js";

/** (L mH, C μF) — L·C ∈ {250, 1000, 4000, 16000} ⇒ ω0 ∈ {2000, 1000, 500, 250} rad/s。 */
const LC_PAIRS: ReadonlyArray<readonly [number, number]> = [
  [10, 25],
  [25, 10],
  [5, 50],
  [50, 5],
  [10, 100],
  [100, 10],
  [20, 50],
  [40, 25],
  [40, 100],
  [100, 40],
  [80, 50],
  [200, 20],
  [160, 100],
  [400, 40],
  [200, 80],
  [1, 10],
  [1, 40],
  [1, 160],
  [2, 20],
  [2, 80],
  [2, 125],
  [4, 10],
  [4, 40],
  [4, 160],
  [5, 8],
  [5, 32],
  [5, 128],
  [5, 200],
  [8, 20],
  [8, 80],
  [8, 125],
  [10, 4],
  [10, 16],
  [10, 64],
  [16, 10],
  [16, 40],
  [16, 160],
  [20, 8],
  [20, 32],
  [20, 128],
  [20, 200],
  [25, 40],
  [25, 160],
  [32, 5],
  [32, 20],
  [32, 80],
  [32, 125],
  [40, 4],
  [40, 16],
  [40, 64],
  [50, 20],
  [50, 80],
  [50, 125],
  [64, 10],
  [64, 40],
  [64, 160],
  [80, 8],
  [80, 32],
  [80, 125],
  [100, 4],
  [100, 16],
  [100, 64],
  [125, 8],
  [125, 32],
  [128, 5],
  [160, 4],
  [160, 16],
  [200, 5],
  [200, 32],
  [250, 8],
  [320, 5],
  [500, 8],
];

type Params = {
  inductance: number;
  capacitance: number;
};

export const rlcResonance = defineTemplate<Params>({
  topic: "RLC直列回路の共振",
  subject: "理論",
  exam: "denken2_primary",
  difficulty: 3,
  pastExam: { area: "単相交流回路", frequency: "high", years: [2006, 2011, 2016, 2021] },
  paramSpecs: {
    inductance: { unit: "mH", realistic_range: [1, 500] },
    capacitance: { unit: "μF", realistic_range: [1, 200] },
  },
  paramOrder: ["inductance", "capacitance"],
  draw(rng) {
    const [l, c] = pick(LC_PAIRS, rng);
    return { inductance: l, capacitance: c };
  },
  buildFrom({ inductance: lMilliH, capacitance: cMicroF }) {
    if (lMilliH <= 0 || cMicroF <= 0) return null;
    const lc = lMilliH * 1e-3 * (cMicroF * 1e-6); // SI
    const omega = 1 / Math.sqrt(lc);
    if (!isCleanAnswer(omega)) return null;
    const answerText = formatClean(omega);
    return {
      format: "numeric",
      params: {
        inductance: { value: lMilliH, unit: "mH", realistic_range: [1, 500] },
        capacitance: { value: cMicroF, unit: "μF", realistic_range: [1, 200] },
      },
      answerValue: omega,
      answerUnit: "rad/s",
      answerText,
      facts: { lMilliH, cMicroF, omega },
      defaultStatement:
        `R、L=${formatClean(lMilliH)}mH、C=${formatClean(cMicroF)}μF を直列に接続した回路がある。` +
        `この回路が共振する角周波数 ω0〔rad/s〕は?`,
      defaultSolution: [
        `共振条件 ωL=1/(ωC) より ω0=1/√(LC)（このときインピーダンスは R のみ）`,
        `LC=${formatClean(lMilliH)}×10⁻³×${formatClean(cMicroF)}×10⁻⁶=${lc.toExponential(1)}`,
        `ω0=1/√(LC)=${answerText}rad/s`,
      ],
      physicallyValid: true,
    };
  },
});
