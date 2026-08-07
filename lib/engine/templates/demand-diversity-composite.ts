/**
 * テンプレート: 需要率・不等率・負荷率の複合（法規B問題・五肢択一）。
 *
 * 本試の法規B問題（施設管理）は「2需要家の設備容量と需要率 → 不等率で合成最大需要電力
 * → さらに総合負荷率」という**連鎖計算**で問われる。既存の需要率/負荷率/不等率テンプレは
 * 1量1式の単発定義問題のため、この連鎖そのものを訓練できない。
 *
 *   各需要家の最大需要電力  Pi   = 設備容量i × 需要率i
 *   合成最大需要電力        Pmax = ΣPi / 不等率          (不等率≧1 ⇒ 割る)
 *   総合負荷率              LF   = 平均需要電力 / Pmax × 100 〔%〕
 *
 * variant=1（総合負荷率）は、答が割り切れるよう「先に LF を決めて平均需要電力を逆算」する。
 * 与件として提示する平均需要電力が綺麗な値にならない draw は棄却する。
 */
import { formatClean, isCleanAnswer } from "../clean.js";
import { buildRoundedMcChoices, defineTemplate, pick } from "./helpers.js";

const CAPACITY_SET = [200, 240, 300, 360, 400, 480, 500, 600];
const DEMAND_SET = [40, 50, 60, 70, 80];
const DIVERSITY_SET = [1.1, 1.2, 1.25, 1.5];
const LOAD_FACTOR_SET = [50, 60, 70, 75, 80];

type Params = {
  capacity_a: number;
  capacity_b: number;
  demand_a: number;
  demand_b: number;
  diversity: number;
  load_factor: number;
  variant: number;
};

