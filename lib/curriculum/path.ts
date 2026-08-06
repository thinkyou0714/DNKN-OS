/**
 * curriculum/path.ts — 体系学習ロードマップの生成（純ロジック）。
 *
 * 目的: 「今なにを・なぜその順で学ぶか」を1本の決定論的な道筋として提示する。
 *   前提グラフ（curriculum/graph.ts）のトポロジカル順に全領域を並べ、習得状態
 *   （mastered / ready / blocked）を付け、深さごとの学習段階（stage）に分ける。
 *   recommendNextConcepts が「今のおすすめ」の断片を返すのに対し、こちらは
 *   全体像（どこまで来ていて、この先どう続くか）を返す。
 *
 * 決定論: 同じ入力（習得済み集合・エッジ）に対して常に同じ順序・同じ結果を返す
 *   （深さ→名前(ja)の安定ソート。リポジトリ不変条件）。
 *
 * DOM 非依存・状態なし。
 */
import { analyzeConceptGraph, CONCEPT_EDGES, type PrereqEdge } from "./graph.js";

/** ロードマップ上の1領域の状態。 */
export type StepStatus = "mastered" | "ready" | "blocked";

/** ロードマップの1ステップ（1概念領域）。 */
export interface LearningStep {
  /** 概念領域名（CONCEPT_EDGES のノード名）。 */
  area: string;
  /** 体系深さ（最長前提連鎖の長さ。0=前提なしの基礎）。 */
  depth: number;
  /** mastered=習得済み / ready=前提クリアで着手可 / blocked=前提不足。 */
  status: StepStatus;
  /** blocked のとき、未習得の直接前提（それ以外は空配列）。 */
  missingPrereqs: string[];
}

/** ロードマップ全体。 */
export interface LearningPath {
  /** 体系順（深さ→名前）の全ステップ。 */
  steps: LearningStep[];
  /** 深さごとの段階分け。stages[0] が基礎（深さ0）。 */
  stages: LearningStep[][];
  /** 習得済み領域数。 */
  masteredCount: number;
  /** 全領域数。 */
  total: number;
}

/**
 * 習得済み集合から体系学習ロードマップを組み立てる。
 *
 * @param mastered 習得済みとみなす領域名（masteredConceptAreas の結果など）。
 * @param edges    前提グラフ（既定は CONCEPT_EDGES）。
 */
export function buildLearningPath(
  mastered: Iterable<string>,
  edges: readonly PrereqEdge[] = CONCEPT_EDGES,
): LearningPath {
  const done = new Set(mastered);
  const graph = analyzeConceptGraph(edges);
  const steps: LearningStep[] = graph.order.map((area) => {
    const missing = (graph.prereqs.get(area) ?? []).filter((p) => !done.has(p));
    const status: StepStatus = done.has(area) ? "mastered" : missing.length === 0 ? "ready" : "blocked";
    return {
      area,
      depth: graph.depths.get(area) ?? 0,
      status,
      // mastered は「もう不足はない」扱いで空にする（UI で🔒理由を出すのは blocked のみ）。
      missingPrereqs: status === "blocked" ? missing : [],
    };
  });
  const stages: LearningStep[][] = [];
  for (const s of steps) {
    const stage = stages[s.depth] ?? [];
    stage.push(s);
    stages[s.depth] = stage;
  }
  return {
    steps,
    stages,
    masteredCount: steps.filter((s) => s.status === "mastered").length,
    total: steps.length,
  };
}

/**
 * 「次はここから」— ready な領域を体系順で先頭から最大 limit 件返す。
 * 基礎に近い（深さが浅い）順に出るため、土台から積み上げる順序が保たれる。
 */
export function nextUp(path: LearningPath, limit = 3): LearningStep[] {
  return path.steps.filter((s) => s.status === "ready").slice(0, Math.max(0, limit));
}
