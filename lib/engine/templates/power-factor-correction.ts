/**
 * テンプレート: 力率改善コンデンサ容量（電力・numeric）。
 *   負荷 P〔kW〕の力率を cosθ1 → cosθ2 に改善するのに必要な進相容量
 *     Qc = P·(tanθ1 − tanθ2)  〔kvar〕
 *   tanθ = sinθ/cosθ。改善後は θ2<θ1（tan が減る）であることが条件。
 */
import { formatClean, isCleanAnswer } from "../clean.js";
import { powerTriangleFigure } from "../figures/index.js";
import { defineTemplate, pick } from "./helpers.js";

const P_SET: ReadonlyArray<number> = [
  60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 360, 390, 420, 450, 480, 510, 540, 570, 600,
];
// [cosθ1(改善前), cosθ2(改善後)]。cosθ2>cosθ1（力率が良くなる）。
const PF_PAIRS: ReadonlyArray<readonly [number, number]> = [
  [0.6, 1.0],
  [0.8, 1.0],
  [0.6, 0.8],
];

function tanOf(cos: number): number {
  const sin = Math.sqrt(1 - cos * cos);
  return sin / cos;
}

type Params = {
  load_power: number;
  power_factor_before: number;
  power_factor_after: number;
};

export const powerFactorCorrection = defineTemplate<Params>({
  topic: "力率改善",
  subject: "電力",
  exam: "denken2_primary",
  difficulty: 3,
  pastExam: { area: "力率改善・無効電力", frequency: "high", years: [2006, 2010, 2015, 2019, 2023] },
  paramSpecs: {
    load_power: { unit: "kW", realistic_range: [50, 600] },
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
    if (P <= 0 || cos1 <= 0 || cos1 > 1 || cos2 <= 0 || cos2 > 1) return null;
    if (cos2 <= cos1) return null; // 改善後は力率が良くなる
    const tan1 = tanOf(cos1);
    const tan2 = tanOf(cos2);
    const Qc = P * (tan1 - tan2);
    if (Qc <= 0 || !isCleanAnswer(Qc)) return null;
    const answerText = formatClean(Qc);
    const t1 = formatClean(tan1, 4);
    const t2 = formatClean(tan2, 4);
    return {
      format: "numeric",
      params: {
        load_power: { value: P, unit: "kW", realistic_range: [50, 600] },
        power_factor_before: { value: cos1, unit: "", realistic_range: [0.5, 1] },
        power_factor_after: { value: cos2, unit: "", realistic_range: [0.5, 1] },
      },
      answerValue: Qc,
      answerUnit: "kvar",
      answerText,
      facts: { P, cos1, cos2, tan1: Number(t1), tan2: Number(t2), Qc },
      defaultStatement:
        `有効電力 P=${P}kW の負荷の力率を ${cos1}（遅れ）から ${cos2} に改善したい。` +
        `必要な進相コンデンサの容量 Qc〔kvar〕は?`,
      defaultSolution: [
        `着眼点: 有効電力Pは一定で、無効電力QをQ1→Q2へ減らす差が必要容量。`,
        `Qc=P·(tanθ1−tanθ2)`,
        `tanθ1=${t1}、tanθ2=${t2}`,
        `Qc=${P}×(${t1}−${t2})=${answerText}kvar`,
        `ポイント: 図の電力三角形で、Sの傾き(力率)が立つほどQが減りQcは増える。`,
      ],
      figure: powerTriangleFigure(P, P * tan1, P * tan2, "kvar"),
      physicallyValid: true,
    };
  },
});
