/**
 * テンプレート: オペアンプ反転増幅（理論・電子回路・numeric）。
 *   理想オペアンプ（仮想接地・入力電流0）の反転増幅回路:
 *     Av = −Rf / Ri   →   |Vo| = (Rf/Ri)·|Vi|
 *   （Rf=帰還抵抗, Ri=入力抵抗。出力は入力と逆位相）
 *
 * 典型ミス（解説で言及）:
 *   ・1+Rf/Ri … 非反転増幅の利得と混同
 *   ・Ri/Rf … 帰還抵抗と入力抵抗の取り違え
 *   ・位相反転（負号）の見落とし
 */
import { formatClean, isCleanAnswer } from "../clean.js";
import { defineTemplate, pick } from "./helpers.js";

const RF_SET: ReadonlyArray<number> = [10, 20, 50, 100, 200]; // 〔kΩ〕
const RI_SET: ReadonlyArray<number> = [2, 5, 10, 20, 25]; // 〔kΩ〕
const VI_SET: ReadonlyArray<number> = [0.1, 0.2, 0.5, 1]; // 〔V〕

type Params = {
  feedback_resistance: number;
  input_resistance: number;
  input_voltage: number;
};

export const opAmpInvertingGain = defineTemplate<Params>({
  topic: "オペアンプ反転増幅",
  subject: "理論",
  exam: "denken2_primary",
  difficulty: 2,
  pastExam: {
    area: "電子回路",
    frequency: "mid",
    years: [2010, 2014, 2018, 2022],
    note: "理想オペアンプの仮想接地から利得を導く。非反転増幅（1+Rf/Ri）との対比が頻出",
  },
  paramSpecs: {
    feedback_resistance: { unit: "kohm", realistic_range: [1, 500] },
    input_resistance: { unit: "kohm", realistic_range: [1, 100] },
    input_voltage: { unit: "V", realistic_range: [0.05, 2] },
  },
  paramOrder: ["feedback_resistance", "input_resistance", "input_voltage"],
  draw(rng) {
    return {
      feedback_resistance: pick(RF_SET, rng),
      input_resistance: pick(RI_SET, rng),
      input_voltage: pick(VI_SET, rng),
    };
  },
  buildFrom({ feedback_resistance: rf, input_resistance: ri, input_voltage: vi }) {
    if (rf <= 0 || ri <= 0 || vi <= 0) return null;
    const gain = rf / ri; // 利得の大きさ |Av|
    const vo = gain * vi; // 出力電圧の大きさ〔V〕
    // 増幅器として意味があり（|Av|>1）、電源電圧内で線形動作する範囲に限定する。
    if (gain <= 1 || vo > 13) return null;
    if (!isCleanAnswer(gain) || !isCleanAnswer(vo)) return null;
    const answerText = formatClean(vo);
    return {
      format: "numeric",
      params: {
        feedback_resistance: { value: rf, unit: "kohm", realistic_range: [1, 500] },
        input_resistance: { value: ri, unit: "kohm", realistic_range: [1, 100] },
        input_voltage: { value: vi, unit: "V", realistic_range: [0.05, 2] },
      },
      answerValue: vo,
      answerUnit: "V",
      answerText,
      facts: { rf, ri, vi, gain, vo },
      defaultStatement:
        `理想オペアンプを用いた反転増幅回路で、入力抵抗 Ri=${formatClean(ri)}kΩ、帰還抵抗 Rf=${formatClean(rf)}kΩ である。` +
        `入力電圧 Vi=${formatClean(vi)}V を加えたときの出力電圧の大きさ |Vo|〔V〕はいくらか。`,
      defaultSolution: [
        `反転増幅の電圧利得は Av=−Rf/Ri（仮想接地により入力電流 Vi/Ri がすべて Rf に流れる）`,
        `|Av|=${formatClean(rf)}/${formatClean(ri)}=${formatClean(gain)}倍`,
        `|Vo|=|Av|×Vi=${formatClean(gain)}×${formatClean(vi)}=${answerText}V`,
        `ポイント: 出力は入力と逆位相（負号）。非反転増幅の利得 1+Rf/Ri と混同しない。`,
      ],
      physicallyValid: true,
    };
  },
});
