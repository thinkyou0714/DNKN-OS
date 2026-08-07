/**
 * テンプレート: 並行運転発電機間の循環電流（二種二次・機械制御・descriptive）。
 *   並行運転中の2台の同期発電機に起電力差 ΔE（同相・大きさの差）があると、
 *   両機の同期リアクタンス Xs を通って無効循環電流
 *     Ic = ΔE / (2·Xs) 〔A〕
 *   が流れる。過去問頻出の「同期発電機の並行運転」を、循環電流の計算にひねった改作。
 */
import { formatClean, isCleanAnswer } from "../clean.js";
import { defineTemplate, pick } from "./helpers.js";

const DE_SET: ReadonlyArray<number> = [
  50, 60, 70, 80, 90, 100, 120, 150, 180, 200, 240, 250, 300, 360, 400, 450, 500, 600, 750, 800, 900, 1000,
];
const XS_SET: ReadonlyArray<number> = [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 7.5, 8, 10];

type Params = {
  emf_difference: number;
  synchronous_reactance: number;
};

export const synchronizingCurrent = defineTemplate<Params>({
  topic: "並行運転発電機の循環電流",
  subject: "機械制御",
  exam: "denken2_secondary",
  difficulty: 4,
  pastExam: { area: "回転機の制御", frequency: "mid", years: [2011, 2017, 2022] },
  paramSpecs: {
    emf_difference: { unit: "V", realistic_range: [50, 1000] },
    synchronous_reactance: { unit: "Ω", realistic_range: [1, 10] },
  },
  paramOrder: ["emf_difference", "synchronous_reactance"],
  draw(rng) {
    return {
      emf_difference: pick(DE_SET, rng),
      synchronous_reactance: pick(XS_SET, rng),
    };
  },
  buildFrom({ emf_difference: de, synchronous_reactance: xs }) {
    if (de <= 0 || xs <= 0) return null;
    const current = de / (2 * xs);
    if (current <= 0 || !isCleanAnswer(current)) return null;
    const answerText = formatClean(current);
    return {
      format: "descriptive",
      params: {
        emf_difference: { value: de, unit: "V", realistic_range: [50, 1000] },
        synchronous_reactance: { value: xs, unit: "Ω", realistic_range: [1, 10] },
      },
      answerValue: current,
      answerUnit: "A",
      answerText,
      facts: { de, xs, current },
      defaultStatement:
        `同一定格の三相同期発電機2台が並行運転している。一方の界磁を強めたため、両機の` +
        `1相当たりの起電力に同相で ${de}V の大きさの差が生じた。各機の1相当たりの同期リアクタンスを` +
        `${xs}Ω、電機子抵抗を無視できるものとして、両機間を流れる循環電流〔A〕を求めよ。`,
      defaultSolution: [
        `着眼点: 起電力差 ΔE が2台分の同期リアクタンス（直列で 2Xs）に加わる閉回路を考える。`,
        `Ic=ΔE/(2Xs)=${de}/(2×${formatClean(xs)})`,
        `Ic=${answerText}A`,
        `ポイント: 同相の起電力差による循環電流はほぼ無効電流で、無効電力の分担だけを変える。有効分担を変えるのは原動機入力（位相差）。`,
      ],
      physicallyValid: true,
    };
  },
});
