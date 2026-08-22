/**
 * power-factor.ts — 力率改善コンデンサの容量計算（純ロジック）。
 *
 * モデル: 有効電力 P を一定として無効電力だけを打ち消す標準的な設計。
 *   必要容量 Qc = P × (tanθ1 − tanθ2)
 * 設置予定容量を入れた場合は、それによる改善後力率と過補償（進み力率）を判定する。
 * 実際に買えるコンデンサは 10/15/20/25/50 kvar のような飛び飛びの値なので、
 * 「必要容量を出す」だけでなく「その容量で足りるか・行き過ぎないか」まで見るのが実務。
 *
 * 電験（三種 電力・法規／二種 電力管理）で頻出する論点でもあり、学習アプリ側の
 * 論点と直結する。無料枠に置いて検索流入の入口にする（docs/strategy/toolkit-product.md）。
 *
 * 根拠解説の技術内容はドラフト。販売前に販売者（実務者）の最終監修を受けること。
 */

import type { ExplanationDoc, FieldSpec, ModuleResult, ResultItem, ToolkitModule, Verdict } from "./types.js";
import { num, validateFields } from "./types.js";

/** 力率 cosθ から tanθ（遅れ力率を前提）。 */
export function tanFromPf(pf: number): number {
  return Math.sqrt(Math.max(0, 1 - pf * pf)) / pf;
}

/** 有効電力と無効電力から力率（進み側でも絶対値で返す）。 */
export function pfFrom(activePower: number, reactivePower: number): number {
  const apparent = Math.hypot(activePower, reactivePower);
  return apparent === 0 ? 1 : activePower / apparent;
}

export const POWER_FACTOR_FIELDS: FieldSpec[] = [
  {
    key: "activePower",
    label: "有効電力 P",
    unit: "kW",
    kind: "number",
    defaultValue: 100,
    min: 0,
    minExclusive: true,
    max: 1000000,
    help: "負荷の有効電力（力率改善の前後で変わらない量）",
  },
  {
    key: "pfBefore",
    label: "改善前の力率 cosθ1",
    kind: "number",
    defaultValue: 0.7,
    min: 0,
    minExclusive: true,
    max: 1,
    help: "遅れ力率を想定。電力会社の請求書や実測値から",
  },
  {
    key: "pfTarget",
    label: "目標力率 cosθ2",
    kind: "number",
    defaultValue: 0.95,
    min: 0,
    minExclusive: true,
    max: 1,
    help: "力率割引の基準として 0.95 前後を目標にすることが多い",
  },
  {
    key: "lineVoltage",
    label: "線間電圧",
    unit: "V",
    kind: "number",
    defaultValue: 400,
    min: 0,
    minExclusive: true,
    max: 500000,
    help: "コンデンサを接続する回路の線間電圧",
  },
  {
    key: "frequency",
    label: "周波数",
    kind: "select",
    defaultValue: "60",
    options: [
      { value: "50", label: "50 Hz（東日本）" },
      { value: "60", label: "60 Hz（西日本）" },
    ],
  },
  {
    key: "connection",
    label: "コンデンサの結線",
    kind: "select",
    defaultValue: "delta",
    options: [
      { value: "delta", label: "Δ（三角）結線" },
      { value: "star", label: "Y（星形）結線" },
    ],
    help: "同じ容量でも必要な静電容量が3倍違う（Δのほうが小さくて済む）",
  },
  {
    key: "installedQc",
    label: "設置予定のコンデンサ容量",
    unit: "kvar",
    kind: "number",
    defaultValue: 0,
    min: 0,
    max: 1000000,
    help: "市販の規格容量を入れると、改善後力率と過補償を判定します（0 なら必要容量の算出のみ）",
  },
];

