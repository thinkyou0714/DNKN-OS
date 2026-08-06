/**
 * テンプレート: 中性点抵抗接地系統の一線地絡電流（二種二次・電力管理・descriptive・難易度5）。
 *
 * 対称座標法による一線(a相)完全地絡:
 *   Ig = 3·E / (Z1 + Z2 + Z0)        〔A〕
 *     E  = 相電圧（線間電圧 V のとき E=V/√3。本問は相電圧を直接与える）
 *     Z1=Z2=jX1（正相=逆相, 純リアクタンスと仮定）
 *     Z0 = jX0 + 3·R_n   （中性点抵抗 R_n は零相回路に 3R_n として現れる）
 *
 *   よって分母は
 *     Z1+Z2+Z0 = 3R_n + j(2X1 + X0)
 *   その大きさは
 *     |Z| = √( (3R_n)² + (2X1 + X0)² )
 *   一線地絡電流の大きさは
 *     |Ig| = 3·E / |Z|
 *
 * 設計: (3R_n, 2X1+X0) がピタゴラス数になる組を採り |Z| を整数に、|Ig| を綺麗な値に収める。
 *   多段の導出（3R_n の算出 → リアクタンス和 → |Z|（ピタゴラス）→ 3E → |Ig|）を要する難問。
 *
 * 中性点抵抗接地の意義: R_n を入れて地絡電流を抑制し、通信線誘導障害・機器損傷を低減する。
 *   R_n→0（直接接地）で Ig は最大、R_n→∞（非接地）で Ig は極小になる。
 */
import { formatClean, isCleanAnswer } from "../clean.js";
import { defineTemplate, pick } from "./helpers.js";

// [R_n(Ω), X1=X2(Ω), X0(Ω), E(V)]。(3R_n, 2X1+X0) がピタゴラス数 → |Z| 整数, Ig 綺麗。
const SETS: ReadonlyArray<readonly [number, number, number, number]> = [
  [10, 5, 30, 1000], // 3Rn=30, 2X1+X0=40, |Z|=50, Ig=60
  [10, 5, 30, 2000], // |Z|=50, Ig=120
  [10, 5, 30, 500], //  |Z|=50, Ig=30
  [20, 10, 60, 2000], // 3Rn=60, 2X1+X0=80, |Z|=100, Ig=60
  [20, 10, 60, 1000], // |Z|=100, Ig=30
  [5, 5, 10, 500], //   3Rn=15, 2X1+X0=20, |Z|=25, Ig=60
  [5, 5, 10, 1000], //  |Z|=25, Ig=120
  [15, 10, 40, 1500], // 3Rn=45, 2X1+X0=60, |Z|=75, Ig=60
  [15, 10, 40, 1000], // |Z|=75, Ig=40
  [3, 3, 6, 500], //    3Rn=9,  2X1+X0=12, |Z|=15, Ig=100
  [3, 3, 6, 750], //    |Z|=15, Ig=150
  [30, 20, 80, 2000], // 3Rn=90, 2X1+X0=120, |Z|=150, Ig=40
  [7, 9, 10, 3500], //  3Rn=21, 2X1+X0=28, |Z|=35, Ig=300
  [10, 5, 30, 1500], // |Z|=50, Ig=90
  [5, 5, 10, 750], //   |Z|=25, Ig=90
  [20, 10, 60, 3000], // |Z|=100, Ig=90
  [15, 10, 40, 2500], // |Z|=75, Ig=100
  [1, 1, 2, 500], //    3Rn=3,  2X1+X0=4,  |Z|=5,   Ig=300
  [1, 1, 2, 1000], //   |Z|=5,   Ig=600
  [2, 1, 6, 500], //    3Rn=6,  2X1+X0=8,  |Z|=10,  Ig=150
  [2, 2, 4, 1000], //   |Z|=10,  Ig=300
  [2, 3, 2, 2000], //   |Z|=10,  Ig=600
  [3, 1, 10, 500], //   3Rn=9,  2X1+X0=12, |Z|=15,  Ig=100
  [3, 1, 10, 1500], //  |Z|=15,  Ig=300
  [4, 2, 12, 1000], //  3Rn=12, 2X1+X0=16, |Z|=20,  Ig=150
  [4, 2, 12, 2000], //  |Z|=20,  Ig=300
  [6, 4, 16, 1000], //  3Rn=18, 2X1+X0=24, |Z|=30,  Ig=100
  [6, 4, 16, 3000], //  |Z|=30,  Ig=300
  [7, 4, 16, 700], //   3Rn=21, 2X1+X0=28, |Z|=35,  Ig=60
  [7, 4, 16, 3500], //  |Z|=35,  Ig=300
  [8, 4, 24, 1000], //  3Rn=24, 2X1+X0=32, |Z|=40,  Ig=75
  [8, 4, 24, 4000], //  |Z|=40,  Ig=300
  [9, 6, 24, 1500], //  3Rn=27, 2X1+X0=36, |Z|=45,  Ig=100
  [9, 6, 24, 3000], //  |Z|=45,  Ig=200
  [12, 8, 32, 2000], // 3Rn=36, 2X1+X0=48, |Z|=60,  Ig=100
  [12, 8, 32, 3000], // |Z|=60,  Ig=150
  [14, 10, 36, 3500], // 3Rn=42, 2X1+X0=56, |Z|=70, Ig=150
  [14, 10, 36, 700], // |Z|=70,  Ig=30
  [25, 15, 70, 2500], // 3Rn=75, 2X1+X0=100, |Z|=125, Ig=60
  [25, 15, 70, 5000], // |Z|=125, Ig=120
];

