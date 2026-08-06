/**
 * テンプレート: 損失係数と負荷率（電力管理・二次・numeric）。
 *   配電系統の損失電力量の見積りに使う経験式:
 *     F = α·L + (1−α)·L²  （α=0.3 が代表値。L: 負荷率〔小数〕）
 *   負荷率から損失係数を求める（年間損失電力量の算定の核）。
 *
 * 新規テンプレートはこの形（defineTemplate ファクトリ）を標準とする。
 */
import { formatClean, isCleanAnswer } from "../clean.js";
import { defineTemplate, pick } from "./helpers.js";

const ALPHA = 0.3;
const L_SET: ReadonlyArray<number> = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];

type Params = {
  load_factor: number;
};

export const lossFactor = defineTemplate<Params>({
  topic: "損失係数と負荷率",
  subject: "電力管理",
  exam: "denken2_secondary",
  difficulty: 3,
  pastExam: { area: "配電・需要損失", frequency: "mid", years: [2011, 2017, 2023] },
  paramSpecs: {
    load_factor: { realistic_range: [0.1, 1] },
  },
  paramOrder: ["load_factor"],
  draw(rng) {
    return {
      load_factor: pick(L_SET, rng),
    };
  },
  buildFrom({ load_factor: loadFactor }) {
    if (loadFactor <= 0 || loadFactor > 1) return null;
    const f = (ALPHA * loadFactor + (1 - ALPHA) * loadFactor * loadFactor) * 100; // %
    if (!isCleanAnswer(f)) return null;
    const answerText = formatClean(f);
    return {
      format: "numeric",
      params: {
        load_factor: { value: loadFactor, realistic_range: [0.1, 1] },
      },
      answerValue: f,
      answerUnit: "%",
      answerText,
      facts: { loadFactor, alpha: ALPHA, f },
      defaultStatement:
        `負荷率が ${formatClean(loadFactor)}（=${formatClean(loadFactor * 100)}%）の配電系統について、` +
        `経験式 F=0.3L+0.7L² を用いて損失係数〔%〕を求めよ。`,
      defaultSolution: [
        `損失係数の経験式 F=αL+(1−α)L²（α=0.3）`,
        `=0.3×${formatClean(loadFactor)}+0.7×${formatClean(loadFactor * loadFactor, 4)}`,
        `=${answerText}%`,
      ],
      physicallyValid: true,
    };
  },
});
