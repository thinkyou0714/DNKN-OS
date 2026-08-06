/**
 * テンプレート: 調相設備（電力用コンデンサ）容量（二種二次・電力管理・descriptive）。
 *   Qc = P·(tanθ1 − tanθ2)   〔kvar〕
 *   力率改善（電力科目）と同式だが、二次は記述で導出過程を問う。
 */
import { formatClean, isCleanAnswer } from "../clean.js";
import { powerTriangleFigure } from "../figures/index.js";
import { defineTemplate, pick } from "./helpers.js";

const P_SET: ReadonlyArray<number> = [
  300, 600, 900, 1200, 1500, 1800, 2100, 2400, 2700, 3000, 3300, 3600, 3900, 4200, 4500, 4800,
];
const PF_PAIRS: ReadonlyArray<readonly [number, number]> = [
  [0.6, 1.0],
  [0.8, 1.0],
  [0.6, 0.8],
];

function tanOf(cos: number): number {
  return Math.sqrt(1 - cos * cos) / cos;
}

type Params = {
  load_power: number;
  power_factor_before: number;
  power_factor_after: number;
};

export const reactivePowerCompensation = defineTemplate<Params>({
  topic: "調相設備容量",
  subject: "電力管理",
  exam: "denken2_secondary",
  difficulty: 4,
  pastExam: { area: "変電・調相", frequency: "mid", years: [2009, 2014, 2019, 2024] },
  paramSpecs: {
    load_power: { unit: "kW", realistic_range: [300, 5000] },
    power_factor_before: { unit: "", realistic_range: [0.5, 1] },
    power_factor_after: { unit: "", realistic_range: [0.5, 1] },
  },
  paramOrder: ["load_power", "power_factor_before", "power_factor_after"],
  draw(rng) {
    const [c1, c2] = pick(PF_PAIRS, rng);
    return {
      load_power: pick(P_SET, rng),
      power_factor_before: c1,
      power_factor_after: c2,
    };
  },
  buildFrom({ load_power: P, power_factor_before: cos1, power_factor_after: cos2 }) {
    if (P <= 0 || cos1 <= 0 || cos1 > 1 || cos2 <= 0 || cos2 > 1 || cos2 <= cos1) return null;
    const tan1 = tanOf(cos1);
    const tan2 = tanOf(cos2);
    const Qc = P * (tan1 - tan2);
    if (Qc <= 0 || !isCleanAnswer(Qc)) return null;
    const answerText = formatClean(Qc);
    const t1 = formatClean(tan1, 4);
    const t2 = formatClean(tan2, 4);
    return {
      format: "descriptive",
      params: {
        load_power: { value: P, unit: "kW", realistic_range: [300, 5000] },
        power_factor_before: { value: cos1, unit: "", realistic_range: [0.5, 1] },
        power_factor_after: { value: cos2, unit: "", realistic_range: [0.5, 1] },
      },
      answerValue: Qc,
      answerUnit: "kvar",
      answerText,
      facts: { P, cos1, cos2, tan1: Number(t1), tan2: Number(t2), Qc },
      defaultStatement:
        `有効電力 P=${P}kW、力率 cosθ1=${cos1}（遅れ）の需要家が、力率を cosθ2=${cos2} に改善する。` +
        `必要な電力用コンデンサ（調相設備）容量 Qc〔kvar〕を導出過程とともに求めよ。`,
      defaultSolution: [
        `改善前後の無効電力差が必要容量: Qc=P(tanθ1−tanθ2)`,
        `tanθ1=${t1}、tanθ2=${t2}`,
        `Qc=${P}×(${t1}−${t2})=${answerText}kvar`,
      ],
      figure: powerTriangleFigure(P, P * tan1, P * tan2, "kvar"),
      physicallyValid: true,
    };
  },
});
