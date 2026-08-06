/**
 * テンプレート: 同期発電機の電圧変動率（零力率）（機械・同期機・numeric）。
 *   同期インピーダンス法（電機子抵抗無視）で、零力率（遅れ）の負荷では
 *   端子電圧 V と同期リアクタンス降下 xs·I が同相となり、無負荷誘導起電力は算術和:
 *     E0 = V + xs·I   〔p.u.〕（V=1.0 p.u. 基準）
 *   電圧変動率:
 *     ε = (E0 − V)/V × 100 = xs·I × 100   〔%〕
 *   零力率法（ポチェ図の入口）に対応する、単位法計算の頻出パターン。
 */
import { formatClean, isCleanAnswer } from "../clean.js";
import { defineTemplate, pick } from "./helpers.js";

const XS_SET: ReadonlyArray<number> = [0.4, 0.5, 0.6, 0.75, 0.8, 0.9, 1.0, 1.1, 1.25]; // 〔p.u.〕
const I_SET: ReadonlyArray<number> = [0.2, 0.25, 0.4, 0.5, 0.6, 0.8, 1.0]; // 〔p.u.〕

type Params = {
  synchronous_reactance: number;
  load_current: number;
};

export const synchronousVoltageRegulation = defineTemplate<Params>({
  topic: "同期発電機の電圧変動率（零力率）",
  subject: "機械",
  exam: "denken2_primary",
  difficulty: 3,
  pastExam: {
    area: "同期機",
    frequency: "high",
    years: [2009, 2013, 2017, 2021],
    note: "同期インピーダンス法の単位法計算。零力率では xs·I が V と同相で算術和になる",
  },
  paramSpecs: {
    synchronous_reactance: { unit: "p.u.", realistic_range: [0.3, 1.5] },
    load_current: { unit: "p.u.", realistic_range: [0.1, 1] },
  },
  paramOrder: ["synchronous_reactance", "load_current"],
  draw(rng) {
    return { synchronous_reactance: pick(XS_SET, rng), load_current: pick(I_SET, rng) };
  },
  buildFrom({ synchronous_reactance: xs, load_current: current }) {
    if (xs <= 0 || current <= 0 || current > 1) return null;
    const e0 = 1 + xs * current; // 無負荷誘導起電力〔p.u.〕
    const epsilon = xs * current * 100; // 電圧変動率〔%〕
    if (!isCleanAnswer(e0) || !isCleanAnswer(epsilon)) return null;
    const answerText = formatClean(epsilon);
    return {
      format: "numeric",
      params: {
        synchronous_reactance: { value: xs, unit: "p.u.", realistic_range: [0.3, 1.5] },
        load_current: { value: current, unit: "p.u.", realistic_range: [0.1, 1] },
      },
      answerValue: epsilon,
      answerUnit: "%",
      answerText,
      facts: { xs, current, e0, epsilon },
      defaultStatement:
        `同期リアクタンス xs=${formatClean(xs)}p.u.（電機子抵抗は無視）の三相同期発電機が、端子電圧 1.0p.u. で` +
        `零力率（遅れ）の負荷電流 I=${formatClean(current)}p.u. を流している。この運転状態から負荷を遮断したときの` +
        `電圧変動率 ε〔%〕はいくらか。`,
      defaultSolution: [
        `零力率（遅れ）では同期リアクタンス降下 xs·I が端子電圧 V と同相 → E0=V+xs·I の算術和`,
        `E0=1.0+${formatClean(xs)}×${formatClean(current)}=${formatClean(e0)}p.u.`,
        `ε=(E0−V)/V×100=(${formatClean(e0)}−1.0)/1.0×100`,
        `ε=${answerText}%`,
        `ポイント: 力率1の負荷ならベクトル和 E0=√(V²+(xs·I)²) となり変動率は小さくなる。零力率が最も大きい。`,
      ],
      physicallyValid: true,
    };
  },
});
