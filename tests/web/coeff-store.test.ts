/**
 * tests/web/coeff-store.test.ts — 係数判断ドリルの記憶状態ストアの検証。
 * FSRS による次回予定の更新・演習/納得チェックデータとの分離・壊れた保存値や
 * 保存失敗への耐性を確認する（why-store.test.ts と同じ観点）。
 */
import { describe, expect, it } from "vitest";
import { COEFFICIENT_DRILL_ITEMS, type CoefficientDrillItem } from "../../lib/curriculum/coefficients.js";
import { COEFF_CARD_KEY, CoeffDrillStore } from "../../web/src/coeff-store.js";
import { MemoryStorage, ThrowingStorage } from "../helpers/storage.js";

const NOW = Date.UTC(2026, 7, 1);
const DAY = 86_400_000;
const ID = (COEFFICIENT_DRILL_ITEMS[0] as CoefficientDrillItem).id;

describe("CoeffDrillStore", () => {
  it("未着手なら状態も着手IDも空", () => {
    const store = new CoeffDrillStore(new MemoryStorage());
    expect(store.states().size).toBe(0);
    expect(store.startedIds()).toEqual([]);
    expect(store.view(ID)).toBeUndefined();
  });

  it("採点を記録すると次回予定が未来になり、着手済みとして数えられる", () => {
    const store = new CoeffDrillStore(new MemoryStorage());
    const view = store.record(ID, "good", NOW);
    expect(view.dueMs).toBeGreaterThan(NOW);
    expect(store.startedIds()).toEqual([ID]);
    expect(store.states().get(ID)?.dueMs).toBe(view.dueMs);
  });

  it("不正解（again）は正解（good）より早く再出題される", () => {
    const again = new CoeffDrillStore(new MemoryStorage()).record(ID, "again", NOW);
    const good = new CoeffDrillStore(new MemoryStorage()).record(ID, "good", NOW);
    expect(again.dueMs).toBeLessThan(good.dueMs);
  });

  it("states() は lapses を含む（苦手ファミリ推定に使う）", () => {
    const store = new CoeffDrillStore(new MemoryStorage());
    store.record(ID, "good", NOW);
    const state = store.states().get(ID);
    expect(typeof state?.lapses).toBe("number");
    expect(state?.lapses).toBeGreaterThanOrEqual(0);
    // 定着後（good×2 で Review 状態へ）に忘れる（期限後に again）と lapses が増える。
    store.record(ID, "good", NOW + DAY);
    store.record(ID, "again", NOW + 40 * DAY);
    expect(store.states().get(ID)?.lapses ?? 0).toBeGreaterThanOrEqual(1);
  });

  it("演習・納得チェックのデータ（denken:cards / denken:logs / denken:whyCards）には書き込まない", () => {
    const storage = new MemoryStorage();
    new CoeffDrillStore(storage).record(ID, "good", NOW);
    expect(storage.getItem("denken:cards")).toBeNull();
    expect(storage.getItem("denken:logs")).toBeNull();
    expect(storage.getItem("denken:whyCards")).toBeNull();
    expect(storage.getItem(COEFF_CARD_KEY)).not.toBeNull();
  });

  it("保存値が壊れていても落ちず、未着手として扱って記録を続けられる", () => {
    const storage = new MemoryStorage();
    storage.setItem(COEFF_CARD_KEY, "{壊れたJSON");
    const store = new CoeffDrillStore(storage);
    expect(store.states().size).toBe(0);
    expect(() => store.record(ID, "good", NOW)).not.toThrow();
    expect(store.startedIds()).toEqual([ID]);
  });

  it("保存値が配列でも（オブジェクトでなくても）空として扱う", () => {
    const storage = new MemoryStorage();
    storage.setItem(COEFF_CARD_KEY, "[1,2,3]");
    expect(new CoeffDrillStore(storage).states().size).toBe(0);
  });

  it("保存が失敗しても throw しない（学習の継続を優先する）", () => {
    const store = new CoeffDrillStore(new ThrowingStorage());
    expect(() => store.record(ID, "good", NOW)).not.toThrow();
  });

  it("日付が壊れた保存値は未着手として扱う（NaN の due で永久に出題されなくなるのを防ぐ）", () => {
    const storage = new MemoryStorage();
    const store = new CoeffDrillStore(storage);
    store.record(ID, "good", NOW);
    const cards = JSON.parse(storage.getItem(COEFF_CARD_KEY) as string) as Record<string, { due: string }>;
    (cards[ID] as { due: string }).due = "壊れた日付";
    storage.setItem(COEFF_CARD_KEY, JSON.stringify(cards));
    expect(store.states().has(ID)).toBe(false);
    expect(store.startedIds()).toEqual([]);
    // 壊れた状態からでも record し直せば復帰する。
    expect(() => store.record(ID, "good", NOW)).not.toThrow();
    expect(store.startedIds()).toEqual([ID]);
  });

  it("目標保持率を上げると次回間隔が同じか短くなる（設定連動の向きの確認）", () => {
    const low = new CoeffDrillStore(new MemoryStorage(), 0.8).record(ID, "good", NOW);
    const high = new CoeffDrillStore(new MemoryStorage(), 0.95).record(ID, "good", NOW);
    expect(high.dueMs).toBeLessThanOrEqual(low.dueMs);
  });
});
