/**
 * voltage-drop.ts — 電線・ケーブルの電圧降下計算（直流・単相2線。純ロジック）。
 *
 * モデル: 抵抗成分のみの往復電圧降下 e = 2 × I × ρ × L / A。
 * 細物電線（38mm² 程度まで）はリアクタンスより抵抗が支配的で、この式が実用近似になる。
 * 三相・力率考慮は第2弾（本モジュールの notes と根拠解説で明示）。
 *
 * 抵抗率プリセット:
 *  - 軟銅 20℃: 0.017241 Ω·mm²/m（IACS 100% の定義値）
 *  - 軟銅 簡易式相当: 0.0178 Ω·mm²/m（内線規程で知られる係数 35.6 = 2×1000×0.0178 に対応。
 *    導体温度上昇を見込んだ実用値）
 *  - 硬アルミ 20℃: 0.028264 Ω·mm²/m（IACS 61%）
 *
 * 根拠解説の技術内容はドラフト。販売前に販売者（実務者）の最終監修を受けること。
 */

import type { ExplanationDoc, FieldSpec, ModuleResult, ToolkitModule } from "./types.js";
import { judgeUsage, num, validateFields } from "./types.js";

/** 抵抗率プリセット [Ω·mm²/m]。 */
export const RESISTIVITY = {
  cu20: 0.017241,
  cuPractical: 0.0178,
  al20: 0.028264,
} as const;

/** select 値（string）→ プリセット抵抗率の引き当て用ビュー。 */
const PRESET_RHO: Record<string, number> = RESISTIVITY;

export const VOLTAGE_DROP_FIELDS: FieldSpec[] = [
  {
    // 直流/単相2線は同じ係数2で計算が一致するため compute は参照しないが、
    // 計算書への記載と三相対応（第2弾）の布石として選択・保存する。
    key: "circuit",
    label: "回路方式",
    kind: "select",
    defaultValue: "single2",
    options: [
      { value: "single2", label: "単相2線式" },
      { value: "dc2", label: "直流2線式" },
    ],
  },
  {
    key: "material",
    label: "導体材質",
    kind: "select",
    defaultValue: "cuPractical",
    options: [
      { value: "cuPractical", label: "軟銅（簡易式相当 0.0178）" },
      { value: "cu20", label: "軟銅（20℃ 0.017241）" },
      { value: "al20", label: "硬アルミ（20℃ 0.028264）" },
      { value: "custom", label: "カスタム（抵抗率を入力）" },
    ],
  },
  {
    key: "customRho",
    label: "抵抗率",
    unit: "Ω·mm²/m",
    kind: "number",
    defaultValue: 0.0178,
    min: 0,
    minExclusive: true,
    max: 1,
    help: "導体温度補正後の値など、任意の抵抗率を指定できます",
    showIf: { key: "material", equals: "custom" },
  },
  {
    key: "area",
    label: "導体断面積",
    unit: "mm²",
    kind: "number",
    defaultValue: 2,
    min: 0,
    minExclusive: true,
    max: 2000,
    help: "公称断面積（2sq なら 2）",
  },
  {
    key: "length",
    label: "こう長（片道）",
    unit: "m",
    kind: "number",
    defaultValue: 20,
    min: 0,
    minExclusive: true,
    max: 100000,
    help: "電源から負荷までの片道の電線長（往復分は式が考慮する）",
  },
  {
    key: "current",
    label: "負荷電流",
    unit: "A",
    kind: "number",
    defaultValue: 10,
    min: 0,
    max: 10000,
  },
  {
    key: "supplyVoltage",
    label: "送電端電圧",
    unit: "V",
    kind: "number",
    defaultValue: 100,
    min: 0,
    minExclusive: true,
    max: 100000,
  },
  {
    key: "threshold",
    label: "判定閾値（電圧降下率）",
    unit: "%",
    kind: "number",
    defaultValue: 2,
    min: 0,
    minExclusive: true,
    max: 100,
    help: "分岐回路 2%・幹線 3% が一般に知られる目安（適用規程の実値を確認のこと）",
  },
];

