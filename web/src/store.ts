/**
 * store.ts — ブラウザのローカル進捗（localStorage）。
 * offline-first の小さな key/value 状態は localStorage で十分（調査の定石）。
 * Storage を注入可能にし、DOM 無しでもテストできる。
 *
 * スケジューラは FSRS（Free Spaced Repetition Scheduler）を採用する。
 * 研究上 FSRS は SM-2 比で同じ保持率を 20〜30% 少ない復習で達成でき、
 * 4段階評価（again/hard/good/easy）で記憶状態（安定度・難易度）を分離管理する。
 * 互換のため record() は boolean（正誤）も受け付け、true→good / false→again に写像する。
 */
import {
  type AnswerLog,
  examAwareParams,
  type FsrsScheduler,
  type FsrsView,
  getScheduler,
  type Rating,
  reviveCard,
  type StoredCard,
  toStoredCard,
} from "../../lib/scheduler/index.js";
import { dayIndex as _dayIndex, JST_OFFSET_MS } from "./dates.js";
import { daysUntil } from "./plan.js";
import { applyAnswer, dueProblemIds, evictOverCap, PROBLEM_CARD_KEY, type ProblemCardMap } from "./problem-cards.js";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  /** 任意実装（localStorage は実装済み）。バックアップ復元の巻き戻し等でキー削除に使う。 */
  removeItem?(key: string): void;
}

/** 解答ログ（AnswerLog に4段階評価を添える）。 */
export interface WebAnswerLog extends AnswerLog {
  rating?: Rating;
  /**
   * 誤答時に学習者が選んだ/入力した答え（誤概念分析用。正解時は記録しない）。
   *
   * 正解値との「比」から誤概念を推定する（lib/curriculum/misconceptions.ts）ため、
   * 分類は保存時ではなく読み出し時に行う。こうしておくとパターン表を後から
   * 増やしたときに、過去のログにも遡って新しい分類が効く
   * （XP を解答ログから完全導出しているのと同じ設計方針）。
   */
  chosen?: string;
}

/**
 * ログに保存する誤答文字列の最大長。
 * 選択肢や入力がどれだけ長くても、比の判定に要るのは先頭の数値だけなので短く切る
 * （LOG_CAP=5000 件ぶん積み上がるため、quota を圧迫しないことを優先する）。
 */
export const CHOSEN_MAX_LEN = 24;

const CARD_KEY = "denken:cards";
const LOG_KEY = "denken:logs";
const RETENTION_KEY = "denken:retention";
/** 解答ログの保持上限。無限成長で localStorage quota（〜5MB）に達すると
 *  以後の保存がすべて失敗するため、古い順に間引く（1日10問×500日分は保持）。 */
export const LOG_CAP = 5000;

/**
 * II-151: localStorage の使用量を推定する（JSON.stringify の文字数をバイト近似値として使用）。
 * ブラウザの quota（一般に 5MB〜10MB）に対して何 KB 使っているかを返す。
 * 推定値のため実際の quota 残量とは一致しない場合があるが、警告の目安として十分。
 * @returns 推定使用量（KB）
 */
export function estimateStorageKb(storage: StorageLike, keys: readonly string[]): number {
  let total = 0;
  for (const key of keys) {
    const v = storage.getItem(key);
    if (v !== null) total += key.length + v.length;
  }
  // UTF-16 の文字列を UTF-8 に近似（ASCII 主体なので ×1 が妥当な近似）。
  return Math.round(total / 1024);
}

/** localStorage quota の推奨警告閾値（KB）。この値を超えたら UI で通知する。 */
export const STORAGE_WARN_KB = 3_000; // 3 MB 超で警告

function ratingOf(x: Rating | boolean): Rating {
  if (typeof x === "boolean") return x ? "good" : "again";
  return x;
}

export class LocalProgress {
  private scheduler: FsrsScheduler;
  /** 最後に保存が失敗したキーと時刻（成功でクリア）。G6 が保存失敗 UI に利用する。 */
  private _lastPersistError: { key: string; atMs: number } | null = null;
  /**
   * dueTopics の件数メモ化（xpByDayCached パターン）。
   * dueTopics() は毎呼び出しで全 FSRS カードを revive するため renderNav の度に重い。
   * cards-blob の長さ・nowMs の「分」・retention をキーにキャッシュする。
   * 内容ハッシュではないが、書き込みは safeSet 経由で blob 長 or 内容が変わるため十分実用的。
   */
  private _dueCountCache: { cardsLen: number; minute: number; retention: number; count: number } | null = null;
  /** 問題単位カードの due 件数メモ（blob 長＋分をキーにする）。 */
  private _dueProblemCache: { key: string; count: number } | null = null;

