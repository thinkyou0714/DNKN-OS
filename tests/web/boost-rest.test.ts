import { describe, expect, it } from "vitest";
import {
  bridgeWithFreezes,
  canReserveRest,
  coveredDays,
  loadFreezeState,
  saveFreezeState,
  streakWithFreezes,
  toggleRestReservation,
} from "../../web/src/freeze.js";
import { MASCOT_TRIVIA, mascotSvg, mascotTip, tierForLevel } from "../../web/src/mascot.js";
import { dailyQuests, dayIndexOf } from "../../web/src/quests.js";
import { getSound, getSoundLevel, setSound, setSoundLevel } from "../../web/src/settings.js";
import type { WebAnswerLog } from "../../web/src/store.js";
import { comboBonus, QUEST_BOOST_MULT, totalXp, XP_BY_RATING, xpFromLogs } from "../../web/src/xp.js";
import { MemoryStorage } from "../helpers/storage.js";

const DAY0 = Date.UTC(2026, 0, 5, 3, 0, 0); // 2026-01-05 12:00 JST
const DAY0_IDX = dayIndexOf(DAY0);

function log(over: Partial<WebAnswerLog> = {}): WebAnswerLog {
  return { topic: "三相交流電力", correct: true, atMs: DAY0, rating: "good", ...over };
}

describe("XPブースト（クエスト全達成後の正解XP×1.5）", () => {
  /** 全クエストを確実にクリアする12問（全問正解・論点分散＝mastery/topics/solve/correct を満たす）。 */
  function clearingLogs(): WebAnswerLog[] {
    return Array.from({ length: 12 }, (_, i) => log({ atMs: DAY0 + i * 60_000, topic: `論点${i}`, rating: "good" }));
  }

  it("全達成後の正解は ×1.5（端数は四捨五入）で加算される", () => {
    const base12 = clearingLogs();
    const extra = log({ atMs: DAY0 + 13 * 60_000, topic: "追加論点", rating: "good" });
    const delta = totalXp([...base12, extra]) - totalXp(base12);
    // 13問目: 基礎 good ＋ コンボ上限 +5 → ×1.5（四捨五入）。
    expect(delta).toBe(Math.round((XP_BY_RATING.good + 5) * QUEST_BOOST_MULT));
  });

  it("クエスト未達成の日はブーストが掛からない", () => {
    // 同一論点・good のみ3問 → どのクエスト構成でも全達成は不可能（solve≥5/topics≥2/mastery≥2 のいずれかを満たせない）。
    const logs = [log(), log({ atMs: DAY0 + 1000 }), log({ atMs: DAY0 + 2000 })];
    expect(xpFromLogs(logs)).toBe(XP_BY_RATING.good * 3 + comboBonus(2) + comboBonus(3));
  });

  it("不正解（参加報酬）にはブーストが掛からない", () => {
    const base12 = clearingLogs();
    const wrong = log({ atMs: DAY0 + 13 * 60_000, correct: false, rating: "again" });
    const delta = totalXp([...base12, wrong]) - totalXp(base12);
    expect(delta).toBe(XP_BY_RATING.again);
  });

  it("その日のクエスト構成と無関係に決定論（同じログなら同じXP）", () => {
    const logs = clearingLogs();
    expect(totalXp(logs)).toBe(totalXp([...logs].reverse()));
    expect(dailyQuests(DAY0_IDX)).toEqual(dailyQuests(DAY0_IDX));
  });
});

describe("効果音の音量設定（オフ/小/中/大）", () => {
  it("既定は mid・旧形式 '1'/'0' を解釈する", () => {
    const s = new MemoryStorage();
    expect(getSoundLevel(s)).toBe("mid");
    s.setItem("denken:sound", "1"); // 旧オン
    expect(getSoundLevel(s)).toBe("mid");
    s.setItem("denken:sound", "0"); // 旧オフ
    expect(getSoundLevel(s)).toBe("off");
  });

  it("音量を保存・復元できる（off は旧形式 '0' で保存＝後方互換）", () => {
    const s = new MemoryStorage();
    setSoundLevel(s, "high");
    expect(getSoundLevel(s)).toBe("high");
    setSoundLevel(s, "off");
    expect(s.getItem("denken:sound")).toBe("0");
    expect(getSound(s)).toBe(false);
  });

  it("後方互換ラッパ getSound/setSound が動く", () => {
    const s = new MemoryStorage();
    setSound(s, false);
    expect(getSound(s)).toBe(false);
    setSound(s, true);
    expect(getSoundLevel(s)).toBe("mid");
  });
});

describe("シンクウの成長（tier）とまめ知識", () => {
  it("レベル帯で成長段階が決まる", () => {
    expect(tierForLevel(1)).toBe(0);
    expect(tierForLevel(9)).toBe(0);
    expect(tierForLevel(10)).toBe(1);
    expect(tierForLevel(20)).toBe(2);
    expect(tierForLevel(40)).toBe(3);
    expect(tierForLevel(99)).toBe(3);
  });

  it("成長段階ごとに見た目が変わる（アクセサリーが付く）", () => {
    const t0 = mascotSvg("happy", 64, 0);
    const t1 = mascotSvg("happy", 64, 1);
    const t2 = mascotSvg("happy", 64, 2);
    const t3 = mascotSvg("happy", 64, 3);
    expect(new Set([t0, t1, t2, t3]).size).toBe(4);
  });

  it("まめ知識は巡回し、負のインデックスでも安全", () => {
    expect(MASCOT_TRIVIA.length).toBeGreaterThanOrEqual(10);
    expect(mascotTip(0)).toBe(MASCOT_TRIVIA[0]);
    expect(mascotTip(MASCOT_TRIVIA.length)).toBe(MASCOT_TRIVIA[0]);
    expect(typeof mascotTip(-1)).toBe("string");
  });
});

describe("おやすみ予約（restDays）", () => {
  it("予約は「今日学習済み」が条件・トグルで取消できる", () => {
    const state = loadFreezeState(new MemoryStorage());
    expect(canReserveRest(state, new Set([100]), 100)).toBe(true);
    expect(canReserveRest(state, new Set([99]), 100)).toBe(false); // 今日未学習
    const reserved = toggleRestReservation(state, 100);
    expect(reserved.restDays).toContain(101);
    expect(canReserveRest(reserved, new Set([100]), 100)).toBe(false); // 予約済み
    expect(toggleRestReservation(reserved, 100).restDays).not.toContain(101);
  });

  it("予約日はストリーク計算で学習日扱いになる", () => {
    const state = { count: 0, usedDays: [], lastAwardStreak: 0, restDays: [101] };
    expect(streakWithFreezes(new Set([100, 102]), coveredDays(state), 102)).toBe(3);
  });

  it("予約日はお守りを消費しない（ブリッジの欠席に数えない）", () => {
    const state = { count: 1, usedDays: [], lastAwardStreak: 0, restDays: [101] };
    const r = bridgeWithFreezes(state, new Set([100]), 102);
    expect(r.bridgedDays).toEqual([]); // 101 は休みなので欠席ではない
    expect(r.state.count).toBe(1);
  });

  it("保存・復元で restDays が保持され、旧データ（restDaysなし）も読める", () => {
    const s = new MemoryStorage();
    saveFreezeState(s, { count: 1, usedDays: [], lastAwardStreak: 7, restDays: [200] });
    expect(loadFreezeState(s).restDays).toEqual([200]);
    s.setItem("denken:freeze", JSON.stringify({ count: 1, usedDays: [5], lastAwardStreak: 7 }));
    expect(loadFreezeState(s).restDays).toEqual([]);
  });
});
