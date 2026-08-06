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

  it("同じチェックを繰り返し採点すると間隔が伸びる", () => {
    const store = new WhyCheckStore(new MemoryStorage());
    const first = store.record(ID, "good", NOW);
    const second = store.record(ID, "good", first.dueMs);
    expect(second.scheduledDays).toBeGreaterThanOrEqual(first.scheduledDays);
    expect(second.reps).toBe(2);
  });
});
