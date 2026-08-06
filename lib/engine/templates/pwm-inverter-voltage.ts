/**
 * テンプレート: PWMインバータの出力電圧（V/f一定制御）（機械・パワエレ・numeric）。
 *
 * 形式: 可変電圧可変周波数(VVVF)インバータで誘導電動機を駆動するとき、
 *   磁束を一定に保つため出力電圧を周波数に比例させる「V/f一定制御」を行う。
 *   このとき出力電圧は周波数に正比例する:
 *     V2 / V1 = f2 / f1   ⇒   V2 = V1 · (f2 / f1)   〔V〕
 *
 * 出典・根拠: 電動機の鉄心磁束 Φ ∝ V/f（誘導起電力 E≈4.44·f·N·Φ より）。
 *   磁束一定（飽和回避・トルク確保）には V/f を一定に保つ必要がある。
 *   これは VVVF インバータ制御の最も基本的かつ確立した関係式（電験二種 機械の頻出）。
 *   ※ 正弦波PWMの基本波実効値 V_LL=m·(√3/(2√2))·Vd は係数が無理数で綺麗な値に
 *     ならないため、本テンプレでは確実に検算できる V/f 一定の比例関係を採用する。
 *
 * 誤答（成立する典型ミス）:
 *   ① 反比例   V1·(f1/f2)（比を逆に取る）
 *   ② 周波数差 V1−(f1−f2)（電圧と周波数の次元を混同）
 *   ③ 変えない V1（周波数を下げても電圧一定と誤解）
 */
import { formatClean, isCleanAnswer } from "../clean.js";
import { defineTemplate, pick } from "./helpers.js";

const BASE: ReadonlyArray<readonly [number, number]> = [
  [200, 50],
  [200, 60],
  [400, 50],
  [400, 60],
  [100, 50],
  [100, 60],
  [110, 50],
  [110, 60],
  [220, 50],
  [220, 60],
  [380, 50],
  [380, 60],
];
const F2_SET: ReadonlyArray<number> = [10, 15, 20, 25, 30, 40, 45, 48];

type Params = {
  base_voltage: number;
  base_frequency: number;
  output_frequency: number;
};

export const pwmInverterVoltage = defineTemplate<Params>({
  topic: "PWMインバータの出力電圧",
  subject: "機械",
  exam: "denken2_primary",
  difficulty: 3,
  pastExam: { area: "パワーエレクトロニクス", frequency: "high", years: [2010, 2015, 2020, 2025] },
  paramSpecs: {
    base_voltage: { unit: "V", realistic_range: [100, 400] },
    base_frequency: { unit: "Hz", realistic_range: [50, 60] },
    output_frequency: { unit: "Hz", realistic_range: [10, 60] },
  },
  paramOrder: ["base_voltage", "base_frequency", "output_frequency"],
  draw(rng) {
    const [v1, f1] = pick(BASE, rng);
    return { base_voltage: v1, base_frequency: f1, output_frequency: pick(F2_SET, rng) };
  },
  buildFrom({ base_voltage: V1, base_frequency: f1, output_frequency: f2 }) {
    if (V1 <= 0 || f1 <= 0 || f2 <= 0) return null;
    if (f2 >= f1) return null; // 基底周波数以下での運転（弱め界磁領域を避ける）
    const V2 = V1 * (f2 / f1); // 正解
    if (!isCleanAnswer(V2)) return null;
    const answerText = formatClean(V2);
    return {
      format: "numeric",
      params: {
        base_voltage: { value: V1, unit: "V", realistic_range: [100, 400] },
        base_frequency: { value: f1, unit: "Hz", realistic_range: [50, 60] },
        output_frequency: { value: f2, unit: "Hz", realistic_range: [10, 60] },
      },
      answerValue: V2,
      answerUnit: "V",
      answerText,
      facts: { V1, f1, f2, V2 },
      defaultStatement:
        `VVVFインバータで誘導電動機をV/f一定制御している。基底周波数 f1=${f1}Hz のとき出力電圧 V1=${V1}V である。` +
        `出力周波数を f2=${f2}Hz にしたときの出力電圧 V2〔V〕は?`,
      defaultSolution: [
        `V/f一定制御では磁束一定のため出力電圧は周波数に比例: V2/V1=f2/f1`,
        `V2=V1×f2/f1=${V1}×${f2}/${f1}`,
        `V2=${answerText}V`,
      ],
      physicallyValid: true,
    };
  },
});
