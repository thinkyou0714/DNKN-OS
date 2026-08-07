/**
 * subject-plan.ts — 科目合格の有効回数を管理し、次に張るべき科目を提案する（純ロジック）。
 *
 * 電験は科目合格制で、社会人受験者は毎回「今回どの科目に集中するか」を決めている。
 * 競合の学習アプリはこの意思決定を支援していない（電験固有の問題なので汎用アプリには無い）。
 *
 * ## 制度の正確な仕様（重要）
 * 一般に「3年間有効」と説明されるが、これは通称。試験センターの規定は
 *   「最初に合格した試験以降、その申請により **最大で連続して5回まで** 当該科目の試験が免除される」
 * であり、**年数ではなく試験の回数で数える**。2022年度から年2回実施のため
 * 5回 ≒ 2.5年になり、これが「3年」と丸められている。
 * ここでは誤差の出ない「回数」で計算する。
 */

/** 電験三種の4科目。 */
export const DENKEN3_SUBJECTS = ["理論", "電力", "機械", "法規"] as const;
export type Denken3Subject = (typeof DENKEN3_SUBJECTS)[number];

/** 免除される最大の試験回数（試験センター規定）。 */
export const MAX_EXEMPT_SITTINGS = 5;

/** 科目合格の記録。sittingsAgo = その合格から数えて既に何回試験が実施されたか。 */
export interface SubjectPass {
  subject: Denken3Subject;
  /** 合格した回から現在までに実施された試験の回数（0 = 直近の回に合格した）。 */
  sittingsAgo: number;
}

export interface SubjectStatus {
  subject: Denken3Subject;
  passed: boolean;
  /** あと何回の試験まで免除が使えるか（passed のときのみ意味を持つ）。 */
  remaining: number;
  /** 次回の試験で免除が使えるか。 */
  usableNext: boolean;
  /** 期限が迫っている（残り1回以下）か。 */
  expiringSoon: boolean;
}

/**
 * 科目ごとの免除ステータスを求める。
 * remaining は「これから受けられる免除回数」。0 なら次回はもう免除されない（＝再受験が必要）。
 */
export function subjectStatuses(passes: readonly SubjectPass[]): SubjectStatus[] {
  const byId = new Map(passes.map((p) => [p.subject, p]));
  return DENKEN3_SUBJECTS.map((subject) => {
    const p = byId.get(subject);
    if (!p) {
      return { subject, passed: false, remaining: 0, usableNext: false, expiringSoon: false };
    }
    const remaining = Math.max(0, MAX_EXEMPT_SITTINGS - p.sittingsAgo);
    return {
      subject,
      passed: remaining > 0,
      remaining,
      usableNext: remaining > 0,
      expiringSoon: remaining > 0 && remaining <= 1,
    };
  });
}

export interface Recommendation {
  subject: Denken3Subject;
  /** 高いほど今回優先すべき。 */
  priority: number;
  reason: string;
}

/**
 * 「今回どの科目に張るか」を提案する。
 *
 * 判断材料:
 *  - まだ合格していない科目だけが対象（合格済みで免除が生きているものは受けなくてよい）
 *  - 失効が近い科目があると、その科目を落とすと**他の合格済み科目まで無駄になる**ため、
 *    残り回数が少ない状況ほど「合格済みを守る」圧力が上がる
 *  - 到達度（アプリ内の学習実績）が高い科目から確実に取る
 *  - 理論は他科目の土台なので、到達度が同程度なら理論を先に置く
 *
 * @param readiness 科目→到達度(0..1)。アプリの学習実績から与える。
 */
export function recommendSubjects(
  statuses: readonly SubjectStatus[],
  readiness: ReadonlyMap<string, number>,
): Recommendation[] {
  const remainingSubjects = statuses.filter((s) => !s.passed);
  // 合格済みのうち最も早く失効するものの残り回数（少ないほど急ぐ理由になる）。
  const soonest = statuses
    .filter((s) => s.passed)
    .reduce<number | null>((min, s) => (min === null || s.remaining < min ? s.remaining : min), null);

  return remainingSubjects
    .map((s) => {
      const r = readiness.get(s.subject) ?? 0;
      // 到達度が主軸。理論は土台なので僅かに加点する。
      let priority = r * 100 + (s.subject === "理論" ? 5 : 0);
      const reasons: string[] = [`到達度 ${Math.round(r * 100)}%`];
      if (soonest !== null && soonest <= 2) {
        // 合格済みの失効が近い＝今回で決めないと積み上げが崩れる。
        priority += 20;
        reasons.push(`合格済み科目の免除があと${soonest}回で切れる`);
      }
      if (s.subject === "理論") reasons.push("他科目の土台になる");
      return { subject: s.subject, priority: Math.round(priority), reason: reasons.join(" / ") };
    })
    .sort((a, b) => b.priority - a.priority);
}

/** 提案の要約文（先頭2科目に集中を促す。残り1科目ならそれだけ）。 */
export function planSummary(recs: readonly Recommendation[]): string {
  if (recs.length === 0) return "4科目すべて合格済みです。免状の申請手続きに進んでください。";
  if (recs.length === 1) return `残るは「${recs[0]?.subject}」のみ。ここに集中してください。`;
  const top = recs.slice(0, 2).map((r) => r.subject);
  return `今回は「${top.join("」「")}」の2科目に絞るのが現実的です（残り${recs.length}科目）。`;
}
