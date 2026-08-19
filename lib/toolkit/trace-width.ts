/**
 * trace-width.ts — 基板パターンの許容電流・必要パターン幅（IPC-2221 近似式。純ロジック）。
 *
 * IPC-2221 の一般に知られる近似式:
 *   I = k × ΔT^0.44 × A^0.725
 *   （I [A], ΔT [℃], A [mil²], k = 0.048（外層）/ 0.024（内層））
 * これはチャートの曲線当てはめであり、適用範囲（〜35A・ΔT 10〜100℃・幅 〜10mm 程度）を
 * 外れる条件では使えない。近似式である旨を根拠解説に明記する（仕様の要求事項）。
 *
 * 根拠解説の技術内容はドラフト。販売前に販売者（実務者）の最終監修を受けること。
 */

import type { ExplanationDoc, FieldSpec, ModuleResult, ToolkitModule } from "./types.js";
import { judgeUsage, num, validateFields } from "./types.js";

/** IPC-2221 近似式の係数（外層/内層）。 */
export const IPC_K = { external: 0.048, internal: 0.024 } as const;

const MM_PER_MIL = 0.0254;
const UM_PER_MIL = 25.4;

export const TRACE_WIDTH_FIELDS: FieldSpec[] = [
  {
    key: "layer",
    label: "配線層",
    kind: "select",
    defaultValue: "external",
    options: [
      { value: "external", label: "外層（表面）" },
      { value: "internal", label: "内層" },
    ],
  },
  {
    key: "current",
    label: "電流",
    unit: "A",
    kind: "number",
    defaultValue: 2,
    min: 0,
    minExclusive: true,
    max: 35,
    help: "定常電流（近似式の適用上限 35A）",
  },
  {
    key: "tempRise",
    label: "許容温度上昇",
    unit: "K",
    kind: "number",
    defaultValue: 10,
    min: 1,
    max: 100,
    help: "パターンの周囲に対する温度上昇の許容値（10K が安全側の定石。式の適用範囲 10〜100K）",
  },
  {
    key: "thickness",
    label: "銅箔厚",
    unit: "μm",
    kind: "number",
    defaultValue: 35,
    min: 1,
    max: 400,
    help: "18μm（1/2oz）/ 35μm（1oz）/ 70μm（2oz）が標準",
  },
  {
    key: "width",
    label: "評価するパターン幅",
    unit: "mm",
    kind: "number",
    defaultValue: 1,
    min: 0,
    minExclusive: true,
    max: 50,
    help: "実際に引く（引いた）幅。この幅の許容電流と負荷率を判定する",
  },
  {
    key: "threshold",
    label: "判定閾値（電流負荷率）",
    unit: "%",
    kind: "number",
    defaultValue: 80,
    min: 0,
    minExclusive: true,
    max: 100,
    help: "許容電流に対する使用率。ΔT 設定が既に余裕を含むため 80% が実用的な目安",
  },
];

/** 電流と許容温度上昇から必要断面積 [mil²] を逆算する。 */
export function requiredAreaMil2(current: number, tempRise: number, k: number): number {
  return (current / (k * tempRise ** 0.44)) ** (1 / 0.725);
}

/** 必要パターン幅 [mm]（銅箔厚 μm・層種別から）。 */
export function requiredTraceWidthMm(
  current: number,
  tempRise: number,
  thicknessUm: number,
  layer: "external" | "internal",
): number {
  const area = requiredAreaMil2(current, tempRise, IPC_K[layer]);
  const thicknessMil = thicknessUm / UM_PER_MIL;
  return (area / thicknessMil) * MM_PER_MIL;
}

/** 指定パターン幅 [mm] の許容電流 [A]。 */
export function allowableCurrentA(
  widthMm: number,
  tempRise: number,
  thicknessUm: number,
  layer: "external" | "internal",
): number {
  const areaMil2 = (widthMm / MM_PER_MIL) * (thicknessUm / UM_PER_MIL);
  return IPC_K[layer] * tempRise ** 0.44 * areaMil2 ** 0.725;
}

