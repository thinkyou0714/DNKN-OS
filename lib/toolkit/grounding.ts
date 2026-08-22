/**
 * grounding.ts — 接地抵抗の許容値チェック（純ロジック）。
 *
 * 接地工事の種別ごとに広く知られている上限値と、B種接地の
 *   R_B = k / I1（k は高圧側の遮断時間で決まる係数）
 * という考え方に基づいて、実測値の可否を判定する。
 *
 * 注意（知財・法令）: 規程・省令の条文は転載しない。ここで扱うのは一般に知られた
 * 設計指針としての数値と考え方だけであり、適用の可否は必ず原文で確認する必要がある。
 * その旨を notes と根拠解説の両方に明記する。
 *
 * 根拠解説の技術内容はドラフト。販売前に販売者（実務者）の最終監修を受けること。
 */

import type { ExplanationDoc, FieldSpec, ModuleResult, ToolkitModule } from "./types.js";
import { judgeUsage, num, validateFields } from "./types.js";

/** B種接地の分子係数。高圧側の遮断時間が短いほど大きい値を取れる。 */
export const B_TYPE_COEFFICIENT = { none: 150, within2s: 300, within1s: 600 } as const;

/** 低圧側（C種・D種）で地絡遮断装置がある場合に緩和される上限値 [Ω]。 */
export const RELAXED_LIMIT_OHM = 500;

export const GROUNDING_FIELDS: FieldSpec[] = [
  {
    key: "groundType",
    label: "接地工事の種別",
    kind: "select",
    defaultValue: "B",
    options: [
      { value: "A", label: "A種（高圧機器の外箱・避雷器など）" },
      { value: "B", label: "B種（変圧器の低圧側中性点など）" },
      { value: "C", label: "C種（300V超の低圧機器）" },
      { value: "D", label: "D種（300V以下の低圧機器）" },
    ],
  },
  {
    key: "breakTime",
    label: "高圧側の地絡遮断時間",
    kind: "select",
    defaultValue: "within2s",
    options: [
      { value: "none", label: "遮断装置なし（係数 150）" },
      { value: "within2s", label: "2秒以内に遮断（係数 300）" },
      { value: "within1s", label: "1秒以内に遮断（係数 600）" },
    ],
    help: "B種の許容値は k / I1 で決まり、k がこの遮断時間で変わる",
    showIf: { key: "groundType", equals: "B" },
  },
  {
    key: "groundFaultCurrent",
    label: "高圧側の1線地絡電流 I1",
    unit: "A",
    kind: "number",
    defaultValue: 5,
    min: 0,
    minExclusive: true,
    max: 10000,
    help: "電力会社から示される値、または規程の算定式による値（線路のこう長で決まる）",
    showIf: { key: "groundType", equals: "B" },
  },
  {
    key: "hasEarthLeakageBreaker",
    label: "0.5秒以内に動作する地絡遮断装置",
    kind: "select",
    defaultValue: "no",
    options: [
      { value: "no", label: "なし" },
      { value: "yes", label: "あり（上限が緩和される）" },
    ],
    help: "漏電遮断器がある場合、C種・D種の上限は 500Ω まで緩和されるのが一般的",
    showIf: { key: "groundType", equals: ["C", "D"] },
  },
  {
    key: "measured",
    label: "実測接地抵抗",
    unit: "Ω",
    kind: "number",
    defaultValue: 100,
    min: 0,
    max: 1000000,
    help: "接地抵抗計による測定値（最も条件の悪い乾燥期の値で評価するのが安全側）",
  },
];

/** 種別と条件から許容接地抵抗値 [Ω] を求める。 */
export function allowableGroundResistance(params: {
  groundType: string;
  breakTime?: string;
  groundFaultCurrent?: number;
  relaxed?: boolean;
}): number {
  switch (params.groundType) {
    case "A":
      return 10;
    case "B": {
      const k = B_TYPE_COEFFICIENT[(params.breakTime ?? "none") as keyof typeof B_TYPE_COEFFICIENT] ?? 150;
      const current = params.groundFaultCurrent ?? 0;
      return current > 0 ? k / current : Number.POSITIVE_INFINITY;
    }
    case "C":
      return params.relaxed === true ? RELAXED_LIMIT_OHM : 10;
    default:
      return params.relaxed === true ? RELAXED_LIMIT_OHM : 100;
  }
}

