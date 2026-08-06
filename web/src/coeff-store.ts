/**
 * coeff-store.ts — 係数判断ドリルの記憶状態（localStorage + FSRS）。
 *
 * why-store.ts（納得チェック）と同じ設計を係数リーズニングに適用する:
 *   - 演習の記憶状態（store.ts の `denken:cards`）とは分離する。係数判断は
 *     「係数の使い分けができるか」という横断スキルで、topic 単位の正答率・XP・
 *     弱点診断へ混ぜると各指標の意味が壊れる（解答ログにも積まない）。
 *   - スケジューリングは同じ FSRS を `getScheduler("fsrs")` 経由で使う
 *     （実装差し替え可能性のリポジトリ不変条件）。
 *   - 試験日逆算は適用しない。係数の理解は試験日をまたいでも価値が続く。
 *
 * 保存失敗（プライベートモード・quota 超過）は学習継続より劣後させ、例外を投げない。
 */
import type { CoefficientDrillState } from "../../lib/curriculum/coefficients.js";
import {
  type FsrsScheduler,
  type FsrsView,
  getScheduler,
  type Rating,
  reviveCard,
  type StoredCard,
  toStoredCard,
} from "../../lib/scheduler/index.js";
import type { StorageLike } from "./store.js";

/** 係数判断ドリルの記憶状態の保存キー。 */
export const COEFF_CARD_KEY = "denken:coeffCards";

export class CoeffDrillStore {
  private scheduler: FsrsScheduler;

  constructor(
    private storage: StorageLike,
    desiredRetention?: number,
  ) {
    this.scheduler = getScheduler("fsrs", desiredRetention !== undefined ? { desiredRetention } : {});
  }

  /**
   * 目標保持率を変更してスケジューラを作り直す（設定タブの変更に追随する）。
   * 演習側（store.ts）・納得チェック側（why-store.ts）と同じ値を渡して非対称を作らないこと。
   */
  setDesiredRetention(desiredRetention: number): void {
    this.scheduler = getScheduler("fsrs", { desiredRetention });
  }

  private cards(): Record<string, StoredCard> {
    const raw = this.storage.getItem(COEFF_CARD_KEY);
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
      return parsed as Record<string, StoredCard>;
    } catch {
      console.warn(`[coeff-store] JSON.parse 失敗: key=${COEFF_CARD_KEY}`);
      return {};
    }
  }

  /** 保存の安全ラッパ（失敗しても学習は続行する）。 */
  private safeSet(value: string): void {
    try {
      this.storage.setItem(COEFF_CARD_KEY, value);
    } catch {
      // 保存不能（プライベートモード・容量超過）。クラッシュさせない。
    }
  }

  /**
   * 保存値1件から有効なビューを取り出す。破損値（日付が壊れて due が NaN になる等）は
   * undefined を返し、呼び出し側で「未着手」として扱えるようにする（why-store.ts と同じ理由:
   * NaN の due を素通しすると、そのドリルが二度と出題されないまま着手済みに数えられ続ける）。
   */
  private validView(card: StoredCard): FsrsView | undefined {
    try {
      const view = this.scheduler.view(reviveCard(card));
      return Number.isFinite(view.dueMs) ? view : undefined;
    } catch {
      return undefined;
    }
  }

  /** ID → 出題予定＋忘却回数（lib/curriculum の due 判定・苦手ファミリ推定に渡す形）。破損値は含めない。 */
  states(): Map<string, CoefficientDrillState> {
    const out = new Map<string, CoefficientDrillState>();
    for (const [id, card] of Object.entries(this.cards())) {
      const view = this.validView(card);
      if (view) out.set(id, { dueMs: view.dueMs, lapses: view.lapses });
    }
    return out;
  }

  /** 一度でも回答したドリルの ID 一覧。 */
  startedIds(): string[] {
    return [...this.states().keys()];
  }

  /** 1件の記憶状態ビュー（未着手・破損値なら undefined）。 */
  view(id: string): FsrsView | undefined {
    const card = this.cards()[id];
    if (!card) return undefined;
    return this.validView(card);
  }

  /**
   * 採点結果（ratingForCoefficientAnswer の写像値）を反映して次回予定を更新する。
   * 保存値がどんな形に壊れていても例外は投げず、新規カードとしてやり直して採点を成立させる。
   */
  record(id: string, rating: Rating, nowMs: number = Date.now()): FsrsView {
    const now = new Date(nowMs);
    const cards = this.cards();
    const stored = cards[id];
    let prev = this.scheduler.init(now);
    if (stored) {
      try {
        prev = reviveCard(stored);
      } catch {
        // 壊れた保存値は新規カードとして扱う。
      }
    }
    let next: ReturnType<FsrsScheduler["review"]>;
    try {
      next = this.scheduler.review(prev, rating, now);
    } catch {
      // reviveCard は通っても FSRS が受け付けない形（欠損フィールド等）だった場合の最後の砦。
      next = this.scheduler.review(this.scheduler.init(now), rating, now);
    }
    cards[id] = toStoredCard(next);
    this.safeSet(JSON.stringify(cards));
    return this.scheduler.view(next);
  }
}
