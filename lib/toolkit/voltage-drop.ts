/**
 * voltage-drop.ts — 電線・ケーブルの電圧降下計算（純ロジック）。
 *
 * モデル: 回路方式の係数 k と力率を含む一般形
 *   e = k × I × L × (r·cosθ + x·sinθ)
 * r = ρ/A（導体抵抗 [Ω/m]）、x = リアクタンス [Ω/m]。
 * k は 単相2線/直流2線=2、単相3線（平衡時・外線−中性線間）=1、三相3線=√3。
 * リアクタンス 0・力率 1 のとき、細物電線で使われる簡易式 e=2IρL/A（＝35.6 式）に一致する。
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

/**
 * 回路方式ごとの電圧降下係数 k。
 * 単相2線・直流2線は往復2本ぶんで 2、単相3線は平衡時に中性線電流が 0 になるため外線1本ぶんで 1、
 * 三相3線は線間電圧で表すため √3。
 */
export const CIRCUIT_COEFFICIENT: Record<string, number> = {
  single2: 2,
  dc2: 2,
  single3: 1,
  three3: Math.sqrt(3),
};

/** 交流の回路方式（力率・リアクタンスを表示・適用する対象）。 */
const AC_CIRCUITS = ["single2", "single3", "three3"] as const;

export const VOLTAGE_DROP_FIELDS: FieldSpec[] = [
  {
    key: "circuit",
    label: "回路方式",
    kind: "select",
    defaultValue: "single2",
    options: [
      { value: "single2", label: "単相2線式（k=2）" },
      { value: "dc2", label: "直流2線式（k=2）" },
      { value: "single3", label: "単相3線式・平衡（k=1）" },
      { value: "three3", label: "三相3線式（k=√3）" },
    ],
    help: "単相3線式は外線−中性線間、三相3線式は線間の電圧降下を求めます",
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
    help: "電源から負荷までの片道の電線長（往復分は回路係数 k が受け持つ）",
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
    key: "powerFactor",
    label: "力率 cosθ",
    kind: "number",
    defaultValue: 1,
    min: 0,
    minExclusive: true,
    max: 1,
    help: "遅れ力率を想定（1.0 で抵抗のみの計算になる）。電動機負荷は 0.8 前後",
    showIf: { key: "circuit", equals: AC_CIRCUITS },
  },
  {
    key: "reactance",
    label: "リアクタンス（片道・単位長あたり）",
    unit: "mΩ/m",
    kind: "number",
    defaultValue: 0,
    min: 0,
    max: 100,
    help: "= Ω/km と同値。低圧ケーブルは 0.07〜0.1 程度。0 なら抵抗のみで計算（細物電線の実用近似）",
    showIf: { key: "circuit", equals: AC_CIRCUITS },
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
    help: "三相3線式は線間電圧、単相3線式は外線−中性線間の電圧を入れる",
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
  const circuit = v.input.sels.circuit ?? "single2";
  const material = v.input.sels.material ?? "cuPractical";
  // validateFields が options 外の値を既定値へ倒すため、?? は型のためのフォールバック。
  const rho = material === "custom" ? num(v.input, "customRho") : (PRESET_RHO[material] ?? RESISTIVITY.cuPractical);
  const k = CIRCUIT_COEFFICIENT[circuit] ?? 2;
  const isAc = (AC_CIRCUITS as readonly string[]).includes(circuit);
  // 直流では力率・リアクタンスの概念がないため、フィールドを出さず cosθ=1・x=0 として扱う。
  const cos = isAc ? num(v.input, "powerFactor") : 1;
  const reactancePerM = isAc ? num(v.input, "reactance") / 1000 : 0; // mΩ/m → Ω/m
  const sin = Math.sqrt(Math.max(0, 1 - cos * cos));

  const area = num(v.input, "area");
  const length = num(v.input, "length");
  const current = num(v.input, "current");
  const supplyVoltage = num(v.input, "supplyVoltage");
  const threshold = num(v.input, "threshold");

  const resistance = (rho * length) / area; // 片道導体抵抗 [Ω]
  const reactance = reactancePerM * length; // 片道リアクタンス [Ω]
  const drop = k * current * (resistance * cos + reactance * sin);
  const dropPercent = (drop / supplyVoltage) * 100;
  const loadVoltage = supplyVoltage - drop;

  const notes: string[] = [];
  if (isAc && reactancePerM === 0) {
    notes.push(
      "リアクタンス 0 で計算しています（抵抗のみ）。細物電線では実用上十分ですが、38mm² 超・長距離・低力率ではケーブルの実値を入れてください。",
    );
  }
  notes.push(
    "導体抵抗は温度で変わります（銅は約 0.4%/℃）。許容電流近くで使う電線は温度補正した抵抗率で確認してください。",
  );
  notes.push("電動機の始動電流など、突入時の電圧降下は別途評価が必要です。");
  if (circuit === "single3") {
    notes.push(
      "単相3線式の係数 1 は負荷平衡（中性線電流 0）が前提です。不平衡時は中性線の電圧降下を別途検討してください。",
    );
  }

  const items = [
    { label: "回路係数 k", value: k, unit: "", digits: 4 },
    { label: "導体抵抗（片道）", value: resistance, unit: "Ω", digits: 4 },
    { label: "電圧降下", value: drop, unit: "V" },
    { label: "電圧降下率", value: dropPercent, unit: "%" },
    { label: "受電端（負荷端）電圧", value: loadVoltage, unit: "V", digits: 4 },
  ];
  // リアクタンス分は入力されたときだけ出す（0 の行は紙面と画面のノイズになる）。
  if (reactance > 0) items.splice(2, 0, { label: "リアクタンス（片道）", value: reactance, unit: "Ω", digits: 4 });

  return {
    ok: true,
    items,
    usagePercent: dropPercent,
    verdict: judgeUsage(dropPercent, threshold),
    notes,
  };
}

export const VOLTAGE_DROP_EXPLANATION: ExplanationDoc = {
  conclusion: [
    "電圧降下は「回路係数 k × 電流 × こう長 × インピーダンス成分」。k を回路方式で取り違えることと、こう長を往復で二重に数えることが二大事故である。",
    "細物電線・力率1なら抵抗だけの簡易式で十分だが、太物・長距離・低力率ではリアクタンス項 x·sinθ が効いてくる。",
  ],
  formula: [
    "電圧降下 e [V] = k × I × L × (r·cosθ + x·sinθ)",
    "r = ρ / A [Ω/m]（導体抵抗）　x = リアクタンス [Ω/m]",
    "k = 2（単相2線・直流2線）／ 1（単相3線・平衡）／ √3（三相3線）",
    "簡易式（銅線・単相2線・力率1）: e = 35.6 × L × I / (1000 × A)",
    "電圧降下率 [%] = e ÷ V送電端 × 100",
  ],
  terms: [
    "k: 回路方式の係数。単相2線は往復2本ぶんで 2。単相3線は平衡時に中性線電流が 0 になるため外線1本ぶんの 1。三相3線は線間電圧で表すため √3。",
    "ρ: 導体の抵抗率 [Ω·mm²/m]。軟銅 20℃ で 0.017241（IACS 100%）。",
    "L: こう長 [m]。電源から負荷までの片道。往復2本分は係数 k が受け持つ。",
    "A: 導体の公称断面積 [mm²]。より線は素線合計の公称値を使う。",
    "cosθ: 力率。遅れ力率を前提に sinθ = √(1−cos²θ) として計算する。",
    "x: 単位長あたりリアクタンス。mΩ/m は Ω/km と同値で、低圧ケーブルでは 0.07〜0.1 程度。",
    "係数 35.6 の正体: 2 × 1000 × 0.0178。0.0178 は軟銅の抵抗率を導体温度上昇分だけ割り増した実用値で、1000 は m→km 換算ではなく A[mm²]・L[m] のまま V を得るための整理係数。つまり簡易式は本ツールの一般式で k=2・cosθ=1・x=0 とした場合そのものである。",
    "判定閾値: 電気設備の設計慣行として分岐回路 2%・幹線 3% が広く知られる（適用する規程・社内基準の実値を必ず確認）。",
  ],
  pitfalls: [
    "こう長 L を往復で入れてしまい 2 倍過大に見積もる（係数 k と二重計上）。本ツールは片道入力。",
    "三相の式に単相の 2 を使う（またはその逆）。√3 と 2 では 15% 以上ずれる。",
    "単相3線式の 1 は「負荷が平衡していれば」の話。不平衡なら中性線にも電流が流れ、電圧降下は増える。",
    "力率を無視すると低力率負荷で過小評価になる。リアクタンス項は cosθ が小さいほど効く。",
    "電圧降下率の基準電圧（送電端か受電端か）を混同しない。本ツールは送電端基準。",
    "許容電流ギリギリの電線は導体温度が上がり抵抗も増える。20℃ の抵抗率のままでは楽観側になる。",
  ],
  primarySources: [
    "内線規程の電圧降下の節（許容値と簡易式の適用条件。規程本文は必ず原文で確認）。",
    "電線メーカーのカタログ（導体抵抗 [Ω/km]・リアクタンス [Ω/km]・温度係数の実測値）。",
    "JIS C 3307 等の電線規格（公称断面積と導体構成）。",
    "負荷機器の仕様書（許容電圧変動範囲・力率）。",
  ],
};

export const voltageDropModule: ToolkitModule = {
  id: "voltage-drop",
  title: "電圧降下計算",
  shortTitle: "電圧降下",
  description: "単相2線・直流・単相3線・三相3線の電圧降下を力率・リアクタンス込みで計算",
  tier: "free",
  fields: VOLTAGE_DROP_FIELDS,
  compute: computeVoltageDrop,
  explanation: VOLTAGE_DROP_EXPLANATION,
};
