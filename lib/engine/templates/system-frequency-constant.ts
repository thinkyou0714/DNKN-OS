/**
 * テンプレート: 系統周波数特性定数と周波数低下（二種二次・電力管理・descriptive）。
 *   系統容量 Ps〔MW〕・系統周波数特性定数 K〔%MW/Hz〕の系統で電源 ΔP〔MW〕が脱落すると
 *     ΔP% = ΔP/Ps×100、Δf = ΔP% / K 〔Hz〕
 *   過去問頻出の「系統周波数制御」を、電源脱落時の周波数低下量にひねった改作。
 */
import { formatClean, isCleanAnswer } from "../clean.js";
import { defineTemplate, pick } from "./helpers.js";

const PS_SET: ReadonlyArray<number> = [
  3000, 4000, 5000, 6000, 8000, 10000, 12000, 15000, 20000, 25000, 30000, 40000, 50000,
];
const K_SET: ReadonlyArray<number> = [5, 6, 7.5, 8, 10, 12, 12.5, 15];
const DP_SET: ReadonlyArray<number> = [100, 150, 200, 250, 300, 400, 450, 500, 600, 750, 800, 900, 1000, 1200, 1500];

type Params = {
  system_capacity: number;
  frequency_constant: number;
  lost_power: number;
};

export const systemFrequencyConstant = defineTemplate<Params>({
  topic: "系統周波数特性定数と周波数低下",
  subject: "電力管理",
  exam: "denken2_secondary",
  difficulty: 5,
  pastExam: { area: "送電・系統安定度", frequency: "mid", years: [2009, 2014, 2020, 2025] },
  paramSpecs: {
    system_capacity: { unit: "MW", realistic_range: [3000, 50000] },
    frequency_constant: { unit: "%MW/Hz", realistic_range: [5, 15] },
    lost_power: { unit: "MW", realistic_range: [100, 1500] },
  },
  paramOrder: ["system_capacity", "frequency_constant", "lost_power"],
  draw(rng) {
    return {
      system_capacity: pick(PS_SET, rng),
      frequency_constant: pick(K_SET, rng),
      lost_power: pick(DP_SET, rng),
    };
  },
  buildFrom({ system_capacity: ps, frequency_constant: k, lost_power: dp }) {
    if (ps <= 0 || k <= 0 || dp <= 0) return null;
    if (dp >= ps) return null;
    const dpPercent = (dp / ps) * 100;
    const deltaF = dpPercent / k;
    // 現実的な周波数低下（〜1Hz 程度まで）の綺麗な値のみ採用。
    if (deltaF <= 0 || deltaF > 1 || !isCleanAnswer(dpPercent) || !isCleanAnswer(deltaF)) return null;
    const answerText = formatClean(deltaF);
    const dpp = formatClean(dpPercent);
    return {
      format: "descriptive",
      params: {
        system_capacity: { value: ps, unit: "MW", realistic_range: [3000, 50000] },
        frequency_constant: { value: k, unit: "%MW/Hz", realistic_range: [5, 15] },
        lost_power: { value: dp, unit: "MW", realistic_range: [100, 1500] },
      },
      answerValue: deltaF,
      answerUnit: "Hz",
      answerText,
      facts: { ps, k, dp, dpPercent, deltaF },
      defaultStatement:
        `系統容量 ${ps}MW、系統周波数特性定数 ${k}%MW/Hz の電力系統で、出力 ${dp}MW の電源が` +
        `脱落した。負荷の周波数特性とガバナ応答が落ち着いた後の周波数低下量 Δf〔Hz〕を求めよ。`,
      defaultSolution: [
        `着眼点: 特性定数 K は「周波数1Hzの変化で系統容量の何%の需給が動くか」。まず脱落量を%に直す。`,
        `脱落量: ΔP%=${dp}/${ps}×100=${dpp}%`,
        `Δf=ΔP%/K=${dpp}/${k}=${answerText}Hz`,
        `ポイント: MW のまま K〔%MW/Hz〕で割らない。基準（系統容量）に対する%へ換算してから使う。`,
      ],
      physicallyValid: true,
    };
  },
});
