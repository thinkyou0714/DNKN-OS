/**
 * resistor-derating.ts — 抵抗のディレーティング計算（純ロジック）。
 *
 * モデル: 定格電力 P0 は周囲温度 Ts（折れ点）まで 100%、Ts〜Tz（全ディレーティング温度）で
 * 直線的に低減し、Tz 以上で 0 になる（データシートの derating curve の一般形）。
 * 負荷率 = 実使用電力 ÷ 温度ディレーティング後の許容電力。判定閾値の既定 50% は
 * 一般的な信頼性設計のストレス低減慣行（電力ストレス比 0.5 以下）に合わせている。
 *
 * 根拠解説の技術内容はドラフト。販売前に販売者（実務者）の最終監修を受けること。
 */

import type { ExplanationDoc, FieldSpec, ModuleResult, ToolkitModule } from "./types.js";
import { judgeUsage, num, validateFields } from "./types.js";

export const RESISTOR_FIELDS: FieldSpec[] = [
  {
    key: "ratedPower",
    label: "定格電力",
    unit: "W",
    kind: "number",
    defaultValue: 0.25,
    min: 0,
    minExclusive: true,
    max: 10000,
    help: "データシートの定格電力（Ts 以下の周囲温度での値）",
  },
  {
    key: "actualPower",
    label: "実使用電力",
    unit: "W",
    kind: "number",
    defaultValue: 0.1,
    min: 0,
    max: 10000,
    help: "実回路での消費電力（worst case）",
  },
  {
    key: "ambientTemp",
    label: "周囲温度",
    unit: "℃",
    kind: "number",
    defaultValue: 60,
    min: -55,
    max: 300,
    help: "部品周囲の局所温度（筐体内温度上昇を含める）",
  },
  {
    key: "derateStart",
    label: "ディレーティング開始温度",
    unit: "℃",
    kind: "number",
    defaultValue: 70,
    min: -55,
    max: 300,
    help: "定格 100% を維持できる上限周囲温度（データシートの折れ点。70℃ が典型）",
  },
  {
    key: "fullDerate",
    label: "全ディレーティング温度",
    unit: "℃",
    kind: "number",
    defaultValue: 155,
    min: -55,
    max: 400,
    help: "許容電力が 0 になる温度（155℃ が典型。シリーズにより異なる）",
  },
  {
    key: "threshold",
    label: "判定閾値（負荷率）",
    unit: "%",
    kind: "number",
    defaultValue: 50,
    min: 0,
    minExclusive: true,
    max: 100,
    help: "一般的なディレーティング慣行は 50%（電力ストレス比 0.5）",
  },
];

export function computeResistorDerating(values: Record<string, number | string>): ModuleResult {
  const v = validateFields(RESISTOR_FIELDS, values);
  if (!v.ok) return { ok: false, errors: v.errors };
  const ratedPower = num(v.input, "ratedPower");
  const actualPower = num(v.input, "actualPower");
  const ambientTemp = num(v.input, "ambientTemp");
  const derateStart = num(v.input, "derateStart");
  const fullDerate = num(v.input, "fullDerate");
  const threshold = num(v.input, "threshold");
  if (fullDerate <= derateStart) {
    return {
      ok: false,
      errors: [{ key: "fullDerate", message: "全ディレーティング温度はディレーティング開始温度より高くしてください" }],
    };
  }

  // 直線ディレーティングカーブ: Ts 以下 100% / Tz 以上 0% / 中間は線形。
  let ratio: number;
  if (ambientTemp <= derateStart) ratio = 1;
  else if (ambientTemp >= fullDerate) ratio = 0;
  else ratio = (fullDerate - ambientTemp) / (fullDerate - derateStart);

  const allowable = ratedPower * ratio;
  const usagePercent = allowable > 0 ? (actualPower / allowable) * 100 : Number.POSITIVE_INFINITY;
  const notes: string[] = [];
  if (ratio === 0) {
    notes.push("周囲温度が全ディレーティング温度以上のため、この条件では使用できません。");
  }
  notes.push("負荷率は「温度ディレーティング後の許容電力」に対する比です（定格電力そのものではありません）。");

  return {
    ok: true,
    items: [
      { label: "温度ディレーティング後の許容電力", value: allowable, unit: "W" },
      { label: "負荷率", value: usagePercent, unit: "%" },
    ],
    usagePercent,
    verdict: judgeUsage(usagePercent, threshold),
    notes,
  };
}

export const RESISTOR_EXPLANATION: ExplanationDoc = {
  conclusion: [
    "抵抗は「定格電力いっぱい」では使わない。周囲温度によるディレーティングカーブで許容電力を下げたうえで、さらにその 50% 程度までに抑えるのが信頼性設計の定石である。",
    "本ツールは (1) 温度ディレーティング後の許容電力、(2) それに対する負荷率、の2段階で評価する。",
  ],
  formula: [
    "許容電力 P(Ta) = P0 × k(Ta)",
    "k(Ta) = 1（Ta ≤ Ts）／ (Tz − Ta)/(Tz − Ts)（Ts < Ta < Tz）／ 0（Ta ≥ Tz）",
    "負荷率 [%] = P使用 ÷ P(Ta) × 100",
  ],
  terms: [
    "P0: データシートの定格電力。「周囲温度 Ts 以下」という条件付きの値であることに注意。",
    "Ts: ディレーティング開始温度（折れ点）。汎用チップ抵抗・炭素皮膜抵抗では 70℃ が典型。",
    "Tz: 全ディレーティング温度。許容電力がゼロになる周囲温度で、155℃ が典型（部品シリーズで異なる）。",
    "k(Ta): ディレーティング係数。折れ点から直線で低減する近似は大半のデータシートのカーブと一致する。",
    "判定閾値: 温度ディレーティング後の許容電力に対する電力ストレス比。一般的な信頼性設計指針では 0.5（50%）以下が推奨される。",
  ],
  pitfalls: [
    "「周囲温度」は室温ではない。筐体内の温度上昇や近接発熱部品の影響を含めた、部品周囲の局所温度で評価する。",
    "定格電力の 50% で使っていても、周囲温度が折れ点を超えていれば許容電力はさらに下がる。2つの低減は独立に掛かる。",
    "パルス電力は本計算の対象外。短時間の過負荷はデータシートのパルス限界グラフ（単発/繰り返し）で別途確認する。",
    "高抵抗値では電力より先に定格電圧（最高使用電圧）で制限されることがある。P = V²/R だけで判断しない。",
    "集合抵抗（アレイ）は素子単体ではなくパッケージ全体の許容電力で制限される場合がある。",
  ],
  primarySources: [
    "部品データシートの「Power Derating Curve」（折れ点 Ts・ゼロ点 Tz の実値を必ず読む）。",
    "定格電圧（Limiting Element Voltage / 最高使用電圧）の欄。",
    "パルス耐量グラフ（Pulse Limit / Surge）— パルス用途の場合。",
    "自社または業界の信頼性設計基準（ディレーティング基準表）。閾値 50% はあくまで一般的な慣行値。",
  ],
};

export const resistorDeratingModule: ToolkitModule = {
  id: "resistor-derating",
  title: "抵抗ディレーティング",
  shortTitle: "抵抗",
  description: "定格電力・周囲温度・ディレーティングカーブから許容電力と負荷率を判定",
  tier: "free",
  fields: RESISTOR_FIELDS,
  compute: computeResistorDerating,
  explanation: RESISTOR_EXPLANATION,
};
