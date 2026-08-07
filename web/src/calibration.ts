/**
 * calibration.ts — 自分の解答実績で難易度を較正する（純ロジック）。
 *
 * 問題データの `stats.correct_rate` は配信時点で全問 0 のまま（受験者全体の統計は
 * サーバが無いと集められない）。一方で ★難易度はテンプレ作者が付けた推定値で、
 * 「自分にとって難しいか」とは別物。
 *
 * ここでは端末内の解答ログだけを使い、
 *   - 問題ごとの正答率（自分）
 *   - 表示上の「体感難易度」（★推定 と 自分の実績のブレンド）
 * を出す。サーバ不要で今日から効き、弱点の可視化に直結する。
 */
import type { AnswerLog } from "../../lib/scheduler/diagnosis.js";

export interface ProblemStat {
  attempts: number;
  correct: number;
  /** 自分の正答率（0..1）。attempts=0 のときは undefined。 */
  rate: number | undefined;
}

/**
 * problemId ごとの自己集計のメモ（出題のたびに全ログを再走査しないため）。
 * ログ配列の参照が変わったときだけ作り直す（解答するたびに新配列が返る前提）。
 */
let _memoSrc: readonly AnswerLog[] | null = null;
let _memo: Map<string, ProblemStat> = new Map();

/** メモ付きの集計。呼び出し側は毎描画で気軽に呼んでよい。 */
export function statsByProblemCached(logs: readonly AnswerLog[]): Map<string, ProblemStat> {
  if (_memoSrc !== logs) {
    _memo = statsByProblem(logs);
    _memoSrc = logs;
  }
  return _memo;
}

/** problemId ごとの自己集計。problemId を持たない古いログは無視する。 */
export function statsByProblem(logs: readonly AnswerLog[]): Map<string, ProblemStat> {
  const m = new Map<string, ProblemStat>();
  for (const l of logs) {
    if (!l.problemId) continue;
    const cur = m.get(l.problemId) ?? { attempts: 0, correct: 0, rate: undefined };
    cur.attempts += 1;
    if (l.correct) cur.correct += 1;
    cur.rate = cur.correct / cur.attempts;
    m.set(l.problemId, cur);
  }
  return m;
}

/**
 * 体感難易度（1..5）。
 *
 * 試行が浅いうちは推定★を信じ、解くほど自分の実績に寄せる（ベイズ的な収縮）。
 * `PRIOR_WEIGHT` 回ぶんの「推定★」を事前情報として持っている、と解釈する。
 */
const PRIOR_WEIGHT = 3;

export function perceivedDifficulty(baseDifficulty: number, stat: ProblemStat | undefined): number {
  if (!stat || stat.attempts === 0) return baseDifficulty;
  // 正答率0% → 5、100% → 1 に線形写像したものを「実績由来の難易度」とする。
  const fromRate = 5 - 4 * (stat.correct / stat.attempts);
  const w = stat.attempts / (stat.attempts + PRIOR_WEIGHT);
  const blended = baseDifficulty * (1 - w) + fromRate * w;
  return Math.min(5, Math.max(1, Math.round(blended * 10) / 10));
}

/** 表示用のラベル。較正が効いているときだけ実績を添える。 */
export function calibrationLabel(baseDifficulty: number, stat: ProblemStat | undefined): string {
  if (!stat || stat.attempts === 0) return "";
  const pct = Math.round((stat.correct / stat.attempts) * 100);
  const perceived = perceivedDifficulty(baseDifficulty, stat);
  const gap = perceived - baseDifficulty;
  // 推定より明らかに難しい/易しいときだけ注意を引く（差が小さければ数字だけ）。
  const mark = gap >= 0.8 ? "（自分には難しめ）" : gap <= -0.8 ? "（自分には易しめ）" : "";
  return `あなたの正答率 ${pct}%（${stat.correct}/${stat.attempts}）${mark}`;
}
