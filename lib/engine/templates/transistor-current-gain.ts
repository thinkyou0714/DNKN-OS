/**
 * テンプレート: トランジスタの電流増幅率（理論・numeric）。
 *   エミッタ接地の直流電流増幅率:
 *     hFE = Ic / Ib
 *   （Ic=コレクタ電流, Ib=ベース電流。単位を揃えて計算する）
 *
 * 典型ミス（解説で言及）:
 *   ・Ic[mA] と Ib[μA] の単位を揃えずに計算する
 *   ・Ib/Ic と逆数にする
 */
import { formatClean, isCleanAnswer } from "../clean.js";
import { defineTemplate, pick } from "./helpers.js";

const COLLECTOR_SET: ReadonlyArray<number> = [1, 1.2, 1.5, 1.6, 2, 2.4, 2.5, 3, 3.2, 3.5, 4, 4.5, 4.8, 5]; // 〔mA〕
const BASE_SET: ReadonlyArray<number> = [10, 12, 15, 16, 20, 24, 25, 30, 32, 40, 48, 50]; // 〔μA〕

type Params = {
  collector_current: number;
  base_current: number;
};

export const transistorCurrentGain = defineTemplate<Params>({
  topic: "トランジスタの電流増幅率",
  subject: "理論",
  exam: "denken2_primary",
  difficulty: 2,
  pastExam: {
    area: "電子理論",
    frequency: "mid",
    years: [2011, 2017, 2023],
    note: "エミッタ接地の直流電流増幅率 hFE=Ic/Ib",
  },
  paramSpecs: {
    collector_current: { unit: "mA", realistic_range: [1, 5] },
    base_current: { unit: "uA", realistic_range: [10, 50] },
  },
  paramOrder: ["collector_current", "base_current"],
  draw(rng) {
    return {
      collector_current: pick(COLLECTOR_SET, rng),
      base_current: pick(BASE_SET, rng),
    };
  },
  buildFrom({ collector_current: collectorCurrent, base_current: baseCurrent }) {
    if (baseCurrent <= 0 || collectorCurrent <= 0) return null;
    const hfe = (collectorCurrent * 1000) / baseCurrent; // Ic[mA]→μA換算してIc/Ib
    if (!isCleanAnswer(hfe)) return null;
    const answerText = formatClean(hfe);
    return {
      format: "numeric",
      params: {
        collector_current: { value: collectorCurrent, unit: "mA", realistic_range: [1, 5] },
        base_current: { value: baseCurrent, unit: "uA", realistic_range: [10, 50] },
      },
      answerValue: hfe,
      answerUnit: "倍",
      answerText,
      facts: { collectorCurrent, baseCurrent, hfe },
      defaultStatement:
        `エミッタ接地トランジスタで、コレクタ電流 Ic=${formatClean(collectorCurrent)}mA、` +
        `ベース電流 Ib=${formatClean(baseCurrent)}μA であった。` +
        `直流電流増幅率 hFE〔倍〕はいくらか。`,
      defaultSolution: [
        `直流電流増幅率 hFE=Ic/Ib`,
        `単位を揃える Ic=${formatClean(collectorCurrent)}mA=${formatClean(collectorCurrent * 1000)}μA, Ib=${formatClean(baseCurrent)}μA`,
        `hFE=${formatClean(collectorCurrent * 1000)}/${formatClean(baseCurrent)}=${answerText}倍`,
      ],
      physicallyValid: true,
    };
  },
});
