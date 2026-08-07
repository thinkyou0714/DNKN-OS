/**
 * state/exam.ts — 模試タブの状態・タイマー・開始/終了処理。
 */
import type { Problem } from "../../../lib/engine/schema.js";

export type ExamPreset = "all" | "primary" | "secondary" | "year";

export interface ExamState {
  set: Problem[];
  idx: number;
  results: boolean[];
  startedAt: number;
  timerId: number | null;
  preset: ExamPreset;
  /** 制限時間（ms）。形式別の持ち時間合計（examTimeLimitMs）。 */
  limitMs: number;
  /** 時間切れで強制終了したか（結果画面で明示する）。 */
  timedOut: boolean;
  /** 開始時点でクエスト全達成済みだったか（結果画面での達成祝賀の判定）。 */
  questsClearAtStart: boolean;
  /** 開始時点で週次クエスト全達成済みだったか。 */
  weeklyClearAtStart: boolean;
  /** 開始時点の今日の解答数（模試中の日次目標達成を祝うため）。 */
  todayCountAtStart: number;
  /** 結果画面の祝賀（紙吹雪等）を実行済みか（タブ再描画での再発火を防ぐ）。 */
  celebrated: boolean;
  /** 結果を履歴に保存済みか（タブ再描画での二重保存を防ぐ）。 */
  historySaved?: boolean;
  /**
   * 「あとで見直す」を付けた問題の index 集合（本試CBTの見直しフラグ相当）。
   * 迷った問題を飛ばして先に進み、時間が余ったら戻る、という本番の解き方を再現する。
   */
  flagged?: number[];
}

export let exam: ExamState | null = null;

export function setExam(e: ExamState | null): void {
  exam = e;
}

/**
 * 二次の「N問中M問選択」の選択フェーズ状態（#43）。
 * 電力管理は6問中4問、機械制御は4問中2問を選ばせ、選んだ問題だけ採点する。
 * 選択が確定したら startExam で本番（時間制限つき）へ移行する。
 */
export interface SecondarySelectState {
  /** 科目ごとの候補と選択数（required）。 */
  groups: Array<{ subject: Problem["subject"]; candidates: Problem[]; choose: number }>;
  count: number;
}

export let secondarySelect: SecondarySelectState | null = null;

export function setSecondarySelect(s: SecondarySelectState | null): void {
  secondarySelect = s;
}
