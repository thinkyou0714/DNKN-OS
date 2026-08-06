/**
 * テンプレート: 汽力発電の発電端効率（効率の積）（電力・火力発電・numeric）。
 *   汽力発電所の発電端効率は各段の効率の積:
 *     ηP = ηB · ηT · ηG × 100   〔%〕
 *       ηB=ボイラ効率, ηT=タービン室効率（熱サイクル効率を含む）, ηG=発電機効率
 *   効率の分解と積み上げは二種一次「火力発電」の頻出パターン
 *   （送電端効率 = 発電端効率×(1−所内率) への展開の土台）。
 */
import { formatClean, isCleanAnswer } from "../clean.js";
import { defineTemplate, pick } from "./helpers.js";

const BOILER_SET: ReadonlyArray<number> = [0.85, 0.86, 0.88, 0.9, 0.92];
const TURBINE_SET: ReadonlyArray<number> = [0.4, 0.42, 0.44, 0.45, 0.46, 0.48, 0.5];
const GENERATOR_SET: ReadonlyArray<number> = [0.95, 0.96, 0.98, 0.99];

type Params = {
  boiler_efficiency: number;
  turbine_efficiency: number;
  generator_efficiency: number;
};

export const thermalPlantEfficiency = defineTemplate<Params>({
  topic: "汽力発電の発電端効率（効率の積）",
  subject: "電力",
  exam: "denken2_primary",
  difficulty: 3,
  pastExam: {
    area: "火力発電",
    frequency: "high",
    years: [2007, 2011, 2015, 2019, 2023],
    note: "発電端効率=ボイラ×タービン室×発電機の効率の積。送電端効率への展開の土台",
  },
  paramSpecs: {
    boiler_efficiency: { realistic_range: [0.8, 0.95] },
    turbine_efficiency: { realistic_range: [0.35, 0.55] },
    generator_efficiency: { realistic_range: [0.9, 1] },
  },
  paramOrder: ["boiler_efficiency", "turbine_efficiency", "generator_efficiency"],
  draw(rng) {
    return {
      boiler_efficiency: pick(BOILER_SET, rng),
      turbine_efficiency: pick(TURBINE_SET, rng),
      generator_efficiency: pick(GENERATOR_SET, rng),
    };
  },
  buildFrom({ boiler_efficiency: etaB, turbine_efficiency: etaT, generator_efficiency: etaG }) {
    if (etaB <= 0 || etaB > 1 || etaT <= 0 || etaT > 1 || etaG <= 0 || etaG > 1) return null;
    const etaP = etaB * etaT * etaG * 100; // 発電端効率〔%〕
    if (!isCleanAnswer(etaP)) return null;
    const answerText = formatClean(etaP);
    return {
      format: "numeric",
      params: {
        boiler_efficiency: { value: etaB, realistic_range: [0.8, 0.95] },
        turbine_efficiency: { value: etaT, realistic_range: [0.35, 0.55] },
        generator_efficiency: { value: etaG, realistic_range: [0.9, 1] },
      },
      answerValue: etaP,
      answerUnit: "%",
      answerText,
      facts: { etaB, etaT, etaG, etaP },
      defaultStatement:
        `ある汽力発電所のボイラ効率が ${formatClean(etaB)}、タービン室効率（熱サイクル効率を含む）が ${formatClean(etaT)}、` +
        `発電機効率が ${formatClean(etaG)} である。この発電所の発電端効率 ηP〔%〕はいくらか。`,
      defaultSolution: [
        `発電端効率は各段の効率の積: ηP=ηB×ηT×ηG`,
        `ηP=${formatClean(etaB)}×${formatClean(etaT)}×${formatClean(etaG)}×100`,
        `ηP=${answerText}%`,
        `ポイント: 送電端効率はさらに所内率 L を使って ηP×(1−L) となる。`,
      ],
      physicallyValid: true,
    };
  },
});
