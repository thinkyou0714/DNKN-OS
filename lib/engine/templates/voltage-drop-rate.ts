/**
 * テンプレート: 送電線の電圧降下率（電力・五択マークシート）。
 *   電圧降下率  ε = (Vs − Vr) / Vr × 100   〔%〕
 *
 * 本番（一次）は五択マークシートのため、コード算出の ε を真値とし、
 * 典型ミス由来の誤答を buildMcChoices で五択に整える。
 */
import { formatClean, isCleanAnswer } from "../clean.js";
import { buildMcChoices, defineTemplate, pick } from "./helpers.js";

// [送電端 Vs, 受電端 Vr]（ε が綺麗）。
const V_PAIRS: ReadonlyArray<readonly [number, number]> = [
  [210, 200],
  [220, 200],
  [216, 200],
  [208, 200],
  [105, 100],
  [3300, 3000],
  [6300, 6000],
  [6600, 6000],
  [101, 100],
  [102, 100],
  [103, 100],
  [104, 100],
  [106, 100],
  [108, 100],
  [110, 100],
  [202, 200],
  [204, 200],
  [206, 200],
  [212, 200],
  [214, 200],
  [218, 200],
  [3030, 3000],
  [3060, 3000],
  [3090, 3000],
  [3120, 3000],
  [3150, 3000],
  [3180, 3000],
  [3240, 3000],
  [6060, 6000],
  [6120, 6000],
  [6180, 6000],
  [6240, 6000],
  [6360, 6000],
  [6420, 6000],
  [6480, 6000],
  [6540, 6000],
];

type Params = {
  sending_voltage: number;
  receiving_voltage: number;
};

export const voltageDropRate = defineTemplate<Params>({
  topic: "電圧降下率",
  subject: "電力",
  exam: "denken2_primary",
  difficulty: 2,
  pastExam: { area: "送電・線路計算", frequency: "mid", years: [2010, 2015, 2020, 2025] },
  paramSpecs: {
    sending_voltage: { unit: "V", realistic_range: [100, 6600] },
    receiving_voltage: { unit: "V", realistic_range: [100, 6600] },
  },
  paramOrder: ["sending_voltage", "receiving_voltage"],
  draw(rng) {
    const [Vs, Vr] = pick(V_PAIRS, rng);
    return {
      sending_voltage: Vs,
      receiving_voltage: Vr,
    };
  },
  buildFrom({ sending_voltage: Vs, receiving_voltage: Vr }) {
    if (Vs <= 0 || Vr <= 0 || Vs < Vr) return null;
    const eps = ((Vs - Vr) / Vr) * 100;
    if (!isCleanAnswer(eps)) return null;

    // 五択（典型ミス由来の誤答）。
    const mc = buildMcChoices(
      eps,
      [
        { value: eps * 10, reason: "×100を×1000とし桁を取り違え（単位の取り違え）" },
        { value: eps * 2, reason: "電圧降下率を誤って2倍にした（係数2のミス）" },
        { value: eps / 2, reason: "電圧降下率を誤って半分にした（係数1/2のミス）" },
        { value: eps * 5, reason: "係数の取り違えで5倍した当て推量" },
      ],
      formatClean,
    );
    if (!mc) return null;

    return {
      params: {
        sending_voltage: { value: Vs, unit: "V", realistic_range: [100, 6600] },
        receiving_voltage: { value: Vr, unit: "V", realistic_range: [100, 6600] },
      },
      answerValue: eps,
      answerUnit: "%",
      answerText: mc.answerText,
      choices: mc.choices,
      distractors: mc.distractors,
      likelyWrongChoice: formatClean(eps * 2),
      facts: { Vs, Vr, eps },
      defaultStatement: `送電端電圧 Vs=${Vs}V、受電端電圧 Vr=${Vr}V である。電圧降下率 ε〔%〕は?`,
      defaultSolution: [`電圧降下率 ε=(Vs−Vr)/Vr×100`, `ε=(${Vs}−${Vr})/${Vr}×100`, `ε=${mc.answerText}%`],
      physicallyValid: true,
    };
  },
});
