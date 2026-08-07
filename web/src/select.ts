/**
 * select.ts — 次の出題を選ぶ純ロジック（app.ts の DOM から分離してテスト可能にする）。
 *
 * 方針: 弱点 topic を優先し、その中からランダム。直近に出した問題(excludeId)は
 *   他に候補があるかぎり避ける（同じ問題が連続して出る体験を防ぐ）。
 *
 * インターリーブ（#50）: 弱点 topic を上から順に「使い切る」のではなく、直近に出した
 *   topic を後回しにして弱点群を横断的に出す。連続して同じ topic ばかり出ると
 *   ブロック学習になり、文脈干渉による定着（interleaving 効果）が得られないため。
 *
 * 問題単位の弱点バイアス（FSRS は topic 単位のまま）: 選んだ topic の中では、過去に
 *   間違えた問題(problemId)を、まだ解いていない/既に正解の問題より優先して出す。
 *   FSRS のカードキーは topic 単位のまま（lib/ は変更しない）。ここは「同じ topic 内で
 *   どの問題文を見せるか」を誤答履歴で寄せるだけの薄いバイアス。
 */
import type { Problem } from "../../lib/engine/schema.js";
import type { AnswerLog } from "../../lib/scheduler/diagnosis.js";

export interface PickOptions {
  /** 優先する弱点 topic（優先度順）。 */
  weakTopics: string[];
  rng?: () => number;
  /** 直近に出した問題ID（可能なら避ける）。 */
  excludeId?: string;
  /**
   * 直近に出した topic 群（新しい順）。インターリーブのため、これに含まれる弱点 topic は
   * 後回しにする（他に弱点候補があるときだけ）。
   */
  recentTopics?: string[];
  /**
   * topic の出題重み（過去問頻度）。>1 なら選ばれやすくなる。未指定は一様。
   * 「過去問で頻出の論点ほど多く当たる」を、順序ではなく確率で実現する
   * （順序で固定すると頻出以外を一度も見ないまま本番を迎えるため）。
   */
  topicWeight?: (topic: string) => number;
  /**
   * 過去に間違えた問題ID集合（問題単位の弱点バイアス）。topic 内の候補に含まれていれば、
   * これに該当する問題を優先して出す（never-seen / already-correct より前に）。
   */
  missedIds?: ReadonlySet<string>;
}

/**
 * 解答ログから「最後の解答が誤答だった問題ID」の集合を作る（問題単位の弱点）。
 *
 * 同じ問題を後で正解したら「克服済み」とみなして外す（最新の結果で判定）。
 * problemId の無い古いログは無視する。FSRS のカードキー（topic 単位）には一切触れない。
 */
export function missedProblemIds(logs: readonly AnswerLog[]): Set<string> {
  // 問題ごとに最後の正誤を覚える（ログは時系列前提だが atMs でも判定して順不同に強くする）。
  const last = new Map<string, { atMs: number; correct: boolean }>();
  for (const l of logs) {
    if (!l.problemId) continue;
    const prev = last.get(l.problemId);
    if (!prev || l.atMs >= prev.atMs) last.set(l.problemId, { atMs: l.atMs, correct: l.correct });
  }
  const missed = new Set<string>();
  for (const [id, v] of last) if (!v.correct) missed.add(id);
  return missed;
}

/** topic 重みつきの抽選。重み未指定・総和0のときは一様抽選に落とす。 */
function weightedPick(
  pool: Problem[],
  weightOf: ((topic: string) => number) | undefined,
  rng: () => number,
): Problem | null {
  if (pool.length === 0) return null;
  if (!weightOf) return pool[Math.floor(rng() * pool.length)] ?? null;
  const weights = pool.map((p) => Math.max(0, weightOf(p.topic)));
  const total = weights.reduce((a, b) => a + b, 0);
  if (!(total > 0)) return pool[Math.floor(rng() * pool.length)] ?? null;
  let r = rng() * total;
  for (const [i, w] of weights.entries()) {
    r -= w;
    if (r <= 0) return pool[i] ?? null;
  }
  return pool[pool.length - 1] ?? null;
}

export function pickNextProblem(problems: Problem[], opts: PickOptions): Problem | null {
  if (problems.length === 0) return null;
  const rng = opts.rng ?? Math.random;
  const recent = new Set(opts.recentTopics ?? []);
  const missed = opts.missedIds;

  const pickFrom = (pool: Problem[]): Problem | null => {
    if (pool.length === 0) return null;
    // 直近と同じ問題は避ける（他に候補があるときだけ）。
    const others = pool.filter((p) => p.id !== opts.excludeId);
    const usable = others.length > 0 ? others : pool;
    // 問題単位の弱点バイアス: 候補に「過去に間違えた問題」があればそこから選ぶ（#FSRS-problem）。
    // excludeId 除外後の usable の中で判定する（直近問題の連続は引き続き避ける）。
    if (missed && missed.size > 0) {
      const missedPool = usable.filter((p) => missed.has(p.id));
      if (missedPool.length > 0) return missedPool[Math.floor(rng() * missedPool.length)] ?? null;
    }
    return weightedPick(usable, opts.topicWeight, rng);
  };

  // 弱点 topic を「直近に出していないもの」優先で並べ替える（インターリーブ #50）。
  // 直近 topic を末尾へ回すことで、同じ topic を連続でドリルし続けないようにする。
  const weak = opts.weakTopics;
  const fresh = weak.filter((t) => !recent.has(t));
  const stale = weak.filter((t) => recent.has(t));
  const orderedWeak = [...fresh, ...stale];

  // 並べ替えた弱点 topic に該当する問題があればそこから（解答履歴があるとき）。
  for (const topic of orderedWeak) {
    const chosen = pickFrom(problems.filter((p) => p.topic === topic));
    if (chosen) return chosen;
  }
  // 弱点なし/該当なしは全体から。
  return pickFrom(problems);
}
