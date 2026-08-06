/**
 * テンプレート: 限流リアクトルによる短絡容量の抑制（二種二次・電力管理・descriptive）。
 *   基準容量 Pb=10MV·A、既設系統の %ZS のとき、受電点の短絡容量を Ps_max 以下に
 *   抑えるために直列に挿入すべき限流リアクトルの百分率リアクタンスは
 *     %X = 100·Pb/Ps_max − %ZS 〔%〕
 *   過去問頻出の「短絡容量」を、遮断器の能力から逆算する設計問題にひねった改作。
 */
import { formatClean, isCleanAnswer } from "../clean.js";
import { defineTemplate, pick } from "./helpers.js";

/** 基準容量〔MV·A〕（問題文に明示する定数）。 */
const BASE_MVA = 10;
const ZS_SET: ReadonlyArray<number> = [0.5, 0.625, 0.8, 1, 1.25, 1.5, 2, 2.5, 3, 4, 5];
const PS_SET: ReadonlyArray<number> = [50, 100, 125, 200, 250, 400, 500, 625, 800, 1000];

type Params = {
  source_impedance: number;
  max_fault_mva: number;
};

export const currentLimitingReactor = defineTemplate<Params>({
  topic: "限流リアクトルによる短絡容量抑制",
  subject: "電力管理",
  exam: "denken2_secondary",
  difficulty: 4,
  pastExam: { area: "短絡・故障計算", frequency: "mid", years: [2008, 2014, 2019, 2024] },
  paramSpecs: {
    source_impedance: { unit: "%", realistic_range: [0.5, 5] },
    max_fault_mva: { unit: "MV·A", realistic_range: [50, 1000] },
  },
  paramOrder: ["source_impedance", "max_fault_mva"],
  draw(rng) {
    return {
      source_impedance: pick(ZS_SET, rng),
      max_fault_mva: pick(PS_SET, rng),
    };
  },
  buildFrom({ source_impedance: zs, max_fault_mva: psMax }) {
    if (zs <= 0 || psMax <= 0) return null;
    const neededZ = (100 * BASE_MVA) / psMax; // Ps_max に抑えるのに必要な合計%Z
    const reactorX = neededZ - zs;
    if (reactorX <= 0) return null; // 既に目標以下なら挿入不要（出題不成立）
    if (!isCleanAnswer(neededZ) || !isCleanAnswer(reactorX)) return null;
    const answerText = formatClean(reactorX);
    const needed = formatClean(neededZ);
    return {
      format: "descriptive",
      params: {
        source_impedance: { value: zs, unit: "%", realistic_range: [0.5, 5] },
        max_fault_mva: { value: psMax, unit: "MV·A", realistic_range: [50, 1000] },
      },
      answerValue: reactorX,
      answerUnit: "%",
      answerText,
      facts: { zs, psMax, baseMva: BASE_MVA, neededZ, reactorX },
      defaultStatement:
        `受電点から電源側を見た百分率インピーダンスが 10MV·A 基準で ${zs}% の系統がある。` +
        `受電点の三相短絡容量を、遮断器の定格に合わせて ${psMax}MV·A 以下に抑えたい。` +
        `直列に挿入する限流リアクトルに必要な百分率リアクタンス〔%〕（10MV·A 基準）の最小値を求めよ。`,
      defaultSolution: [
        `着眼点: 短絡容量 Ps=100·Pb/%Z。Ps を目標以下にするには合計 %Z を大きくする。`,
        `必要な合計: %Z≧100×10/${psMax}=${needed}%`,
        `%X=${needed}−${zs}=${answerText}%`,
        `ポイント: 限流リアクトルは短絡容量対策の代表。%X も同じ基準容量に換算して加算する。`,
      ],
      physicallyValid: true,
    };
  },
});
