/**
 * テンプレート: 特別高圧の絶縁耐力試験電圧（法規・numeric）。
 *   電技解釈15条: 最大使用電圧 7000V 超 60000V 以下は
 *     試験電圧 = 最大使用電圧 × 1.25（10分間印加）。
 *   最大使用電圧 = 公称電圧 × 1.15/1.1。
 */
import { formatClean, isCleanAnswer } from "../clean.js";
import { defineTemplate, pick } from "./helpers.js";

const NOMINAL_SET: ReadonlyArray<number> = [11000, 22000, 33000, 44000, 55000]; // 〔V〕（いずれも最大使用電圧≤60000V）

type Params = {
  nominal_voltage: number;
};

export const hvInsulationTestVoltage = defineTemplate<Params>({
  topic: "特別高圧の絶縁耐力試験電圧",
  subject: "法規",
  exam: "denken2_primary",
  difficulty: 3,
  pastExam: {
    area: "絶縁・絶縁耐力",
    frequency: "mid",
    years: [2010, 2016, 2022],
    note: "電技解釈15条: 最大使用電圧7000V超60000V以下は試験電圧=最大使用電圧×1.25（10分間印加）",
  },
  paramSpecs: {
    nominal_voltage: { unit: "V", realistic_range: [11000, 55000] },
  },
  paramOrder: ["nominal_voltage"],
  draw(rng) {
    return { nominal_voltage: pick(NOMINAL_SET, rng) };
  },
  buildFrom({ nominal_voltage }) {
    // 演算順を sibling テンプレ（insulation-test-voltage）と統一し、
    // (公称×1.15)/1.1 を小数2桁に丸めて facts の浮動小数ノイズ（…99999）を排除する。
    const maxUse = Math.round(((nominal_voltage * 1.15) / 1.1) * 100) / 100;
    if (!(maxUse > 7000 && maxUse <= 60000)) return null;
    const test = maxUse * 1.25;
    if (!isCleanAnswer(test)) return null;
    const answerText = formatClean(test);
    const maxUseText = formatClean(maxUse);
    return {
      format: "numeric",
      params: {
        nominal_voltage: { value: nominal_voltage, unit: "V", realistic_range: [11000, 55000] },
      },
      answerValue: test,
      answerUnit: "V",
      answerText,
      facts: { nominal_voltage, maxUse, test },
      defaultStatement:
        `公称電圧 ${formatClean(nominal_voltage)}V の特別高圧機器について、交流絶縁耐力試験を行う。` +
        `試験電圧〔V〕を求めよ（最大使用電圧=公称×1.15/1.1、7000V超60000V以下は試験電圧=最大使用電圧×1.25）。`,
      defaultSolution: [
        `最大使用電圧 = 公称電圧×1.15/1.1 = ${formatClean(nominal_voltage)}×1.15/1.1 = ${maxUseText}V`,
        `7000V超60000V以下のため試験電圧=最大使用電圧×1.25`,
        `試験電圧 = ${maxUseText}×1.25 = ${answerText}V`,
      ],
      physicallyValid: true,
    };
  },
});
