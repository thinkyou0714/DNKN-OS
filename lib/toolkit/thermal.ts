/**
 * thermal.ts — 半導体の熱計算（ジャンクション温度・純ロジック）。
 *
 * モデル: 熱抵抗直列モデル。
 *  - 簡易（ヒートシンクなし）: Tj = Ta + P × θja
 *  - ヒートシンクあり:         Tj = Ta + P × (θjc + θcs + θsa)
 * 繰り返しパルス負荷では、データシートの過渡熱インピーダンス曲線から読んだ単発値 Zth(tp) を使い
 * よく知られた近似 Zth(D, tp) = D×Rth + (1−D)×Zth(tp) でピーク Tj を求める（D = tp/T）。
 * 判定は Tj の絶対値を Tj(max) に対する百分率で評価する（既定 80%。125℃ 定格なら 100℃ 相当）。
 *
 * 根拠解説の技術内容はドラフト。販売前に販売者（実務者）の最終監修を受けること。
 */

import type { ExplanationDoc, FieldSpec, ModuleResult, ToolkitModule } from "./types.js";
import { judgeUsage, num, validateFields } from "./types.js";

export const THERMAL_FIELDS: FieldSpec[] = [
  {
    key: "loadMode",
    label: "負荷モード",
    kind: "select",
    defaultValue: "steady",
    options: [
      { value: "steady", label: "定常（連続損失）" },
      { value: "pulse", label: "繰り返しパルス（過渡熱抵抗）" },
    ],
  },
  {
    key: "model",
    label: "放熱モデル",
    kind: "select",
    defaultValue: "simple",
    options: [
      { value: "simple", label: "ヒートシンクなし（θja）" },
      { value: "heatsink", label: "ヒートシンクあり（θjc + θcs + θsa）" },
    ],
  },
  {
    key: "ambientTemp",
    label: "周囲温度",
    unit: "℃",
    kind: "number",
    defaultValue: 50,
    min: -55,
    max: 200,
    help: "部品周囲の局所温度（筐体内温度上昇を含める）",
  },
  {
    key: "power",
    label: "損失電力",
    unit: "W",
    kind: "number",
    defaultValue: 1,
    min: 0,
    max: 10000,
    help: "定常状態の worst case 損失（導通損＋スイッチング損）",
    showIf: { key: "loadMode", equals: "steady" },
  },
  {
    key: "pulsePower",
    label: "パルス時の損失電力",
    unit: "W",
    kind: "number",
    defaultValue: 10,
    min: 0,
    max: 100000,
    help: "パルス期間中の瞬時損失（平均値ではない）",
    showIf: { key: "loadMode", equals: "pulse" },
  },
  {
    key: "pulseWidth",
    label: "パルス幅 tp",
    unit: "s",
    kind: "number",
    defaultValue: 0.001,
    min: 0,
    minExclusive: true,
    max: 3600,
    help: "1発あたりの通電時間。データシートの Zth 曲線を読むときの横軸",
    showIf: { key: "loadMode", equals: "pulse" },
  },
  {
    key: "period",
    label: "繰り返し周期 T",
    unit: "s",
    kind: "number",
    defaultValue: 0.01,
    min: 0,
    minExclusive: true,
    max: 3600,
    help: "パルスの繰り返し周期（デューティ比 D = tp / T）",
    showIf: { key: "loadMode", equals: "pulse" },
  },
  {
    key: "zthSingle",
    label: "単発過渡熱抵抗 Zth(tp)",
    unit: "℃/W",
    kind: "number",
    defaultValue: 0.5,
    min: 0,
    minExclusive: true,
    max: 10000,
    help: "データシートの過渡熱インピーダンス曲線で D=単発（single pulse）・横軸 tp を読んだ値",
    showIf: { key: "loadMode", equals: "pulse" },
  },
  {
    key: "thetaJa",
    label: "熱抵抗 θja",
    unit: "℃/W",
    kind: "number",
    defaultValue: 60,
    min: 0,
    minExclusive: true,
    max: 10000,
    help: "ジャンクション−周囲間熱抵抗（JEDEC 標準基板での測定値。実装基板で大きく変わる）",
    showIf: { key: "model", equals: "simple" },
  },
  {
    key: "thetaJc",
    label: "熱抵抗 θjc",
    unit: "℃/W",
    kind: "number",
    defaultValue: 1.5,
    min: 0,
    max: 1000,
    help: "ジャンクション−ケース間（データシート値）",
    showIf: { key: "model", equals: "heatsink" },
  },
  {
    key: "thetaCs",
    label: "熱抵抗 θcs",
    unit: "℃/W",
    kind: "number",
    defaultValue: 0.5,
    min: 0,
    max: 1000,
    help: "ケース−ヒートシンク間（グリス/シートの実装条件で決まる）",
    showIf: { key: "model", equals: "heatsink" },
  },
  {
    key: "thetaSa",
    label: "熱抵抗 θsa",
    unit: "℃/W",
    kind: "number",
    defaultValue: 5,
    min: 0,
    max: 1000,
    help: "ヒートシンク−周囲間（ヒートシンクのカタログ値。風速依存）",
    showIf: { key: "model", equals: "heatsink" },
  },
  {
    key: "tjMax",
    label: "最大ジャンクション温度 Tj(max)",
    unit: "℃",
    kind: "number",
    defaultValue: 150,
    min: 0,
    minExclusive: true,
    max: 400,
    help: "データシートの絶対最大定格（150℃ / 175℃ など）",
  },
  {
    key: "threshold",
    label: "判定閾値（Tj / Tj(max)）",
    unit: "%",
    kind: "number",
    defaultValue: 80,
    min: 0,
    minExclusive: true,
    max: 100,
    help: "一般的なディレーティング慣行は 80%（150℃ 定格なら 120℃ まで）",
  },
];

