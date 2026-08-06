/**
 * テンプレート: 並列電源系統の合成パーセントインピーダンス（二種二次・電力管理・descriptive）。
 *   2電源が並列のときの合成  %Z = %Za·%Zb / (%Za + %Zb)
 *   （短絡容量 Ps=Pbase·100/%Z の前段計算で頻出）
 */
import { formatClean, isCleanAnswer } from "../clean.js";
import { defineTemplate, pick } from "./helpers.js";

const PZ_SET: ReadonlyArray<number> = [
  4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 9, 10, 12, 12.5, 13, 14, 15, 16, 18, 19.5, 20,
];

type Params = {
  percent_z_a: number;
  percent_z_b: number;
};

export const parallelPercentImpedance = defineTemplate<Params>({
  topic: "並列電源の合成％インピーダンス",
  subject: "電力管理",
  exam: "denken2_secondary",
  difficulty: 3,
  pastExam: { area: "短絡・故障計算", frequency: "mid", years: [2008, 2014, 2020] },
  paramSpecs: {
    percent_z_a: { unit: "%", realistic_range: [4, 20] },
    percent_z_b: { unit: "%", realistic_range: [4, 20] },
  },
  paramOrder: ["percent_z_a", "percent_z_b"],
  draw(rng) {
    return {
      percent_z_a: pick(PZ_SET, rng),
      percent_z_b: pick(PZ_SET, rng),
    };
  },
  buildFrom({ percent_z_a: za, percent_z_b: zb }) {
    if (za <= 0 || zb <= 0) return null;
    const z = (za * zb) / (za + zb);
    if (!isCleanAnswer(z)) return null;
    const answerText = formatClean(z);
    return {
      format: "descriptive",
      params: {
        percent_z_a: { value: za, unit: "%", realistic_range: [4, 20] },
        percent_z_b: { value: zb, unit: "%", realistic_range: [4, 20] },
      },
      answerValue: z,
      answerUnit: "%",
      answerText,
      facts: { za, zb, z },
      defaultStatement:
        `同一基準容量で %Za=${za}%、%Zb=${zb}% の2電源が母線に並列接続されている。` +
        `母線から見た合成パーセントインピーダンス %Z〔%〕を導出過程とともに求めよ。`,
      defaultSolution: [
        `並列なので %Z=%Za·%Zb/(%Za+%Zb)`,
        `%Z=${za}×${zb}/(${za}+${zb})`,
        `%Z=${answerText}%`,
        `ポイント: この %Z から短絡容量 Ps=P_base×100/%Z が求まる。`,
      ],
      physicallyValid: true,
    };
  },
});
