/**
 * テンプレート: 変圧器の効率（機械・numeric）。
 *   η = P_out / (P_out + P_i + P_c) × 100  〔%〕
 *     P_out=出力, P_i=鉄損(無負荷損), P_c=銅損(負荷損)
 *   綺麗な η になる (P_out, P_i, P_c) の組のみ採用する。
 */
import { formatClean, isCleanAnswer } from "../clean.js";
import { defineTemplate, pick } from "./helpers.js";

// [出力 P_out(kW), 鉄損 P_i(kW), 銅損 P_c(kW)] — η が綺麗(整数 or .5%)になる組。
const TUPLES: ReadonlyArray<readonly [number, number, number]> = [
  [900, 40, 60],
  [950, 20, 30],
  [475, 10, 15],
  [970, 12, 18],
  [864, 16, 20],
  [882, 8, 10],
  [1880, 40, 80],
  [1990, 4, 6],
  // η=95%（損失=Pout/19）
  [380, 8, 12],
  [760, 16, 24],
  [1140, 24, 36],
  [1520, 32, 48],
  [1900, 40, 60],
  // η=96%（損失=Pout/24）
  [480, 8, 12],
  [720, 12, 18],
  [960, 16, 24],
  [1200, 20, 30],
  [1440, 24, 36],
  [1920, 32, 48],
  // η=97%/98%
  [1940, 24, 36],
  [980, 8, 12],
  [1470, 12, 18],
  [1960, 16, 24],
  // η=90%/92%/94%
  [450, 20, 30],
  [1350, 60, 90],
  [575, 20, 30],
  [1150, 40, 60],
  [940, 24, 36],
  // η=93.75%（損失=Pout/15）
  [600, 16, 24],
  [900, 24, 36],
  [1200, 32, 48],
  [1500, 40, 60],
];

type Params = {
  output_power: number;
  iron_loss: number;
  copper_loss: number;
};

export const transformerEfficiency = defineTemplate<Params>({
  topic: "変圧器の効率",
  subject: "機械",
  exam: "denken2_primary",
  difficulty: 3,
  pastExam: { area: "変圧器", frequency: "high", years: [2006, 2010, 2014, 2018, 2022] },
  paramSpecs: {
    output_power: { unit: "kW", realistic_range: [300, 2000] },
    iron_loss: { unit: "kW", realistic_range: [1, 60] },
    copper_loss: { unit: "kW", realistic_range: [1, 100] },
  },
  paramOrder: ["output_power", "iron_loss", "copper_loss"],
  draw(rng) {
    const [pout, pi, pc] = pick(TUPLES, rng);
    return { output_power: pout, iron_loss: pi, copper_loss: pc };
  },
  buildFrom({ output_power: pout, iron_loss: pi, copper_loss: pc }) {
    if (pout <= 0 || pi <= 0 || pc <= 0) return null;
    const eta = (pout / (pout + pi + pc)) * 100;
    if (!isCleanAnswer(eta)) return null;
    const answerText = formatClean(eta);
    return {
      format: "numeric",
      params: {
        output_power: { value: pout, unit: "kW", realistic_range: [300, 2000] },
        iron_loss: { value: pi, unit: "kW", realistic_range: [1, 60] },
        copper_loss: { value: pc, unit: "kW", realistic_range: [1, 100] },
      },
      answerValue: eta,
      answerUnit: "%",
      answerText,
      facts: { pout, pi, pc, eta },
      defaultStatement: `ある変圧器が出力 P_out=${pout}kW で運転している。鉄損 P_i=${pi}kW、銅損 P_c=${pc}kW のとき、効率 η〔%〕は?`,
      defaultSolution: [`η=P_out/(P_out+P_i+P_c)×100`, `η=${pout}/(${pout}+${pi}+${pc})×100`, `η=${answerText}%`],
      physicallyValid: true,
    };
  },
});
