/**
 * tests/web/why-store.test.ts — 納得チェックの記憶状態ストアの検証。
 * FSRS による次回予定の更新・演習データとの分離・壊れた保存値や保存失敗への耐性を確認する。
 */
import { describe, expect, it } from "vitest";
import { WHY_CHECK_ITEMS, type WhyCheckItem } from "../../lib/curriculum/why-check.js";
import { WHY_CARD_KEY, WhyCheckStore } from "../../web/src/why-store.js";
import { MemoryStorage, ThrowingStorage } from "../helpers/storage.js";

const NOW = Date.UTC(2026, 7, 1);
const ID = (WHY_CHECK_ITEMS[0] as WhyCheckItem).id;

describe("WhyCheckStore", () => {
  it("未着手なら状態も着手IDも空", () => {
    const store = new WhyCheckStore(new MemoryStorage());
    expect(store.states().size).toBe(0);
    expect(store.startedIds()).toEqual([]);
    expect(store.view(ID)).toBeUndefined();
  });

  it("採点を記録すると次回予定が未来になり、着手済みとして数えられる", () => {
    const store = new WhyCheckStore(new MemoryStorage());
    const view = store.record(ID, "good", NOW);
    expect(view.dueMs).toBeGreaterThan(NOW);
    expect(store.startedIds()).toEqual([ID]);
    expect(store.states().get(ID)?.dueMs).toBe(view.dueMs);
  });

  it("「言えなかった」は「スラスラ言えた」より早く再出題される", () => {
    const again = new WhyCheckStore(new MemoryStorage()).record(ID, "again", NOW);
    const easy = new WhyCheckStore(new MemoryStorage()).record(ID, "easy", NOW);
    expect(again.dueMs).toBeLessThan(easy.dueMs);
  });

  it("演習データ（denken:cards / denken:logs）には書き込まない", () => {
    const storage = new MemoryStorage();
    new WhyCheckStore(storage).record(ID, "good", NOW);
    expect(storage.getItem("denken:cards")).toBeNull();
    expect(storage.getItem("denken:logs")).toBeNull();
    expect(storage.getItem(WHY_CARD_KEY)).not.toBeNull();
  });

  it("保存値が壊れていても落ちず、未着手として扱って記録を続けられる", () => {
    const storage = new MemoryStorage();
    storage.setItem(WHY_CARD_KEY, "{壊れたJSON");
    const store = new WhyCheckStore(storage);
    expect(store.states().size).toBe(0);
    expect(() => store.record(ID, "good", NOW)).not.toThrow();
    expect(store.startedIds()).toEqual([ID]);
  });

  it("保存値が配列でも（オブジェクトでなくても）空として扱う", () => {
    const storage = new MemoryStorage();
    storage.setItem(WHY_CARD_KEY, "[1,2,3]");
    expect(new WhyCheckStore(storage).states().size).toBe(0);
  });

  it("保存が失敗しても throw しない（学習の継続を優先する）", () => {
    const store = new WhyCheckStore(new ThrowingStorage());
    expect(() => store.record(ID, "good", NOW)).not.toThrow();
  });

  it("日付が壊れた保存値は未着手として扱う（NaN の due で永久に出題されなくなるのを防ぐ）", () => {
    const storage = new MemoryStorage();
    const store = new WhyCheckStore(storage);
    store.record(ID, "good", NOW);
    // 保存済みカードの due を壊す（バックアップの手編集・部分的な書き込み失敗などを想定）。
    const cards = JSON.parse(storage.getItem(WHY_CARD_KEY) as string) as Record<string, { due: string }>;
    (cards[ID] as { due: string }).due = "壊れた日付";
    storage.setItem(WHY_CARD_KEY, JSON.stringify(cards));

    const broken = new WhyCheckStore(storage);
    expect(broken.states().has(ID)).toBe(false);
    expect(broken.startedIds()).not.toContain(ID);
    expect(broken.view(ID)).toBeUndefined();
    // 未着手として再開でき、次回予定も正常に戻る。
    const view = broken.record(ID, "good", NOW);
    expect(Number.isFinite(view.dueMs)).toBe(true);
    expect(broken.states().get(ID)?.dueMs).toBe(view.dueMs);
  });

  it("エントリの型が壊れていても採点は成立する（新規カードとしてやり直す）", () => {
    const storage = new MemoryStorage();
    storage.setItem(WHY_CARD_KEY, JSON.stringify({ [ID]: 42 }));
    const store = new WhyCheckStore(storage);
    expect(store.states().size).toBe(0);
    expect(() => store.record(ID, "good", NOW)).not.toThrow();
    expect(store.states().get(ID)?.dueMs).toBeGreaterThan(NOW);
  });

  it("目標保持率を上げると間隔が短くなる（設定タブの変更に追随する）", () => {
    // 初回採点は学習ステップ（当日中の再出題）で保持率に依らないため、2回目の間隔で比べる。
    const intervalDays = (store: WhyCheckStore): number => {
      const first = store.record(ID, "good", NOW);
      return store.record(ID, "good", first.dueMs).scheduledDays;
    };
    expect(intervalDays(new WhyCheckStore(new MemoryStorage(), 0.95))).toBeLessThan(
      intervalDays(new WhyCheckStore(new MemoryStorage(), 0.8)),
    );

    // 構築後に setDesiredRetention で変更しても効く。
    const changed = new WhyCheckStore(new MemoryStorage(), 0.8);
    changed.setDesiredRetention(0.95);
    expect(intervalDays(changed)).toBeLessThan(intervalDays(new WhyCheckStore(new MemoryStorage(), 0.8)));
  });

  it("同じチェックを繰り返し採点すると間隔が伸びる", () => {
    const store = new WhyCheckStore(new MemoryStorage());
    const first = store.record(ID, "good", NOW);
    const second = store.record(ID, "good", first.dueMs);
    expect(second.scheduledDays).toBeGreaterThanOrEqual(first.scheduledDays);
    expect(second.reps).toBe(2);
  });
});