export function computeTraceWidth(values: Record<string, number | string>): ModuleResult {
  const v = validateFields(TRACE_WIDTH_FIELDS, values);
  if (!v.ok) return { ok: false, errors: v.errors };
  const layer = v.input.sels.layer === "internal" ? "internal" : "external";
  const current = num(v.input, "current");
  const tempRise = num(v.input, "tempRise");
  const thickness = num(v.input, "thickness");
  const width = num(v.input, "width");
  const threshold = num(v.input, "threshold");

  const required = requiredTraceWidthMm(current, tempRise, thickness, layer);
  const allowable = allowableCurrentA(width, tempRise, thickness, layer);
  const usagePercent = (current / allowable) * 100;

  return {
    ok: true,
    items: [
      { label: "必要パターン幅（この電流・ΔT に対して）", value: required, unit: "mm" },
      { label: "評価幅の許容電流", value: allowable, unit: "A" },
      { label: "電流負荷率", value: usagePercent, unit: "%" },
    ],
    usagePercent,
    verdict: judgeUsage(usagePercent, threshold),
    notes: [
      "IPC-2221 のチャートを曲線近似した式です。適用範囲（〜35A・ΔT 10〜100K・幅 10mm 程度まで）の外では使えません。",
      "ビア・パッド部のくびれ、周囲の発熱部品、ベタ銅の有無は考慮していません。大電流パターンは熱解析または実測で検証してください。",
      "同じ断面積でも内層は放熱が悪く、許容電流は外層の約半分になります（k の違い）。",
    ],
  };
}

export const TRACE_WIDTH_EXPLANATION: ExplanationDoc = {
  conclusion: [
    "パターン幅は「電流 × 温度上昇の予算」で決まる。IPC-2221 の近似式で必要幅を見積もり、ビアや銅箔厚も含めて電流経路全体で細り所がないかを確認するのが実務の流れである。",
    "1oz（35μm）外層・ΔT10K で 1A ≒ 0.3mm 幅、が暗算用のアンカーになる。",
  ],
  formula: [
    "I = k × ΔT^0.44 × A^0.725",
    "A [mil²] = (I / (k × ΔT^0.44))^(1/0.725)",
    "パターン幅 [mm] = A ÷ 銅箔厚 [mil] × 0.0254",
  ],
  terms: [
    "I: 定常電流 [A]。実効値で評価する（PWM 電流はデューティ考慮の実効値）。",
    "ΔT: パターンの周囲に対する許容温度上昇 [K]。10K が安全側の定石。ΔT を倍にしても許容電流は 2^0.44 ≒ 1.36 倍にしかならない。",
    "A: パターン断面積 [mil²]。1 mil = 0.0254mm。銅箔厚 1oz = 約 35μm = 約 1.38 mil。",
    "k: 層種別の係数。外層 0.048・内層 0.024。内層は放熱経路が樹脂越しになるため半分に落ちる。",
    "0.44 / 0.725 という端数の指数: チャートの曲線当てはめの結果であり、物理式ではない。だからこそ適用範囲の外挿は禁物。",
  ],
  pitfalls: [
    "「近似式だから多少外れても大丈夫」ではない。35A 超・ΔT100K 超・極端に広い/狭いパターンではチャートの元データが存在しない。",
    "パターンだけ太くしてビアを忘れる。電流経路で最も細い断面（ビアのバレル断面積）が律速する。",
    "内層に大電流を流すと外層の半分しか流せないうえ、温度も直接測れない。大電流は外層＋ベタが原則。",
    "細いパターンはヒューズにならない。溶断は保証されず、樹脂の炭化・発火リスクになるだけ。保護は保護素子で行う。",
    "IPC-2152（IPC-2221 の後継の実測ベース規格）では条件によって許容電流が大きく異なる結果が示されている。厳しい設計では新しい規格・熱解析の併用を検討する。",
  ],
  primarySources: [
    "IPC-2221（Generic Standard on Printed Board Design）の電流容量チャート（本文は原文を確認）。",
    "IPC-2152（実測ベースの改訂規格）— より精度が必要な場合。",
    "基板メーカーの製造仕様（銅箔厚の公差・めっき厚）。",
    "ビアの許容電流はバレル断面積（穴径×めっき厚）から同式で概算し、必ず複数ビアで冗長化する。",
  ],
};

export const traceWidthModule: ToolkitModule = {
  id: "trace-width",
  title: "基板パターン許容電流・パターン幅",
  shortTitle: "パターン幅",
  description: "IPC-2221 近似式で必要パターン幅と許容電流を計算（外層/内層・銅箔厚対応）",
  tier: "paid",
  fields: TRACE_WIDTH_FIELDS,
  compute: computeTraceWidth,
  explanation: TRACE_WIDTH_EXPLANATION,
};
