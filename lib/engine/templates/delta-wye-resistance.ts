/**
 * テンプレート: Δ-Y変換（理論・numeric）。
 *   平衡三相の Δ→Y 等価変換。各辺の抵抗が等しい平衡 Δ では、
 *     R_Y = R_Δ / 3
 *   （一般式 R_Y = R_a·R_b/(R_a+R_b+R_c) を平衡 R_Δ で簡約した形）。
 *
 * 典型ミス（解説で言及）:
 *   ・R_Y=3R_Δ … Y→Δ（×3）と取り違える
 *   ・R_Y=R_Δ/2 … 分母を相数ではなく 2 にする
 */
import { formatClean, isCleanAnswer } from "../clean.js";
import { defineTemplate, pick } from "./helpers.js";

// 3の倍数（Y換算 R/3 が綺麗になる）を [3,90] の全域から採る。
const DELTA_SET: ReadonlyArray<number> = [
  3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36, 39, 42, 45, 48, 51, 54, 57, 60, 63, 66, 69, 72, 75, 78, 81, 84, 87, 90,
]; // 〔Ω〕

type Params = {
  delta_resistance: number;
};

export const deltaWyeResistance = defineTemplate<Params>({
  topic: "Δ-Y変換",
  subject: "理論",
  exam: "denken2_primary",
  difficulty: 2,
  pastExam: {
    area: "直流回路",
    frequency: "mid",
    years: [2011, 2016, 2021],
    note: "平衡三相のΔ→Y等価変換。各相 R_Y=R_Δ/3",
  },
  paramSpecs: {
    delta_resistance: { unit: "Ω", realistic_range: [3, 90] },
  },
  paramOrder: ["delta_resistance"],
  draw(rng) {
    return {
      delta_resistance: pick(DELTA_SET, rng),
    };
  },
  buildFrom({ delta_resistance: deltaR }) {
    if (deltaR <= 0) return null;
    const wyeR = deltaR / 3; // Y結線等価の各相抵抗〔Ω〕
    if (!isCleanAnswer(wyeR)) return null;
    const answerText = formatClean(wyeR);
    return {
      format: "numeric",
      params: {
        delta_resistance: { value: deltaR, unit: "Ω", realistic_range: [3, 90] },
      },
      answerValue: wyeR,
      answerUnit: "Ω",
      answerText,
      facts: { deltaR, wyeR },
      defaultStatement:
        `各辺の抵抗が等しい平衡 Δ（三角）結線（各辺 R_Δ=${formatClean(deltaR)}Ω）を、` +
        `等価な Y（星形）結線に変換したとき、Y結線の各相抵抗 R_Y〔Ω〕は?`,
      defaultSolution: [`平衡 Δ→Y 変換は各相 R_Y=R_Δ/3`, `R_Y=${formatClean(deltaR)}/3`, `R_Y=${answerText}Ω`],
      physicallyValid: true,
    };
  },
});
