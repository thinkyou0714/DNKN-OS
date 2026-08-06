/**
 * テンプレート: 単相半波整流の直流電圧（機械・パワーエレクトロニクス・numeric）。
 *   平均直流電圧（近似）  Vd ≈ 0.45 · V   〔V〕（V=交流電源の実効値）
 *   （正確には Vd=√2·V/π≈0.45V。全波整流 0.9V のちょうど半分になる電験の頻出近似値）
 */
import { formatClean, isCleanAnswer } from "../clean.js";
import { defineTemplate, pick } from "./helpers.js";

const V_SET: ReadonlyArray<number> = [100, 110, 200, 220, 400, 440, 500, 600, 1000];

type Params = {
  ac_voltage: number;
};

export const halfWaveRectifier = defineTemplate<Params>({
  topic: "単相半波整流の直流電圧",
  subject: "機械",
  exam: "denken2_primary",
  difficulty: 2,
  pastExam: { area: "パワーエレクトロニクス", frequency: "high", years: [2010, 2015, 2020, 2024] },
  paramSpecs: {
    ac_voltage: { unit: "V", realistic_range: [100, 1000] },
  },
  paramOrder: ["ac_voltage"],
  draw(rng) {
    return { ac_voltage: pick(V_SET, rng) };
  },
  buildFrom({ ac_voltage: V }) {
    if (V <= 0) return null;
    const Vd = 0.45 * V;
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
      defaultStatement: `実効値 V=${V}V の交流を単相半波整流する。平均直流電圧 Vd〔V〕を近似式 Vd≈0.45V により求めよ。`,
      defaultSolution: [
        `単相半波整流の平均直流電圧 Vd=√2·V/π≈0.45·V`,
        `Vd=0.45×${V}`,
        `Vd=${answerText}V`,
        `ポイント: 全波整流の 0.9·V のちょうど半分（半周期しか導通しないため）。`,
      ],
      physicallyValid: true,
    };
  },
});
