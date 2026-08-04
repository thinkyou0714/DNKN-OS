/**
 * curriculum/index.ts — 体系学習パイプラインの公開API。
 *
 * - graph.ts:      前提コンセプトグラフ（DAG）とトポロジカル順・おすすめ判定
 * - principles.ts: 原理カード（なぜ成り立つか・導出の筋道・納得チェック）
 * - path.ts:       習得状態つきロードマップ（mastered/ready/blocked と段階分け）
 * - gaps.ts:       弱点の根っこ診断（前提不足の検出）
 */
export * from "./gaps.js";
export * from "./graph.js";
export * from "./path.js";
export * from "./principles.js";
