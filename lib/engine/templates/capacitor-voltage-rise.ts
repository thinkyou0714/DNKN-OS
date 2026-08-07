/**
 * テンプレート: 電力用コンデンサによる母線電圧上昇（二種二次・電力管理・descriptive）。
 *   系統リアクタンス X〔Ω〕の母線（線間電圧 V〔kV〕）に電力用コンデンサ Q〔Mvar〕を
 *   並列投入したときの電圧上昇の近似式:
 *     ΔV ≈ X·Q / V   〔kV〕
 *   （Ω × Mvar / kV = kV。抵抗分 R≪X を無視した実務近似）
 *   調相設備による電圧調整の基本式で、二種二次・電力管理「変電・調相」の頻出パターン。
 */
import { formatClean, isCleanAnswer } from "../clean.js";
import { defineTemplate, pick } from "./helpers.js";

/** [V(kV), X(Ω)] — X が V/10 の 0.5〜1.5 倍 → ΔV=X·Q/V が必ず綺麗になる組。 */
const VX_PAIRS: ReadonlyArray<readonly [number, number]> = [
  [66, 3.3],
  [66, 6.6],
  [66, 9.9],
  [77, 7.7],
  [77, 15.4],
  [110, 5.5],
  [110, 11],
  [110, 16.5],
  [154, 7.7],
  [154, 15.4],
];
const Q_SET: ReadonlyArray<number> = [10, 20, 30, 40];

type Params = {
  system_voltage: number;
  system_reactance: number;
  capacitor_capacity: number;
};

export const capacitorVoltageRise = defineTemplate<Params>({
  topic: "電力用コンデンサによる母線電圧上昇",
  subject: "電力管理",
  exam: "denken2_secondary",
  difficulty: 4,
  pastExam: { area: "変電・調相", frequency: "mid", years: [2010, 2016, 2022] },
  paramSpecs: {
    system_voltage: { unit: "kV", realistic_range: [60, 170] },
    system_reactance: { unit: "Ω", realistic_range: [3, 20] },
    capacitor_capacity: { unit: "Mvar", realistic_range: [5, 50] },
  },
  paramOrder: ["system_voltage", "system_reactance", "capacitor_capacity"],
  draw(rng) {
    const [v, x] = pick(VX_PAIRS, rng);
    return { system_voltage: v, system_reactance: x, capacitor_capacity: pick(Q_SET, rng) };
  },
  buildFrom({ system_voltage: V, system_reactance: X, capacitor_capacity: Q }) {
    if (V <= 0 || X <= 0 || Q <= 0) return null;
    const dV = (X * Q) / V; // 〔kV〕（Ω×Mvar/kV=kV）
    // 電圧上昇が母線電圧の10%を超える運用は非現実的なため棄却する。
    if (dV <= 0 || dV > 0.1 * V || !isCleanAnswer(dV)) return null;
    const answerText = formatClean(dV);
    return {
      format: "descriptive",
      params: {
        system_voltage: { value: V, unit: "kV", realistic_range: [60, 170] },
        system_reactance: { value: X, unit: "Ω", realistic_range: [3, 20] },
        capacitor_capacity: { value: Q, unit: "Mvar", realistic_range: [5, 50] },
      },
      answerValue: dV,
      answerUnit: "kV",
      answerText,
      facts: { V, X, Q, dV },
      defaultStatement:
        `線間電圧 V=${formatClean(V)}kV の変電所母線に、電力用コンデンサ Q=${formatClean(Q)}Mvar を並列に投入する。` +
        `電源側から見た系統リアクタンスを X=${formatClean(X)}Ω、抵抗分は無視できるものとして、` +
        `投入による母線電圧の上昇 ΔV〔kV〕を近似式により導出過程とともに求めよ。`,
      defaultSolution: [
        `着眼点: 進み無効電力 Q の注入はリアクタンス X による電圧上昇 ΔV≈X·Q/V を生む（R≪X の実務近似）。`,
        `ΔV=X·Q/V=${formatClean(X)}×${formatClean(Q)}/${formatClean(V)}`,
        `ΔV=${answerText}kV`,
        `ポイント: 分路リアクトルなら同式で電圧が下がる（Q の符号が逆）。調相設備による電圧調整の基本式。`,
      ],
      physicallyValid: true,
    };
  },
});
