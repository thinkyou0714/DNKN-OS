/**
 * テンプレート: Δ結線とY結線の消費電力（理論・三相交流回路・numeric）。
 *   同一の抵抗 R×3個を線間電圧 V の対称三相電源に接続するとき:
 *     Y結線: 相電圧 V/√3 → 全消費電力 P_Y = 3·(V/√3)²/R = V²/R
 *     Δ結線: 相電圧 V     → 全消費電力 P_Δ = 3·V²/R
 *   よって P_Δ = 3·P_Y（Δ⇔Y の繋ぎ替えで消費電力は3倍/(1/3)倍）。
 *   スターデルタ始動の始動電流 1/3 の根拠にもなる、二種一次頻出の基本関係。
 */
import { formatClean, isCleanAnswer } from "../clean.js";
import { defineTemplate, pick } from "./helpers.js";

/** [V(V), R(Ω)] — P_Δ=3V²/R が kW で綺麗になる組。 */
const VR_PAIRS: ReadonlyArray<readonly [number, number]> = [
  [100, 2],
  [100, 4],
  [100, 5],
  [100, 8],
  [100, 10],
  [100, 20],
  [100, 25],
  [100, 40],
  [100, 50],
  [200, 4],
  [200, 5],
  [200, 8],
  [200, 10],
  [200, 16],
  [200, 20],
  [200, 25],
  [200, 32],
  [200, 40],
  [200, 50],
  [400, 8],
  [400, 10],
  [400, 16],
  [400, 20],
  [400, 32],
  [400, 40],
  [400, 50],
  [400, 64],
  [400, 80],
  [400, 100],
];

type Params = {
  line_voltage: number;
  resistance: number;
};

export const deltaWyePowerRatio = defineTemplate<Params>({
  topic: "Δ結線とY結線の消費電力",
  subject: "理論",
  exam: "denken2_primary",
  difficulty: 3,
  pastExam: {
    area: "三相交流回路",
    frequency: "high",
    years: [2008, 2012, 2016, 2020, 2024],
    note: "同一抵抗のΔ/Y繋ぎ替えで電力が3倍/(1/3)倍になる関係。Y-Δ始動の理論的根拠",
  },
  paramSpecs: {
    line_voltage: { unit: "V", realistic_range: [100, 400] },
    resistance: { unit: "Ω", realistic_range: [2, 100] },
  },
  paramOrder: ["line_voltage", "resistance"],
  draw(rng) {
    const [v, r] = pick(VR_PAIRS, rng);
    return { line_voltage: v, resistance: r };
  },
  buildFrom({ line_voltage: V, resistance: R }) {
    if (V <= 0 || R <= 0) return null;
    const pWyeKw = (V * V) / R / 1000; // Y結線の全消費電力〔kW〕
    const pDeltaKw = 3 * pWyeKw; // Δ結線の全消費電力〔kW〕
    if (!isCleanAnswer(pWyeKw) || !isCleanAnswer(pDeltaKw)) return null;
    const answerText = formatClean(pDeltaKw);
    return {
      format: "numeric",
      params: {
        line_voltage: { value: V, unit: "V", realistic_range: [100, 400] },
        resistance: { value: R, unit: "Ω", realistic_range: [2, 100] },
      },
      answerValue: pDeltaKw,
      answerUnit: "kW",
      answerText,
      facts: { V, R, pWyeKw, pDeltaKw },
      defaultStatement:
        `抵抗 R=${formatClean(R)}Ω を3個、線間電圧 V=${formatClean(V)}V の対称三相電源に Y結線で接続したのち、` +
        `同じ3個の抵抗を Δ結線に繋ぎ替えた。Δ結線時の全消費電力 P_Δ〔kW〕はいくらか。`,
      defaultSolution: [
        `Y結線では各相に相電圧 V/√3 が加わる: P_Y=3×(V/√3)²/R=V²/R=${formatClean(pWyeKw)}kW`,
        `Δ結線では各相に線間電圧 V がそのまま加わる: P_Δ=3×V²/R（Y結線の3倍）`,
        `P_Δ=3×${formatClean(V)}²/${formatClean(R)}=${answerText}kW`,
        `ポイント: Δ→Y に繋ぎ替えると電力・電流は 1/3。スターデルタ始動で始動電流が 1/3 になる根拠。`,
      ],
      physicallyValid: true,
    };
  },
});
