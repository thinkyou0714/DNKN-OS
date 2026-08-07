/**
 * settings.ts — ユーザー設定（試験日・1日の目標問題数・AIチャット）の永続化（純ロジック）。
 * FSRS の目標保持率は store.ts 側で管理する。
 */
import { CHAT_MODELS, DEFAULT_CHAT_MODEL } from "../../lib/chat/prompt.js";
import type { StorageLike } from "./store.js";

const EXAM_DATE_KEY = "denken:examDate";
const DAILY_GOAL_KEY = "denken:dailyGoal";
const THEME_KEY = "denken:theme";
const API_KEY_KEY = "denken:apiKey";
const CHAT_MODEL_KEY = "denken:chatModel";
const ONBOARDED_KEY = "denken:onboarded";
const REVIEW_CAP_KEY = "denken:reviewCap";

/** 既定の試験日（2026年度 電験二種 一次試験の目安）。設定で上書き可。 */
export const DEFAULT_EXAM_DATE = "2026-08-30";
export const DEFAULT_DAILY_GOAL = 10;
/** 1日に出す復習の上限（retention.ts の既定と揃える）。 */
export const DEFAULT_REVIEW_CAP = 30;

/** テーマ設定。system=OS追従。 */
export type ThemePref = "system" | "light" | "dark";

export function getTheme(storage: StorageLike): ThemePref {
  const raw = storage.getItem(THEME_KEY);
  return raw === "light" || raw === "dark" ? raw : "system";
}

export function setTheme(storage: StorageLike, t: ThemePref): void {
  storage.setItem(THEME_KEY, t);
}

export function getExamDate(storage: StorageLike): string {
  const raw = storage.getItem(EXAM_DATE_KEY);
  return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : DEFAULT_EXAM_DATE;
}

export function setExamDate(storage: StorageLike, iso: string): void {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) storage.setItem(EXAM_DATE_KEY, iso);
}

export function getDailyGoal(storage: StorageLike): number {
  const n = Number(storage.getItem(DAILY_GOAL_KEY));
  return Number.isFinite(n) && n >= 1 && n <= 200 ? n : DEFAULT_DAILY_GOAL;
}

export function setDailyGoal(storage: StorageLike, n: number): void {
  const clamped = Math.min(200, Math.max(1, Math.round(n)));
  storage.setItem(DAILY_GOAL_KEY, String(clamped));
}

// ---- AIチャット（BYOK: ユーザー自身の Anthropic API キー）----
// キーはこの端末の localStorage のみに保存し、送信先は api.anthropic.com のみ。
// リポジトリ・サーバには一切送らない（.env と同じく秘匿情報の扱い）。

export function getApiKey(storage: StorageLike): string {
  return storage.getItem(API_KEY_KEY)?.trim() ?? "";
}

/** 空文字で実質削除（StorageLike に removeItem が無いため）。 */
export function setApiKey(storage: StorageLike, key: string): void {
  storage.setItem(API_KEY_KEY, key.trim());
}

export function getChatModel(storage: StorageLike): string {
  const raw = storage.getItem(CHAT_MODEL_KEY);
  return CHAT_MODELS.some((m) => m.id === raw) ? (raw as string) : DEFAULT_CHAT_MODEL;
}

export function setChatModel(storage: StorageLike, id: string): void {
  if (CHAT_MODELS.some((m) => m.id === id)) storage.setItem(CHAT_MODEL_KEY, id);
}

// ---- 復習の1日上限（リテンション: 多すぎる復習による離脱を防ぐ）----

export function getReviewCap(storage: StorageLike): number {
  const n = Number(storage.getItem(REVIEW_CAP_KEY));
  return Number.isFinite(n) && n >= 5 && n <= 200 ? n : DEFAULT_REVIEW_CAP;
}

export function setReviewCap(storage: StorageLike, n: number): void {
  const clamped = Math.min(200, Math.max(5, Math.round(n)));
  storage.setItem(REVIEW_CAP_KEY, String(clamped));
}

// ---- 受験する試験区分（三種 / 二種一次 / 二種二次）----

const EXAM_FILTER_KEY = "denken:examFilter";

/**
 * 出題を絞る試験区分。"all" は従来どおり全部混ぜる（既存ユーザーの既定＝挙動を変えない）。
 * 学習ログ・FSRSカードは topic 単位で貯まるため、この設定を切り替えても履歴は消えない
 * （表示・出題プールが変わるだけで、戻せば元の進捗もそのまま見える）。
 */
export type ExamFilter = "all" | "denken3" | "denken2_primary" | "denken2_secondary";

const EXAM_FILTERS: readonly ExamFilter[] = ["all", "denken3", "denken2_primary", "denken2_secondary"];

export const EXAM_FILTER_LABEL: Record<ExamFilter, string> = {
  all: "すべて",
  denken3: "電験三種",
  denken2_primary: "電験二種 一次",
  denken2_secondary: "電験二種 二次",
};