type Params = {
  neutral_resistance: number;
  positive_reactance: number;
  zero_reactance: number;
  phase_voltage: number;
};

export const groundFaultNeutralResistance = defineTemplate<Params>({
  topic: "中性点抵抗接地系統の一線地絡電流",
  subject: "電力管理",
  exam: "denken2_secondary",
  difficulty: 5,
  pastExam: { area: "短絡・故障計算", frequency: "mid", years: [2009, 2015, 2021] },
  paramSpecs: {
    neutral_resistance: { unit: "Ω", realistic_range: [1, 50] },
    positive_reactance: { unit: "Ω", realistic_range: [1, 50] },
    zero_reactance: { unit: "Ω", realistic_range: [1, 100] },
    phase_voltage: { unit: "V", realistic_range: [100, 6350] },
  },
  paramOrder: ["neutral_resistance", "positive_reactance", "zero_reactance", "phase_voltage"],
  draw(rng) {
    const [rn, x1, x0, e] = pick(SETS, rng);
    return { neutral_resistance: rn, positive_reactance: x1, zero_reactance: x0, phase_voltage: e };
  },
  buildFrom({ neutral_resistance: Rn, positive_reactance: X1, zero_reactance: X0, phase_voltage: E }) {
    if (Rn <= 0 || X1 <= 0 || X0 <= 0 || E <= 0) return null;
    const resPart = 3 * Rn; // 零相回路の抵抗分 3R_n
    const reactPart = 2 * X1 + X0; // 2X1 + X0（Z1=Z2=jX1, Z0 の虚部）
    const Zmag = Math.sqrt(resPart * resPart + reactPart * reactPart);
    const Ig = (3 * E) / Zmag;
    if (!isCleanAnswer(Zmag) || !isCleanAnswer(Ig)) return null;
    const answerText = formatClean(Ig);
    return {
      format: "descriptive",
      params: {
        neutral_resistance: { value: Rn, unit: "Ω", realistic_range: [1, 50] },
        positive_reactance: { value: X1, unit: "Ω", realistic_range: [1, 50] },
        zero_reactance: { value: X0, unit: "Ω", realistic_range: [1, 100] },
        phase_voltage: { value: E, unit: "V", realistic_range: [100, 6350] },
      },
      answerValue: Ig,
      answerUnit: "A",
      answerText,
      facts: { Rn, X1, X0, E, resPart, reactPart, Zmag, Ig },
      defaultStatement:
        `中性点を抵抗 R_n=${Rn}Ω で接地した三相系統がある。相電圧 E=${E}V、正相=逆相リアクタンス X1=X2=${X1}Ω、` +
        `零相リアクタンス X0=${X0}Ω のとき、a相が完全地絡したときの一線地絡電流の大きさ |Ig|〔A〕を、` +
        `対称座標法により導出過程とともに求めよ。`,
      defaultSolution: [
        `着眼点: 一線地絡では正相・逆相・零相の3回路を直列に接続して扱う（Ig=3E/(Z1+Z2+Z0)）。`,
        `中性点抵抗 R_n は零相回路にのみ 3R_n として現れる: Z0=jX0+3R_n。`,
        `分母 Z1+Z2+Z0=j2X1+(jX0+3R_n)=3R_n+j(2X1+X0)`,
        `実部 3R_n=3×${Rn}=${formatClean(resPart)}Ω、虚部 2X1+X0=2×${X1}+${X0}=${formatClean(reactPart)}Ω`,
        `大きさ |Z|=√((3R_n)²+(2X1+X0)²)=√(${formatClean(resPart)}²+${formatClean(reactPart)}²)=${formatClean(Zmag)}Ω`,
        `一線地絡電流 |Ig|=3E/|Z|=3×${E}/${formatClean(Zmag)}`,
        `|Ig|=${answerText}A`,
        `（ポイント: R_n を大きくすると |Z| が増え Ig が減る。直接接地(R_n→0)で最大、非接地で極小となる。）`,
      ],
      physicallyValid: true,
    };
  },
});
