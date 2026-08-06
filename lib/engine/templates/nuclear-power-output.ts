/**
 * テンプレート: 原子力発電の電気出力（電力・numeric）。
 *   原子炉の熱出力 Qt と熱効率 η から電気出力:
 *     Pe = η · Qt    〔MW〕
 *
 * 典型ミス（解説で言及）:
 *   ・熱効率を掛け忘れて熱出力をそのまま電気出力とする
 *   ・η を百分率のまま（×100）扱う
 */
import { formatClean, isCleanAnswer } from "../clean.js";
import { defineTemplate, pick } from "./helpers.js";

const THERMAL_SET: ReadonlyArray<number> = [
  1500, 1600, 1700, 1800, 1900, 2000, 2100, 2200, 2300, 2400, 2500, 2600, 2700, 2800, 2900, 3000, 3100, 3200, 3300,
]; // 〔MW〕
const EFFICIENCY_SET: ReadonlyArray<number> = [0.32, 0.325, 0.33, 0.335, 0.34, 0.345, 0.35];

type Params = {
  thermal_output: number;
  efficiency: number;
};

export const nuclearPowerOutput = defineTemplate<Params>({
  topic: "原子力発電の電気出力",
  subject: "電力",
  exam: "denken2_primary",
  difficulty: 2,
  pastExam: {
    area: "原子力・新エネルギー",
    frequency: "mid",
    years: [2010, 2016, 2022],
    note: "原子炉熱出力Qtと熱効率ηから電気出力 Pe=η·Qt",
  },
  paramSpecs: {
    thermal_output: { unit: "MW", realistic_range: [1500, 3300] },
    efficiency: { realistic_range: [0.32, 0.35] },
  },
  paramOrder: ["thermal_output", "efficiency"],
  draw(rng) {
    return {
      thermal_output: pick(THERMAL_SET, rng),
      efficiency: pick(EFFICIENCY_SET, rng),
    };
  },
  buildFrom({ thermal_output: thermalOutput, efficiency }) {
    if (efficiency <= 0 || efficiency >= 1 || thermalOutput <= 0) return null;
    const pe = efficiency * thermalOutput; // 電気出力〔MW〕
    if (!isCleanAnswer(pe)) return null;
    const answerText = formatClean(pe);
    return {
      format: "numeric",
      params: {
        thermal_output: { value: thermalOutput, unit: "MW", realistic_range: [1500, 3300] },
        efficiency: { value: efficiency, realistic_range: [0.32, 0.35] },
      },
      answerValue: pe,
      answerUnit: "MW",
      answerText,
      facts: { thermalOutput, efficiency, pe },
      defaultStatement:
        `ある原子力発電所の原子炉熱出力が Qt=${formatClean(thermalOutput)}MW、` +
        `熱効率が η=${formatClean(efficiency)} である。電気出力 Pe〔MW〕はいくらか。`,
      defaultSolution: [
        `電気出力 Pe=熱効率η×熱出力Qt`,
        `Pe=${formatClean(efficiency)}×${formatClean(thermalOutput)}`,
        `Pe=${answerText}MW`,
      ],
      physicallyValid: true,
    };
  },
});
