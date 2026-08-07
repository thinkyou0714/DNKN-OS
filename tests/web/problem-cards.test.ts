/**
 * 問題単位カード（誤答した問題の期日管理）の不変条件。
 * topic カードとは独立の名前空間で、件数が爆発しないことを構造的に担保する。
 */
import { describe, expect, it } from "vitest";
import { FsrsScheduler } from "../../lib/scheduler/index.js";
import {
  applyAnswer,
  dueProblemIds,
  evictOverCap,
  GRADUATE_OK_STREAK,
  MISTAKE_CARD_CAP,
  type ProblemCardMap,
} from "../../web/src/problem-cards.js";

const scheduler = new FsrsScheduler();
const NOW = new Date("2026-08-01T00:00:00Z");

describe("問題単位カード", () => {
  it("誤答でカードが作られる", () => {
    const m = applyAnswer({}, "G-0001", "again", scheduler, NOW);
    expect(Object.keys(m)).toEqual(["G-0001"]);
    expect(m["G-0001"]?.okStreak).toBe(0);
  });

  it("正解しただけの問題にはカードを作らない（件数爆発の防止）", () => {
    for (const r of ["good", "easy", "hard"] as const) {
      expect(applyAnswer({}, "G-0002", r, scheduler, NOW)).toEqual({});
    }
  });

  it(`誤答後に ${GRADUATE_OK_STREAK} 回連続で正解すると卒業して消える`, () => {
    let m: ProblemCardMap = applyAnswer({}, "G-0003", "again", scheduler, NOW);
    for (let i = 0; i < GRADUATE_OK_STREAK - 1; i++) {
      m = applyAnswer(m, "G-0003", "good", scheduler, NOW);
      expect(m["G-0003"]).toBeDefined();
    }
    m = applyAnswer(m, "G-0003", "good", scheduler, NOW);
    expect(m["G-0003"]).toBeUndefined();
  });

  it("途中で再び誤答すると okStreak が 0 に戻る", () => {
    let m = applyAnswer({}, "G-0004", "again", scheduler, NOW);
    m = applyAnswer(m, "G-0004", "good", scheduler, NOW);
    expect(m["G-0004"]?.okStreak).toBe(1);
    m = applyAnswer(m, "G-0004", "again", scheduler, NOW);
    expect(m["G-0004"]?.okStreak).toBe(0);
  });

  it("上限を超えたら卒業に近いものから決定的に捨てる", () => {
    const m: ProblemCardMap = {};
    for (let i = 0; i < MISTAKE_CARD_CAP + 5; i++) {
      m[`G-${String(i).padStart(4, "0")}`] = {
        card: { ...schedulerCard(), due: new Date(NOW.getTime() + i * 1000).toISOString() },
        // 先頭5件だけ卒業間近にしておく → これが捨てられるべき
        okStreak: i < 5 ? 2 : 0,
        createdAtMs: NOW.getTime(),
      };
    }
    const out = evictOverCap(m);
    expect(Object.keys(out)).toHaveLength(MISTAKE_CARD_CAP);
    for (let i = 0; i < 5; i++) expect(out[`G-${String(i).padStart(4, "0")}`]).toBeUndefined();
  });

  it("期日到来分だけを期日の早い順に返す", () => {
    const m: ProblemCardMap = {
      late: { card: { ...schedulerCard(), due: "2026-08-10T00:00:00Z" }, okStreak: 0, createdAtMs: 0 },
      early: { card: { ...schedulerCard(), due: "2026-07-30T00:00:00Z" }, okStreak: 0, createdAtMs: 0 },
      mid: { card: { ...schedulerCard(), due: "2026-07-31T00:00:00Z" }, okStreak: 0, createdAtMs: 0 },
    };
    expect(dueProblemIds(m, Date.parse("2026-08-01T00:00:00Z"))).toEqual(["early", "mid"]);
  });

  it("上限まで貯めても localStorage を圧迫しない（100KB 未満）", () => {
    const m: ProblemCardMap = {};
    for (let i = 0; i < MISTAKE_CARD_CAP; i++) {
      m[`G-${String(i).padStart(8, "0")}`] = { card: schedulerCard(), okStreak: 1, createdAtMs: NOW.getTime() };
    }
    expect(JSON.stringify(m).length).toBeLessThan(100_000);
  });
});

/** テスト用の StoredCard（scheduler の初期カードを保存形にしたもの）。 */
function schedulerCard() {
  const c = scheduler.init(NOW);
  return JSON.parse(JSON.stringify({ ...c, due: c.due.toISOString() })) as ProblemCardMap[string]["card"];
}
