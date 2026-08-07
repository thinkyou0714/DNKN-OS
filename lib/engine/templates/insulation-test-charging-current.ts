/**
 * テンプレート: 絶縁耐力試験の充電電流・試験装置容量（法規B問題・五肢択一）。
 *
 * 既存の「絶縁耐力試験電圧」テンプレは試験電圧の算出までで終わる。本試のB問題は
 * その先の (b)「ケーブルの充電電流」と「試験装置に必要な容量」が本体なので分離して用意する。
 *
 *   公称6600V ⇒ 最大使用電圧 = 6600 × 1.15/1.1 = 6900V
 *   試験電圧   = 最大使用電圧 × 1.5 = 10350V（電技解釈: 7000V以下の電路、連続10分間）
 *   充電電流   Ic = 2πf・C・V        (C はケーブル全長の静電容量〔F〕)
 *   試験装置容量 S = V・Ic 〔VA〕
 *
 * ω=2πf に π が入るため答えは割り切れない。isCleanAnswer では棄却されてしまうので、
 * ここでは本試と同様に**小数2桁へ丸めた値**を答えとする（他テンプレの clean 前提とは異なる）。
 */
import { formatClean } from "../clean.js";
import { buildRoundedMcChoices, defineTemplate, pick } from "./helpers.js";

/** 公称6600V 高圧ケーブルの試験電圧（6600×1.15/1.1×1.5）。 */
const TEST_VOLTAGE = 10350;
const LENGTH_SET = [0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 1, 1.2, 1.5, 1.8, 2, 2.4, 2.5, 3, 3.5, 4, 5];
const CAPACITANCE_SET = [0.12, 0.15, 0.18, 0.2, 0.22, 0.25, 0.28, 0.3, 0.35, 0.4, 0.45, 0.5];
const FREQ_SET = [50, 60];

type Params = {
  cable_length: number;
  capacitance_per_km: number;
  frequency: number;
  variant: number;
};

