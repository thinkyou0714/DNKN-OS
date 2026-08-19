/**
 * thermal.ts — 半導体の熱計算（ジャンクション温度・純ロジック）。
 *
 * モデル: 定常状態の熱抵抗直列モデル。
 *  - 簡易（ヒートシンクなし）: Tj = Ta + P × θja
 *  - ヒートシンクあり:         Tj = Ta + P × (θjc + θcs + θsa)
 * 判定は Tj の絶対値を Tj(max) に対する百分率で評価する（既定 80%。125℃ 定格なら 100℃ 相当）。
 *
 * 根拠解説の技術内容はドラフト。販売前に販売者（実務者）の最終監修を受けること。
 */

import type { ExplanationDoc, FieldSpec, ModuleResult, ToolkitModule } from "./types.js";
import { judgeUsage, num, validateFields } from "./types.js";

export const THERMAL_FIELDS: FieldSpec[] = [
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

export function computeThermal(values: Record<string, number | string>): ModuleResult {
  const v = validateFields(THERMAL_FIELDS, values);
  if (!v.ok) return { ok: false, errors: v.errors };
  const model = v.input.sels.model;
  const ambientTemp = num(v.input, "ambientTemp");
  const power = num(v.input, "power");
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

  const tj = ambientTemp + power * theta;
  const usagePercent = (tj / tjMax) * 100;
  const margin = tjMax - tj;
  const notes: string[] = [
    "定常状態の直列熱抵抗モデルです。パルス損失は過渡熱抵抗（Transient Thermal Impedance）で別途評価してください。",
  ];
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
    items: [
      { label: "合成熱抵抗", value: theta, unit: "℃/W" },
      { label: "ジャンクション温度 Tj", value: tj, unit: "℃" },
      { label: "Tj(max) までの余裕", value: margin, unit: "℃" },
      { label: "Tj / Tj(max)", value: usagePercent, unit: "%" },
    ],
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
  ],
  pitfalls: [
    "θja をそのまま信じるのが最大の罠。JEDEC 基板と実基板では銅箔面積が違い、実力は数十%〜数倍ずれる。基板依存を見込んで大きめの余裕を取るか、実測で検証する。",
    "Ron・VF などの損失パラメータは高温で悪化する。25℃ の typ 値で損失を計算すると Tj を過小評価する（正のフィードバックで熱暴走もあり得る）。",
    "θcs を 0 と置かない。グリス塗布ムラ・締結トルク不足で簡単に悪化する。",
    "パルス負荷は定常式では評価できない。短時間なら過渡熱インピーダンス Zth(t) で許容損失が大きくなる方向だが、必ず曲線で確認する。",
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
