/**
 * why-store.ts — 原理の納得チェックの記憶状態（localStorage + FSRS）。
 *
 * 演習の記憶状態（store.ts の `denken:cards`）とは意図的に分離する:
 *   - 納得チェックは「説明できるか」の自己申告であり、演習の正答率・XP・弱点診断へ
 *     混ぜると各指標の意味が壊れる（解答ログにも積まない）。
 *   - 一方でスケジューリングは同じ FSRS を使う。実装差し替え可能性を保つため
 *     `getScheduler("fsrs")` 経由で生成する（リポジトリ不変条件）。
 *
 * 試験日逆算（exam-aware）は適用しない。試験日を越える間隔を避けるのは「出題される問題を
 * 試験日までに一巡させる」ための制約で、原理の理解は試験日をまたいでも価値が続くため、
 * ここでは期限なしの標準 FSRS で回す。
 *
 * 保存失敗（プライベートモード・quota 超過）は学習継続より劣後させ、例外を投げない。
 */
import type { WhyCheckState } from "../../lib/curriculum/why-check.js";
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

/** 納得チェックの記憶状態の保存キー。 */
export const WHY_CARD_KEY = "denken:whyCards";

export class WhyCheckStore {
  private scheduler: FsrsScheduler;

  constructor(
    private storage: StorageLike,
    desiredRetention?: number,
  ) {
    this.scheduler = getScheduler("fsrs", desiredRetention !== undefined ? { desiredRetention } : {});
  }

  /**
   * 目標保持率を変更してスケジューラを作り直す（設定タブの変更に追随する）。
   * 演習側（store.ts の setDesiredRetention）と同じ値を渡して非対称を作らないこと。
   */
  setDesiredRetention(desiredRetention: number): void {
    this.scheduler = getScheduler("fsrs", { desiredRetention });
  }

  private cards(): Record<string, StoredCard> {
    const raw = this.storage.getItem(WHY_CARD_KEY);
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
      return parsed as Record<string, StoredCard>;
    } catch {
      console.warn(`[why-store] JSON.parse 失敗: key=${WHY_CARD_KEY}`);
      return {};
    }
  }

  /** 保存の安全ラッパ（失敗しても学習は続行する）。 */
  private safeSet(value: string): void {
    try {
      this.storage.setItem(WHY_CARD_KEY, value);
    } catch {
      // 保存不能（プライベートモード・容量超過）。クラッシュさせない。
    }
  }

  /**
   * 保存値1件から有効なビューを取り出す。破損値（日付が壊れて due が NaN になる等）は
   * undefined を返し、呼び出し側で「未着手」として扱えるようにする。
   * NaN を素通しすると due 比較が常に false になり、そのチェックが二度と出題されないまま
   * 「着手済み」として数えられ続ける（サイレントな取りこぼし）ため、ここで必ず弾く。
   */
  private validView(card: StoredCard): FsrsView | undefined {
    try {
      const view = this.scheduler.view(reviveCard(card));
      return Number.isFinite(view.dueMs) ? view : undefined;
    } catch {
      return undefined;
    }
  }

  /** ID → 出題予定（lib/curriculum の due 判定に渡す形）。破損値は含めない。 */
  states(): Map<string, WhyCheckState> {
    const out = new Map<string, WhyCheckState>();
    for (const [id, card] of Object.entries(this.cards())) {
      const view = this.validView(card);
      if (view) out.set(id, { dueMs: view.dueMs });
    }
    return out;
  }

  /**
   * 一度でも回答したチェックの ID 一覧（理解ギャップ検出に使う）。
   * states() と同じ有効性判定を使い、破損値を「着手済み」に数えない。
   */
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
   * 自己採点を反映して次回予定を更新する。
   * 保存値がどんな形に壊れていても（型が違う・日付が不正）例外は投げず、
   * 新規カードとしてやり直して採点を成立させる（学習を止めない）。
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
