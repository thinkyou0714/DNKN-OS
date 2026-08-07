/**
 * テンプレート: 力率改善用コンデンサ容量（法規B問題・五肢択一）。
 *
 * 法規B問題（施設管理）の定番。無効電力の差がそのままコンデンサ容量になる。
 *   Qc = P(tanθ1 − tanθ2) 〔kvar〕      θ1=改善前, θ2=改善後（いずれも遅れ）
 *   variant=1: 改善後の皮相電力 S2 = P / cosθ2 〔kVA〕
 *
 * tanθ = √(1−cos²θ)/cosθ は cosθ がピタゴラス数由来（0.6/0.8 等）でない限り無理数になる。
 * isCleanAnswer で弾くと 0.6/0.8/1.0 の3値しか使えず組合せが枯れるため、本テンプレは
 * **小数2桁へ丸めた値**を答えとする（T-3 と同じ方針）。本試と同じ五肢択一なので、
 * 丸めた表示のまま選択肢を構成できる buildRoundedMcChoices を使う。
 *
 * 典型ミス: 符号の逆転 / 皮相電力の差 S1−S2 を kvar と取り違える / kVA と kvar の混同。
 */
import { formatClean } from "../clean.js";
import { buildRoundedMcChoices, defineTemplate, pick } from "./helpers.js";

const POWER_SET = [
  50, 60, 75, 80, 100, 120, 150, 160, 180, 200, 240, 250, 300, 320, 360, 400, 450, 480, 500, 600, 750, 800, 1000,
];
/** 電験で実際に出題される力率値（遅れ）。1.0 は「力率100%まで改善」の設定。 */
const PF_SET = [0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1.0];

/** cosθ から tanθ を求める（0<cosθ≤1）。 */
function tanFromCos(cos: number): number {
  return Math.sqrt(1 - cos * cos) / cos;
}

type Params = {
  power: number;
  pf_before_index: number;
  pf_after_index: number;
  variant: number;
};

export const powerFactorCapacitor = defineTemplate<Params>({
  topic: "力率改善コンデンサ容量",
  subject: "法規",
  exam: "denken3",
  difficulty: 3,
  pastExam: {
    area: "電気計算（B問題）",
    frequency: "high",
    years: [2008, 2011, 2014, 2018, 2021, 2023],
  },
  paramSpecs: {
    power: { unit: "kW", realistic_range: [50, 1000] },
    pf_before_index: { realistic_range: [0, PF_SET.length - 1] },
    pf_after_index: { realistic_range: [0, PF_SET.length - 1] },
    variant: { realistic_range: [0, 1] },
  },
  paramOrder: ["power", "pf_before_index", "pf_after_index", "variant"],
  draw(rng) {
    return {
      power: pick(POWER_SET, rng),
      pf_before_index: Math.floor(rng() * PF_SET.length),
      pf_after_index: Math.floor(rng() * PF_SET.length),
      variant: Math.floor(rng() * 2),
    };
  },
  buildFrom(p) {
    const cosBefore = PF_SET[p.pf_before_index];
    const cosAfter = PF_SET[p.pf_after_index];
    if (cosBefore === undefined || cosAfter === undefined) return null;
    // 改善なので必ず力率は上がる方向。
    if (cosBefore >= cosAfter) return null;

    const P = p.power;
    const tanBefore = tanFromCos(cosBefore);
    const tanAfter = tanFromCos(cosAfter);
    const qc = P * (tanBefore - tanAfter);
    if (!Number.isFinite(qc) || qc <= 0) return null;

    const params = {
      power: { value: P, unit: "kW", realistic_range: [50, 1000] as [number, number] },
      pf_before_index: { value: p.pf_before_index, realistic_range: [0, PF_SET.length - 1] as [number, number] },
      pf_after_index: { value: p.pf_after_index, realistic_range: [0, PF_SET.length - 1] as [number, number] },
      variant: { value: p.variant, realistic_range: [0, 1] as [number, number] },
    };
    const cos1 = formatClean(cosBefore);
    const cos2 = formatClean(cosAfter);
    const tan1T = formatClean(tanBefore);
    const tan2T = formatClean(tanAfter);
    // 力率1.0 に「遅れ」は存在しない（無効電力ゼロ）ので、改善後が1.0のときは付けない。
    const afterLag = cosAfter < 1 ? "（遅れ）" : "";
    const given =
      `ある高圧需要家の負荷は有効電力${P}kW、力率${cos1}（遅れ）である。` +
      `この力率を${cos2}${afterLag}まで改善したい。`;
    const s1 = P / cosBefore;

    if (p.variant === 0) {
      const qcT = formatClean(qc);
      const mc = buildRoundedMcChoices(
        qc,
        [
          { value: s1 - P / cosAfter, reason: "皮相電力の差 S1−S2 を無効電力の差と取り違えた" },
          { value: P * Math.abs(cosBefore - cosAfter), reason: "力率そのものの差を掛けた（正しくは tanθ の差）" },
          { value: s1, reason: "改善前の皮相電力〔kVA〕を答えにした（単位も kvar ではない）" },
          { value: P * tanBefore, reason: "改善後を力率1と誤解し、無効電力を全て打ち消す量を求めた" },
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
        likelyWrongChoice: formatClean(s1 - P / cosAfter),
        facts: { P, cos1: cosBefore, cos2: cosAfter, Qc: qc },
        defaultStatement: `${given}必要な電力用コンデンサの容量〔kvar〕として、最も近い値を選べ。`,
        defaultSolution: [
          "コンデンサ容量は改善前後の無効電力の差: Qc = P(tanθ1 − tanθ2)",
          `tanθ = √(1−cos²θ)/cosθ より tanθ1 = ${tan1T}、tanθ2 = ${tan2T}`,
          `Qc = ${P}×(${tan1T} − ${tan2T}) = ${qcT}kvar`,
          "（注意: 皮相電力の差 S1−S2 は無効電力の差ではないので kvar として使えない）",
        ],
        physicallyValid: true,
      };
    }

    // variant=1: 改善後の皮相電力。
    const s2 = P / cosAfter;
    if (!Number.isFinite(s2)) return null;
    const s2T = formatClean(s2);
    const mc = buildRoundedMcChoices(
      s2,
      [
        { value: s1, reason: "改善前の皮相電力を答えにした（改善後は cosθ2 で割る）" },
        { value: P * cosAfter, reason: "力率で割るべきところを掛けた" },
        { value: P, reason: "有効電力をそのまま皮相電力とした（力率1のときのみ成立）" },
        { value: qc, reason: "コンデンサ容量〔kvar〕と皮相電力〔kVA〕を取り違えた" },
      ],
      formatClean,
    );
    if (!mc) return null;
    return {
      params,
      answerValue: s2,
      answerUnit: "kVA",
      answerText: mc.answerText,
      choices: mc.choices,
      distractors: mc.distractors,
      likelyWrongChoice: formatClean(s1),
      facts: { P, cos2: cosAfter, S2: s2 },
      defaultStatement: `${given}改善後に電源から供給される皮相電力〔kVA〕として、最も近い値を選べ。`,
      defaultSolution: [
        "有効電力は力率改善によって変わらない（コンデンサは無効電力のみを供給する）",
        "皮相電力 S = P / cosθ",
        `S2 = ${P}/${cos2} = ${s2T}kVA`,
      ],
      physicallyValid: true,
    };
  },
});
