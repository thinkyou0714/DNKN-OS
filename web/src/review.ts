/**
 * review.ts — 復習キューと「間違いノート」（純ロジック）。
 * 学習科学の核: 想起練習＋誤答の重点復習。FSRS の due と誤答履歴から
 * 「今やるべき復習」と「間違えた問題の再演習」を組み立てる。
 */
import type { Problem } from "../../lib/engine/schema.js";
import type { WebAnswerLog } from "./store.js";

export interface MistakeEntry {
  problem: Problem;
  missCount: number;
  attempts: number;
  lastMissMs: number;
}

/** 復習期限が来た topic の問題を集める（due 順に渡された dueTopics を尊重）。 */
export function dueReviewProblems(problems: Problem[], dueTopics: string[]): Problem[] {
  const set = new Set(dueTopics);
  const order = new Map(dueTopics.map((t, i) => [t, i]));
  return problems.filter((p) => set.has(p.topic)).sort((a, b) => (order.get(a.topic) ?? 0) - (order.get(b.topic) ?? 0));
}

/**
 * 間違いノート: problemId 単位で誤答を集計し、誤答回数の多い順・直近順に返す。
 * problemId を持つログのみ対象（問題単位で再演習できる）。
 */
export function mistakeNotebook(logs: WebAnswerLog[], problems: Problem[], limit = 50): MistakeEntry[] {
  const byId = new Map<string, Problem>();
  for (const p of problems) byId.set(p.id, p);

  const stat = new Map<string, { miss: number; attempts: number; lastMiss: number }>();
  for (const l of logs) {
    if (!l.problemId || !byId.has(l.problemId)) continue;
    const cur = stat.get(l.problemId) ?? { miss: 0, attempts: 0, lastMiss: 0 };
    cur.attempts += 1;
    if (!l.correct) {
      cur.miss += 1;
      cur.lastMiss = Math.max(cur.lastMiss, l.atMs);
    }
    stat.set(l.problemId, cur);
  }

  return [...stat.entries()]
    .filter(([, v]) => v.miss > 0)
    .map(([id, v]) => ({
      // line 33 の `!byId.has(l.problemId)` で byId にないログはスキップ済みのため、id は byId に存在する。
      problem: byId.get(id) as Problem,
      missCount: v.miss,
      attempts: v.attempts,
      lastMissMs: v.lastMiss,
    }))
    .sort((a, b) => b.missCount - a.missCount || b.lastMissMs - a.lastMissMs)
    .slice(0, limit);
}

/**
 * 期日が来た誤答問題を解き直し用に解決する。
 * dueIds の順（期日の早い順）を保ち、現在の試験区分に存在しない問題は除外する。
 */
export function dueMistakeProblems(dueIds: readonly string[], problems: readonly Problem[], limit: number): Problem[] {
  const byId = new Map(problems.map((p) => [p.id, p]));
  const out: Problem[] = [];
  for (const id of dueIds) {
    const p = byId.get(id);
    if (p) out.push(p);
    if (out.length >= limit) break;
  }
  return out;
}
