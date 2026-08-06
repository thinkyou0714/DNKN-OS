/**
 * テンプレート: 三相全波整流回路の直流電圧（二種二次・機械制御・descriptive）。
 *   サイリスタ三相ブリッジ整流回路の平均直流電圧（平滑・転流重なりなし）は
 *     Ed = (3√2/π)·V·cosα ≒ 1.35·V·cosα 〔V〕（V は線間電圧実効値）
 *   過去問頻出の「単相全波整流」を、三相ブリッジ＋制御角に発展させた改作。
 *   ※ 係数は試験慣行どおり 1.35 として計算する（問題文に明示）。
 */
import { formatClean, isCleanAnswer } from "../clean.js";
import { defineTemplate, pick } from "./helpers.js";

const V_SET: ReadonlyArray<number> = [
  100, 110, 120, 140, 150, 160, 180, 200, 210, 220, 230, 240, 250, 300, 320, 346, 380, 400, 415, 420, 440, 460, 480,
  500, 550, 600,
];
/** 制御角〔°〕→ cosα（浮動小数の揺れを避けるため厳密値の表を引く）。 */
const COS_TABLE: Readonly<Record<number, number>> = { 0: 1, 60: 0.5 };
const ALPHA_SET: ReadonlyArray<number> = [0, 60];
/** 3√2/π の試験慣行値（問題文に明示する定数）。 */
const RECTIFIER_FACTOR = 1.35;

type Params = {
  line_voltage: number;
  firing_angle: number;
};

export const threePhaseRectifier = defineTemplate<Params>({
  topic: "三相全波整流回路の直流電圧",
  subject: "機械制御",
  exam: "denken2_secondary",
  difficulty: 4,
  pastExam: { area: "パワーエレクトロニクス", frequency: "high", years: [2009, 2014, 2018, 2023] },
  paramSpecs: {
    line_voltage: { unit: "V", realistic_range: [100, 600] },
    firing_angle: { unit: "°", realistic_range: [0, 60] },
  },
  paramOrder: ["line_voltage", "firing_angle"],
  draw(rng) {
    return {
      line_voltage: pick(V_SET, rng),
      firing_angle: pick(ALPHA_SET, rng),
    };
  },
  buildFrom({ line_voltage: v, firing_angle: alpha }) {
    if (v <= 0) return null;
    const cosAlpha = COS_TABLE[alpha];
    if (cosAlpha === undefined) return null;
    const ed = RECTIFIER_FACTOR * v * cosAlpha;
    if (ed <= 0 || !isCleanAnswer(ed)) return null;
    const answerText = formatClean(ed);
    return {
      format: "descriptive",
      params: {
        line_voltage: { value: v, unit: "V", realistic_range: [100, 600] },
        firing_angle: { value: alpha, unit: "°", realistic_range: [0, 60] },
      },
      answerValue: ed,
      answerUnit: "V",
      answerText,
      facts: { v, alpha, cosAlpha, ed, factor: RECTIFIER_FACTOR },
      defaultStatement:
        `線間電圧 ${v}V の三相交流電源にサイリスタ三相ブリッジ整流回路を接続し、` +
        `制御角 α=${alpha}° で運転する。転流重なりを無視し、平均直流電圧は Ed=1.35·V·cosα で` +
        `与えられるものとして、Ed〔V〕を求めよ。`,
      defaultSolution: [
        `着眼点: 三相ブリッジの無制御時 Ed0=(3√2/π)·V≒1.35·V。位相制御では cosα 倍になる。`,
        `cosα=cos${alpha}°=${formatClean(cosAlpha)}`,
        `Ed=1.35×${v}×${formatClean(cosAlpha)}=${answerText}V`,
        `ポイント: 単相全波の 0.9·V と混同しない。三相ブリッジは脈動も小さく係数は 1.35。`,
      ],
      physicallyValid: true,
    };
  },
});
