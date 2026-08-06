/**
 * tests/curriculum/graph.test.ts — 前提コンセプトグラフの構造検証。
 * DAG 性・体系深さ・決定論的トポロジカル順・直接前提の逆引きを確認する。
 * （recommendNextConcepts / masteredConceptAreas の挙動は移設前からの
 *   tests/web/concept-graph.test.ts が web 側の再エクスポート経由で担保する。）
 */
import { describe, expect, it } from "vitest";
import {
  analyzeConceptGraph,
  CONCEPT_EDGES,
  conceptDepths,
  directPrereqs,
  hasCycle,
  topologicalOrder,
} from "../../lib/curriculum/graph.js";

const nodeNames = new Set(CONCEPT_EDGES.flatMap((e) => [e.from, e.to]));

describe("conceptDepths", () => {
  it("CONCEPT_EDGES は DAG で、全ノードの深さが確定する", () => {
    expect(hasCycle(CONCEPT_EDGES)).toBe(false);
    const depths = conceptDepths();
    expect(depths.size).toBe(nodeNames.size);
  });

  it("最長前提連鎖の長さを返す（前提なしの基礎 = 0）", () => {
    const depths = conceptDepths();
    expect(depths.get("直流回路")).toBe(0);
    expect(depths.get("静電気")).toBe(0);
    expect(depths.get("単相交流回路")).toBe(1);
    expect(depths.get("三相交流回路")).toBe(2);
    expect(depths.get("誘導機")).toBe(3);
    expect(depths.get("同期機")).toBe(4);
    // 回転機の制御はパワエレ(深さ2)と同期機(深さ4)の合流点 → 最長側 + 1
    expect(depths.get("回転機の制御")).toBe(5);
  });

  it("循環に巻き込まれたノードは深さ未確定として結果に含めない（防御的挙動）", () => {
    const edges = [
      { from: "A", to: "B" },
      { from: "B", to: "A" },
      { from: "C", to: "D" },
    ];
    const depths = conceptDepths(edges);
    expect(depths.has("A")).toBe(false);
    expect(depths.has("B")).toBe(false);
    expect(depths.get("C")).toBe(0);
    expect(depths.get("D")).toBe(1);
  });
});

describe("topologicalOrder", () => {
  it("すべてのエッジで from が to より先に並ぶ（トポロジカル順）", () => {
    const order = topologicalOrder();
    expect(order.length).toBe(nodeNames.size);
    const pos = new Map(order.map((n, i) => [n, i]));
    for (const e of CONCEPT_EDGES) {
      expect(pos.get(e.from)!, `${e.from} → ${e.to}`).toBeLessThan(pos.get(e.to)!);
    }
  });

  it("決定論: 同じ入力で常に同じ順序を返す", () => {
    expect(topologicalOrder()).toEqual(topologicalOrder());
  });

  it("同深さのノードは名前順（ja）で安定に並ぶ", () => {
    const edges = [
      { from: "あ", to: "う" },
      { from: "あ", to: "い" },
    ];
    expect(topologicalOrder(edges)).toEqual(["あ", "い", "う"]);
  });
});

describe("directPrereqs", () => {
  it("ノード → 直接前提の逆引きを返す（前提なしは未登録）", () => {
    const m = directPrereqs();
    expect([...(m.get("回転機の制御") ?? [])].sort()).toEqual(["パワーエレクトロニクス", "同期機"].sort());
    expect(m.get("単相交流回路")).toEqual(["直流回路"]);
    expect(m.get("直流回路")).toBeUndefined();
  });
});

describe("analyzeConceptGraph", () => {
  it("1回の解析結果が個別 API と同じ派生情報を返す", () => {
    const analysis = analyzeConceptGraph();
    expect(analysis.depths).toEqual(conceptDepths());
    expect(analysis.prereqs).toEqual(directPrereqs());
    expect(analysis.order).toEqual(topologicalOrder());
    const ancestors = analysis.ancestorsOf("三相交流回路");
    expect(ancestors).toEqual(new Set(["単相交流回路", "直流回路"]));
    expect(analysis.ancestorsOf("三相交流回路")).toBe(ancestors);
    expect(analysis.ancestorsOf("未知の領域")).toEqual(new Set());
  });

  it("循環入力の祖先集合からノード自身を除外する", () => {
    const analysis = analyzeConceptGraph([
      { from: "A", to: "B" },
      { from: "B", to: "A" },
    ]);
    expect(analysis.ancestorsOf("A")).toEqual(new Set(["B"]));
    expect(analysis.ancestorsOf("B")).toEqual(new Set(["A"]));
  });
});