  /**
   * 試験日(ISO `YYYY-MM-DD`)。設定タブから変更され、setExamDate で更新される。
   * 試験日逆算（#34/#35）で実効目標保持率・最大間隔・直前モードを決めるために保持する。
   * null（試験日不明）なら従来どおり期限なしの FSRS として動く。
   */
  private examDateIso: string | null;

  constructor(
    private storage: StorageLike,
    /** 日境界のタイムゾーンオフセット(ms)。既定 JST。テストで上書き可。 */
    private dayOffsetMs: number = JST_OFFSET_MS,
    /**
     * 試験日(ISO `YYYY-MM-DD`)。渡すと試験日逆算スケジューリングが有効化される（#34/#35）。
     * 後方互換のため省略可。省略時は期限なしの FSRS（従来挙動）。
     */
    examDateIso: string | null = null,
  ) {
    this.examDateIso = examDateIso;
    this.scheduler = this.buildScheduler();
  }

  /**
   * 試験日逆算（#34/#35）の実効パラメータを返す純ヘルパー。
   * 試験日が未設定なら base のまま・間隔上限なし・直前モード off。
   */
  private examParams() {
    const base = this.desiredRetention();
    const daysLeft = this.examDateIso ? daysUntil(this.examDateIso) : null;
    // daysUntil は過去/不明を 0 にするため、0 のときは「試験なし扱い」へ寄せる（base 維持）。
    // 【試験当日(daysLeft===0)の扱いは意図的】: 当日は試験本番のため、直前モード(cram)と
    // 間隔上限を解除して通常スケジュールへ戻す。前日(daysLeft===1)までは cram / 上限1日が
    // 効くので「当日を越える復習」は前日時点で既に抑止済み。当日に cram を残す設計も可能だが、
    // 本番当日は新規スケジューリングの意味が薄いため通常挙動を採る（プロダクト判断・非バグ）。
    return examAwareParams(daysLeft && daysLeft > 0 ? daysLeft : null, base);
  }

  /**
   * 実効パラメータで FSRS スケジューラを構築する（試験日を越える復習を組まない）。
   * 公開ファクトリ getScheduler 経由で生成する（実装差し替え可能性の維持。CLAUDE.md 不変条件）。
   */
  private buildScheduler(): FsrsScheduler {
    const { requestRetention, maximumIntervalDays } = this.examParams();
    return getScheduler("fsrs", {
      desiredRetention: requestRetention,
      ...(maximumIntervalDays !== undefined ? { maximumIntervalDays } : {}),
    });
  }

  /**
   * 直前モード（集中復習を推奨する期間か）。試験まで CRAM_MODE_DAYS 以内のとき true。
   * 学習/復習タブのバナー表示・弱点集中の切替に使う（#34/#35）。
   */
  cramMode(): boolean {
    return this.examParams().cramMode;
  }

  /**
   * 試験日を更新し、スケジューラを再構築する（試験日が変われば実効保持率・間隔上限が変わる）。
   * due 判定も変わるためメモ化キャッシュを破棄する。
   */
  setExamDate(iso: string | null): void {
    this.examDateIso = iso;
    this.scheduler = this.buildScheduler();
    this._dueCountCache = null;
  }

  /**
   * 最後に localStorage 保存が失敗したキーと時刻。
   * iOS プライベートモードや quota 超過時に記録される。保存成功でクリアされる。
   * G6（app.ts 分割後）が保存失敗をユーザーに通知するために使う。
   */
  get lastPersistError(): { key: string; atMs: number } | null {
    return this._lastPersistError;
  }

  /** epoch ms をオフセット込みの「日番号」に落とす（同一日の判定・連続日数に使う）。 */
  private dayIndex(ms: number): number {
    return _dayIndex(ms, this.dayOffsetMs);
  }

