/**
 * tests/web/roadmap.test.ts — 体系学習ロードマップ表示モデルの検証。
 * views/dashboard.ts から抽出した純ロジック（チップ分岐・演習プール・根っこ診断ヒント文）を
 * DOM なしで検証する（views 層は薄いグルーに徹する規約）。
 */
import { describe, expect, it } from "vitest";
import type { LearningStep } from "../../lib/curriculum/path.js";
import type { Problem } from "../../lib/engine/schema.js";
import { areaProblemPool, foundationGapHint, roadmapChipModel } from "../../web/src/roadmap.js";

function step(status: LearningStep["status"], missingPrereqs: string[] = []): LearningStep {
  return { area: "三相交流回路", depth: 2, status, missingPrereqs };
}

function problem(topic: string): Problem {
  return {
    id: `p-${topic}`,
    subject: "理論",
    topic,
    difficulty: 2,
    statement: "テスト用",
    answer: "42",
    solution: ["手順1"],
    validation: { solver_checked: true, human_checked: true, clean_answer: true, physically_valid: true },
    source: { type: "original" },
  };
}

describe("roadmapChipModel", () => {
  it("mastered は🎓＋通常チップ＋推定であることの注記 title", () => {
    const m = roadmapChipModel(step("mastered"));
    expect(m.label).toBe("🎓 三相交流回路");
    expect(m.className).toBe("concept-chip");
    expect(m.title).toContain("推定");
  });

  it("ready は▶＋next クラス・title なし", () => {
    const m = roadmapChipModel(step("ready"));
    expect(m.label).toBe("▶ 三相交流回路");
    expect(m.className).toBe("concept-chip next");
    expect(m.title).toBeUndefined();
  });

  it("blocked は🔒＋blocked クラス＋不足前提の title", () => {
    const m = roadmapChipModel(step("blocked", ["単相交流回路", "直流回路"]));
    expect(m.label).toBe("🔒 三相交流回路");
    expect(m.className).toBe("concept-chip blocked");
    expect(m.title).toBe("前提: 単相交流回路・直流回路");
  });
});

describe("areaProblemPool", () => {
  const problems = [problem("三相交流電力"), problem("直並列合成抵抗"), problem("二電力計法")];

  it("CONCEPT_KEYWORDS の部分一致で領域の問題を集める", () => {
    const pool = areaProblemPool("三相交流回路", problems);
    expect(pool.map((p) => p.topic).sort()).toEqual(["二電力計法", "三相交流電力"].sort());
  });

  it("別領域のキーワードには反応しない", () => {
    const pool = areaProblemPool("直流回路", problems);
    expect(pool.map((p) => p.topic)).toEqual(["直並列合成抵抗"]);
  });

  it("キーワード未定義の領域・マッチなしは空配列", () => {
    expect(areaProblemPool("存在しない領域", problems)).toEqual([]);
    expect(areaProblemPool("変圧器", problems)).toEqual([]);
  });
});

describe("foundationGapHint", () => {
  it("topic と不足前提を含む・断定しないヒント文を作る", () => {
    const hint = foundationGapHint({
      topic: "三相交流電力",
      areas: ["三相交流回路"],
      missingFoundations: ["直流回路", "単相交流回路"],
    });
    expect(hint).toContain("三相交流電力");
    expect(hint).toContain("直流回路・単相交流回路");
    expect(hint).toContain("かもしれません"); // 粗い推定なので断定しない
  });
});