export function computeGrounding(values: Record<string, number | string>): ModuleResult {
  const v = validateFields(GROUNDING_FIELDS, values);
  if (!v.ok) return { ok: false, errors: v.errors };
  const groundType = v.input.sels.groundType ?? "B";
  const measured = num(v.input, "measured");

  const breakTime = v.input.sels.breakTime;
  const allowable = allowableGroundResistance({
    groundType,
    ...(breakTime !== undefined ? { breakTime } : {}),
    ...(groundType === "B" ? { groundFaultCurrent: num(v.input, "groundFaultCurrent") } : {}),
    relaxed: v.input.sels.hasEarthLeakageBreaker === "yes",
  });

  const usagePercent = (measured / allowable) * 100;
  const items = [
    { label: "許容接地抵抗値", value: allowable, unit: "Ω" },
    { label: "実測値", value: measured, unit: "Ω" },
    { label: "許容値に対する比", value: usagePercent, unit: "%" },
    { label: "許容値までの余裕", value: allowable - measured, unit: "Ω" },
  ];

  const notes: string[] = [
    "ここで扱う数値は一般に知られた設計指針です。適用条件・例外は必ず電気設備技術基準の解釈および内線規程の原文で確認してください。",
    "接地抵抗は季節（土壌の乾燥・凍結）で大きく変わります。最も条件の悪い時期の値で成立するように設計してください。",
  ];
  if (groundType === "B") {
    notes.push(
      "B種の許容値は高圧側の1線地絡電流 I1 に反比例します。I1 は線路のこう長で変わるため、電力会社から示される値を使ってください。",
    );
  }
  if (measured > allowable) {
    notes.unshift(
      "実測値が許容値を超えています。接地極の追加・打ち込み深さの見直し・接地抵抗低減剤などの対策が必要です。",
    );
  }

  return {
    ok: true,
    items,
    usagePercent,
    // 許容値そのものが上限なので閾値は 100%（判定は 90% 以下で ok・100% までは warn）。
    verdict: judgeUsage(usagePercent, 100),
    notes,
  };
}

export const GROUNDING_EXPLANATION: ExplanationDoc = {
  conclusion: [
    "接地の目的は「地絡時に人が触れる部分の対地電圧を危険な値まで上げないこと」。だから許容抵抗値は、想定する地絡電流と許容できる電圧上昇から逆算されている。",
    "B種だけが計算で決まり（R = k / I1）、A種・C種・D種は種別ごとの上限値で決まる。",
  ],
  formula: [
    "B種: R_B [Ω] = k / I1、　k = 150（遮断装置なし）／ 300（2秒以内）／ 600（1秒以内）",
    "A種: 10Ω 以下",
    "C種: 10Ω 以下（0.5秒以内に動作する地絡遮断装置があれば 500Ω 以下）",
    "D種: 100Ω 以下（同上 500Ω 以下）",
  ],
  terms: [
    "I1: 高圧側の1線地絡電流。線路のこう長（ケーブル・架空線の対地静電容量）で決まる。電力会社から提示されるか、規程の算定式で求める。",
    "k の意味: 遮断が速いほど危険電圧のかかる時間が短いので、同じ安全性でも高い抵抗値が許容される。1秒以内なら150の4倍まで許される。",
    "B種の役割: 高低圧混触時に低圧側の対地電圧が異常上昇するのを抑える。低圧側の人身安全のための接地であり、機器の外箱接地（C種・D種）とは目的が違う。",
    "500Ωへの緩和: 地絡遮断装置が確実に切るなら、接触時間が短くなるため上限を緩められるという考え方。装置の動作時間が前提条件になる。",
  ],
  pitfalls: [
    "B種の I1 を勝手に仮定する。こう長で数倍変わるため、値が違うと許容抵抗値も数倍変わる。必ず提示値か算定式による値を使う。",
    "測定した季節の値だけで合格としてしまう。冬の凍結期・夏の乾燥期は抵抗が上がる。最悪期で成立させる。",
    "接地抵抗計の補助極の配置が不適切だと測定値そのものが信用できない。基準極・電流極の距離と直線性を確認する。",
    "複数の接地を連結すると合成抵抗は下がるが、等電位ボンディングの要否など別の検討が要る。単純に「つなげば下がる」で済ませない。",
    "C種・D種の 500Ω 緩和は「0.5秒以内に動作する地絡遮断装置がある」ことが条件。装置の有無だけでなく動作時間を確認する。",
  ],
  primarySources: [
    "電気設備技術基準の解釈（接地工事の種類と施設方法）— 条文の原文を必ず確認する。",
    "内線規程の接地の章（実務上の施工方法と測定方法）。",
    "電力会社から提示される1線地絡電流の値。",
    "接地抵抗計の取扱説明書（測定手順・補助極の配置条件）。",
  ],
};

export const groundingModule: ToolkitModule = {
  id: "grounding",
  title: "接地抵抗の許容値チェック",
  shortTitle: "接地抵抗",
  description: "A/B/C/D種の許容接地抵抗値を求め、実測値の可否と余裕を判定（B種は k/I1 で算出）",
  tier: "paid",
  fields: GROUNDING_FIELDS,
  compute: computeGrounding,
  explanation: GROUNDING_EXPLANATION,
};
