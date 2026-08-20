/**
 * capacitor.ts — コンデンサのディレーティング＋寿命推定（純ロジック）。
 *
 * - セラミック: 電圧ディレーティング率のみ（既定閾値 50%）。DC バイアスによる実効容量低下は
 *   判定対象外（notes と根拠解説で注意喚起する）。
 * - アルミ電解: 電圧ディレーティング（既定閾値 80%）に加え、アレニウス則（10℃2倍則）で
 *   寿命を推定する。リプル電流による内部温度上昇は ΔT = ΔT0 × (Ir/(Ir0×kf))² の簡易モデル
 *   （kf = 周波数補正係数。定格周波数どおりなら 1.0）。
 *   L = L0 × 2^((T0 − Ta − ΔT) / 10)
 *   メーカー各社の寿命式（リプル項の扱い）は微妙に異なるため、あくまで一次近似であり、
 *   採用部品のメーカー計算式を優先すべきことを notes に明記する。
 *
 * 根拠解説の技術内容はドラフト。販売前に販売者（実務者）の最終監修を受けること。
 */

import type { ExplanationDoc, FieldSpec, ModuleResult, ToolkitModule } from "./types.js";
import { judgeUsage, num, validateFields, worstVerdict } from "./types.js";

/** 15年 [h]。電解コンデンサの寿命推定はこれを超えたら上限扱いにするのが一般的な慣行。 */
export const ELECTROLYTIC_LIFE_CAP_HOURS = 15 * 8760;

export const CAPACITOR_FIELDS: FieldSpec[] = [
  {
    key: "capType",
    label: "コンデンサ種別",
    kind: "select",
    defaultValue: "ceramic",
    options: [
      { value: "ceramic", label: "セラミック（MLCC）" },
      { value: "electrolytic", label: "アルミ電解" },
    ],
  },
  {
    key: "ratedVoltage",
    label: "定格電圧",
    unit: "V",
    kind: "number",
    defaultValue: 16,
    min: 0,
    minExclusive: true,
    max: 100000,
  },
  {
    key: "appliedVoltage",
    label: "印加電圧",
    unit: "V",
    kind: "number",
    defaultValue: 5,
    min: 0,
    max: 100000,
    help: "DC バイアス＋リプルピークを含む worst case の電圧",
  },
  {
    key: "voltThresholdCeramic",
    label: "判定閾値（電圧ディレーティング）",
    unit: "%",
    kind: "number",
    defaultValue: 50,
    min: 0,
    minExclusive: true,
    max: 100,
    help: "MLCC の一般的なディレーティング慣行は 50%（DC バイアス特性も考慮した安全側）",
    showIf: { key: "capType", equals: "ceramic" },
  },
  {
    key: "voltThresholdElec",
    label: "判定閾値（電圧ディレーティング）",
    unit: "%",
    kind: "number",
    defaultValue: 80,
    min: 0,
    minExclusive: true,
    max: 100,
    help: "アルミ電解の一般的なディレーティング慣行は 80%",
    showIf: { key: "capType", equals: "electrolytic" },
  },
  {
    key: "ratedLife",
    label: "定格寿命",
    unit: "h",
    kind: "number",
    defaultValue: 5000,
    min: 0,
    minExclusive: true,
    max: 1000000,
    help: "データシートの保証寿命（定格温度・定格リプルでの値。例: 105℃ 5000h）",
    showIf: { key: "capType", equals: "electrolytic" },
  },
  {
    key: "ratedTemp",
    label: "定格上限温度",
    unit: "℃",
    kind: "number",
    defaultValue: 105,
    min: 0,
    max: 200,
    help: "カテゴリ上限温度（85℃ 品 / 105℃ 品など）",
    showIf: { key: "capType", equals: "electrolytic" },
  },
  {
    key: "ambientTemp",
    label: "周囲温度",
    unit: "℃",
    kind: "number",
    defaultValue: 55,
    min: -55,
    max: 200,
    help: "部品周囲の局所温度（筐体内温度上昇を含める）",
    showIf: { key: "capType", equals: "electrolytic" },
  },
  {
    key: "rippleCurrent",
    label: "実リプル電流",
    unit: "Arms",
    kind: "number",
    defaultValue: 0,
    min: 0,
    max: 10000,
    help: "実回路のリプル電流実効値（0 なら自己発熱なしとして計算）",
    showIf: { key: "capType", equals: "electrolytic" },
  },
  {
    key: "ratedRipple",
    label: "定格リプル電流",
    unit: "Arms",
    kind: "number",
    defaultValue: 1,
    min: 0,
    minExclusive: true,
    max: 10000,
    help: "データシートの許容リプル電流（定格温度・定格周波数での値）",
    showIf: { key: "capType", equals: "electrolytic" },
  },
  {
    key: "freqCoeff",
    label: "周波数補正係数",
    kind: "number",
    defaultValue: 1,
    min: 0,
    minExclusive: true,
    max: 10,
    help: "データシートの周波数補正係数（許容リプル電流の倍率）。定格周波数どおりなら 1.0",
    showIf: { key: "capType", equals: "electrolytic" },
  },
  {
    key: "coreRise",
    label: "定格リプル時の中心温度上昇",
    unit: "K",
    kind: "number",
    defaultValue: 5,
    min: 0,
    max: 50,
    help: "定格リプルを流したときの内部温度上昇（5K が一般的な目安。メーカー資料があれば実値を）",
    showIf: { key: "capType", equals: "electrolytic" },
  },
  {
    key: "requiredLife",
    label: "要求寿命",
    unit: "h",
    kind: "number",
    defaultValue: 87600,
    min: 0,
    minExclusive: true,
    max: 1000000,
    help: "製品の設計寿命（例: 10年 = 87,600h）",
    showIf: { key: "capType", equals: "electrolytic" },
  },
];

