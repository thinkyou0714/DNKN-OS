/**
 * curriculum/understanding.ts — 「解けるけど説明できない」領域の検出（純ロジック）。
 *
 * 目的: 演習の正答率だけを見ていると、公式に数字を当てはめて正解しているだけの領域も
 *   「習得済み」に見えてしまう。参考書の読み上げ学習で起きるのはまさにこれで、
 *   正答率は上がるのに「なぜその式なのか」は空白のまま残る。
 *   演習の正答率（解ける）と納得チェックの着手率（説明できる）の2軸を突き合わせ、
 *   前者だけが高い領域を「原理の確認がまだ」の候補として返す。
 *
 * 判定はあくまで推定（topic→領域はキーワード部分一致・着手率は自己申告ベース）なので、
 * UI では断定せず「確認してみませんか」の温度で提示すること。
 *
 * DOM 非依存・状態なし・決定論。
 */
import { smoothedSuccessRate } from "../scheduler/diagnosis.js";
import { topicConceptAreas } from "./gaps.js";
import { CONCEPT_KEYWORDS } from "./graph.js";
import { WHY_CHECK_ITEMS, type WhyCheckItem } from "./why-check.js";

/** 集計に使う最小の解答ログ。 */
export interface SolveLog {
  topic: string;
  correct: boolean;
}

/** 概念領域1つの「解ける」と「説明できる」の対比。 */
export interface AreaUnderstanding {
  area: string;
  /** その領域に属する論点への解答数。 */
  attempts: number;
  /** 平滑化した正答率（0..1。少試行のノイズを抑える）。 */
  solveAccuracy: number;
  /** その領域の納得チェック総数。 */
  whyTotal: number;
  /** 一度でも回答した納得チェック数。 */
  whyStarted: number;
  /** 納得チェックの着手率（0..1。whyTotal=0 なら 0）。 */
  whyCoverage: number;
  /** 「解けるけど説明できない」疑いがあるか。 */
  gap: boolean;
}

/** ギャップ判定に必要な最小解答数（これ未満は正答率が信頼できない）。 */
export const GAP_MIN_ATTEMPTS = 5;
/** ギャップ判定の正答率下限（これ以上なら「解けている」とみなす）。 */
export const GAP_MIN_ACCURACY = 0.8;
/** ギャップ判定の着手率上限（これ未満なら「原理の確認がまだ」とみなす）。 */
export const GAP_MAX_WHY_COVERAGE = 0.5;

/**
 * 概念領域ごとに「解ける（演習正答率）」と「説明できる（納得チェック着手率）」を集計する。
 *
 * 1つの論点が複数領域のキーワードにマッチする場合、その解答は各領域に計上する
 * （領域は排他ではなく、同じ論点が複数領域の理解を要求しうるため）。
 * 領域にマッチしない論点は無視する。
 *
 * @param logs          解答ログ（topic と正誤のみ使う）。
 * @param startedWhyIds 一度でも回答した納得チェックの ID 集合。
 */
export function understandingByArea(
  logs: Iterable<SolveLog>,
  startedWhyIds: Iterable<string>,
  items: readonly WhyCheckItem[] = WHY_CHECK_ITEMS,
  keywords: Readonly<Record<string, readonly string[]>> = CONCEPT_KEYWORDS,
): AreaUnderstanding[] {
  const started = new Set(startedWhyIds);
  // 領域 → 演習の試行/正答。
  const solve = new Map<string, { attempts: number; correct: number }>();
  // topic → 領域の推定はログ件数ぶん繰り返すため、topic 単位でメモ化する。
  const areaCache = new Map<string, string[]>();
  for (const log of logs) {
    let areas = areaCache.get(log.topic);
    if (!areas) {
      areas = topicConceptAreas(log.topic, keywords);
      areaCache.set(log.topic, areas);
    }
    for (const area of areas) {
      const cur = solve.get(area) ?? { attempts: 0, correct: 0 };
      cur.attempts += 1;
      if (log.correct) cur.correct += 1;
      solve.set(area, cur);
    }
  }
  // 領域 → 納得チェックの総数/着手数。
  const why = new Map<string, { total: number; started: number }>();
  for (const item of items) {
    const cur = why.get(item.area) ?? { total: 0, started: 0 };
    cur.total += 1;
    if (started.has(item.id)) cur.started += 1;
    why.set(item.area, cur);
  }

  const areas = new Set<string>([...solve.keys(), ...why.keys()]);
  const rows: AreaUnderstanding[] = [];
  for (const area of areas) {
    const s = solve.get(area) ?? { attempts: 0, correct: 0 };
    const w = why.get(area) ?? { total: 0, started: 0 };
    const solveAccuracy = smoothedSuccessRate(s.correct, s.attempts);
    const whyCoverage = w.total > 0 ? w.started / w.total : 0;
    const gap =
      s.attempts >= GAP_MIN_ATTEMPTS &&
      solveAccuracy >= GAP_MIN_ACCURACY &&
      w.total > 0 &&
      whyCoverage < GAP_MAX_WHY_COVERAGE;
    rows.push({
      area,
      attempts: s.attempts,
      solveAccuracy,
      whyTotal: w.total,
      whyStarted: w.started,
      whyCoverage,
      gap,
    });
  }
  // 安定した順序（表示・テストのため名前順）。
  rows.sort((a, b) => a.area.localeCompare(b.area, "ja"));
  return rows;
}

/**
 * 「解けるけど説明できない」疑いのある領域だけを優先度順で返す。
 * 優先度は「よく解けている（＝取りこぼしに気づきにくい）」かつ「原理の確認が薄い」順。
 */
export function explanationGaps(
  logs: Iterable<SolveLog>,
  startedWhyIds: Iterable<string>,
  items: readonly WhyCheckItem[] = WHY_CHECK_ITEMS,
  keywords: Readonly<Record<string, readonly string[]>> = CONCEPT_KEYWORDS,
): AreaUnderstanding[] {
  return understandingByArea(logs, startedWhyIds, items, keywords)
    .filter((r) => r.gap)
    .sort(
      (a, b) =>
        b.solveAccuracy - a.solveAccuracy || a.whyCoverage - b.whyCoverage || a.area.localeCompare(b.area, "ja"),
    );
}