export function computeVoltageDrop(values: Record<string, number | string>): ModuleResult {
  const v = validateFields(VOLTAGE_DROP_FIELDS, values);
  if (!v.ok) return { ok: false, errors: v.errors };
  const material = v.input.sels.material ?? "cuPractical";
  // validateFields が options 外の値を既定値へ倒すため、?? は型のためのフォールバック。
  const rho = material === "custom" ? num(v.input, "customRho") : (PRESET_RHO[material] ?? RESISTIVITY.cuPractical);
  const area = num(v.input, "area");
  const length = num(v.input, "length");
  const current = num(v.input, "current");
  const supplyVoltage = num(v.input, "supplyVoltage");
  const threshold = num(v.input, "threshold");

  const oneWayResistance = (rho * length) / area; // 片道導体抵抗 [Ω]
  const drop = 2 * current * oneWayResistance; // 往復電圧降下 [V]
  const dropPercent = (drop / supplyVoltage) * 100;
  const loadVoltage = supplyVoltage - drop;

  return {
    ok: true,
    items: [
      { label: "往復導体抵抗", value: 2 * oneWayResistance, unit: "Ω", digits: 4 },
      { label: "電圧降下", value: drop, unit: "V" },
      { label: "電圧降下率", value: dropPercent, unit: "%" },
      { label: "受電端（負荷端）電圧", value: loadVoltage, unit: "V", digits: 4 },
    ],
    usagePercent: dropPercent,
    verdict: judgeUsage(dropPercent, threshold),
    notes: [
      "抵抗成分のみの計算です。太物ケーブル・低力率負荷ではリアクタンス分の影響が出ます（三相・力率考慮は今後対応予定）。",
      "導体抵抗は温度で変わります（銅は約 0.4%/℃）。許容電流近くで使う電線は温度補正した抵抗率で確認してください。",
      "電動機の始動電流など、突入時の電圧降下は別途評価が必要です。",
    ],
  };
}

export const VOLTAGE_DROP_EXPLANATION: ExplanationDoc = {
  conclusion: [
    "電圧降下は「導体抵抗 × 電流 × 往復分」。単純だが、こう長を片道で数えるか往復で数えるか、係数 35.6 がどこから来るかを説明できるかどうかで設計の信頼性が変わる。",
    "分岐回路 2%・幹線 3% という目安に対し、本ツールは電圧降下率で直接判定する。",
  ],
  formula: [
    "電圧降下 e [V] = 2 × I × R片道 = 2 × I × ρ × L / A　（直流・単相2線式）",
    "簡易式（銅線）: e = 35.6 × L × I / (1000 × A)",
    "電圧降下率 [%] = e ÷ V送電端 × 100",
  ],
  terms: [
    "ρ: 導体の抵抗率 [Ω·mm²/m]。軟銅 20℃ で 0.017241（IACS 100%）。",
    "L: こう長 [m]。電源から負荷までの片道。往復2本分は式の係数 2 が受け持つ。",
    "A: 導体の公称断面積 [mm²]。より線は素線合計の公称値を使う。",
    "係数 35.6 の正体: 2 × 1000 × 0.0178。0.0178 は軟銅の抵抗率を導体温度上昇分だけ割り増した実用値で、1000 は m→km 換算ではなく式の整理で A[mm²]・L[m] のまま V を得るための係数。つまり簡易式は本ツールの物理式と同じものである。",
    "判定閾値: 電気設備の設計慣行として分岐回路 2%・幹線 3% が広く知られる（適用する規程・社内基準の実値を必ず確認）。",
  ],
  pitfalls: [
    "こう長 L を往復で入れてしまい 2 倍過大に見積もる（式の 2 と二重計上）。本ツールは片道入力。",
    "単相3線式の中性線平衡時は外線1本分（係数 1）になるなど、回路方式で係数が変わる。2線式の式を使い回さない。",
    "細物では抵抗支配だが、38mm² を超えるあたりからリアクタンスが無視できなくなる。太物・長距離・低力率は等価抵抗法などで別途検討する。",
    "電圧降下率の基準電圧（送電端か受電端か）を混同しない。本ツールは送電端基準。",
    "許容電流ギリギリの電線は導体温度が上がり抵抗も増える。20℃ の抵抗率のままでは楽観側になる。",
  ],
  primarySources: [
    "内線規程の電圧降下の節（許容値と簡易式の適用条件。規程本文は必ず原文で確認）。",
    "電線メーカーのカタログ（導体抵抗 [Ω/km] の実測値・温度係数）。",
    "JIS C 3307 等の電線規格（公称断面積と導体構成）。",
    "負荷機器の仕様書（許容電圧変動範囲）。",
  ],
};

export const voltageDropModule: ToolkitModule = {
  id: "voltage-drop",
  title: "電圧降下計算",
  shortTitle: "電圧降下",
  description: "電線の断面積・こう長・電流から電圧降下と降下率を計算（直流・単相2線）",
  tier: "free",
  fields: VOLTAGE_DROP_FIELDS,
  compute: computeVoltageDrop,
  explanation: VOLTAGE_DROP_EXPLANATION,
};