/**
 * アレニウス則（10℃2倍則）による電解コンデンサの推定寿命 [h]。
 * ΔT = coreRise × (Ir/(Ir0×kf))² を内部温度上昇とし、L = L0 × 2^((T0 − Ta − ΔT)/10)。
 */
export function estimateElectrolyticLife(params: {
  ratedLife: number;
  ratedTemp: number;
  ambientTemp: number;
  rippleCurrent: number;
  ratedRipple: number;
  coreRise: number;
  /** 周波数補正係数（許容リプル電流の倍率）。省略時 1.0＝定格周波数どおり。 */
  freqCoeff?: number;
}): { lifeHours: number; rippleRise: number; rippleUsage: number } {
  const kf = params.freqCoeff ?? 1;
  // 補正後の許容リプルに対する比。発熱は I²R なので温度上昇はこの比の2乗で効く。
  const rippleUsage = params.rippleCurrent / (params.ratedRipple * kf);
  const rippleRise = params.coreRise * rippleUsage ** 2;
  const lifeHours = params.ratedLife * 2 ** ((params.ratedTemp - params.ambientTemp - rippleRise) / 10);
  return { lifeHours, rippleRise, rippleUsage: rippleUsage * 100 };
}

export function computeCapacitor(values: Record<string, number | string>): ModuleResult {
  const v = validateFields(CAPACITOR_FIELDS, values);
  if (!v.ok) return { ok: false, errors: v.errors };
  const capType = v.input.sels.capType;
  const ratedVoltage = num(v.input, "ratedVoltage");
  const appliedVoltage = num(v.input, "appliedVoltage");

  const voltUsage = (appliedVoltage / ratedVoltage) * 100;

  if (capType === "ceramic") {
    const threshold = num(v.input, "voltThresholdCeramic");
    return {
      ok: true,
      items: [{ label: "電圧ディレーティング率", value: voltUsage, unit: "%" }],
      usagePercent: voltUsage,
      verdict: judgeUsage(voltUsage, threshold),
      notes: [
        "MLCC は DC バイアスで実効容量が大きく低下します（判定対象外）。容量が効く回路では必ずバイアス特性グラフを確認してください。",
        "クラス2誘電体（X5R/X7R 等）は温度・経時でも容量が変動します。",
      ],
    };
  }

  // アルミ電解
  const threshold = num(v.input, "voltThresholdElec");
  const ratedLife = num(v.input, "ratedLife");
  const ratedTemp = num(v.input, "ratedTemp");
  const ambientTemp = num(v.input, "ambientTemp");
  const rippleCurrent = num(v.input, "rippleCurrent");
  const ratedRipple = num(v.input, "ratedRipple");
  const coreRise = num(v.input, "coreRise");
  const freqCoeff = num(v.input, "freqCoeff");
  const requiredLife = num(v.input, "requiredLife");

  const { lifeHours, rippleRise, rippleUsage } = estimateElectrolyticLife({
    ratedLife,
    ratedTemp,
    ambientTemp,
    rippleCurrent,
    ratedRipple,
    coreRise,
    freqCoeff,
  });
  const lifeUsage = (requiredLife / lifeHours) * 100;
  const voltVerdict = judgeUsage(voltUsage, threshold);
  // 寿命の合否は「要求寿命 ÷ 推定寿命」を負荷率とみなして共通の3値判定に載せる（閾値 100% 固定）。
  const lifeVerdict = judgeUsage(lifeUsage, 100);
  // リプル電流は補正後の許容値を超えた時点で不適（寿命以前に定格違反）。
  const rippleVerdict = judgeUsage(rippleUsage, 100);

  const overTemp = ambientTemp + rippleRise > ratedTemp;
  const notes: string[] = [
    "寿命式は 10℃2倍則＋リプル自己発熱 ΔT=ΔT0×(Ir/Ir0)² の一次近似です。採用部品のメーカー寿命計算式（リプル項の扱いが各社異なる）を優先してください。",
    "低温では ESR 増大・容量低下が起きます（寿命とは別の制約）。",
    "リプル電流の許容値は周波数で変わります。スイッチング電源など定格周波数と違う用途では、データシートの周波数補正係数を必ず入れてください。",
  ];
  if (overTemp) {
    notes.unshift("周囲温度＋リプル自己発熱が定格上限温度を超えています。この条件では使用できません。");
  }
  if (lifeHours > ELECTROLYTIC_LIFE_CAP_HOURS) {
    notes.push(
      "推定寿命が15年を超えています。封口ゴムの劣化など電解液蒸散以外の故障モードが支配的になるため、15年程度を上限の目安としてください。",
    );
  }
  return {
    ok: true,
    items: [
      { label: "電圧ディレーティング率", value: voltUsage, unit: "%" },
      { label: "リプル電流負荷率（周波数補正後）", value: rippleUsage, unit: "%" },
      { label: "リプルによる内部温度上昇", value: rippleRise, unit: "K" },
      { label: "推定寿命", value: lifeHours, unit: "h" },
      { label: "推定寿命（年換算）", value: lifeHours / 8760, unit: "年" },
      { label: "寿命充足率（要求÷推定）", value: lifeUsage, unit: "%" },
    ],
    usagePercent: Math.max(voltUsage, lifeUsage, rippleUsage),
    verdict: overTemp ? "ng" : worstVerdict(worstVerdict(voltVerdict, lifeVerdict), rippleVerdict),
    notes,
  };
}

