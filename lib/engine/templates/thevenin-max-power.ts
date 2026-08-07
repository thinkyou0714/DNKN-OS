/**
 * テンプレート: テブナンの等価回路と最大電力（理論B問題・(a)(b)連問）。
 *
 * 本試の理論B問題は「(a)で等価回路を求め、(b)でその結果を使って別の量を出す」連鎖型。
 * 既存の `thevenin.ts` は等価電源を求めるところで終わるため、
 * 「(a)→(b) を続けて解く」練習ができなかった。
 *
 *   (a) 端子から見た開放電圧 V0 と等価内部抵抗 R0
 *   (b) 負荷 RL を接続したとき、RL で消費される電力が最大になる条件と、そのときの最大電力
 *       最大電力の条件: RL = R0、そのとき P_max = V0² / (4·R0)
 *
 * 分圧で V0 が割り切れ、P_max も綺麗になる組だけを採用する。
 */
import { formatClean, isCleanAnswer } from "../clean.js";
import { buildRoundedMcChoices, defineTemplate, pick } from "./helpers.js";

/** 電源電圧〔V〕。 */
const E_SET = [12, 18, 20, 24, 30, 36, 40, 48, 60, 100];
/** 分圧を作る2抵抗〔Ω〕。 */
const R1_SET = [2, 3, 4, 5, 6, 8, 10, 12, 15, 20];
const R2_SET = [2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 30, 40];

type Params = {
  emf: number;
  r1: number;
  r2: number;
  variant: number;
};

export const theveninMaxPower = defineTemplate<Params>({
  topic: "テブナンの定理と最大電力",
  subject: "理論",
  exam: "denken3",
  difficulty: 3,
  pastExam: {
    area: "直流回路",
    frequency: "high",
    years: [2009, 2013, 2016, 2020, 2023],
  },
  paramSpecs: {
    emf: { unit: "V", realistic_range: [10, 200] },
    r1: { unit: "ohm", realistic_range: [1, 50] },
    r2: { unit: "ohm", realistic_range: [1, 50] },
    variant: { realistic_range: [0, 1] },
  },
  paramOrder: ["emf", "r1", "r2", "variant"],
  draw(rng) {
    return {
      emf: pick(E_SET, rng),
      r1: pick(R1_SET, rng),
      r2: pick(R2_SET, rng),
      variant: Math.floor(rng() * 2),
    };
  },
  buildFrom(p) {
    const { emf: E, r1: R1, r2: R2 } = p;
    // 開放電圧は R2 側の分圧、内部抵抗は R1∥R2。
    const v0 = (E * R2) / (R1 + R2);
    const r0 = (R1 * R2) / (R1 + R2);
    if (!isCleanAnswer(v0) || !isCleanAnswer(r0) || r0 <= 0) return null;

    const params = {
      emf: { value: E, unit: "V", realistic_range: [10, 200] as [number, number] },
      r1: { value: R1, unit: "ohm", realistic_range: [1, 50] as [number, number] },
      r2: { value: R2, unit: "ohm", realistic_range: [1, 50] as [number, number] },
      variant: { value: p.variant, realistic_range: [0, 1] as [number, number] },
    };
    const v0T = formatClean(v0);
    const r0T = formatClean(r0);
    const given =
      `起電力${E}V の直流電源に抵抗 R1=${R1}Ω と R2=${R2}Ω を直列に接続し、` +
      `R2 の両端を出力端子 a-b とした回路がある。`;

    if (p.variant === 0) {
      // (a) 等価内部抵抗を問う（開放電圧は(b)の与件として使う）。
      const mc = buildRoundedMcChoices(
        r0,
        [
          { value: R1 + R2, reason: "内部抵抗を直列合成とした（電源を短絡すると並列になる）" },
          { value: R1, reason: "R1 だけを内部抵抗とした（R2 との並列を忘れた）" },
          { value: R2, reason: "R2 だけを内部抵抗とした（R1 との並列を忘れた）" },
          { value: r0 * 2, reason: "並列合成を2倍にした（計算のとり違え）" },
        ],
        formatClean,
      );
      if (!mc) return null;
      return {
        params,
        answerValue: r0,
        answerUnit: "Ω",
        answerText: mc.answerText,
        choices: mc.choices,
        distractors: mc.distractors,
        likelyWrongChoice: formatClean(R1 + R2),
        facts: { E, R1, R2, V0: v0, R0: r0 },
        defaultStatement: `${given}端子 a-b から見たテブナンの等価内部抵抗 R0〔Ω〕として、最も近い値を選べ。`,
        defaultSolution: [
          "テブナンの等価内部抵抗は、電源を短絡して端子から見た合成抵抗",
          `電源を短絡すると R1 と R2 の並列になる: R0 = R1·R2/(R1+R2)`,
          `R0 = ${R1}×${R2}/(${R1}+${R2}) = ${r0T}Ω`,
          `（参考: 開放電圧は V0 = E·R2/(R1+R2) = ${v0T}V）`,
        ],
        physicallyValid: true,
      };
    }

    // (b) 最大電力。RL = R0 のとき P_max = V0²/(4·R0)。
    const pmax = (v0 * v0) / (4 * r0);
    if (!isCleanAnswer(pmax) || pmax <= 0) return null;
    const pmaxT = formatClean(pmax);
    const mc = buildRoundedMcChoices(
      pmax,
      [
        { value: (v0 * v0) / r0, reason: "分母の係数4を落とした（P=V0²/R0 としてしまった）" },
        { value: (v0 * v0) / (2 * r0), reason: "分母の係数を4でなく2とした" },
        { value: v0 / (4 * r0), reason: "V0 を2乗し忘れた" },
        { value: (v0 * v0) / (4 * r0) / 2, reason: "さらに半分にした（½ の重複適用）" },
      ],
      formatClean,
    );
    if (!mc) return null;
    return {
      params,
      answerValue: pmax,
      answerUnit: "W",
      answerText: mc.answerText,
      choices: mc.choices,
      distractors: mc.distractors,
      likelyWrongChoice: formatClean((v0 * v0) / r0),
      facts: { E, R1, R2, V0: v0, R0: r0, Pmax: pmax },
      defaultStatement:
        `${given}(a) より端子 a-b の開放電圧は${v0T}V、等価内部抵抗は${r0T}Ω である。` +
        "端子 a-b に可変抵抗 RL を接続したとき、RL で消費される電力の最大値〔W〕として、最も近い値を選べ。",
      defaultSolution: [
        "最大電力を取り出す条件は RL = R0（整合条件）",
        `このとき RL の電圧は V0 の半分になるので P_max = (V0/2)²/R0 = V0²/(4·R0)`,
        `P_max = ${v0T}²/(4×${r0T}) = ${pmaxT}W`,
      ],
      physicallyValid: true,
    };
  },
});
