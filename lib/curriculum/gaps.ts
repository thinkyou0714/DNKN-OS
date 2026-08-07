/**
 * curriculum/gaps.ts — 弱点の根っこ診断（foundation gap analysis・純ロジック）。
 *
 * 目的: 弱点論点を「その論点の演習量不足」と決めつけず、前提グラフを遡って
 *   「そもそも土台の領域が未習得だから崩れている」可能性を提示する。
 *   例: 「三相交流電力」が弱い × 「単相交流回路」が未習得 → 先に単相を固める方が早い。
 *   読み上げ学習で「こういうものだ」と流した箇所は前提の欠けとして現れやすく、
 *   その欠けを体系順（基礎から）で並べて返す。
 *
 * scheduler/diagnosis.ts（正答率×due の弱点順位づけ）とは独立の観点で、
 * 弱点リストに「前提から固め直す」という次アクションを添えるために使う。
 *
 * DOM 非依存・状態なし・決定論。
 */
import { CONCEPT_EDGES, CONCEPT_KEYWORDS, conceptDepths, directPrereqs, type PrereqEdge } from "./graph.js";

/**
 * granular な topic 名が属する概念領域をキーワード部分一致で推定する（複数マッチ可）。
 * 例: 「同期速度と極数」は誘導機・同期機の両方にマッチする。
 * 返り値の順序は keywords の定義順（決定論）。マッチなしは空配列。
 */
export function topicConceptAreas(
  topic: string,
  keywords: Readonly<Record<string, readonly string[]>> = CONCEPT_KEYWORDS,
): string[] {
  const areas: string[] = [];
  for (const [concept, kws] of Object.entries(keywords)) {
    if (kws.some((k) => topic.includes(k))) areas.push(concept);
  }
  return areas;
}

/**
 * area の祖先（直接・間接の前提）領域集合を返す。area 自身は含めない。
 * visited 集合で循環入力にも停止を保証する（CONCEPT_EDGES は DAG 前提）。
 */
export function ancestorAreas(area: string, edges: readonly PrereqEdge[] = CONCEPT_EDGES): Set<string> {
  const prereqMap = directPrereqs(edges);
  const out = new Set<string>();
  const stack = [...(prereqMap.get(area) ?? [])];
  while (stack.length > 0) {
    const cur = stack.pop() as string; // length>0 のため在中
    if (out.has(cur)) continue;
    out.add(cur);
    for (const p of prereqMap.get(cur) ?? []) stack.push(p);
  }
  return out;
}

/** 弱点論点1つぶんの根っこ診断結果。 */
export interface FoundationGap {
  /** 弱点の granular な topic 名。 */
  topic: string;
  /** topic が属すると推定した概念領域（複数可・keywords 定義順）。 */
  areas: string[];
  /** 未習得の祖先前提（体系順: 深さ→名前(ja)）。空にはならない（空なら gap 自体を返さない）。 */
  missingFoundations: string[];
}

/**
 * 弱点論点リストから「前提不足が根っこ」の疑いがあるものだけを診断して返す。
 *
 * - topic → 概念領域はキーワード推定（マッチなしの論点はスキップ）。
 * - マッチした領域の祖先前提のうち未習得のものを合算し、体系順（深さ→名前）に並べる。
 * - 祖先がすべて習得済みの論点は返さない（弱点はその領域内の問題 = 演習で潰す方が適切）。
 * - 入力順を保ち、同一 topic は重複排除する（決定論）。
 *
 * @param weakTopics    弱点論点（weakestTopics / byTopic の結果など。優先度順を想定）。
 * @param masteredAreas 習得済みの概念領域集合（masteredConceptAreas の結果など）。
 */
export function foundationGaps(
  weakTopics: Iterable<string>,
  masteredAreas: Iterable<string>,
  edges: readonly PrereqEdge[] = CONCEPT_EDGES,
  keywords: Readonly<Record<string, readonly string[]>> = CONCEPT_KEYWORDS,
): FoundationGap[] {
  const done = new Set(masteredAreas);
  const depths = conceptDepths(edges);
  const gaps: FoundationGap[] = [];
  const seen = new Set<string>();
  for (const topic of weakTopics) {
    if (seen.has(topic)) continue;
    seen.add(topic);
    const areas = topicConceptAreas(topic, keywords);
    if (areas.length === 0) continue;
    const missing = new Set<string>();
    for (const a of areas) {
      for (const anc of ancestorAreas(a, edges)) {
        if (!done.has(anc)) missing.add(anc);
      }
    }
    if (missing.size === 0) continue;
    const missingFoundations = [...missing].sort(
      (x, y) => (depths.get(x) ?? 0) - (depths.get(y) ?? 0) || x.localeCompare(y, "ja"),
    );
    gaps.push({ topic, areas, missingFoundations });
  }
  return gaps;
}
