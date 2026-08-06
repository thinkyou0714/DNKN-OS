/**
 * テンプレート: キルヒホッフの法則（2メッシュ回路）（理論・直流回路・numeric）。
 *
 * 回路: 起電力 E1（内部抵抗 R1）と E2（内部抵抗 R2）の2電源が、
 *   共通の負荷抵抗 R3 を介して並列に接続された2ループ回路。
 *   節点電圧を V とすると、キルヒホッフの電流則(KCL)より
 *     (E1−V)/R1 + (E2−V)/R2 = V/R3
 *   各枝電流:
 *     I1 = (E1−V)/R1,  I2 = (E2−V)/R2,  I3 = V/R3 = I1 + I2
 *   本問は共通枝（負荷 R3）に流れる電流 I3〔A〕を問う。
 *
 * 節点方程式を V について解くと:
 *   V = (E1/R1 + E2/R2) / (1/R1 + 1/R2 + 1/R3)
 *
 * 誤答（成立する典型ミス）:
 *   ① I1 のみ … 共通枝電流を一方の電源電流と取り違え
 *   ② I1−I2  … 和でなく差をとる（向きの誤り）
 *   ③ E1/R1  … 負荷を無視し E1 が R1 だけに流れると誤る
 */
import { formatClean, isCleanAnswer } from "../clean.js";
import { defineTemplate, pick } from "./helpers.js";

// [E1, E2, R1, R2, R3]。両電源電流が正（E1,E2>V）で、I1,I2,I3 がすべて綺麗になる組。
const SETS: ReadonlyArray<readonly [number, number, number, number, number]> = [
  [14, 10, 2, 2, 1],
  [20, 14, 2, 2, 1],
  [24, 12, 3, 3, 1],
  [18, 12, 2, 2, 1],
  [30, 20, 5, 5, 2],
  [16, 10, 2, 2, 1],
  [22, 16, 2, 2, 1],
  [40, 20, 4, 4, 1],
  [26, 14, 3, 3, 1],
  [12, 8, 2, 2, 2],
  [28, 16, 2, 2, 1],
  [24, 18, 3, 3, 2],
  [36, 24, 4, 4, 2],
  [20, 10, 2, 2, 1],
  [44, 28, 4, 4, 2],
  [32, 20, 4, 4, 2],
];

type Params = {
  emf1: number;
  emf2: number;
  R1: number;
  R2: number;
  R3: number;
};

export const kirchhoffTwoMesh = defineTemplate<Params>({
  topic: "キルヒホッフの法則（2メッシュ回路）",
  subject: "理論",
  exam: "denken2_primary",
  difficulty: 3,
  pastExam: { area: "直流回路", frequency: "high", years: [2007, 2012, 2016, 2021] },
  paramSpecs: {
    emf1: { unit: "V", realistic_range: [1, 100] },
    emf2: { unit: "V", realistic_range: [1, 100] },
    R1: { unit: "Ω", realistic_range: [1, 50] },
    R2: { unit: "Ω", realistic_range: [1, 50] },
    R3: { unit: "Ω", realistic_range: [1, 50] },
  },
  paramOrder: ["emf1", "emf2", "R1", "R2", "R3"],
  draw(rng) {
    const [e1, e2, r1, r2, r3] = pick(SETS, rng);
    return { emf1: e1, emf2: e2, R1: r1, R2: r2, R3: r3 };
  },
  buildFrom({ emf1: E1, emf2: E2, R1, R2, R3 }) {
    if (E1 <= 0 || E2 <= 0 || R1 <= 0 || R2 <= 0 || R3 <= 0) return null;
    // 節点電圧 V（ミルマンの定理 = KCL を解いた形）。
    const V = (E1 / R1 + E2 / R2) / (1 / R1 + 1 / R2 + 1 / R3);
    const I1 = (E1 - V) / R1;
    const I2 = (E2 - V) / R2;
    const I3 = V / R3; // 共通枝（負荷）電流 = 正解
    // 両電源とも負荷へ電流を流す（吸い込みでない）構成に限定する。
    if (I1 <= 0 || I2 <= 0 || I3 <= 0) return null;
    // 正解・主要誤答がすべて綺麗で相互に重複しないこと。
    const wrongOnlyI1 = I1;
    const wrongDiff = Math.abs(I1 - I2);
    const wrongNoLoad = E1 / R1;
    if (![V, I1, I2, I3, wrongDiff, wrongNoLoad].every((x) => isCleanAnswer(x))) return null;

    const answerText = formatClean(I3);
    return {
      format: "numeric",
      params: {
        emf1: { value: E1, unit: "V", realistic_range: [1, 100] },
        emf2: { value: E2, unit: "V", realistic_range: [1, 100] },
        R1: { value: R1, unit: "Ω", realistic_range: [1, 50] },
        R2: { value: R2, unit: "Ω", realistic_range: [1, 50] },
        R3: { value: R3, unit: "Ω", realistic_range: [1, 50] },
      },
      answerValue: I3,
      answerUnit: "A",
      answerText,
      facts: { E1, E2, R1, R2, R3, V, I1, I2, I3, wrongOnlyI1, wrongDiff, wrongNoLoad },
      defaultStatement:
        `起電力 E1=${E1}V（内部抵抗 R1=${R1}Ω）と E2=${E2}V（内部抵抗 R2=${R2}Ω）の2電源が、` +
        `共通の負荷抵抗 R3=${R3}Ω を介して並列に接続されている。負荷 R3 に流れる電流 I3〔A〕を、` +
        `キルヒホッフの法則を用いて求めよ。`,
      defaultSolution: [
        `負荷両端の電圧を V とおき、キルヒホッフの電流則(KCL)で連立式を立てる:`,
        `枝電流 I1=(E1−V)/R1、I2=(E2−V)/R2、I3=V/R3、かつ I1+I2=I3`,
        `(E1−V)/R1+(E2−V)/R2=V/R3 … ① を V について解く`,
        `V=(E1/R1+E2/R2)/(1/R1+1/R2+1/R3)=(${E1}/${R1}+${E2}/${R2})/(1/${R1}+1/${R2}+1/${R3})=${formatClean(V)}V`,
        `I3=V/R3=${formatClean(V)}/${R3}`,
        `I3=${answerText}A`,
        `（検算: I1=${formatClean(I1)}A、I2=${formatClean(I2)}A、I1+I2=${formatClean(I1 + I2)}A=I3）`,
      ],
      physicallyValid: true,
    };
  },
});