export function getExamFilter(storage: StorageLike): ExamFilter {
  const raw = storage.getItem(EXAM_FILTER_KEY) as ExamFilter | null;
  return raw && EXAM_FILTERS.includes(raw) ? raw : "all";
}

export function setExamFilter(storage: StorageLike, f: ExamFilter): void {
  storage.setItem(EXAM_FILTER_KEY, EXAM_FILTERS.includes(f) ? f : "all");
}

/** 試験区分フィルタを問題リストに適用する（"all" は素通し）。 */
export function applyExamFilter<T extends { exam?: string | undefined }>(items: readonly T[], f: ExamFilter): T[] {
  if (f === "all") return [...items];
  // exam 未設定の問題は区分が判定できないため、絞り込み時は除外する。
  return items.filter((p) => p.exam === f);
}

// ---- 科目合格（電験の科目別合格制度）----

const SUBJECT_PASS_KEY = "denken:subjectPasses";

/**
 * 科目合格の記録。値は「その合格から数えて既に何回試験が実施されたか」。
 * 制度は年数でなく回数で数える（最大連続5回免除）ため、回数で保存する。
 */
export function getSubjectPasses(storage: StorageLike): Record<string, number> {
  try {
    const raw = storage.getItem(SUBJECT_PASS_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v) && v >= 0) out[k] = Math.floor(v);
    }
    return out;
  } catch {
    return {};
  }
}

export function setSubjectPasses(storage: StorageLike, v: Record<string, number>): void {
  storage.setItem(SUBJECT_PASS_KEY, JSON.stringify(v));
}

// ---- 文字サイズ（可読性・アクセシビリティ）----

const FONT_SCALE_KEY = "denken:fontScale";

/**
 * 文字サイズ。既存CSSが rem ベースなので、ルートの font-size を変えるだけで
 * 問題文・選択肢・解説まで一律に追随する（個別指定を増やさない）。
 * 競合の学習アプリでは標準機能で、長文の条文問題を読む法規で特に効く。
 */
export type FontScale = "s" | "m" | "l" | "xl";

const FONT_SCALES: readonly FontScale[] = ["s", "m", "l", "xl"];

/** ルート要素に掛ける倍率（%）。m=100% が既定＝従来の見た目。 */
export const FONT_SCALE_PERCENT: Record<FontScale, number> = { s: 90, m: 100, l: 115, xl: 130 };
export const FONT_SCALE_LABEL: Record<FontScale, string> = { s: "小", m: "標準", l: "大", xl: "特大" };

export function getFontScale(storage: StorageLike): FontScale {
  const raw = storage.getItem(FONT_SCALE_KEY) as FontScale | null;
  return raw && FONT_SCALES.includes(raw) ? raw : "m";
}

export function setFontScale(storage: StorageLike, v: FontScale): void {
  storage.setItem(FONT_SCALE_KEY, FONT_SCALES.includes(v) ? v : "m");
}

// ---- 効果音（正解音・ファンファーレ等。既定オン(中)・音量3段階＋オフ）----

const SOUND_KEY = "denken:sound";

/** 効果音の音量。off=無音。保存値 "1"（旧オン）と未設定は mid に写像する。 */
export type SoundLevel = "off" | "low" | "mid" | "high";

export function getSoundLevel(storage: StorageLike): SoundLevel {
  const raw = storage.getItem(SOUND_KEY);
  if (raw === "0") return "off";
  if (raw === "low" || raw === "mid" || raw === "high") return raw;
  return "mid";
}

/** off は旧形式の "0" で保存し、旧バージョンとの互換を保つ。 */
export function setSoundLevel(storage: StorageLike, level: SoundLevel): void {
  storage.setItem(SOUND_KEY, level === "off" ? "0" : level);
}

/** 後方互換ラッパ（オン/オフだけ知りたい呼び出し向け）。 */
export function getSound(storage: StorageLike): boolean {
  return getSoundLevel(storage) !== "off";
}

export function setSound(storage: StorageLike, on: boolean): void {
  setSoundLevel(storage, on ? "mid" : "off");
}

// ---- マスコット表示（キャラ演出が不要な学習者向けに切れる。既定オン）----

const MASCOT_KEY = "denken:mascot";

export function getMascotEnabled(storage: StorageLike): boolean {
  return storage.getItem(MASCOT_KEY) !== "0";
}

export function setMascotEnabled(storage: StorageLike, on: boolean): void {
  storage.setItem(MASCOT_KEY, on ? "1" : "0");
}

// ---- オンボーディング（初回ガイドの既読管理）----

export function isOnboarded(storage: StorageLike): boolean {
  return storage.getItem(ONBOARDED_KEY) === "1";
}

export function setOnboarded(storage: StorageLike): void {
  storage.setItem(ONBOARDED_KEY, "1");
}
