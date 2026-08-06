/**
 * tests/curriculum/gaps.test.ts — 弱点の根っこ診断の検証。
 * topic→概念領域のキーワード推定・祖先前提の遡り・未習得前提の体系順ソート・
 * 決定論（重複排除・入力順維持）を確認する。
 */
import { describe, expect, it } from "vitest";
import { ancestorAreas, foundationGaps, topicConceptAreas } from "../../lib/curriculum/gaps.js";

describe("topicConceptAreas", () => {
  it("topic 名のキーワード部分一致で概念領域を推定する", () => {
    expect(topicConceptAreas("三相交流電力")).toContain("三相交流回路");
    expect(topicConceptAreas("直並列合成抵抗")).toContain("直流回路");
  });

  it("複数領域にマッチする topic は全部返す（keywords 定義順）", () => {
    // 「同期速度」は誘導機・同期機の両方のキーワードに登録されている。
    const areas = topicConceptAreas("同期速度と極数");
    expect(areas).toContain("誘導機");
    expect(areas).toContain("同期機");
  });

  it("マッチなしは空配列", () => {
    expect(topicConceptAreas("まったく無関係な論点")).toEqual([]);
  });
});

describe("ancestorAreas", () => {
  it("直接・間接の前提をすべて返す（自分自身は含めない）", () => {
    const anc = ancestorAreas("三相交流回路");
    expect(anc).toEqual(new Set(["単相交流回路", "直流回路"]));
  });

  it("前提なしの基礎領域は空集合", () => {
    expect(ancestorAreas("直流回路").size).toBe(0);
  });

  it("合流点は全系統の祖先を返す", () => {
    const anc = ancestorAreas("回転機の制御");
    // 同期機系: 同期機→誘導機→変圧器→電磁気→静電気 / パワエレ系: パワエレ→電子回路→電子理論
    for (const a of [
      "同期機",
      "誘導機",
      "変圧器",
      "電磁気",
      "静電気",
      "パワーエレクトロニクス",
      "電子回路",
      "電子理論",
    ]) {
      expect(anc.has(a), a).toBe(true);
    }
  });

  it("循環入力でも停止する（防御的挙動）", () => {
    const edges = [
      { from: "A", to: "B" },
      { from: "B", to: "A" },
    ];
    expect(ancestorAreas("A", edges)).toEqual(new Set(["B"]));
  });
});

describe("foundationGaps", () => {
  it("未習得の祖先前提を体系順（深さ→名前）で返す", () => {
    const gaps = foundationGaps(["三相交流電力"], []);
    expect(gaps.length).toBe(1);
    expect(gaps[0]!.topic).toBe("三相交流電力");
    expect(gaps[0]!.areas).toContain("三相交流回路");
    // 深さ順: 直流回路(0) → 単相交流回路(1)
    expect(gaps[0]!.missingFoundations).toEqual(["直流回路", "単相交流回路"]);
  });

  it("祖先がすべて習得済みなら gap を返さない（弱点は領域内＝演習で潰す）", () => {
    expect(foundationGaps(["三相交流電力"], ["直流回路", "単相交流回路"])).toEqual([]);
  });

  it("一部習得済みなら未習得の前提だけ返す", () => {
    const gaps = foundationGaps(["三相交流電力"], ["直流回路"]);
    expect(gaps[0]!.missingFoundations).toEqual(["単相交流回路"]);
  });

  it("領域にマッチしない topic はスキップし、同一 topic は重複排除する", () => {
    const gaps = foundationGaps(["未知の論点", "三相交流電力", "三相交流電力"], []);
    expect(gaps.length).toBe(1);
  });

  it("複数領域マッチは祖先を合算し、入力順を保つ（決定論）", () => {
    const a = foundationGaps(["同期速度と極数", "三相交流電力"], []);
    const b = foundationGaps(["同期速度と極数", "三相交流電力"], []);
    expect(a).toEqual(b);
    expect(a.map((g) => g.topic)).toEqual(["同期速度と極数", "三相交流電力"]);
    // 誘導機＋同期機の祖先合算: 静電気(0) → 電磁気(1) → 変圧器(2) → 誘導機(3)
    expect(a[0]!.missingFoundations).toEqual(["静電気", "電磁気", "変圧器", "誘導機"]);
  });
});
