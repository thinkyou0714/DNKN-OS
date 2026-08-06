/**
 * tests/curriculum/why-check.test.ts — 納得チェックの間隔反復ロジックの検証。
 * アイテム展開（体系順・安定ID・網羅）、出題順（既習の期限到来優先→未着手を基礎順）、
 * 進捗集計、決定論を確認する。
 */
import { describe, expect, it } from "vitest";
import { topologicalOrder } from "../../lib/curriculum/graph.js";
import { PRINCIPLE_CARDS } from "../../lib/curriculum/principles.js";
import {
  dueWhyChecks,
  getWhyCheckItem,
  WHY_CHECK_ITEMS,
  WHY_CHECK_SESSION_SIZE,
  type WhyCheckItem,
  type WhyCheckState,
  whyCheckId,
  whyCheckStats,
  whyChecksForArea,
} from "../../lib/curriculum/why-check.js";

const NOW = Date.UTC(2026, 7, 1);
const DAY = 86_400_000;

/** dueMs だけの状態マップを組む小道具。 */
function states(entries: Array<[string, number]>): Map<string, WhyCheckState> {
  return new Map(entries.map(([id, dueMs]) => [id, { dueMs }]));
}

describe("WHY_CHECK_ITEMS", () => {
  it("全原理カードの納得チェックを取りこぼさず展開する", () => {
    const expected = PRINCIPLE_CARDS.reduce((n, c) => n + c.checks.length, 0);
    expect(WHY_CHECK_ITEMS.length).toBe(expected);
  });

  it("ID は安定（area#index）で一意", () => {
    const ids = new Set(WHY_CHECK_ITEMS.map((i) => i.id));
    expect(ids.size).toBe(WHY_CHECK_ITEMS.length);
    const first = WHY_CHECK_ITEMS[0] as WhyCheckItem;
    expect(first.id).toBe(whyCheckId(first.area, 0));
  });

  it("order は 0 から連番で、領域の初出順は体系順（基礎から）に一致する", () => {
    WHY_CHECK_ITEMS.forEach((item, i) => {
      expect(item.order).toBe(i);
    });
    const firstSeen: string[] = [];
    for (const item of WHY_CHECK_ITEMS) {
      if (!firstSeen.includes(item.area)) firstSeen.push(item.area);
    }
    const cardAreas = new Set(PRINCIPLE_CARDS.map((c) => c.area));
    expect(firstSeen).toEqual(topologicalOrder().filter((a) => cardAreas.has(a)));
  });

  it("同一領域のチェックはカード内の順序を保つ", () => {
    const area = "三相交流回路";
    const card = PRINCIPLE_CARDS.find((c) => c.area === area);
    const items = whyChecksForArea(area);
    expect(items.map((i) => i.question)).toEqual(card?.checks.map((c) => c.question));
  });

  it("getWhyCheckItem は ID でひけて、未知の ID は undefined", () => {
    const target = WHY_CHECK_ITEMS[3] as WhyCheckItem;
    expect(getWhyCheckItem(target.id)).toEqual(target);
    expect(getWhyCheckItem("存在しない領域#0")).toBeUndefined();
  });
});

describe("whyCheckStats", () => {
  it("未着手のみなら fresh が全件", () => {
    const s = whyCheckStats(new Map(), NOW);
    expect(s.total).toBe(WHY_CHECK_ITEMS.length);
    expect(s.started).toBe(0);
    expect(s.due).toBe(0);
    expect(s.fresh).toBe(WHY_CHECK_ITEMS.length);
  });

  it("期限前の既習は started に入るが due には入らない", () => {
    const a = (WHY_CHECK_ITEMS[0] as WhyCheckItem).id;
    const b = (WHY_CHECK_ITEMS[1] as WhyCheckItem).id;
    const s = whyCheckStats(
      states([
        [a, NOW + DAY],
        [b, NOW - DAY],
      ]),
      NOW,
    );
    expect(s.started).toBe(2);
    expect(s.due).toBe(1);
    expect(s.fresh).toBe(WHY_CHECK_ITEMS.length - 2);
  });
});

describe("dueWhyChecks", () => {
  it("未着手のみなら体系順の先頭から limit 件返す", () => {
    const got = dueWhyChecks(new Map(), NOW, 3);
    expect(got.map((i) => i.order)).toEqual([0, 1, 2]);
  });

  it("既習の期限到来を未着手より先に出す（保持を優先）", () => {
    // order の大きい（＝応用側の）チェックが期限到来している状況。
    const late = WHY_CHECK_ITEMS[WHY_CHECK_ITEMS.length - 1] as WhyCheckItem;
    const got = dueWhyChecks(states([[late.id, NOW - DAY]]), NOW, 2);
    expect(got[0]?.id).toBe(late.id);
    expect(got[1]?.order).toBe(0); // 続きは未着手の体系順先頭
  });

  it("期限到来が複数あるときは期限の古い順", () => {
    const a = WHY_CHECK_ITEMS[0] as WhyCheckItem;
    const b = WHY_CHECK_ITEMS[1] as WhyCheckItem;
    const got = dueWhyChecks(
      states([
        [a.id, NOW - DAY],
        [b.id, NOW - 5 * DAY],
      ]),
      NOW,
      2,
    );
    expect(got.map((i) => i.id)).toEqual([b.id, a.id]);
  });

  it("期限前の既習は出さない", () => {
    const a = WHY_CHECK_ITEMS[0] as WhyCheckItem;
    const got = dueWhyChecks(states([[a.id, NOW + DAY]]), NOW, 1);
    expect(got[0]?.id).not.toBe(a.id);
  });

  it("全件が期限前なら空、limit=0 でも空", () => {
    const all = states(WHY_CHECK_ITEMS.map((i) => [i.id, NOW + DAY] as [string, number]));
    expect(dueWhyChecks(all, NOW, 10)).toEqual([]);
    expect(dueWhyChecks(new Map(), NOW, 0)).toEqual([]);
  });

  it("既定の件数上限で切り、決定論的に同じ結果を返す", () => {
    const a = dueWhyChecks(new Map(), NOW);
    const b = dueWhyChecks(new Map(), NOW);
    expect(a).toEqual(b);
    expect(a.length).toBe(WHY_CHECK_SESSION_SIZE);
  });
});
