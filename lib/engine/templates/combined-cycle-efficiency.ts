/**
 * テンプレート: コンバインドサイクルの熱効率（電力・numeric）。
 *   ガスタービン効率 ηG と、その排熱で動く汽力（蒸気タービン）効率 ηS の組合せ:
 *     η = ηG + (1 − ηG)·ηS = ηG + ηS − ηG·ηS   〔小数〕
 *   （排熱 (1−ηG) のうち ηS を回収する、の式変形。過去問頻出の導出）
 */
import { formatClean, isCleanAnswer } from "../clean.js";
import { defineTemplate, pick } from "./helpers.js";

const ETA_G_SET: ReadonlyArray<number> = [20, 22, 24, 25, 26, 28, 30, 32, 33, 34, 35, 36, 38, 40, 42, 45];
const ETA_S_SET: ReadonlyArray<number> = [15, 18, 20, 22, 24, 25, 26, 28, 30, 32, 34, 35, 36, 38, 40, 42, 45];

type Params = {
  eta_gas: number;
  eta_steam: number;
};

export const combinedCycleEfficiency = defineTemplate<Params>({
  topic: "コンバインドサイクルの熱効率",
  subject: "電力",
  exam: "denken2_primary",
  difficulty: 3,
  pastExam: { area: "火力発電", frequency: "high", years: [2009, 2014, 2019, 2024] },
  paramSpecs: {
    eta_gas: { unit: "%", realistic_range: [20, 45] },
    eta_steam: { unit: "%", realistic_range: [15, 45] },
  },
  paramOrder: ["eta_gas", "eta_steam"],
  draw(rng) {
    return {
      eta_gas: pick(ETA_G_SET, rng),
      eta_steam: pick(ETA_S_SET, rng),
    };
  },
  buildFrom({ eta_gas: etaG, eta_steam: etaS }) {
    if (etaG <= 0 || etaG >= 100 || etaS <= 0 || etaS >= 100) return null;
    const eta = etaG + etaS - (etaG * etaS) / 100; // %
    if (eta >= 100 || !isCleanAnswer(eta)) return null;
    const answerText = formatClean(eta);
    return {
      format: "numeric",
      params: {
        eta_gas: { value: etaG, unit: "%", realistic_range: [20, 45] },
        eta_steam: { value: etaS, unit: "%", realistic_range: [15, 45] },
      },
      answerValue: eta,
      answerUnit: "%",
      answerText,
      facts: { etaG, etaS, eta },
      defaultStatement:
        `ガスタービンの熱効率が ${etaG}%、その排熱を利用する蒸気タービン部分の熱効率が ${etaS}% の` +
        `コンバインドサイクル発電の総合熱効率〔%〕は?`,
      defaultSolution: [
        `総合効率 η=ηG+(1−ηG)·ηS（ガスで ηG を回収し、残り排熱 (1−ηG) から ηS を回収）`,
        `=${etaG}% + (1−${formatClean(etaG / 100)})×${etaS}%`,
        `=${answerText}%`,
      ],
      physicallyValid: true,
    };
  },
});
