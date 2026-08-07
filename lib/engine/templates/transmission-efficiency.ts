/**
 * テンプレート: 送電効率（電力・五択マークシート）。
 *   送電効率  η = 受電電力 / 送電電力 × 100 = Pr / (Pr + 損失) × 100   〔%〕
 *
 * 本番（一次）は五択マークシートのため、コード算出の η を真値とし、
 * 典型ミス由来の誤答を buildMcChoices で五択に整える。
 */
import { formatClean, isCleanAnswer } from "../clean.js";
import { buildMcChoices, defineTemplate, pick } from "./helpers.js";

// [受電電力 Pr, 送電電力 Ps]（η が綺麗）。
const PAIRS: ReadonlyArray<readonly [number, number]> = [
  [95, 100],
  [90, 100],
  [96, 100],
  [475, 500],
  [950, 1000],
  [1900, 2000],
  [180, 200],
  [92, 100],
  [94, 100],
  [98, 100],
  [99, 100],
  [285, 300],
  [288, 300],
  [294, 300],
  [380, 400],
  [392, 400],
  [396, 400],
  [470, 500],
  [480, 500],
  [490, 500],
  [495, 500],
  [570, 600],
  [588, 600],
  [594, 600],
  [760, 800],
  [784, 800],
  [792, 800],
  [900, 1000],
  [920, 1000],
  [940, 1000],
  [960, 1000],
  [970, 1000],
  [980, 1000],
  [990, 1000],
  [1140, 1200],
  [1176, 1200],
  [1188, 1200],
  [1425, 1500],
  [1440, 1500],
  [1470, 1500],
  [1485, 1500],
  [1800, 2000],
  [1840, 2000],
  [1880, 2000],
  [1920, 2000],
  [1960, 2000],
  [1980, 2000],
];

type Params = {
  received_power: number;
  sent_power: number;
};

export const transmissionEfficiency = defineTemplate<Params>({
  topic: "送電効率",
  subject: "電力",
  exam: "denken2_primary",
  difficulty: 2,
  pastExam: { area: "送電・線路計算", frequency: "high", years: [2008, 2013, 2018, 2023] },
  paramSpecs: {
    received_power: { unit: "kW", realistic_range: [90, 2000] },
    sent_power: { unit: "kW", realistic_range: [100, 2000] },
  },
  paramOrder: ["received_power", "sent_power"],
  draw(rng) {
    const [Pr, Ps] = pick(PAIRS, rng);
    return {
      received_power: Pr,
      sent_power: Ps,
    };
  },
  buildFrom({ received_power: Pr, sent_power: Ps }) {
    if (Pr <= 0 || Ps <= 0 || Pr > Ps) return null;
    const eta = (Pr / Ps) * 100;
    if (!isCleanAnswer(eta)) return null;
    const loss = Ps - Pr;

    // 五択（典型ミス由来の誤答）。
    const mc = buildMcChoices(
      eta,
      [
        { value: 100 - eta, reason: "送電効率でなく損失率（100−η）を答えた" },
        { value: eta * 10, reason: "×100を×1000とし桁を取り違え（単位の取り違え）" },
        { value: eta * 2, reason: "送電効率を誤って2倍にした（係数2のミス）" },
        { value: eta / 2, reason: "送電効率を誤って半分にした（係数1/2のミス）" },
      ],
      formatClean,
    );
    if (!mc) return null;

    return {
      params: {
        received_power: { value: Pr, unit: "kW", realistic_range: [90, 2000] },
        sent_power: { value: Ps, unit: "kW", realistic_range: [100, 2000] },
      },
      answerValue: eta,
      answerUnit: "%",
      answerText: mc.answerText,
      choices: mc.choices,
      distractors: mc.distractors,
      likelyWrongChoice: formatClean(100 - eta),
      facts: { Pr, Ps, loss, eta },
      defaultStatement: `送電電力 Ps=${Ps}kW に対し、受電電力 Pr=${Pr}kW であった（線路損失 ${loss}kW）。送電効率 η〔%〕は?`,
      defaultSolution: [`送電効率 η=受電電力/送電電力×100`, `η=${Pr}/${Ps}×100`, `η=${mc.answerText}%`],
      physicallyValid: true,
    };
  },
});