export const CAPACITOR_EXPLANATION: ExplanationDoc = {
  conclusion: [
    "セラミックは「電圧を半分に抑える」、アルミ電解は「温度を10℃下げると寿命が2倍」——この2つが実務判断の軸になる。",
    "アルミ電解の寿命は周囲温度とリプル電流でほぼ決まる。定格寿命（例: 105℃ 5000h）は最悪条件の保証値であり、実使用温度に換算してから要求寿命と比較する。",
  ],
  formula: [
    "電圧ディレーティング率 [%] = V印加 ÷ V定格 × 100",
    "推定寿命 L = L0 × 2^((T0 − Ta − ΔT) / 10)　（10℃2倍則）",
    "リプルによる内部温度上昇 ΔT = ΔT0 × (Ir / (Ir0 × kf))²",
    "リプル電流負荷率 [%] = Ir ÷ (Ir0 × kf) × 100",
  ],
  terms: [
    "L0: データシートの定格寿命（定格上限温度・定格リプルでの保証時間。105℃ 5000h など）。",
    "T0: 定格上限温度（カテゴリ上限温度）。85℃ 品と 105℃ 品では同条件でも寿命が4倍変わる。",
    "Ta: 実使用の周囲温度。筐体内の温度上昇を含む部品周囲の局所温度。",
    "ΔT: リプル電流の自己発熱による内部（コア）温度上昇。発熱は I²R なのでリプル比の2乗で効く。",
    "ΔT0: 定格リプルを流したときの内部温度上昇。5K 前後が一般的な目安（メーカー資料があれば実値を使う）。",
    "Ir/Ir0: 実リプル電流と定格リプル電流の比。発熱は I²R なので温度上昇はこの比の2乗で効く。",
    "kf: 周波数補正係数。許容リプル電流は周波数で変わり（低周波では小さく、高周波では大きい）、データシートの表・グラフから読む。本ツールは Ir0×kf を実効的な許容値として扱う。",
  ],
  pitfalls: [
    "10℃2倍則は電解液の蒸散（化学反応速度）に基づく経験則で、セラミックやフィルムには適用しない。",
    "寿命推定が15年を超えたら鵜呑みにしない。封口ゴム劣化など別の故障モードが支配的になるため、15年程度を上限の目安とするのが一般的。",
    "リプル電流は周波数で許容値が変わる（周波数補正係数）。スイッチング電源の高周波リプルは補正後の定格で比較する。",
    "MLCC の電圧ディレーティングは信頼性だけでなく DC バイアスによる容量低下対策でもある。50% でも容量は公称値より大きく減っていることがある。",
    "「使用温度範囲内だから大丈夫」ではない。温度範囲は動作可否、寿命は別の話。",
  ],
  primarySources: [
    "データシートの定格寿命（Endurance / Load Life）と定格上限温度。",
    "許容リプル電流と周波数補正係数（Frequency Coefficient）の表。",
    "メーカーの寿命計算式テクニカルノート（各社で ΔT の扱いが異なる。採用メーカーの式を正とする）。",
    "MLCC: DC バイアス特性・温度特性グラフ（メーカーのシミュレーションツールが最も正確）。",
  ],
};

export const capacitorModule: ToolkitModule = {
  id: "capacitor",
  title: "コンデンサ ディレーティング＋寿命推定",
  shortTitle: "コンデンサ",
  description: "セラミックの電圧ディレーティングと、アルミ電解のアレニウス則（10℃2倍則）寿命推定",
  tier: "paid",
  fields: CAPACITOR_FIELDS,
  compute: computeCapacitor,
  explanation: CAPACITOR_EXPLANATION,
};
