/**
 * テンプレート: B種接地の対地電位上昇（二種一次・法規・numeric）。
 *   高低圧混触時、B種接地抵抗 RB に1線地絡電流 Ig が流れると低圧電路の対地電位は
 *     V = Ig × RB 〔V〕
 *   だけ上昇する。150V を超えないことが RB=150/Ig という上限値の根拠。
 *   過去問頻出の「B種接地抵抗の計算」を、混触時の電位上昇側からひねった改作。
 */
import { formatClean, isCleanAnswer } from "../clean.js";
import { defineTemplate, pick } from "./helpers.js";

const IG_SET: ReadonlyArray<number> = [1, 2, 3, 4, 5, 6, 10, 15, 7, 8, 9, 12, 14, 16, 18, 20];
const RB_SET: ReadonlyArray<number> = [5, 10, 15, 20, 25, 30, 50, 75, 150, 6, 8, 12, 18, 24, 40, 60, 100, 120];
/** 遮断装置なしの場合の対地電圧上昇の上限〔V〕（電技解釈17条）。 */
const LIMIT_VOLTAGE = 150;

type Params = {
  ground_fault_current: number;
  grounding_resistance: number;
};

export const groundFaultPotentialRise = defineTemplate<Params>({
  topic: "B種接地の対地電位上昇",
  subject: "法規",
  exam: "denken2_primary",
  difficulty: 3,
  pastExam: { area: "接地工事", frequency: "high", years: [2007, 2013, 2017, 2021] },
  paramSpecs: {
    ground_fault_current: { unit: "A", realistic_range: [1, 20] },
    grounding_resistance: { unit: "Ω", realistic_range: [5, 150] },
  },
  paramOrder: ["ground_fault_current", "grounding_resistance"],
  draw(rng) {
    return {
      ground_fault_current: pick(IG_SET, rng),
      grounding_resistance: pick(RB_SET, rng),
    };
  },
  buildFrom({ ground_fault_current: ig, grounding_resistance: rb }) {
    if (ig <= 0 || rb <= 0) return null;
    const rise = ig * rb;
    // B種の上限 RB≤150/Ig を満たす（=上昇が150V以下の）適法な施設条件のみ出題する。
    if (rise > LIMIT_VOLTAGE) return null;
    if (!isCleanAnswer(rise)) return null;
    const answerText = formatClean(rise);
    const maxRb = formatClean(LIMIT_VOLTAGE / ig);
    return {
      format: "numeric",
      params: {
        ground_fault_current: { value: ig, unit: "A", realistic_range: [1, 20] },
        grounding_resistance: { value: rb, unit: "Ω", realistic_range: [5, 150] },
      },
      answerValue: rise,
      answerUnit: "V",
      answerText,
      facts: { ig, rb, rise, limit: LIMIT_VOLTAGE, maxRb: Number(maxRb) },
      defaultStatement:
        `変圧器の高圧側電路の1線地絡電流が ${ig}A の配電系統で、低圧側に施す B種接地工事の` +
        `接地抵抗値が ${rb}Ω である。高低圧が混触したとき、低圧電路に生じる対地電位の上昇〔V〕を求めよ。`,
      defaultSolution: [
        `着眼点: 混触時は地絡電流 Ig が B種接地抵抗 RB を流れ、V=Ig·RB だけ電位が持ち上がる。`,
        `V=${ig}×${rb}=${answerText}V`,
        `（混触時に電路を自動遮断する装置を施設しない場合、この上昇を150V以下に抑えるのが RB≤150/Ig=${maxRb}Ω という上限値の根拠。1秒以内の遮断装置があれば600V等まで緩和される）`,
        `ポイント: B種の抵抗上限 150/Ig は「混触時の対地電圧上昇の制限」から来ている。`,
      ],
      physicallyValid: true,
    };
  },
});
