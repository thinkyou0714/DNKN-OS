/**
 * テンプレート: 汽力発電所の発電端熱効率（二種二次・電力管理・descriptive）。
 *   1kWh = 3600kJ より  η = 3600 / q × 100   〔%〕
 *     q = 発電端の熱消費率〔kJ/(kW·h)〕
 *
 * 新規テンプレートはこの形（defineTemplate ファクトリ）を標準とする。
 */
import { formatClean, isCleanAnswer } from "../clean.js";
import { defineTemplate, pick } from "./helpers.js";

const Q_SET: ReadonlyArray<number> = [7200, 7500, 8000, 9000, 9375, 9600, 10000, 11250, 11520, 12000];

type Params = {
  heat_rate: number;
};

export const thermalEfficiency = defineTemplate<Params>({
  topic: "汽力発電の熱効率",
  subject: "電力管理",
  exam: "denken2_secondary",
  difficulty: 4,
  pastExam: { area: "発電（水力・汽力）", frequency: "high", years: [2008, 2013, 2018, 2023] },
  paramSpecs: {
    heat_rate: { unit: "kJ/kWh", realistic_range: [7000, 12000] },
  },
  paramOrder: ["heat_rate"],
  draw(rng) {
    return {
      heat_rate: pick(Q_SET, rng),
    };
  },
  buildFrom({ heat_rate: q }) {
    if (q <= 0) return null;
    const eta = (3600 / q) * 100;
    if (!isCleanAnswer(eta)) return null;
    const answerText = formatClean(eta);

    return {
      format: "descriptive",
      params: {
        heat_rate: { value: q, unit: "kJ/kWh", realistic_range: [7000, 12000] },
      },
      answerValue: eta,
      answerUnit: "%",
      answerText,
      facts: { q, eta },
      defaultStatement: `ある汽力発電所の発電端熱消費率が q=${q}kJ/(kW·h) である。発電端熱効率 η〔%〕を導出過程とともに求めよ。`,
      defaultSolution: [`1kWh=3600kJ なので η=3600/q×100`, `η=3600/${q}×100`, `η=${answerText}%`],
      physicallyValid: true,
    };
  },
});