export const demandDiversityComposite = defineTemplate<Params>({
  topic: "需要率・不等率・負荷率の複合",
  subject: "法規",
  exam: "denken3",
  difficulty: 3,
  pastExam: {
    area: "電気計算（B問題）",
    frequency: "high",
    years: [2009, 2012, 2016, 2019, 2022, 2024],
  },
  paramSpecs: {
    capacity_a: { unit: "kW", realistic_range: [100, 1000] },
    capacity_b: { unit: "kW", realistic_range: [100, 1000] },
    demand_a: { unit: "%", realistic_range: [20, 100] },
    demand_b: { unit: "%", realistic_range: [20, 100] },
    diversity: { realistic_range: [1, 2] },
    load_factor: { unit: "%", realistic_range: [20, 100] },
    variant: { realistic_range: [0, 1] },
  },
  paramOrder: ["capacity_a", "capacity_b", "demand_a", "demand_b", "diversity", "load_factor", "variant"],
  draw(rng) {
    return {
      capacity_a: pick(CAPACITY_SET, rng),
      capacity_b: pick(CAPACITY_SET, rng),
      demand_a: pick(DEMAND_SET, rng),
      demand_b: pick(DEMAND_SET, rng),
      diversity: pick(DIVERSITY_SET, rng),
      load_factor: pick(LOAD_FACTOR_SET, rng),
      variant: Math.floor(rng() * 2),
    };
  },
  buildFrom(p) {
    const { capacity_a: ca, capacity_b: cb, demand_a: da, demand_b: db, diversity: f, load_factor: lf } = p;
    if (f < 1) return null;
    const pa = (ca * da) / 100;
    const pb = (cb * db) / 100;
    const pmax = (pa + pb) / f;
    if (!Number.isFinite(pmax) || pmax <= 0) return null;
    // 各段の与件・中間値も割り切れること（本試は綺麗な数値で出題される）。
    if (!isCleanAnswer(pa) || !isCleanAnswer(pb) || !isCleanAnswer(pmax)) return null;

    const paT = formatClean(pa);
    const pbT = formatClean(pb);
    const pmaxT = formatClean(pmax);
    const params = {
      capacity_a: { value: ca, unit: "kW", realistic_range: [100, 1000] as [number, number] },
      capacity_b: { value: cb, unit: "kW", realistic_range: [100, 1000] as [number, number] },
      demand_a: { value: da, unit: "%", realistic_range: [20, 100] as [number, number] },
      demand_b: { value: db, unit: "%", realistic_range: [20, 100] as [number, number] },
      diversity: { value: f, realistic_range: [1, 2] as [number, number] },
      load_factor: { value: lf, unit: "%", realistic_range: [20, 100] as [number, number] },
      variant: { value: p.variant, realistic_range: [0, 1] as [number, number] },
    };
    const given =
      `A需要家: 設備容量${ca}kW・需要率${da}%、B需要家: 設備容量${cb}kW・需要率${db}%、` +
      `両需要家間の不等率${f}である。`;

    if (p.variant === 0) {
      // 本試はマークシート五択。誤答は「実際に起きる操作ミス」から導く。
      const mc = buildRoundedMcChoices(
        pmax,
        [
          { value: (pa + pb) * f, reason: "不等率を掛けてしまった（不等率≧1なので割るのが正しい）" },
          { value: pa + pb, reason: "不等率を使わず個々の最大需要電力を単純に合計した" },
          { value: (ca + cb) / f, reason: "需要率を掛け忘れ、設備容量の合計をそのまま使った" },
          { value: Math.max(pa, pb), reason: "合成最大需要電力を大きい方の需要家の値だと誤解した" },
        ],
        formatClean,
      );
      if (!mc) return null;
      return {
        params,
        answerValue: pmax,
        answerUnit: "kW",
        answerText: mc.answerText,
        choices: mc.choices,
        distractors: mc.distractors,
        likelyWrongChoice: formatClean((pa + pb) * f),
        facts: { Pa: pa, Pb: pb, diversity: f, Pmax: pmax },
        defaultStatement: `${given}この2需要家を総括する変電設備からみた合成最大需要電力〔kW〕として、最も近い値を選べ。`,
        defaultSolution: [
          "各需要家の最大需要電力 = 設備容量 × 需要率",
          `A: ${ca}×${da}/100 = ${paT}kW`,
          `B: ${cb}×${db}/100 = ${pbT}kW`,
          "合成最大需要電力 = 個々の最大需要電力の和 ÷ 不等率（不等率≧1なので割る）",
          `Pmax = (${paT}+${pbT})/${f} = ${pmaxT}kW`,
        ],
        physicallyValid: true,
      };
    }

    // variant=1: 総合負荷率。答(lf)が綺麗になるよう平均需要電力を逆算して与件にする。
    const pavg = (pmax * lf) / 100;
    if (!isCleanAnswer(pavg) || pavg <= 0) return null;
    const pavgT = formatClean(pavg);
    const lfT = formatClean(lf);
    const mc = buildRoundedMcChoices(
      lf,
      [
        { value: (pmax / pavg) * 100, reason: "分母と分子を逆にした（負荷率=平均÷最大）" },
        { value: (pavg / (pa + pb)) * 100, reason: "不等率で割らず、個々の最大需要電力の合計を分母にした" },
        { value: (pavg / ((pa + pb) * f)) * 100, reason: "不等率を掛けた合計を分母にした（不等率は割る）" },
        { value: (pavg / (ca + cb)) * 100, reason: "設備容量の合計を分母にした（需要率を反映していない）" },
      ],
      formatClean,
    );
    if (!mc) return null;
    return {
      params,
      answerValue: lf,
      answerUnit: "%",
      answerText: mc.answerText,
      choices: mc.choices,
      distractors: mc.distractors,
      likelyWrongChoice: formatClean((pmax / pavg) * 100),
      facts: { Pmax: pmax, Pavg: pavg, LF: lf },
      defaultStatement:
        `${given}さらに、この総括変電設備の平均需要電力が${pavgT}kWであった。` +
        "総合負荷率〔%〕として、最も近い値を選べ。",
      defaultSolution: [
        "各需要家の最大需要電力 = 設備容量 × 需要率",
        `A: ${ca}×${da}/100 = ${paT}kW、B: ${cb}×${db}/100 = ${pbT}kW`,
        `合成最大需要電力 Pmax = (${paT}+${pbT})/${f} = ${pmaxT}kW`,
        "総合負荷率 = 平均需要電力 ÷ 合成最大需要電力 × 100",
        `LF = ${pavgT}/${pmaxT}×100 = ${lfT}%`,
      ],
      physicallyValid: true,
    };
  },
});
