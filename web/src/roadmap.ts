/**
 * roadmap.ts — 体系学習ロードマップ表示の純ロジック。
 *
 * views/dashboard.ts の learningOrderSection から DOM 非依存の判断だけを抽出する:
 *   - ロードマップチップの表示モデル（アイコン・クラス・title）
 *   - 概念領域 → 演習プール（CONCEPT_KEYWORDS による topic 部分一致）
 *   - 弱点の根っこ診断ヒント文
 *
 * 「習得」は masteredConceptAreas のキーワード推定（論点1つの一致で領域到達とみなす
 * 粗い推定）に基づくため、表示では断定を避けて「到達（推定）」の語彙を使う。
 * views 層はこのモデルを DOM に流し込むだけの薄いグルーに徹する。
 */
import type { FoundationGap } from "../../lib/curriculum/gaps.js";
import { CONCEPT_KEYWORDS } from "../../lib/curriculum/graph.js";
import type { LearningStep } from "../../lib/curriculum/path.js";
import type { Problem } from "../../lib/engine/schema.js";

/** ロードマップチップ1つぶんの表示モデル。 */
export interface RoadmapChipModel {
  /** チップ本文（アイコン + 領域名）。 */
  label: string;
  /** 付与する CSS クラス。 */
  className: string;
  /** ホバー時の補足（blocked の不足前提・mastered の推定注記）。無ければ undefined。 */
  title?: string;
}

/**
 * ロードマップの1ステップをチップ表示モデルへ変換する。
 * 🎓=到達（キーワード推定であることを title で明示） ▶=着手可 🔒=前提不足。
 */
export function roadmapChipModel(step: LearningStep): RoadmapChipModel {
  if (step.status === "mastered") {
    return {
      label: `🎓 ${step.area}`,
      className: "concept-chip",
      title: "習得済みの論点からの自動推定です（この領域の論点に到達済み）",
    };
  }
  if (step.status === "ready") {
    return { label: `▶ ${step.area}`, className: "concept-chip next" };
  }
  return {
    label: `🔒 ${step.area}`,
    className: "concept-chip blocked",
    title: `前提: ${step.missingPrereqs.join("・")}`,
  };
}

/**
 * 概念領域に属する問題プールを作る（CONCEPT_KEYWORDS の topic 部分一致）。
 * キーワード未定義の領域やマッチなしは空配列。
 */
export function areaProblemPool(
  area: string,
  problems: readonly Problem[],
  keywords: Readonly<Record<string, readonly string[]>> = CONCEPT_KEYWORDS,
): Problem[] {
  const kws = keywords[area] ?? [];
  if (kws.length === 0) return [];
  return problems.filter((p) => kws.some((k) => p.topic.includes(k)));
}

/**
 * 弱点の根っこ診断ヒント文（1件ぶん）。断定せず「かもしれません」に留める。
 */
export function foundationGapHint(gap: FoundationGap): string {
  return (
    `「${gap.topic}」のつまずきは、前提領域「${gap.missingFoundations.join("・")}」の理解不足が根っこかもしれません。` +
    "体系学習ロードマップで前提から固め直すのがおすすめです。"
  );
}
