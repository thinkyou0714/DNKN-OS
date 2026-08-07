/**
 * テンプレート: 単相全波整流の直流電圧（機械・numeric）。
 *   平均直流電圧（近似）  Vd ≈ 0.9 · V   〔V〕（V=交流電源の実効値）
 *   （正確には Vd=2√2·V/π≈0.9V。電験の頻出近似値）
 */
import { formatClean, isCleanAnswer } from "../clean.js";
import { defineTemplate, pick } from "./helpers.js";

const V_SET: ReadonlyArray<number> = [
  100, 105, 110, 115, 120, 127, 140, 150, 160, 180, 200, 210, 220, 230, 240, 250, 277, 300, 320, 346, 380, 400, 415,
  420, 440, 460, 480, 500, 550, 600, 660, 690, 700, 750, 800, 900, 1000,
];

type Params = {
  ac_voltage: number;
};

export const fullWaveRectifier = defineTemplate<Params>({
  topic: "単相全波整流の直流電圧",
  subject: "機械",
  exam: "denken2_primary",
  difficulty: 2,
  pastExam: { area: "パワーエレクトロニクス", frequency: "high", years: [2008, 2012, 2018, 2023] },
  paramSpecs: {
    ac_voltage: { unit: "V", realistic_range: [100, 1000] },
  },
  paramOrder: ["ac_voltage"],
  draw(rng) {
    return { ac_voltage: pick(V_SET, rng) };
  },
  buildFrom({ ac_voltage: V }) {
    if (V <= 0) return null;
    const Vd = 0.9 * V;
    if (!isCleanAnswer(Vd)) return null;
    const answerText = formatClean(Vd);
    return {
      format: "numeric",
      params: {
        ac_voltage: { value: V, unit: "V", realistic_range: [100, 1000] },
      },
      answerValue: Vd,
      answerUnit: "V",
      answerText,
      facts: { V, Vd },
      defaultStatement: `実効値 V=${V}V の交流を単相全波整流する。平均直流電圧 Vd〔V〕を近似式 Vd≈0.9V により求めよ。`,
      defaultSolution: [`単相全波整流の平均直流電圧 Vd=2√2·V/π≈0.9·V`, `Vd=0.9×${V}`, `Vd=${answerText}V`],
      physicallyValid: true,
    };
  },
});
