/**
 * concept-graph.ts — lib/curriculum/graph.ts への再エクスポート（後方互換 shim）。
 *
 * 前提コンセプトグラフは体系学習パイプライン（lib/curriculum/）の単一情報源へ移設した。
 * 既存の import 経路（views/dashboard.ts・tests/web/concept-graph.test.ts）を壊さないよう
 * この経路を残す。新規コードは lib/curriculum から直接 import してよい。
 */
export * from "../../lib/curriculum/graph.js";
