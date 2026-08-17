/**
 * tests/curriculum/solution-slides.test.ts — 解法スライド（解く流れの再生）の検証。
 *  - デッキ構造（cover → steps → answer）と枚数
 *  - 役割・思考ガイドが rubric.ts の分類と一致すること
 *  - clampSlideIndex の丸め（矢印キー連打・不正値に安全）
 *  - 実データ（web/problems.json の全問題）でデッキが常に成立すること
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildRubric, ROLE_LABELS } from "../../lib/curriculum/rubric.js";
import {
  ANSWER_THOUGHT,
  AUTOPLAY_PACES,
  buildSolutionSlides,
  COVER_THOUGHT,
  clampSlideIndex,
  nextAutoplayIndex,
  THOUGHT_BY_ROLE,
} from "../../lib/curriculum/solution-slides.js";

/** rubric.test.ts と同じ典型例（同期発電機の出力）。 */
const SOURCE = {
  statement: "三相同期発電機の出力を求めよ。",
  answer: "39.6kW",
  solution: [
    "着眼点: 端子電圧Vと誘導起電力Eの位相差δ（負荷角）が出力を決める。",
    "1相あたり P1=V·E·sinδ/Xs",
    "3相出力 P=3·V·E·sinδ/Xs=3×220×600×0.5/5",
    "P=39600W=39.6kW",
    "ポイント: 図のベクトルでjIXsがVとEを結ぶ。δ=90°で最大、安定限界の指標。",
  ],
};

describe("buildSolutionSlides — デッキ構造", () => {
  it("cover → 各ステップ → answer の順で、枚数は steps+2", () => {
    const deck = buildSolutionSlides(SOURCE);
    expect(deck.slides).toHaveLength(SOURCE.solution.length + 2);
    expect(deck.stepCount).toBe(SOURCE.solution.length);
    expect(deck.slides[0]?.kind).toBe("cover");
    expect(deck.slides[0]?.body).toBe(SOURCE.statement);
    expect(deck.slides.at(-1)?.kind).toBe("answer");
    expect(deck.slides.at(-1)?.body).toBe(SOURCE.answer);
  });

  it("step スライドの役割・本文・stepIndex は buildRubric と完全に一致する", () => {
    const deck = buildSolutionSlides(SOURCE);
    const rubric = buildRubric(SOURCE.solution);
    const steps = deck.slides.filter((s) => s.kind === "step");
    expect(steps).toHaveLength(rubric.length);
    steps.forEach((slide, i) => {
      const item = rubric[i];
      expect(slide.role).toBe(item?.role);
      expect(slide.body).toBe(item?.text);
      expect(slide.stepIndex).toBe(item?.index);
      expect(slide.title).toBe(`STEP ${i + 1}`);
    });
  });

  it("思考ガイドは cover/answer が固定文、step は役割ごとの対応表から引かれる", () => {
    const deck = buildSolutionSlides(SOURCE);
    expect(deck.slides[0]?.thought).toBe(COVER_THOUGHT);
    expect(deck.slides.at(-1)?.thought).toBe(ANSWER_THOUGHT);
    for (const slide of deck.slides.filter((s) => s.kind === "step")) {
      expect(slide.role).toBeDefined();
      if (slide.role) expect(slide.thought).toBe(THOUGHT_BY_ROLE[slide.role]);
    }
  });

  it("THOUGHT_BY_ROLE は ROLE_LABELS の全役割を過不足なくカバーする", () => {
    expect(Object.keys(THOUGHT_BY_ROLE).sort()).toEqual(Object.keys(ROLE_LABELS).sort());
    for (const text of Object.values(THOUGHT_BY_ROLE)) expect(text.length).toBeGreaterThan(0);
  });

  it("solution が空でも cover+answer の2枚デッキとして成立する", () => {
    const deck = buildSolutionSlides({ statement: "s", answer: "a", solution: [] });
    expect(deck.slides.map((s) => s.kind)).toEqual(["cover", "answer"]);
    expect(deck.stepCount).toBe(0);
  });

  it("決定論: 同じ入力からは同じデッキが得られる", () => {
    expect(buildSolutionSlides(SOURCE)).toEqual(buildSolutionSlides(SOURCE));
  });
});

describe("clampSlideIndex", () => {
  it("範囲内はそのまま・範囲外は端へ丸める", () => {
    expect(clampSlideIndex(0, 5)).toBe(0);
    expect(clampSlideIndex(4, 5)).toBe(4);
    expect(clampSlideIndex(-1, 5)).toBe(0);
    expect(clampSlideIndex(5, 5)).toBe(4);
  });

  it("非整数は切り捨て、非有限値と空デッキは 0", () => {
    expect(clampSlideIndex(3.7, 5)).toBe(3);
    expect(clampSlideIndex(Number.NaN, 5)).toBe(0);
    expect(clampSlideIndex(Number.POSITIVE_INFINITY, 5)).toBe(0);
    expect(clampSlideIndex(2, 0)).toBe(0);
  });
});

describe("自動再生（AUTOPLAY_PACES / nextAutoplayIndex）", () => {
  it("ペースは重複なしのキーを持ち、表示時間は正で「ゆっくり→はやい」の降順", () => {
    const keys = AUTOPLAY_PACES.map((p) => p.key);
    expect(new Set(keys).size).toBe(AUTOPLAY_PACES.length);
    for (const p of AUTOPLAY_PACES) expect(p.ms).toBeGreaterThan(0);
    for (let i = 1; i < AUTOPLAY_PACES.length; i++) {
      // 配列順は UI の切替順。後ろほど速い（表示時間が短い）ことを固定する。
      expect((AUTOPLAY_PACES[i] as { ms: number }).ms).toBeLessThan((AUTOPLAY_PACES[i - 1] as { ms: number }).ms);
    }
  });

  it("次の位置を返し、最後のスライドでは null（自動では閉じない）", () => {
    expect(nextAutoplayIndex(0, 5)).toBe(1);
    expect(nextAutoplayIndex(3, 5)).toBe(4);
    expect(nextAutoplayIndex(4, 5)).toBeNull();
  });

  it("範囲外・空デッキにも安全（clamp してから判定する）", () => {
    expect(nextAutoplayIndex(-3, 5)).toBe(1); // clamp で 0 → 次は 1
    expect(nextAutoplayIndex(99, 5)).toBeNull(); // clamp で末尾
    expect(nextAutoplayIndex(0, 0)).toBeNull();
  });
});

describe("実データ検証（web/problems.json の全問題）", () => {
  interface RawProblem {
    statement: string;
    answer: string;
    solution: string[];
  }
  const problems = JSON.parse(
    readFileSync(new URL("../../web/problems.json", import.meta.url), "utf8"),
  ) as RawProblem[];

  it("全問題でデッキが成立する（cover 先頭・answer 末尾・枚数一致・思考ガイドあり）", () => {
    expect(problems.length).toBeGreaterThan(0);
    for (const p of problems) {
      const deck = buildSolutionSlides(p);
      expect(deck.slides[0]?.kind).toBe("cover");
      expect(deck.slides.at(-1)?.kind).toBe("answer");
      expect(deck.slides).toHaveLength(p.solution.length + 2);
      for (const slide of deck.slides) {
        expect(slide.thought.length).toBeGreaterThan(0);
        expect(slide.body.length).toBeGreaterThan(0);
      }
    }
  });
});
