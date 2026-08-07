/**
 * テンプレート: 三相誘導電動機のすべりとトルク（機械B問題・(a)(b)連問）。
 *
 * 本試の機械B問題の定番。(a) ですべりを求め、(b) でそのすべりから出力・トルクへ進む。
 * 既存の `induction-motor-speed.ts` は同期速度・すべりの単発計算で終わるため、
 * 「すべり → 二次入力 → 出力 → トルク」の連鎖が練習できなかった。
 *
 *   同期速度   Ns = 120·f / p 〔min⁻¹〕
 *   すべり     s = (Ns − N) / Ns
 *   二次入力   P2 = 二次銅損 / s（または 出力 / (1−s)）
 *   トルク     T = P_out / ω = P_out·60 / (2π·N) 〔N·m〕
 *
 * 極数と回転速度は、すべりが割り切れる組だけを採用する。
 */
import { formatClean, isCleanAnswer } from "../clean.js";
import { buildRoundedMcChoices, defineTemplate, pick } from "./helpers.js";

const FREQ_SET = [50, 60];
/** 極数（偶数）。 */
const POLE_SET = [2, 4, 6, 8];
/** すべり〔%〕。本試で使われる範囲。 */
const SLIP_SET = [2, 2.5, 3, 4, 5, 6];
/** 定格出力〔kW〕。 */
const OUTPUT_SET = [3.7, 5.5, 7.5, 11, 15, 18.5, 22, 30, 37, 45, 55, 75];

type Params = {
  frequency: number;
  poles: number;
  slip_percent: number;
  output_kw: number;
  variant: number;
};

export const inductionSlipTorque = defineTemplate<Params>({
  topic: "誘導電動機のすべりとトルク",
  subject: "機械",
  exam: "denken3",
  difficulty: 3,
  pastExam: {
    area: "誘導機",
    frequency: "high",
    years: [2009, 2012, 2016, 2019, 2023],
  },
  paramSpecs: {
    frequency: { unit: "Hz", realistic_range: [50, 60] },
    poles: { realistic_range: [2, 8] },
    slip_percent: { unit: "%", realistic_range: [1, 10] },
    output_kw: { unit: "kW", realistic_range: [1, 100] },
    variant: { realistic_range: [0, 1] },
  },
  paramOrder: ["frequency", "poles", "slip_percent", "output_kw", "variant"],
  draw(rng) {
    return {
      frequency: pick(FREQ_SET, rng),
      poles: pick(POLE_SET, rng),
      slip_percent: pick(SLIP_SET, rng),
      output_kw: pick(OUTPUT_SET, rng),
      variant: Math.floor(rng() * 2),
    };
  },
  buildFrom(p) {
    const { frequency: f, poles: pole, slip_percent: sPct, output_kw: Pout } = p;
    const ns = (120 * f) / pole;
    const s = sPct / 100;
    const n = ns * (1 - s);
    if (!isCleanAnswer(ns) || !isCleanAnswer(n)) return null;

    const params = {
      frequency: { value: f, unit: "Hz", realistic_range: [50, 60] as [number, number] },
      poles: { value: pole, realistic_range: [2, 8] as [number, number] },
      slip_percent: { value: sPct, unit: "%", realistic_range: [1, 10] as [number, number] },
      output_kw: { value: Pout, unit: "kW", realistic_range: [1, 100] as [number, number] },
      variant: { value: p.variant, realistic_range: [0, 1] as [number, number] },
    };
    const nsT = formatClean(ns);
    const nT = formatClean(n);
    const given = `極数${pole}・周波数${f}Hz の三相誘導電動機が、回転速度${nT}min⁻¹ で運転している。`;

    if (p.variant === 0) {
      // (a) すべり〔%〕。
      const mc = buildRoundedMcChoices(
        sPct,
        [
          // N/Ns×100 は 100−sPct と数学的に同値なので、片方だけを使う（重複すると5択が作れない）。
          { value: 100 - sPct, reason: "N/Ns を答えた（すべりはその余事象 (Ns−N)/Ns）" },
          { value: ((ns - n) / n) * 100, reason: "分母を Ns でなく N とした" },
          { value: sPct * 2, reason: "すべりを2倍にした（計算のとり違え）" },
          { value: sPct / 2, reason: "すべりを半分にした（計算のとり違え）" },
        ],
        formatClean,
      );
      if (!mc) return null;
      return {
        params,
        answerValue: sPct,
        answerUnit: "%",
        answerText: mc.answerText,
        choices: mc.choices,
        distractors: mc.distractors,
        likelyWrongChoice: formatClean(100 - sPct),
        facts: { f, pole, Ns: ns, N: n, s: sPct },
        defaultStatement: `${given}この電動機のすべり〔%〕として、最も近い値を選べ。`,
        defaultSolution: [
          "同期速度 Ns = 120·f / 極数",
          `Ns = 120×${f}/${pole} = ${nsT}min⁻¹`,
          "すべり s = (Ns − N)/Ns × 100",
          `s = (${nsT} − ${nT})/${nsT}×100 = ${formatClean(sPct)}%`,
        ],
        physicallyValid: true,
      };
    }

    // (b) 全負荷トルク T = P_out·60/(2π·N)。
    const torque = (Pout * 1000 * 60) / (2 * Math.PI * n);
    if (!Number.isFinite(torque) || torque <= 0) return null;
    const tT = formatClean(torque);
    const mc = buildRoundedMcChoices(
      torque,
      [
        { value: (Pout * 1000 * 60) / (2 * Math.PI * ns), reason: "同期速度で割った（トルクは実回転速度で計算する）" },
        { value: (Pout * 1000) / (2 * Math.PI * n), reason: "min⁻¹ → rad/s の 60 を掛け忘れた" },
        { value: (Pout * 60) / (2 * Math.PI * n), reason: "kW を W に直し忘れた" },
        { value: (Pout * 1000 * 60) / (Math.PI * n), reason: "角速度の係数 2 を落とした" },
      ],
      formatClean,
    );
    if (!mc) return null;
    return {
      params,
      answerValue: torque,
      answerUnit: "N·m",
      answerText: mc.answerText,
      choices: mc.choices,
      distractors: mc.distractors,
      likelyWrongChoice: formatClean((Pout * 1000 * 60) / (2 * Math.PI * ns)),
      facts: { f, pole, Ns: ns, N: n, s: sPct, Pout, T: torque },
      defaultStatement:
        `${given}(a) よりすべりは${formatClean(sPct)}% である。` +
        `この電動機の出力が${Pout}kW のとき、軸トルク〔N·m〕として最も近い値を選べ。`,
      defaultSolution: [
        "トルク T = 出力 / 角速度ω、ω = 2π·N/60",
        `ω = 2π×${nT}/60 = ${formatClean((2 * Math.PI * n) / 60)}rad/s`,
        `T = ${Pout}×10³/${formatClean((2 * Math.PI * n) / 60)} = ${tT}N·m`,
      ],
      physicallyValid: true,
    };
  },
});
