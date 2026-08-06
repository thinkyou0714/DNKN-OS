/**
 * テンプレート: 始動時に最大トルクを得る二次挿入抵抗（二種二次・機械制御・descriptive）。
 *   最大トルクを生じる滑りが smT の巻線形誘導電動機で、比例推移により
 *   始動時（s=1）に最大トルクを得るには
 *     (r2+R)/1 = r2/smT  ⇒  R = r2·(1−smT)/smT 〔Ω〕
 *   過去問頻出の「比例推移」を、始動条件（s=1）に固定してひねった改作。
 */
import { formatClean, isCleanAnswer } from "../clean.js";
import { defineTemplate, pick } from "./helpers.js";

const R2_SET: ReadonlyArray<number> = [
  0.02, 0.03, 0.04, 0.05, 0.06, 0.08, 0.1, 0.12, 0.15, 0.16, 0.2, 0.25, 0.3, 0.4, 0.5,
];
const SMT_SET: ReadonlyArray<number> = [0.05, 0.1, 0.125, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6];

type Params = {
  secondary_resistance: number;
  max_torque_slip: number;
};

export const maxTorqueStartResistance = defineTemplate<Params>({
  topic: "始動時最大トルクの二次挿入抵抗",
  subject: "機械制御",
  exam: "denken2_secondary",
  difficulty: 4,
  pastExam: { area: "回転機の制御", frequency: "high", years: [2010, 2014, 2018, 2023] },
  paramSpecs: {
    secondary_resistance: { unit: "Ω", realistic_range: [0.02, 1] },
    max_torque_slip: { unit: "", realistic_range: [0.05, 0.6] },
  },
  paramOrder: ["secondary_resistance", "max_torque_slip"],
  draw(rng) {
    return {
      secondary_resistance: pick(R2_SET, rng),
      max_torque_slip: pick(SMT_SET, rng),
    };
  },
  buildFrom({ secondary_resistance: r2, max_torque_slip: smt }) {
    if (r2 <= 0) return null;
    if (smt <= 0 || smt >= 1) return null;
    const insert = (r2 * (1 - smt)) / smt;
    if (insert <= 0 || !isCleanAnswer(insert)) return null;
    const answerText = formatClean(insert);
    return {
      format: "descriptive",
      params: {
        secondary_resistance: { value: r2, unit: "Ω", realistic_range: [0.02, 1] },
        max_torque_slip: { value: smt, unit: "", realistic_range: [0.05, 0.6] },
      },
      answerValue: insert,
      answerUnit: "Ω",
      answerText,
      facts: { r2, smt, insert },
      defaultStatement:
        `巻線形三相誘導電動機の二次巻線抵抗は1相当たり ${r2}Ω で、最大トルクを生じる滑りは ` +
        `${smt} である。比例推移を利用して始動時（滑り1）に最大トルクを発生させるために、` +
        `二次回路へ1相当たり直列に挿入すべき抵抗 R〔Ω〕を求めよ。`,
      defaultSolution: [
        `着眼点: 最大トルクを生じる滑りは二次回路抵抗に比例する（比例推移）。始動は s=1。`,
        `(r2+R)/1=r2/smT`,
        `R=r2·(1−smT)/smT=${r2}×(1−${formatClean(smt, 3)})/${formatClean(smt, 3)}`,
        `R=${answerText}Ω`,
        `ポイント: 最大トルクの大きさ自体は変わらない。変わるのは「それが現れる滑り」。`,
      ],
      physicallyValid: true,
    };
  },
});
