/**
 * テンプレート: 力率改善後に増設できる負荷（法規B問題・五肢択一）。
 *
 * 既存 `transformer-capacity-selection.ts` は需要率から容量を選ぶだけ。本試のB問題は
 * 「コンデンサで力率を1に改善したとき、変圧器にあと何kW接続できるか」という
 * 容量余力の問いで出る。皮相電力の制約が有効電力の余力に変わる点が要点。
 *
 *   改善前の皮相電力 S1 = P / cosθ1
 *   力率1に改善すると皮相電力＝有効電力になるので、変圧器容量いっぱいまで使える
 *   増設可能な有効電力 ΔP = S_tr − P          〔kW〕
 *   そのとき必要なコンデンサ容量 Qc = P・tanθ1 〔kvar〕
 */
import { formatClean, isCleanAnswer } from "../clean.js";
import { buildRoundedMcChoices, defineTemplate, pick } from "./helpers.js";

const TRANSFORMER_SET = [100, 150, 200, 300, 400, 500, 750, 1000];
const LOAD_SET = [60, 80, 100, 120, 150, 160, 180, 200, 240, 300, 320, 360, 400, 480, 500, 600, 720, 800];
/** tanθ が有理数になる力率（3-4-5 のピタゴラス比）。 */
const PF_TABLE: ReadonlyArray<{ cos: number; tan: number }> = [
  { cos: 0.6, tan: 0.8 / 0.6 },
  { cos: 0.8, tan: 0.6 / 0.8 },
];

type Params = {
  transformer_capacity: number;
  load_power: number;
  pf_index: number;
  variant: number;
};

export const transformerMarginAfterPf = defineTemplate<Params>({
  topic: "力率改善後に増設できる負荷",
  subject: "法規",
  exam: "denken3",
  difficulty: 3,
  pastExam: {
    area: "電気計算（B問題）",
    frequency: "mid",
    years: [2010, 2015, 2019, 2022],
  },
  paramSpecs: {
    transformer_capacity: { unit: "kVA", realistic_range: [100, 1000] },
    load_power: { unit: "kW", realistic_range: [50, 800] },
    pf_index: { realistic_range: [0, PF_TABLE.length - 1] },
    variant: { realistic_range: [0, 1] },
  },
  paramOrder: ["transformer_capacity", "load_power", "pf_index", "variant"],
  draw(rng) {
    return {
      transformer_capacity: pick(TRANSFORMER_SET, rng),
      load_power: pick(LOAD_SET, rng),
      pf_index: Math.floor(rng() * PF_TABLE.length),
      variant: Math.floor(rng() * 2),
    };
  },
  buildFrom(p) {
    const pf = PF_TABLE[p.pf_index];
    if (!pf) return null;
    const Str = p.transformer_capacity;
    const P = p.load_power;
    const s1 = P / pf.cos;
    // 改善前の時点で変圧器容量を超える設定は成立しない。
    if (s1 > Str) return null;
    const margin = Str - P;
    if (margin <= 0) return null;
    if (!isCleanAnswer(s1) || !isCleanAnswer(margin)) return null;

    const params = {
      transformer_capacity: { value: Str, unit: "kVA", realistic_range: [100, 1000] as [number, number] },
      load_power: { value: P, unit: "kW", realistic_range: [50, 800] as [number, number] },
      pf_index: { value: p.pf_index, realistic_range: [0, PF_TABLE.length - 1] as [number, number] },
      variant: { value: p.variant, realistic_range: [0, 1] as [number, number] },
    };
    const cosT = formatClean(pf.cos);
    const s1T = formatClean(s1);
    const given =
      `容量${Str}kVA の変圧器から、有効電力${P}kW・力率${cosT}（遅れ）の負荷に電力を供給している。` +
      "電力用コンデンサを設置して力率を1に改善する。";

    if (p.variant === 0) {
      const marginT = formatClean(margin);
      const mc = buildRoundedMcChoices(
        margin,
        [
          { value: Str * pf.cos - P, reason: "改善前の力率のまま変圧器容量に力率を掛けた（改善後は力率1）" },
          { value: Str - s1, reason: "改善前の皮相電力を引いた（力率改善で皮相電力は P に下がる）" },
          { value: Str - P * pf.cos, reason: "有効電力にさらに力率を掛けてから引いた" },
          { value: s1 - P, reason: "改善前後の皮相電力の差を増設可能分と誤解した" },
        ],
        formatClean,
      );
      if (!mc) return null;
      return {
        params,
        answerValue: margin,
        answerUnit: "kW",
        answerText: mc.answerText,
        choices: mc.choices,
        distractors: mc.distractors,
        likelyWrongChoice: formatClean(Str * pf.cos - P),
        facts: { Str, P, cos1: pf.cos, S1: s1, margin },
        defaultStatement: `${given}改善後、この変圧器にさらに増設できる有効電力〔kW〕として、最も近い値を選べ（増設分の力率も1とする）。`,
        defaultSolution: [
          `改善前の皮相電力 S1 = P/cosθ1 = ${P}/${cosT} = ${s1T}kVA`,
          "力率を1に改善すると皮相電力は有効電力に等しくなるので、変圧器容量まで有効電力を取れる",
          `増設可能分 ΔP = ${Str} − ${P} = ${marginT}kW`,
          `（注意: ${Str}×${cosT} − ${P} とすると改善前の前提のままで誤り）`,
        ],
        physicallyValid: true,
      };
    }

    // variant=1: 力率1にするのに必要なコンデンサ容量。
    const qc = P * pf.tan;
    if (!isCleanAnswer(qc)) return null;
    const qcT = formatClean(qc);
    const mc = buildRoundedMcChoices(
      qc,
      [
        { value: s1 - P, reason: "皮相電力と有効電力の差を無効電力と取り違えた（三平方の関係で一致しない）" },
        { value: s1, reason: "改善前の皮相電力〔kVA〕を答えにした" },
        { value: P * pf.cos, reason: "tanθ ではなく cosθ を掛けた" },
        { value: Str - P, reason: "増設可能な有効電力〔kW〕と混同した" },
      ],
      formatClean,
    );
    if (!mc) return null;
    return {
      params,
      answerValue: qc,
      answerUnit: "kvar",
      answerText: mc.answerText,
      choices: mc.choices,
      distractors: mc.distractors,
      likelyWrongChoice: formatClean(s1 - P),
      facts: { Str, P, cos1: pf.cos, Qc: qc },
      defaultStatement: `${given}このとき必要な電力用コンデンサの容量〔kvar〕として、最も近い値を選べ。`,
      defaultSolution: [
        "力率1にするには負荷の遅れ無効電力を全て打ち消す",
        `Qc = P・tanθ1 = ${P}×${formatClean(pf.tan)} = ${qcT}kvar`,
        `（改善前の皮相電力 ${s1T}kVA との差を kvar と混同しないこと）`,
      ],
      physicallyValid: true,
    };
  },
});
