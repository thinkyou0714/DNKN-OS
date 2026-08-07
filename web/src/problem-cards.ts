/**
 * problem-cards.ts — 誤答した「問題」を個別に期日管理する（純ロジック・DOM非依存）。
 *
 * 既存の FSRS カードは topic 単位（`denken:cards`）で、1問の正誤が論点全体の
 * due/stability を動かす。そのため「特定の問題を間違えた」という最も価値の高い
 * 復習素材が個別にスケジュールされず、間違いノートも回数順の静的リストのままだった。
 *
 * ここでは topic カードには一切触れず、**新しい名前空間**に誤答した問題だけの
 * カードを持つ。全問（12,901問）に張ると localStorage が破綻するため、
 *   - 生成は「誤答したとき」だけ
 *   - 一定回数連続で正解したら卒業（削除）
 *   - 上限超過時は「卒業に最も近い＝学習価値が最小」のものから捨てる
 * という3点で件数を抑える。
 *
 * ログ（denken:logs）は LOG_CAP で古い順に間引かれるが、このカードはログと独立に
 * 期日を持つため、間引きで解き直し予定が消えることがない。
 */

import type { Rating } from "../../lib/scheduler/index.js";
import { type FsrsScheduler, reviveCard, type StoredCard, toStoredCard } from "../../lib/scheduler/index.js";

export const PROBLEM_CARD_KEY = "denken:problemCards";

/** 保持できる問題カードの上限（約230B/件 → 300件で約68KB）。 */
export const MISTAKE_CARD_CAP = 300;
/** 「again 以外」が連続でこの回数に達したら卒業（カード削除）。 */
export const GRADUATE_OK_STREAK = 3;
/** 1日に出す解き直しの上限（topic 側の復習上限とは別枠）。 */
export const MISTAKE_REVIEW_CAP = 10;

export interface ProblemCardEntry {
  card: StoredCard;
  /** again 以外が連続した回数。GRADUATE_OK_STREAK で卒業。 */
  okStreak: number;
  createdAtMs: number;
}

export type ProblemCardMap = Record<string, ProblemCardEntry>;

/**
 * 解答1件をカードへ反映する（新しい map を返す。引数は変更しない）。
 *
 * - `again`: カードが無ければ作る。あれば更新して okStreak を 0 に戻す。
 * - それ以外: **既存カードがあるときだけ**更新し okStreak を増やす。
 *   （正解しただけの問題にカードを作らない＝件数爆発の防止）
 * - okStreak が GRADUATE_OK_STREAK に達したら削除（卒業）。
 */
export function applyAnswer(
  map: ProblemCardMap,
  problemId: string,
  rating: Rating,
  scheduler: FsrsScheduler,
  now: Date,
): ProblemCardMap {
  const existing = map[problemId];
  if (rating !== "again" && !existing) return map; // 正解のみの問題は管理対象にしない

  const prev = existing ? reviveCard(existing.card) : scheduler.init(now);
  const next = scheduler.review(prev, rating, now);
  const okStreak = rating === "again" ? 0 : (existing?.okStreak ?? 0) + 1;

  const out = { ...map };
  if (okStreak >= GRADUATE_OK_STREAK) {
    delete out[problemId];
    return out;
  }
  out[problemId] = {
    card: toStoredCard(next),
    okStreak,
    createdAtMs: existing?.createdAtMs ?? now.getTime(),
  };
  return out;
}

/**
 * 上限を超えた分を決定的に間引く。
 * 卒業に近い（okStreak 大）→ 期日が遠い（due 遅い）→ id 辞書順 で捨てる。
 */
export function evictOverCap(map: ProblemCardMap, cap: number = MISTAKE_CARD_CAP): ProblemCardMap {
  const ids = Object.keys(map);
  if (ids.length <= cap) return map;
  const sorted = [...ids].sort((a, b) => {
    const ea = map[a] as ProblemCardEntry;
    const eb = map[b] as ProblemCardEntry;
    if (eb.okStreak !== ea.okStreak) return eb.okStreak - ea.okStreak;
    const da = Date.parse(ea.card.due);
    const db = Date.parse(eb.card.due);
    if (db !== da) return db - da;
    return a < b ? -1 : 1;
  });
  const out = { ...map };
  for (const id of sorted.slice(0, ids.length - cap)) delete out[id];
  return out;
}

/** 期日が来た problemId を期日の早い順に返す（ISO 文字列の比較のみ＝revive 不要で軽い）。 */
export function dueProblemIds(map: ProblemCardMap, nowMs: number): string[] {
  return Object.entries(map)
    .filter(([, e]) => Date.parse(e.card.due) <= nowMs)
    .sort((a, b) => Date.parse(a[1].card.due) - Date.parse(b[1].card.due))
    .map(([id]) => id);
}
