/**
 * テンプレート: 漏電時の機器の対地電圧（B種・D種接地の分圧）（法規B問題・五肢択一）。
 *
 * 既存 `ground-fault-potential-rise.ts` は Ig×RB（B種接地点の電位上昇）のみ。
 * 本試のB問題は「低圧機器が完全地絡したとき、金属製外箱に現れる対地電圧」を
 * B種接地抵抗 RB と D種接地抵抗 RD の直列分圧で問う（接触電圧の評価）。
 *
 *   地絡電流   Ig = E / (RB + RD)
 *   機器の対地電圧（D種側）  V_D = E・RD/(RB+RD)
 *   B種接地点の電位上昇      V_B = E・RB/(RB+RD)      （V_D + V_B = E）
 *
 * 分圧が割り切れる (RB, RD) の組だけを採用する（isCleanAnswer）。
 */
import { formatClean, isCleanAnswer } from "../clean.js";
import { buildRoundedMcChoices, defineTemplate, pick } from "./helpers.js";

/** 低圧電路の対地電圧〔V〕。 */
const E_SET = [100, 200];
const RB_SET = [5, 10, 15, 20, 25, 30, 40, 50, 60, 75];
const RD_SET = [10, 15, 20, 25, 30, 40, 50, 60, 75, 100, 150, 200, 250, 300, 400, 500];

type Params = {
  source_voltage: number;
  rb: number;
  rd: number;
  variant: number;
};

export const leakageVoltageDivider = defineTemplate<Params>({
  topic: "漏電時の機器の対地電圧",
  subject: "法規",
  exam: "denken3",
  difficulty: 3,
  pastExam: {
    area: "接地工事",
    frequency: "high",
    years: [2011, 2014, 2018, 2020, 2023],
  },
  paramSpecs: {
    source_voltage: { unit: "V", realistic_range: [100, 200] },
    rb: { unit: "ohm", realistic_range: [1, 100] },
    rd: { unit: "ohm", realistic_range: [1, 500] },
    variant: { realistic_range: [0, 1] },
  },
  paramOrder: ["source_voltage", "rb", "rd", "variant"],
  draw(rng) {
    return {
      source_voltage: pick(E_SET, rng),
      rb: pick(RB_SET, rng),
      rd: pick(RD_SET, rng),
      variant: Math.floor(rng() * 2),
    };
  },
  buildFrom(p) {
    const { source_voltage: E, rb: RB, rd: RD } = p;
    const total = RB + RD;
    if (total <= 0) return null;
    const vd = (E * RD) / total;
    const vb = (E * RB) / total;
    // 与件・答えの双方が割り切れる組だけを出題する。
    if (!isCleanAnswer(vd) || !isCleanAnswer(vb)) return null;
    const ig = E / total;
    if (!isCleanAnswer(ig)) return null;

    const params = {
      source_voltage: { value: E, unit: "V", realistic_range: [100, 200] as [number, number] },
      rb: { value: RB, unit: "ohm", realistic_range: [1, 100] as [number, number] },
      rd: { value: RD, unit: "ohm", realistic_range: [1, 500] as [number, number] },
      variant: { value: p.variant, realistic_range: [0, 1] as [number, number] },
    };
    const given =
      `対地電圧${E}V の低圧電路に接続された金属製外箱をもつ機器が、完全地絡（1線地絡）を起こした。` +
      `変圧器の低圧側に施したB種接地工事の抵抗値が${RB}Ω、機器のD種接地工事の抵抗値が${RD}Ωである。`;
    const igT = formatClean(ig);

    if (p.variant === 0) {
      const vdT = formatClean(vd);
      const mc = buildRoundedMcChoices(
        vd,
        [
          { value: vb, reason: "分子に RB を置いた（それはB種接地点の電位上昇）" },
          { value: E, reason: "電源の対地電圧がそのまま外箱に現れると誤解した" },
          { value: ig, reason: "地絡電流〔A〕を電圧として答えた" },
          { value: (E * RD) / RB, reason: "分母を RB+RD ではなく RB とした（直列合成を忘れた）" },
        ],
        formatClean,
      );
      if (!mc) return null;
      return {
        params,
        answerValue: vd,
        answerUnit: "V",
        answerText: mc.answerText,
        choices: mc.choices,
        distractors: mc.distractors,
        likelyWrongChoice: formatClean(vb),
        facts: { E, RB, RD, Ig: ig, Vd: vd },
        defaultStatement: `${given}このとき機器の金属製外箱に現れる対地電圧〔V〕として、最も近い値を選べ。`,
        defaultSolution: [
          "地絡電流は RB と RD の直列回路を流れる",
          `Ig = E/(RB+RD) = ${E}/(${RB}+${RD}) = ${igT}A`,
          "外箱の対地電圧は D種接地抵抗の電圧降下（分圧）",
          `V_D = Ig×RD = E×RD/(RB+RD) = ${E}×${RD}/${total} = ${vdT}V`,
          "（注意: 分子に RB を置くとB種接地点の電位上昇になり、外箱の対地電圧ではない）",
        ],
        physicallyValid: true,
      };
    }

    const vbT = formatClean(vb);
    const mc = buildRoundedMcChoices(
      vb,
      [
        { value: vd, reason: "分子に RD を置いた（それは機器外箱の対地電圧）" },
        { value: E, reason: "電源の対地電圧がそのままB種接地点に現れると誤解した" },
        { value: ig, reason: "地絡電流〔A〕を電圧として答えた" },
        { value: (E * RB) / RD, reason: "分母を RB+RD ではなく RD とした（直列合成を忘れた）" },
      ],
      formatClean,
    );
    if (!mc) return null;
    return {
      params,
      answerValue: vb,
      answerUnit: "V",
      answerText: mc.answerText,
      choices: mc.choices,
      distractors: mc.distractors,
      likelyWrongChoice: formatClean(vd),
      facts: { E, RB, RD, Ig: ig, Vb: vb },
      defaultStatement: `${given}このときB種接地工事を施した接地点の電位上昇〔V〕として、最も近い値を選べ。`,
      defaultSolution: [
        `Ig = E/(RB+RD) = ${E}/(${RB}+${RD}) = ${igT}A`,
        "B種接地点の電位上昇は RB での電圧降下",
        `V_B = Ig×RB = E×RB/(RB+RD) = ${E}×${RB}/${total} = ${vbT}V`,
        `（検算: 機器側の対地電圧 ${formatClean(vd)}V と合計すると電源の対地電圧 ${E}V に一致する）`,
      ],
      physicallyValid: true,
    };
  },
});