export const insulationTestChargingCurrent = defineTemplate<Params>({
  topic: "絶縁耐力試験の充電電流と試験装置容量",
  subject: "法規",
  exam: "denken3",
  difficulty: 3,
  pastExam: {
    area: "絶縁・絶縁耐力",
    frequency: "high",
    years: [2010, 2013, 2017, 2020, 2023],
  },
  paramSpecs: {
    cable_length: { unit: "km", realistic_range: [0.1, 5] },
    capacitance_per_km: { unit: "μF/km", realistic_range: [0.1, 0.5] },
    frequency: { unit: "Hz", realistic_range: [50, 60] },
    variant: { realistic_range: [0, 1] },
  },
  paramOrder: ["cable_length", "capacitance_per_km", "frequency", "variant"],
  draw(rng) {
    return {
      cable_length: pick(LENGTH_SET, rng),
      capacitance_per_km: pick(CAPACITANCE_SET, rng),
      frequency: pick(FREQ_SET, rng),
      variant: Math.floor(rng() * 2),
    };
  },
  buildFrom(p) {
    const { cable_length: L, capacitance_per_km: cPerKm, frequency: f } = p;
    const cTotalUf = cPerKm * L;
    const cTotalF = cTotalUf * 1e-6;
    const omega = 2 * Math.PI * f;
    const ic = omega * cTotalF * TEST_VOLTAGE;
    if (!Number.isFinite(ic) || ic <= 0) return null;

    const params = {
      cable_length: { value: L, unit: "km", realistic_range: [0.1, 5] as [number, number] },
      capacitance_per_km: { value: cPerKm, unit: "μF/km", realistic_range: [0.1, 0.5] as [number, number] },
      frequency: { value: f, unit: "Hz", realistic_range: [50, 60] as [number, number] },
      variant: { value: p.variant, realistic_range: [0, 1] as [number, number] },
    };
    const cTotalT = formatClean(cTotalUf, 3);
    const icT = formatClean(ic);
    const given =
      `公称電圧6600Vの高圧ケーブル（こう長${L}km、静電容量${cPerKm}μF/km）について、` +
      `商用周波数${f}Hzで絶縁耐力試験を行う。`;
    const commonSteps = [
      "最大使用電圧 = 公称電圧 × 1.15/1.1 = 6600×1.15/1.1 = 6900V",
      `試験電圧 = 最大使用電圧 × 1.5 = ${TEST_VOLTAGE}V（7000V以下の電路・連続10分間）`,
      `ケーブル全長の静電容量 C = ${cPerKm}×${L} = ${cTotalT}μF`,
    ];

    if (p.variant === 0) {
      const mc = buildRoundedMcChoices(
        ic,
        [
          { value: omega * cTotalF * 9900, reason: "最大使用電圧の補正(×1.15/1.1)を忘れ、6600×1.5=9900Vで計算した" },
          { value: omega * cTotalF * 6600, reason: "試験電圧ではなく公称電圧6600Vをそのまま使った" },
          { value: f * cTotalF * TEST_VOLTAGE, reason: "角周波数の 2π を掛け忘れた（ω=2πf）" },
          { value: Math.PI * f * cTotalF * TEST_VOLTAGE, reason: "ω=2πf の係数2を落とした" },
        ],
        formatClean,
      );
      if (!mc) return null;
      return {
        params,
        answerValue: ic,
        answerUnit: "A",
        answerText: mc.answerText,
        choices: mc.choices,
        distractors: mc.distractors,
        likelyWrongChoice: formatClean(omega * cTotalF * 9900),
        facts: { V: TEST_VOLTAGE, C: cTotalUf, f, Ic: ic },
        defaultStatement: `${given}試験時にケーブルに流れる充電電流〔A〕として、最も近い値を選べ。`,
        defaultSolution: [
          ...commonSteps,
          "充電電流 Ic = 2πf・C・V",
          `Ic = 2π×${f}×${cTotalT}×10⁻⁶×${TEST_VOLTAGE} = ${icT}A`,
        ],
        physicallyValid: true,
      };
    }

    // variant=1: 試験装置に必要な容量〔kVA〕。
    const sKva = (TEST_VOLTAGE * ic) / 1000;
    if (!Number.isFinite(sKva) || sKva <= 0) return null;
    const sT = formatClean(sKva);
    const mc = buildRoundedMcChoices(
      sKva,
      [
        {
          value: (9900 * (omega * cTotalF * 9900)) / 1000,
          reason: "最大使用電圧の補正を忘れ、試験電圧を9900Vとして計算した",
        },
        { value: ic, reason: "充電電流〔A〕をそのまま容量として答えた" },
        { value: (6900 * ic) / 1000, reason: "試験電圧の1.5倍を掛け忘れ、最大使用電圧6900Vのまま計算した" },
        { value: (6600 * ic) / 1000, reason: "試験電圧ではなく公称電圧6600Vを掛けた" },
      ],
      formatClean,
    );
    if (!mc) return null;
    return {
      params,
      answerValue: sKva,
      answerUnit: "kVA",
      answerText: mc.answerText,
      choices: mc.choices,
      distractors: mc.distractors,
      likelyWrongChoice: formatClean((6600 * ic) / 1000),
      facts: { V: TEST_VOLTAGE, C: cTotalUf, f, Ic: ic, S: sKva },
      defaultStatement: `${given}この試験に必要な試験装置の容量〔kVA〕として、最も近い値を選べ。`,
      defaultSolution: [
        ...commonSteps,
        `充電電流 Ic = 2πf・C・V = 2π×${f}×${cTotalT}×10⁻⁶×${TEST_VOLTAGE} = ${icT}A`,
        "試験装置容量 S = 試験電圧 × 充電電流",
        `S = ${TEST_VOLTAGE}×${icT}/1000 = ${sT}kVA`,
      ],
      physicallyValid: true,
    };
  },
});
