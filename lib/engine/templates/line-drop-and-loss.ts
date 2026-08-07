/**
 * テンプレート: 三相送電線の電圧降下と電力損失（電力B問題・(a)(b)連問）。
 *
 * 本試の電力B問題の定番。(a) で線電流と電圧降下を出し、(b) でその電流を使って
 * 電力損失を求める、という同じ電流を二度使う連鎖構造になっている。
 *
 *   線電流       I = P / (√3 · V · cosθ)
 *   電圧降下     ΔV = √3 · I · (R·cosθ + X·sinθ)
 *   電力損失     P_loss = 3 · I² · R
 *
 * cosθ はピタゴラス比（0.6/0.8）に限り、I が割り切れる組だけを採用する。
 */
import { formatClean, isCleanAnswer } from "../clean.js";
import { buildRoundedMcChoices, defineTemplate, pick } from "./helpers.js";

/** 受電端の三相電力〔kW〕。 */
const P_SET = [300, 400, 500, 600, 800, 1000, 1200, 1500, 2000];
/** 受電端線間電圧〔V〕。配電の代表値。 */
const V_SET = [3300, 6600];
/** 1線あたりの抵抗・リアクタンス〔Ω〕。 */
const R_SET = [0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 1.0, 1.2];
const X_SET = [0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 1.0];
/** 力率（遅れ）。tanθ が有理数になるピタゴラス比のみ。 */
const PF_SET = [
  { cos: 0.6, sin: 0.8 },
  { cos: 0.8, sin: 0.6 },
  { cos: 1.0, sin: 0 },
];

type Params = {
  power: number;
  voltage: number;
  resistance: number;
  reactance: number;
  pf_index: number;
  variant: number;
};

export const lineDropAndLoss = defineTemplate<Params>({
  topic: "送電線の電圧降下と電力損失",
  subject: "電力",
  exam: "denken3",
  difficulty: 3,
  pastExam: {
    area: "配電・需要計算",
    frequency: "high",
    years: [2008, 2012, 2015, 2019, 2022, 2025],
  },
  paramSpecs: {
    power: { unit: "kW", realistic_range: [100, 3000] },
    voltage: { unit: "V", realistic_range: [3300, 6600] },
    resistance: { unit: "ohm", realistic_range: [0.1, 2] },
    reactance: { unit: "ohm", realistic_range: [0.1, 2] },
    pf_index: { realistic_range: [0, PF_SET.length - 1] },
    variant: { realistic_range: [0, 1] },
  },
  paramOrder: ["power", "voltage", "resistance", "reactance", "pf_index", "variant"],
  draw(rng) {
    return {
      power: pick(P_SET, rng),
      voltage: pick(V_SET, rng),
      resistance: pick(R_SET, rng),
      reactance: pick(X_SET, rng),
      pf_index: Math.floor(rng() * PF_SET.length),
      variant: Math.floor(rng() * 2),
    };
  },
  buildFrom(p) {
    const pf = PF_SET[p.pf_index];
    if (!pf) return null;
    const P = p.power * 1000; // W
    const V = p.voltage;
    const R = p.resistance;
    const X = p.reactance;
    const SQRT3 = Math.sqrt(3);

    // 線電流。√3 が入るので割り切れないことが多い → clean な組だけ採用。
    const I = P / (SQRT3 * V * pf.cos);
    if (!Number.isFinite(I) || I <= 0) return null;

    const params = {
      power: { value: p.power, unit: "kW", realistic_range: [100, 3000] as [number, number] },
      voltage: { value: V, unit: "V", realistic_range: [3300, 6600] as [number, number] },
      resistance: { value: R, unit: "ohm", realistic_range: [0.1, 2] as [number, number] },
      reactance: { value: X, unit: "ohm", realistic_range: [0.1, 2] as [number, number] },
      pf_index: { value: p.pf_index, realistic_range: [0, PF_SET.length - 1] as [number, number] },
      variant: { value: p.variant, realistic_range: [0, 1] as [number, number] },
    };
    const cosT = formatClean(pf.cos);
    const iT = formatClean(I);
    const given =
      `三相3線式の配電線路がある。受電端の線間電圧${V}V、負荷は${p.power}kW・力率${cosT}（遅れ）で、` +
      `線路1線あたりの抵抗は${R}Ω、リアクタンスは${X}Ω である。`;

    if (p.variant === 0) {
      // (a) 線電流。
      const mc = buildRoundedMcChoices(
        I,
        [
          { value: P / (V * pf.cos), reason: "√3 を掛け忘れた（単相の式を使った）" },
          { value: (P * SQRT3) / (V * pf.cos), reason: "√3 を分母でなく分子に置いた" },
          { value: P / (SQRT3 * V), reason: "力率で割るのを忘れた" },
          { value: P / (3 * V * pf.cos), reason: "√3 の代わりに 3 で割った" },
        ],
        formatClean,
      );
      if (!mc) return null;
      return {
        params,
        answerValue: I,
        answerUnit: "A",
        answerText: mc.answerText,
        choices: mc.choices,
        distractors: mc.distractors,
        likelyWrongChoice: formatClean(P / (V * pf.cos)),
        facts: { P, V, R, X, cos: pf.cos, I },
        defaultStatement: `${given}この線路に流れる線電流〔A〕として、最も近い値を選べ。`,
        defaultSolution: [
          "三相電力 P = √3·V·I·cosθ を電流について解く",
          "I = P / (√3·V·cosθ)",
          `I = ${p.power}×10³/(√3×${V}×${cosT}) = ${iT}A`,
        ],
        physicallyValid: true,
      };
    }

    // (b) 電力損失（3線ぶん）。
    const loss = 3 * I * I * R;
    if (!Number.isFinite(loss) || loss <= 0) return null;
    const lossKw = loss / 1000;
    const lossT = formatClean(lossKw);
    const mc = buildRoundedMcChoices(
      lossKw,
      [
        { value: (I * I * R) / 1000, reason: "3線ぶんの3を掛け忘れた（1線だけで計算した）" },
        { value: (SQRT3 * I * I * R) / 1000, reason: "3 の代わりに √3 を掛けた" },
        { value: (3 * I * R) / 1000, reason: "電流を2乗し忘れた" },
        { value: (3 * I * I * (R + X)) / 1000, reason: "リアクタンスも損失に加えた（損失は抵抗のみ）" },
      ],
      formatClean,
    );
    if (!mc) return null;
    return {
      params,
      answerValue: lossKw,
      answerUnit: "kW",
      answerText: mc.answerText,
      choices: mc.choices,
      distractors: mc.distractors,
      likelyWrongChoice: formatClean((I * I * R) / 1000),
      facts: { P, V, R, X, cos: pf.cos, I, loss },
      defaultStatement: `${given}(a) より線電流は${iT}A である。この線路で生じる電力損失〔kW〕として、最も近い値を選べ。`,
      defaultSolution: [
        "電力損失は3線それぞれの抵抗損の合計",
        "P_loss = 3·I²·R（リアクタンスは電力を消費しない）",
        `P_loss = 3×${iT}²×${R} = ${formatClean(loss)}W = ${lossT}kW`,
      ],
      physicallyValid: true,
    };
  },
});
