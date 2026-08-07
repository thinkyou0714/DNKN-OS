/**
 * views/practice-rewards.ts — 解答記録後の報酬計算（お守り/レベル/クエスト/実績）。
 * 学習（finalize）と模試（renderExamResult）の両経路で共有する。
 */
import { evaluateAchievements, loadSeenBadges, newlyUnlocked, saveSeenBadges } from "../achievements.js";
import { topicSubjectMap } from "../dashboard.js";
import { maybeAwardFreeze, saveFreezeState } from "../freeze.js";
import {
  allQuestsClear,
  allWeeklyQuestsClear,
  dayIndexOf,
  logsOfDay,
  logsOfWeek,
  QUEST_CLEAR_BONUS_XP,
  WEEKLY_CLEAR_BONUS_XP,
  weekIndexOf,
} from "../quests.js";
import { passedStreakMilestone } from "../retention.js";
import { allProblems, progress, storage } from "../state/app.js";
import { SEEN_LEVEL_KEY, SEEN_STREAK_MILESTONE_KEY } from "../storage-keys.js";
import { currentLevel, freezeInfo, runFreezeBridge, seenLevel, seenStreakMilestone } from "./practice.js";

export interface RewardOutcome {
  /** 重要度順の祝賀メッセージ（先頭をトーストに使う）。 */
  celebrations: string[];
  fanfare: "levelup" | "clear" | null;
  /** 大台達成など特別な節目（紙吹雪を増量する）。 */
  bigConfetti: boolean;
}

/**
 * 解答記録後の報酬処理（お守り獲得/大台/レベル/日次・週次クエスト/実績）。
 * 学習（finalize）と模試（結果画面）の両経路で共有する — 模試だけで学ぶ人も
 * レベルアップやお守りを取りこぼさない。
 */
export function processRewards(beforeRecord: { questsClear: boolean; weeklyClear: boolean }): RewardOutcome {
  // 開きっぱなしのタブで日をまたいだ直後でも、先に欠席日をお守りでカバーしてから集計する。
  runFreezeBridge();
  const todayIdx = dayIndexOf(Date.now());
  const weekIdx = weekIndexOf(Date.now());
  const celebrations: string[] = [];
  let fanfare: "levelup" | "clear" | null = null;
  let bigConfetti = false;

  // 1) ストリークお守りの獲得（7日継続ごと・上限2）。
  const fiAfter = freezeInfo();
  const award = maybeAwardFreeze(fiAfter.state, fiAfter.streak);
  if (award.awarded) {
    saveFreezeState(storage, award.state);
    celebrations.push(`🧊 ${fiAfter.streak}日継続ボーナス！ストリークお守りを獲得（欠席日を自動カバー）`);
  }

  // 1b) ストリーク大台（30/50/100…日）のスペシャル祝賀（最優先・紙吹雪は増量）。
  const milestone = passedStreakMilestone(fiAfter.streak, seenStreakMilestone());
  if (milestone) {
    try {
      storage.setItem(SEEN_STREAK_MILESTONE_KEY, String(milestone));
    } catch {
      // 保存不能でも続行。
    }
    celebrations.unshift(`🏆 ストリーク ${milestone} 日達成！これはもう本物の継続力です`);
    fanfare = "levelup";
    bigConfetti = true;
  }

  // 2) レベルアップ（保存値と比較するため、どの経路の上昇も取りこぼさない）。
  const lv = currentLevel();
  if (lv.level > seenLevel()) {
    try {
      storage.setItem(SEEN_LEVEL_KEY, String(lv.level));
    } catch {
      // 保存不能でも続行。
    }
    celebrations.unshift(`🎉 レベルアップ！ Lv.${lv.level}「${lv.title}」`);
    fanfare = "levelup";
  }

  // 3) 今日のクエスト全達成。
  if (!beforeRecord.questsClear && allQuestsClear(logsOfDay(progress.logs(), todayIdx), todayIdx)) {
    celebrations.push(`📋 今日のクエスト全達成！ +${QUEST_CLEAR_BONUS_XP} XP`);
    fanfare = fanfare ?? "clear";
  }

  // 3b) 今週のクエスト全達成（週に1度の大きめの節目）。
  if (!beforeRecord.weeklyClear && allWeeklyQuestsClear(logsOfWeek(progress.logs(), weekIdx), weekIdx)) {
    celebrations.push(`🗓️ 今週のクエスト全達成！ +${WEEKLY_CLEAR_BONUS_XP} XP`);
    fanfare = fanfare ?? "clear";
  }

  // 4) 実績バッジの新規解除。
  const badgeViews = evaluateAchievements({
    logs: progress.logs(),
    streakDays: fiAfter.streak,
    level: lv.level,
    // 実績は過去の全学習が対象。区分で絞ると他区分で解いた分の科目対応が失われ
    // 「全科目制覇」等のバッジが退行するため、ここは allProblems を使う。
    subjectOf: topicSubjectMap(allProblems),
    usedFreezeDays: fiAfter.state.usedDays,
  });
  const seen = loadSeenBadges(storage);
  const fresh = newlyUnlocked(badgeViews, seen);
  if (fresh.length > 0) {
    for (const b of fresh) seen.add(b.id);
    saveSeenBadges(storage, seen);
    // 遡及判定の導入直後は一度に多数解除されうるため、トーストは2件＋残数に要約する。
    const names = fresh
      .slice(0, 2)
      .map((b) => `${b.icon}${b.title}`)
      .join("、");
    celebrations.push(`🏅 実績解除: ${names}${fresh.length > 2 ? ` ほか${fresh.length - 2}件` : ""}`);
  }

  return { celebrations, fanfare, bigConfetti };
}
