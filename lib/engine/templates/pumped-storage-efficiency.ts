/**
 * テンプレート: 揚水発電所の総合効率（電力・numeric）。
 *   η = 発電電力量 / 揚水電力量 × 100 〔%〕。
 *
 * 典型ミス（解説で言及）:
 *   ・分母分子を逆にする（揚水/発電）
 *   ・100倍し忘れて小数のまま答える
 */
import { formatClean, isCleanAnswer } from "../clean.js";
import { defineTemplate, pick } from "./helpers.js";

const PUMPING_SET: ReadonlyArray<number> = [1000, 1200, 1250, 1400, 1500, 1600, 1750, 1800, 2000]; // 〔MWh〕
const RATIO_SET: ReadonlyArray<number> = [0.65, 0.68, 0.7, 0.72, 0.75, 0.76, 0.78, 0.8];

type Params = {
  pumping_energy: number;
  generating_energy: number;
};

export const pumpedStorageEfficiency = defineTemplate<Params>({
  topic: "揚水発電の総合効率",
  subject: "電力",
  exam: "denken2_primary",
  difficulty: 3,
  pastExam: {
    area: "水力発電",
    frequency: "high",
    years: [2009, 2014, 2019, 2024],
    note: "揚水発電所の総合効率 η=発電電力量/揚水電力量×100〔%〕",
  },
  paramSpecs: {
    pumping_energy: { unit: "MWh", realistic_range: [1000, 2000] },
    generating_energy: { unit: "MWh", realistic_range: [650, 1600] },
  },
  paramOrder: ["pumping_energy", "generating_energy"],
  draw(rng) {
    const wp = pick(PUMPING_SET, rng);
    const r = pick(RATIO_SET, rng);
    return { pumping_energy: wp, generating_energy: Math.round(wp * r) };
  },
  buildFrom({ pumping_energy: wp, generating_energy: wg }) {
    if (wg <= 0 || wg >= wp) return null;
    const eta = (wg / wp) * 100; // 総合効率〔%〕
    if (!isCleanAnswer(eta)) return null;
    const answerText = formatClean(eta);
    return {
      format: "numeric",
      params: {
        pumping_energy: { value: wp, unit: "MWh", realistic_range: [1000, 2000] },
        generating_energy: { value: wg, unit: "MWh", realistic_range: [650, 1600] },
      },
      answerValue: eta,
      answerUnit: "%",
      answerText,
      facts: { wp, wg, eta },
      defaultStatement:
        `ある揚水発電所で、揚水に要した電力量が${formatClean(wp)}MWh、` +
        `これを用いた発電で得られた電力量が${formatClean(wg)}MWh であった。` +
        `総合効率 η〔%〕はいくらか。`,
      defaultSolution: [
        `揚水発電の総合効率 η=発電電力量/揚水電力量×100`,
        `η=${formatClean(wg)}/${formatClean(wp)}×100`,
        `η=${answerText}%`,
      ],
      physicallyValid: true,
    };
  },
});