/**
 * 繰り返しパルスの実効熱インピーダンス [℃/W]。
 * よく知られた近似 Zth(D, tp) = D × Rth + (1 − D) × Zth(tp)。
 * D=1（連続）で Rth に、D→0（単発）で Zth(tp) に一致する。
 */
export function repetitiveZth(dutyRatio: number, steadyRth: number, singlePulseZth: number): number {
  return dutyRatio * steadyRth + (1 - dutyRatio) * singlePulseZth;
}

export function computeThermal(values: Record<string, number | string>): ModuleResult {
  const v = validateFields(THERMAL_FIELDS, values);
  if (!v.ok) return { ok: false, errors: v.errors };
  const model = v.input.sels.model;
  const loadMode = v.input.sels.loadMode ?? "steady";
  const ambientTemp = num(v.input, "ambientTemp");
  const tjMax = num(v.input, "tjMax");
  const threshold = num(v.input, "threshold");

  let theta: number;
  if (model === "simple") {
    theta = num(v.input, "thetaJa");
  } else {
    theta = num(v.input, "thetaJc") + num(v.input, "thetaCs") + num(v.input, "thetaSa");
    if (theta <= 0) {
      return {
        ok: false,
        errors: [{ key: "thetaJc", message: "熱抵抗の合計（θjc + θcs + θsa）は 0 ℃/W より大きくしてください" }],
      };
    }
  }

  const notes: string[] = [];
  const items: Array<{ label: string; value: number; unit?: string; digits?: number }> = [
    { label: "定常の合成熱抵抗 Rth", value: theta, unit: "℃/W", digits: 4 },
  ];

  let tj: number;
  if (loadMode === "pulse") {
    const pulsePower = num(v.input, "pulsePower");
    const pulseWidth = num(v.input, "pulseWidth");
    const period = num(v.input, "period");
    const zthSingle = num(v.input, "zthSingle");
    if (period < pulseWidth) {
      return {
        ok: false,
        errors: [{ key: "period", message: "繰り返し周期はパルス幅以上にしてください（デューティ比が 1 を超えます）" }],
      };
    }
    if (zthSingle > theta) {
      return {
        ok: false,
        errors: [
          {
            key: "zthSingle",
            message: "単発過渡熱抵抗は定常の合成熱抵抗以下です。曲線の読み取り値と熱抵抗を確認してください",
          },
        ],
      };
    }
    const duty = pulseWidth / period;
    const zth = repetitiveZth(duty, theta, zthSingle);
    tj = ambientTemp + pulsePower * zth;
    items.push(
      { label: "デューティ比 D", value: duty, unit: "", digits: 4 },
      { label: "実効熱インピーダンス Zth(D,tp)", value: zth, unit: "℃/W", digits: 4 },
      { label: "平均損失", value: pulsePower * duty, unit: "W" },
      { label: "ピークジャンクション温度 Tj", value: tj, unit: "℃" },
    );
    notes.push(
      "繰り返しパルスは Zth(D,tp) = D×Rth + (1−D)×Zth(tp) の近似です。データシートに D 別の Zth 曲線があれば、そちらの読み値を単発値の代わりに使う方が正確です。",
    );
  } else {
    const power = num(v.input, "power");
    tj = ambientTemp + power * theta;
    items.push({ label: "ジャンクション温度 Tj", value: tj, unit: "℃" });
    notes.push("定常状態の直列熱抵抗モデルです。パルス負荷は「繰り返しパルス」モードで評価してください。");
  }

  const usagePercent = (tj / tjMax) * 100;
  items.push(
    { label: "Tj(max) までの余裕", value: tjMax - tj, unit: "℃" },
    { label: "Tj / Tj(max)", value: usagePercent, unit: "%" },
  );

  if (model === "simple") {
    notes.push(
      "θja は JEDEC 標準基板での測定値です。実装基板の銅箔面積・層数で大きく変わるため、目安として扱ってください。",
    );
  } else {
    notes.push(
      "θcs はグリス/放熱シートの材質・厚み・締結圧で変わります。θsa は風速依存（自然対流値か強制空冷値か）を確認してください。",
    );
  }
  if (tj > tjMax) {
    notes.unshift("ジャンクション温度が絶対最大定格を超えています。この条件では使用できません。");
  }

  return {
    ok: true,
    items,
    usagePercent,
    verdict: judgeUsage(usagePercent, threshold),
    notes,
  };
}