export function computePowerFactor(values: Record<string, number | string>): ModuleResult {
  const v = validateFields(POWER_FACTOR_FIELDS, values);
  if (!v.ok) return { ok: false, errors: v.errors };
  const activePower = num(v.input, "activePower");
  const pfBefore = num(v.input, "pfBefore");
  const pfTarget = num(v.input, "pfTarget");
  const lineVoltage = num(v.input, "lineVoltage");
  const installedQc = num(v.input, "installedQc");
  const frequency = Number(v.input.sels.frequency ?? "60");
  const connection = v.input.sels.connection ?? "delta";

  if (pfTarget < pfBefore) {
    return {
      ok: false,
      errors: [
        {
          key: "pfTarget",
          message: "目標力率は改善前の力率以上にしてください（コンデンサでは力率は上がる方向にしか動きません）",
        },
      ],
    };
  }

  const reactiveBefore = activePower * tanFromPf(pfBefore); // Q1 [kvar]
  const requiredQc = reactiveBefore - activePower * tanFromPf(pfTarget); // Qc [kvar]

  // 静電容量: Δ結線は各相に線間電圧、Y結線は相電圧（V/√3）がかかる。
  //   Δ: Qc = 3·V²·ωC → C = Qc/(3ωV²) ／ Y: Qc = V²·ωC → C = Qc/(ωV²)
  const omega = 2 * Math.PI * frequency;
  const denominator = (connection === "delta" ? 3 : 1) * omega * lineVoltage * lineVoltage;
  const capacitanceUf = ((requiredQc * 1000) / denominator) * 1e6;

  const currentBefore = (activePower * 1000) / (Math.sqrt(3) * lineVoltage * pfBefore);
  const currentTarget = (activePower * 1000) / (Math.sqrt(3) * lineVoltage * pfTarget);

  const items: ResultItem[] = [
    { label: "改善前の無効電力 Q1", value: reactiveBefore, unit: "kvar" },
    { label: "必要なコンデンサ容量 Qc", value: requiredQc, unit: "kvar" },
    {
      label: `必要な静電容量（${connection === "delta" ? "Δ" : "Y"}結線・1相あたり）`,
      value: capacitanceUf,
      unit: "μF",
    },
    { label: "改善前の線電流", value: currentBefore, unit: "A" },
    { label: "目標力率での線電流", value: currentTarget, unit: "A" },
    { label: "線電流の低減率", value: (1 - currentTarget / currentBefore) * 100, unit: "%" },
  ];

  const notes: string[] = [
    "有効電力 P は力率改善で変わらないという前提の標準式です。コンデンサは無効電力だけを打ち消します。",
    "高調波が多い系統では直列リアクトル（6% が一般的）を併用します。本計算はリアクトル分の電圧上昇を含みません。",
  ];

  let verdict: Verdict = "ok";
  let usagePercent = requiredQc === 0 ? 0 : (installedQc / requiredQc) * 100;

  if (installedQc > 0) {
    const reactiveAfter = reactiveBefore - installedQc;
    const pfAfter = pfFrom(activePower, reactiveAfter);
    items.push(
      { label: "設置後の無効電力 Q2", value: reactiveAfter, unit: "kvar" },
      { label: "設置後の力率", value: pfAfter, unit: "", digits: 4 },
    );
    if (reactiveAfter < 0) {
      // 進み力率（過補償）。軽負荷時の電圧上昇・電力会社との契約上の問題になる。
      verdict = "ng";
      notes.unshift(
        "設置容量が過大で進み力率（過補償）になっています。軽負荷時の電圧上昇を招くため、容量を下げるか自動力率調整（APFR）を検討してください。",
      );
    } else if (pfAfter >= pfTarget) {
      verdict = "ok";
    } else if (pfAfter >= pfTarget - 0.02) {
      verdict = "warn";
      notes.push("目標力率にわずかに届きません。1段上の規格容量で足りるか確認してください。");
    } else {
      verdict = "ng";
      notes.push("設置容量が不足しています。必要容量以上の規格容量を選定してください。");
    }
  } else {
    usagePercent = 0;
    notes.push("設置予定容量に市販の規格容量（10/15/20/25/50 kvar など）を入れると、過不足を判定します。");
  }

  return { ok: true, items, usagePercent, verdict, notes };
}

export const POWER_FACTOR_EXPLANATION: ExplanationDoc = {
  conclusion: [
    "力率改善は「有効電力はそのままに、無効電力だけをコンデンサで打ち消す」操作である。だから必要容量は Qc = P(tanθ1 − tanθ2) という引き算で出る。",
    "実務で効くのは容量の算出そのものより、規格容量に丸めたときに**過補償（進み力率）にならないか**の確認である。",
  ],
  formula: [
    "必要容量 Qc [kvar] = P × (tanθ1 − tanθ2)",
    "tanθ = √(1 − cos²θ) / cosθ",
    "静電容量 C = Qc / (3ωV²)（Δ結線）／ Qc / (ωV²)（Y結線）、　ω = 2πf",
    "線電流 I = P / (√3 · V · cosθ)",
  ],
  terms: [
    "P: 有効電力 [kW]。実際に仕事をする電力で、力率改善の前後で変わらない。",
    "Q: 無効電力 [kvar]。Q = P·tanθ。コンデンサはこれを打ち消す（進み無効電力を供給する）。",
    "tanθ1 − tanθ2: 打ち消すべき無効電力の差。力率が 0.7→0.95 なら P の約 0.69 倍が必要になる。",
    "Δ結線とY結線: Δは各相に線間電圧 V、Yは相電圧 V/√3 がかかる。同じ kvar を出すのに必要な静電容量は Y が Δ の3倍。実務でΔが多いのはこのため。",
    "線電流の低減: 力率 0.7→0.95 で電流は約 26% 減る。ケーブル・遮断器の負担と線路損失（I²R）が下がるのが力率改善の実利。",
  ],
  pitfalls: [
    "過補償（入れすぎ）が最大の落とし穴。軽負荷時に進み力率になると母線電圧が上昇し、機器に悪影響が出る。負荷変動が大きい系統は自動力率調整（APFR）で段階投入する。",
    "高調波を含む系統に裸のコンデンサを入れると共振して高調波電流が拡大する。直列リアクトル（6%）併用が原則。",
    "リアクトル付きの場合、コンデンサ端子電圧は線間電圧より約6%高くなる。コンデンサの定格電圧はそれを見込んで選ぶ。",
    "力率を 1.0 に近づけるほど得というわけではない。0.95 前後で割引が頭打ちになる契約が一般的で、それ以上は過補償リスクだけが増える。",
    "計算に使う P は最大需要時の値か平均かで結果が変わる。契約上の力率は通常「月間の平均」で評価される点に注意。",
  ],
  primarySources: [
    "電力会社の力率割引の契約要綱（評価方法と基準力率の実値）。",
    "コンデンサ・直列リアクトルのメーカーカタログ（定格電圧・許容過電流・高調波耐量）。",
    "JIS C 4902（高圧及び特別高圧進相コンデンサ）等の該当規格 — 選定時は原文を確認する。",
    "系統の高調波実測データ（第5次高調波含有率）。リアクトル要否の判断根拠になる。",
  ],
};

export const powerFactorModule: ToolkitModule = {
  id: "power-factor",
  title: "力率改善コンデンサ容量",
  shortTitle: "力率改善",
  description: "Qc = P(tanθ1 − tanθ2) で必要容量と静電容量を算出し、設置容量の過不足・過補償を判定",
  tier: "free",
  fields: POWER_FACTOR_FIELDS,
  compute: computePowerFactor,
  explanation: POWER_FACTOR_EXPLANATION,
};
