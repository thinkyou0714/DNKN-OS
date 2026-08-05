/**
 * tests/curriculum/principles.test.ts — 原理カードの網羅性とコンテンツ不変条件。
 *  - グラフの全ノードとカードが 1:1（抜け・グラフ外・重複なし）
 *  - 導出は並べ替えドリルの最小手数（MIN_DERIVATION_STEPS）以上
 *  - formulaRefs は web/src/formulas.ts の公式名に実在する
 * lib は web に依存しない（文字列参照のみ）ため、突き合わせはテストで横断して行う。
 */
import { describe, expect, it } from "vitest";
import { CONCEPT_EDGES } from "../../lib/curriculum/graph.js";
import { getPrincipleCard, PRINCIPLE_CARDS } from "../../lib/curriculum/principles.js";
import { MIN_DERIVATION_STEPS } from "../../web/src/derivation.js";
import { FORMULAS } from "../../web/src/formulas.js";

const nodeNames = new Set(CONCEPT_EDGES.flatMap((e) => [e.from, e.to]));

describe("PRINCIPLE_CARDS — グラフとの1:1対応", () => {
  it("全概念ノードに原理カードがある（体系に「なぜ」の穴を作らない）", () => {
    const areas = new Set(PRINCIPLE_CARDS.map((c) => c.area));
    for (const n of nodeNames) {
      expect(areas.has(n), `原理カード未作成: ${n}`).toBe(true);
    }
  });

  it("グラフに無い領域のカードは無く、area の重複も無い", () => {
    const seen = new Set<string>();
    for (const c of PRINCIPLE_CARDS) {
      expect(nodeNames.has(c.area), `グラフ外の area: ${c.area}`).toBe(true);
      expect(seen.has(c.area), `area 重複: ${c.area}`).toBe(false);
      seen.add(c.area);
    }
  });
});

describe("PRINCIPLE_CARDS — コンテンツ不変条件", () => {
  it("coreIdea / why は空でない", () => {
    for (const c of PRINCIPLE_CARDS) {
      expect(c.coreIdea.trim().length, c.area).toBeGreaterThan(0);
      expect(c.why.trim().length, c.area).toBeGreaterThan(0);
    }
  });

  it("導出の筋道はドリル最小手数以上で、各ステップが空でない", () => {
    for (const c of PRINCIPLE_CARDS) {
      expect(c.derivation.length, c.area).toBeGreaterThanOrEqual(MIN_DERIVATION_STEPS);
      for (const d of c.derivation) expect(d.trim().length, c.area).toBeGreaterThan(0);
    }
  });

  it("pitfalls と checks は1件以上で、Q/A が空でない", () => {
    for (const c of PRINCIPLE_CARDS) {
      expect(c.pitfalls.length, c.area).toBeGreaterThanOrEqual(1);
      expect(c.checks.length, c.area).toBeGreaterThanOrEqual(1);
      for (const q of c.checks) {
        expect(q.question.trim().length, c.area).toBeGreaterThan(0);
        expect(q.answer.trim().length, c.area).toBeGreaterThan(0);
      }
    }
  });

  it("formulaRefs は公式集（web/src/formulas.ts）に実在する名前だけを指す", () => {
    const names = new Set(FORMULAS.flatMap((g) => g.items.map((i) => i.name)));
    for (const c of PRINCIPLE_CARDS) {
      for (const ref of c.formulaRefs) {
        expect(names.has(ref), `${c.area} の formulaRef が公式集に無い: ${ref}`).toBe(true);
      }
    }
  });
});

describe("getPrincipleCard", () => {
  it("area 名でカードをひける", () => {
    const card = getPrincipleCard("三相交流回路");
    expect(card?.area).toBe("三相交流回路");
    expect(card?.derivation.length).toBeGreaterThanOrEqual(MIN_DERIVATION_STEPS);
  });

  it("未知の area は undefined", () => {
    expect(getPrincipleCard("存在しない領域")).toBeUndefined();
  });
});
