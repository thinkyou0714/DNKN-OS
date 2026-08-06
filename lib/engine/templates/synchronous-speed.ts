/**
 * テンプレート: 同期機の同期速度（機械・numeric）。
 *   Ns = 120·f / p 〔min⁻¹〕（f=周波数, p=極数）。
 *
 * 典型ミス（解説で言及）:
 *   ・誘導機の回転速度（すべり込み N=Ns(1−s)）と混同
 *   ・f と p の取り違え
 */
import { formatClean } from "../clean.js";
import { defineTemplate, pick } from "./helpers.js";

const FREQ: ReadonlyArray<number> = [50, 60]; // 〔Hz〕
const POLES: ReadonlyArray<number> = [2, 4, 6, 8, 10, 12, 16, 18, 20, 24]; // 〔pole〕

type Params = {
  frequency: number;
  poles: number;
};

export const synchronousSpeed = defineTemplate<Params>({
  topic: "同期速度",
  subject: "機械",
  exam: "denken2_primary",
  difficulty: 1,
  pastExam: {
    area: "同期機",
    frequency: "high",
    years: [2006, 2010, 2015, 2020, 2024],
    note: "同期機の同期速度 Ns=120f/p。誘導機の回転速度（すべり込み）と区別",
  },
  paramSpecs: {
    frequency: { unit: "Hz", realistic_range: [50, 60] },
    poles: { unit: "pole", realistic_range: [2, 24] },
  },
  paramOrder: ["frequency", "poles"],
  draw(rng) {
    return {
      frequency: pick(FREQ, rng),
      poles: pick(POLES, rng),
    };
  },
  buildFrom({ frequency: f, poles: p }) {
    if (f <= 0 || p <= 0) return null;
    const Ns = (120 * f) / p; // 同期速度〔min⁻¹〕
    if (!Number.isInteger(Ns)) return null;
    const answerText = formatClean(Ns);
    return {
      format: "numeric",
      params: {
        frequency: { value: f, unit: "Hz", realistic_range: [50, 60] },
        poles: { value: p, unit: "pole", realistic_range: [2, 24] },
      },
      answerValue: Ns,
      answerUnit: "min⁻¹",
      answerText,
      facts: { f, p, Ns },
      defaultStatement: `周波数${f}Hz、極数${p}の同期機の同期速度 Ns〔min⁻¹〕はいくらか。`,
      defaultSolution: [`同期速度 Ns=120·f/p`, `Ns=120×${f}/${p}`, `Ns=${answerText} min⁻¹`],
      physicallyValid: true,
    };
  },
});