export const THERMAL_EXPLANATION: ExplanationDoc = {
  conclusion: [
    "半導体の寿命と信頼性はジャンクション温度 Tj でほぼ決まる。ケース温度でも周囲温度でもなく、Tj を計算して絶対最大定格に対する余裕を確認するのが熱設計の出発点である。",
    "熱抵抗は電気抵抗のアナロジーで扱える: 温度差 = 損失 × 熱抵抗（オームの法則の T = P × θ 版）。",
  ],
  formula: [
    "ヒートシンクなし: Tj = Ta + P × θja",
    "ヒートシンクあり: Tj = Ta + P × (θjc + θcs + θsa)",
    "繰り返しパルス: Tj(peak) = Ta + Pp × Zth(D, tp)、　Zth(D, tp) = D × Rth + (1 − D) × Zth(tp)、　D = tp / T",
    "判定値 [%] = Tj ÷ Tj(max) × 100",
  ],
  terms: [
    "Tj: ジャンクション（チップ接合部）温度。データシートの絶対最大定格（150℃ / 175℃ など）を1秒でも超えてはならない。",
    "Ta: 周囲温度。筐体内の温度上昇を含む、部品周囲の局所温度。",
    "P: 定常の損失電力。MOSFET なら導通損 I²×Ron（Ron は高温値で！）＋スイッチング損。",
    "θja: ジャンクション−周囲間の合成熱抵抗。JEDEC 標準基板（銅箔面積規定）での測定値であり、実装依存が非常に大きい。",
    "θjc: ジャンクション−ケース間。パッケージ固有の値でデータシートから読む。",
    "θcs: ケース−ヒートシンク間。グリス・放熱シートの選定と施工で決まる（0.1〜1 ℃/W 程度が典型）。",
    "θsa: ヒートシンク−周囲間。ヒートシンクカタログの値。自然対流か強制空冷かで数倍違う。",
    "Zth(tp): 単発パルスの過渡熱インピーダンス。短いパルスほどシリコンとパッケージの熱容量が効き、定常の Rth より小さくなる（＝同じ損失でも Tj が上がりきらない）。",
    "D: デューティ比 tp/T。D=1 なら定常（Zth=Rth）、D→0 なら単発（Zth=Zth(tp)）に連続的につながる。",
    "Pp: パルス期間中の瞬時損失。平均損失（Pp×D）ではない点に注意。ピーク Tj を決めるのは瞬時値である。",
  ],
  pitfalls: [
    "θja をそのまま信じるのが最大の罠。JEDEC 基板と実基板では銅箔面積が違い、実力は数十%〜数倍ずれる。基板依存を見込んで大きめの余裕を取るか、実測で検証する。",
    "Ron・VF などの損失パラメータは高温で悪化する。25℃ の typ 値で損失を計算すると Tj を過小評価する（正のフィードバックで熱暴走もあり得る）。",
    "θcs を 0 と置かない。グリス塗布ムラ・締結トルク不足で簡単に悪化する。",
    "パルス負荷を平均損失だけで評価すると、ピーク Tj を大幅に過小評価する。平均は同じでもデューティが小さいほど瞬時損失は大きい。",
    "Zth の近似式は熱回路の1次近似であり、複数のパルス列が重なる実波形（バースト動作等）では合成が必要になる。",
    "「動いているから大丈夫」は禁物。Tj は直接見えない。10℃ の上昇が寿命を半減させるという経験則（アレニウス）を忘れない。",
  ],
  primarySources: [
    "データシートの絶対最大定格 Tj(max) と Thermal Characteristics（θja / θjc / Ψjt）。",
    "θja の測定条件（JEDEC JESD51 系のどの基板か）の脚注。",
    "過渡熱インピーダンス曲線 Zth(t) — パルス用途の場合。",
    "ヒートシンクカタログの熱抵抗−風速特性。グリス/シートのデータシート（熱伝導率と推奨厚み）。",
  ],
};

export const thermalModule: ToolkitModule = {
  id: "thermal",
  title: "半導体 熱計算",
  shortTitle: "熱計算",
  description: "Tj = Ta + P×θ の直列熱抵抗モデルでジャンクション温度と余裕を判定",
  tier: "paid",
  fields: THERMAL_FIELDS,
  compute: computeThermal,
  explanation: THERMAL_EXPLANATION,
};
