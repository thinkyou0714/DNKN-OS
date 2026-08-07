/**
 * tests/curriculum/path.test.ts — 体系学習ロードマップ生成の検証。
 * 状態判定（mastered/ready/blocked）・体系順・段階分け・決定論・nextUp を確認する。
 */
import { describe, expect, it } from "vitest";
import { CONCEPT_EDGES } from "../../lib/curriculum/graph.js";
import { buildLearningPath, nextUp } from "../../lib/curriculum/path.js";

/** テスト用の小さな前提グラフ（2連鎖 + 独立1連鎖）。 */
const EDGES = [
  { from: "直流", to: "交流" },
  { from: "交流", to: "三相" },
  { from: "静電", to: "磁気" },
];

describe("buildLearningPath", () => {
  it("習得ゼロなら基礎（深さ0）だけ ready、後続は blocked（不足前提つき）", () => {
    const p = buildLearningPath([], EDGES);
    expect(p.total).toBe(5);
    expect(p.masteredCount).toBe(0);
    const byArea = new Map(p.steps.map((s) => [s.area, s]));
    expect(byArea.get("直流")?.status).toBe("ready");
    expect(byArea.get("静電")?.status).toBe("ready");
    expect(byArea.get("交流")?.status).toBe("blocked");
    expect(byArea.get("交流")?.missingPrereqs).toEqual(["直流"]);
    expect(byArea.get("三相")?.status).toBe("blocked");
    expect(byArea.get("三相")?.missingPrereqs).toEqual(["交流"]);
  });

  it("前提を習得すると直後の領域が ready に変わる", () => {
    const p = buildLearningPath(["直流"], EDGES);
    const byArea = new Map(p.steps.map((s) => [s.area, s]));
    expect(byArea.get("直流")?.status).toBe("mastered");
    expect(byArea.get("直流")?.missingPrereqs).toEqual([]);
    expect(byArea.get("交流")?.status).toBe("ready");
    expect(byArea.get("三相")?.status).toBe("blocked"); // 直接前提の交流がまだ
    expect(p.masteredCount).toBe(1);
  });

  it("steps は深さ昇順で並び、stages は深さで過不足なく分割される", () => {
    const p = buildLearningPath([], EDGES);
    for (let i = 1; i < p.steps.length; i++) {
      expect(p.steps[i - 1]!.depth).toBeLessThanOrEqual(p.steps[i]!.depth);
    }
    expect(p.stages.length).toBe(3); // 深さ 0/1/2
    expect([...p.stages[0]!.map((s) => s.area)].sort()).toEqual(["直流", "静電"].sort());
    expect(
      p.stages
        .flat()
        .map((s) => s.area)
        .sort(),
    ).toEqual(p.steps.map((s) => s.area).sort());
  });

  it("既定グラフ（CONCEPT_EDGES）で全領域を返し、決定論的", () => {
    const a = buildLearningPath(["直流回路"]);
    const b = buildLearningPath(["直流回路"]);
    expect(a).toEqual(b);
    expect(a.total).toBe(new Set(CONCEPT_EDGES.flatMap((e) => [e.from, e.to])).size);
    const byArea = new Map(a.steps.map((s) => [s.area, s]));
    expect(byArea.get("単相交流回路")?.status).toBe("ready"); // 直流回路を習得したので
  });
});

describe("nextUp", () => {
  it("ready な領域を体系順（基礎から）で最大 limit 件返す", () => {
    const p = buildLearningPath([], EDGES);
    const one = nextUp(p, 1);
    expect(one.length).toBe(1);
    expect(one[0]!.status).toBe("ready");
    expect(nextUp(p, 10).every((s) => s.status === "ready")).toBe(true);
    expect(nextUp(p, 10).length).toBe(2); // 直流・静電のみ
  });

  it("全習得なら空、limit=0 でも空", () => {
    const all = buildLearningPath(["直流", "交流", "三相", "静電", "磁気"], EDGES);
    expect(nextUp(all)).toEqual([]);
    expect(nextUp(buildLearningPath([], EDGES), 0)).toEqual([]);
  });
});
