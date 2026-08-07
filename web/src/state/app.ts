/**
 * state/app.ts — アプリケーション全体の共有状態。
 * problems 配列・loadFailed・現在 view・progress インスタンス・テーマ。
 */
import type { Problem } from "../../../lib/engine/schema.js";
import { JST_OFFSET_MS } from "../dates.js";
import {
  applyExamFilter,
  FONT_SCALE_PERCENT,
  getExamDate,
  getExamFilter,
  getFontScale,
  getTheme,
} from "../settings.js";
import { LocalProgress } from "../store.js";

export const storage = window.localStorage;
// 試験日を渡して FSRS を試験日逆算モードで構築する（#34/#35）。試験日が変わったら
// settings 側で progress.setExamDate を呼んで再構築する。
export const progress = new LocalProgress(storage, JST_OFFSET_MS, getExamDate(storage));

/**
 * 読み込み済みの問題リスト（試験区分フィルタ適用後）。各画面はこれを見る。
 * 生データは allProblems に保持し、フィルタ切替のたびに再 fetch しない。
 */
export let problems: Problem[] = [];
/** フィルタ前の全問題（切替時の再適用用）。 */
export let allProblems: Problem[] = [];

export function setProblems(p: Problem[]): void {
  allProblems = p;
  problems = applyExamFilter(p, getExamFilter(storage));
}

/** 試験区分フィルタを再適用する（設定変更時に呼ぶ。再 fetch なし）。 */
export function refreshExamFilter(): void {
  problems = applyExamFilter(allProblems, getExamFilter(storage));
}

/** topic → 出題傾向メタ（build-problems が書き出す topic-meta.json）。 */
export type TopicMeta = { subject: string; exam?: string; frequency: string; area?: string };
export let topicMeta: Record<string, TopicMeta> = {};
export function setTopicMeta(m: Record<string, TopicMeta>): void {
  topicMeta = m;
}

/** topic の過去問頻度（メタ未取得・未登録は "mid" 扱い）。 */
export function frequencyOf(topic: string): string {
  return topicMeta[topic]?.frequency ?? "mid";
}

/**
 * 現在の試験区分で「出題されうる」topic 集合。
 *
 * FSRS カードは topic 単位で貯まるため、区分を絞ると
 * 「復習期限は来ているが、いまの区分には1問も存在しない topic」が生じる。
 * これを復習キューやナビのバッジに数えると、開いても解く問題が無い状態になる。
 * problems の参照が変わったときだけ作り直す（毎描画の再構築を避ける）。
 */
let _visibleTopics: Set<string> = new Set();
let _visibleTopicsSrc: Problem[] | null = null;
export function visibleTopicSet(): Set<string> {
  if (_visibleTopicsSrc !== problems) {
    _visibleTopics = new Set(problems.map((p) => p.topic));
    _visibleTopicsSrc = problems;
  }
  return _visibleTopics;
}

/** problems.json の読込に失敗したか（オフライン初回起動など）。リトライ導線を出す。 */
export let loadFailed = false;
export function setLoadFailed(v: boolean): void {
  loadFailed = v;
}

/** 現在表示中のタブ ID。 */
export let view = "practice";
export function setView(id: string): void {
  view = id;
}

/** テーマ設定を解決して <html data-theme> に反映（system は OS 追従）。 */
export function applyTheme(): void {
  const pref = getTheme(storage);
  const dark = pref === "dark" || (pref === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

/** A2HS（ホーム画面追加）のプロンプト。対応ブラウザが発火したときだけ保持される。 */
export interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
}
export let installPrompt: InstallPromptEvent | null = null;
export function setInstallPrompt(p: InstallPromptEvent | null): void {
  installPrompt = p;
}

/**
 * 現在の試験区分で出題されうる problemId 集合。
 * 問題単位の解き直しキューでも、区分外の問題を出さないために使う（topic 側と同じ原則）。
 */
let _visibleIds: Set<string> = new Set();
let _visibleIdsSrc: Problem[] | null = null;
export function visibleProblemIdSet(): Set<string> {
  if (_visibleIdsSrc !== problems) {
    _visibleIds = new Set(problems.map((p) => p.id));
    _visibleIdsSrc = problems;
  }
  return _visibleIds;
}

/** 文字サイズ設定をルート要素に反映する（rem ベースのCSSが一括で追随する）。 */
export function applyFontScale(): void {
  document.documentElement.style.fontSize = `${FONT_SCALE_PERCENT[getFontScale(storage)]}%`;
}