  private read<T>(key: string, fallback: T): T {
    const raw = this.storage.getItem(key);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      console.warn(`[store] JSON.parse 失敗: key=${key}`);
      return fallback;
    }
  }

  /** 書き込みの安全ラッパ。iOS プライベートモードや quota 超過で setItem が
   *  throw すると採点フロー全体が落ちるため、保存失敗は学習継続より劣後させる
   *  （その回の永続化は諦め、アプリは動き続ける）。失敗時は lastPersistError に記録。 */
  private safeSet(key: string, value: string): void {
    try {
      this.storage.setItem(key, value);
      // 保存成功: エラー記録をクリア
      this._lastPersistError = null;
    } catch {
      // 保存不能（プライベートモード・容量超過）。クラッシュさせない。
      this._lastPersistError = { key, atMs: Date.now() };
    }
  }

  private cards(): Record<string, StoredCard> {
    return this.read<Record<string, StoredCard>>(CARD_KEY, {});
  }

  /** 目標保持率（FSRS の最重要設定）。設定タブから変更可能（既定0.9）。 */
  desiredRetention(): number {
    const raw = this.storage.getItem(RETENTION_KEY);
    const n = raw ? Number(raw) : Number.NaN;
    return Number.isFinite(n) && n >= 0.7 && n <= 0.97 ? n : 0.9;
  }

  setDesiredRetention(value: number): void {
    const clamped = Math.min(0.97, Math.max(0.7, value));
    this.safeSet(RETENTION_KEY, String(clamped));
    // 試験日逆算込みで再構築する（直前期は base より高い実効保持率になりうる）。
    this.scheduler = this.buildScheduler();
    // 目標保持率が変わると due 判定も変わるためメモ化キャッシュを破棄する。
    this._dueCountCache = null;
  }

  logs(): WebAnswerLog[] {
    return this.read<WebAnswerLog[]>(LOG_KEY, []);
  }

  /** topic の記憶状態ビュー（次回復習予定・安定度など）。 */
  getCardView(topic: string): FsrsView | undefined {
    const c = this.cards()[topic];
    return c ? this.scheduler.view(reviveCard(c)) : undefined;
  }

  allCardViews(): Map<string, FsrsView> {
    const out = new Map<string, FsrsView>();
    for (const [topic, c] of Object.entries(this.cards())) {
      out.set(topic, this.scheduler.view(reviveCard(c)));
    }
    return out;
  }

  /** 復習期限が来ている topic を期限の早い順に返す。 */
  dueTopics(nowMs: number = Date.now()): string[] {
    return [...this.allCardViews().entries()]
      .filter(([, v]) => v.dueMs <= nowMs)
      .sort((a, b) => a[1].dueMs - b[1].dueMs)
      .map(([topic]) => topic);
  }

  /**
   * 期限到来 topic の「件数」だけをメモ化して返す（renderNav 用）。
   * カード blob 長・nowMs の分・retention が前回と同じならキャッシュを返す。
   * 件数が必要なだけの呼び出し（ナビのバッジ）で全カード revive の繰り返しを避ける。
   * 返す件数は同条件の dueTopics(nowMs).length と一致する（テストで保証）。
   */
  dueCountCached(nowMs: number = Date.now()): number {
    const blob = this.storage.getItem(CARD_KEY);
    const cardsLen = blob === null ? 0 : blob.length;
    const minute = Math.floor(nowMs / 60_000);
    // 実効保持率をキーにする（試験日逆算のランプで日々変わりうるため base ではなく実効値）。
    const retention = this.scheduler.desiredRetention;
    const c = this._dueCountCache;
    if (c !== null && c.cardsLen === cardsLen && c.minute === minute && c.retention === retention) {
      return c.count;
    }
    const count = this.dueTopics(nowMs).length;
    this._dueCountCache = { cardsLen, minute, retention, count };
    return count;
  }

  /** dueCount キャッシュを破棄する（テスト・復元用）。 */
  clearDueCountCache(): void {
    this._dueCountCache = null;
  }

  /**
   * 採点を記録し、FSRS で記憶状態を更新する。rating は4段階 or 正誤boolean。
   *
   * @param chosen 誤答時に選んだ/入力した答え（誤概念分析用）。正解時は保存しない。
   */
  record(
    topic: string,
    ratingOrCorrect: Rating | boolean,
    nowMs: number = Date.now(),
    timeMs?: number,
    problemId?: string,
    chosen?: string,
  ): FsrsView {
    const rating = ratingOf(ratingOrCorrect);
    const now = new Date(nowMs);
    // cards() は localStorage 全体を読んで JSON.parse する。1解答につき1回だけ読む。
    const cards = this.cards();
    const stored = cards[topic];
    const prev = stored ? reviveCard(stored) : this.scheduler.init(now);
    const next = this.scheduler.review(prev, rating, now);

    // 明示変換で保存形へ（Date フィールドの知識は lib/scheduler/fsrs.ts が唯一の所有者）。
    cards[topic] = toStoredCard(next);
    this.safeSet(CARD_KEY, JSON.stringify(cards));
    // due 件数が変わりうるのでメモ化キャッシュを破棄（blob 長が同じでも内容変化を取りこぼさない）。
    this._dueCountCache = null;

    const correct = rating !== "again";
    const logs = this.logs();
    logs.push({
      topic,
      correct,
      atMs: nowMs,
      rating,
      ...(timeMs !== undefined ? { timeMs } : {}),
      ...(problemId !== undefined ? { problemId } : {}),
      // 誤答のときだけ、選んだ答えを短く切って残す（正解値は問題データ側にあるので持たない）。
      ...(!correct && chosen !== undefined && chosen.trim() !== ""
        ? { chosen: chosen.trim().slice(0, CHOSEN_MAX_LEN) }
        : {}),
    });
    if (logs.length > LOG_CAP) logs.splice(0, logs.length - LOG_CAP); // 古い順に間引く
    this.safeSet(LOG_KEY, JSON.stringify(logs));

    // 問題単位カード（誤答した問題だけを個別に期日管理する）。
    // record() は学習タブ・模試・ドリルの全経路が通る唯一の choke point なので、
    // ここにフックすれば呼び出し側は無改修で済む。topic カードには影響しない。
    if (problemId !== undefined) {
      const before = this.problemCards();
      const after = evictOverCap(applyAnswer(before, problemId, rating, this.scheduler, now));
      if (after !== before) {
        this.safeSet(PROBLEM_CARD_KEY, JSON.stringify(after));
        this._dueProblemCache = null;
      }
    }
    return this.scheduler.view(next);
  }

  /** 問題単位カードの全体（誤答起点で作られたものだけが入る）。 */
  problemCards(): ProblemCardMap {
    return this.read<ProblemCardMap>(PROBLEM_CARD_KEY, {});
  }

  /** 期日が来た problemId（期日の早い順）。 */
  dueProblemIds(nowMs: number = Date.now()): string[] {
    return dueProblemIds(this.problemCards(), nowMs);
  }

  /** 管理中の問題カード数。 */
  problemCardCount(): number {
    return Object.keys(this.problemCards()).length;
  }

  /**
   * 期日到来の問題数（メモ化）。ナビのバッジが毎描画で JSON.parse しないようにする。
   * topic 側の _dueCountCache と同じく blob 長＋分をキーにする。
   */
  dueProblemCountCached(nowMs: number = Date.now()): number {
    const blob = this.storage.getItem(PROBLEM_CARD_KEY) ?? "";
    const key = `${blob.length}:${Math.floor(nowMs / 60_000)}`;
    if (this._dueProblemCache && this._dueProblemCache.key === key) return this._dueProblemCache.count;
    const count = this.dueProblemIds(nowMs).length;
    this._dueProblemCache = { key, count };
    return count;
  }

  /** 今日まで連続して学習した日数（既定 JST 日基準）。 */
  streakDays(nowMs: number = Date.now()): number {
    const days = new Set(this.logs().map((l) => this.dayIndex(l.atMs)));
    if (days.size === 0) return 0;
    const today = this.dayIndex(nowMs);
    // 今日 or 昨日から遡って連続日数を数える（今日未学習でも昨日まで継続中なら維持）。
    let cursor = days.has(today) ? today : today - 1;
    if (!days.has(cursor)) return 0;
    let streak = 0;
    while (days.has(cursor)) {
      streak += 1;
      cursor -= 1;
    }
    return streak;
  }

  todayMinutes(nowMs: number = Date.now()): number {
    const today = this.dayIndex(nowMs);
    const ms = this.logs()
      .filter((l) => this.dayIndex(l.atMs) === today)
      .reduce((a, l) => a + (l.timeMs ?? 0), 0);
    return Math.round(ms / 60_000);
  }
}
