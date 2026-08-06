/**
 * テンプレート: 高圧機器の絶縁耐力試験電圧（法規・五択マークシート）。
 *   最大使用電圧 = 公称電圧 × 1.15/1.1
 *   交流試験電圧 = 最大使用電圧 × 1.5   〔V〕（最大使用電圧 7000V 以下の場合）
 *
 * 本番（一次）は五択マークシートのため、コード算出の試験電圧を真値とし、
 * 係数の取り違え等の典型ミスを buildMcChoices で五択に整える。
 */
import { formatClean, isCleanAnswer } from "../clean.js";
import { buildMcChoices, defineTemplate, pick } from "./helpers.js";

const NOMINAL_SET: ReadonlyArray<number> = [2200, 3300, 6600];

type Params = {
  nominal_voltage: number;
};

export const insulationTestVoltage = defineTemplate<Params>({
  topic: "絶縁耐力試験電圧",
  subject: "法規",
  exam: "denken2_primary",
  difficulty: 2,
  pastExam: { area: "絶縁・絶縁耐力", frequency: "high", years: [2008, 2012, 2016, 2020, 2024] },
  paramSpecs: {
    nominal_voltage: { unit: "V", realistic_range: [2200, 6600] },
  },
  paramOrder: ["nominal_voltage"],
  draw(rng) {
    return { nominal_voltage: pick(NOMINAL_SET, rng) };
  },
  buildFrom({ nominal_voltage: nominal }) {
    if (nominal <= 0) return null;
    const maxUse = (nominal * 1.15) / 1.1;
    if (maxUse > 7000) return null; // ×1.5 が適用できる範囲
    const test = maxUse * 1.5;
    if (!isCleanAnswer(test)) return null;
    const maxUseText = formatClean(maxUse);

    // 五択（典型ミス由来の誤答）。
    const mc = buildMcChoices(
      test,
      [
        { value: nominal * 1.5, reason: "最大使用電圧でなく公称電圧に×1.5した（×1.15/1.1を忘れ）" },
        { value: maxUse * 1.25, reason: "特別高圧の係数×1.25を高圧に適用した（高圧は×1.5）" },
        { value: maxUse * 2, reason: "係数×1.5を×2と取り違えた" },
        { value: maxUse, reason: "最大使用電圧そのものを試験電圧とした（×1.5を忘れ）" },
      ],
      formatClean,
    );
    if (!mc) return null;

    return {
      params: {
        nominal_voltage: { value: nominal, unit: "V", realistic_range: [2200, 6600] },
      },
      answerValue: test,
      answerUnit: "V",
      answerText: mc.answerText,
      choices: mc.choices,
      distractors: mc.distractors,
      likelyWrongChoice: formatClean(maxUse),
      facts: { nominal, maxUse, test },
      defaultStatement:
        `公称電圧 ${nominal}V の高圧機器について、交流絶縁耐力試験を行う。` +
        `試験電圧〔V〕を求めよ（最大使用電圧=公称×1.15/1.1、試験電圧=最大使用電圧×1.5）。`,
      defaultSolution: [
        `最大使用電圧=${nominal}×1.15/1.1=${maxUseText}V`,
        `試験電圧=最大使用電圧×1.5=${maxUseText}×1.5`,
        `試験電圧=${mc.answerText}V`,
      ],
      physicallyValid: true,
    };
  },
});
