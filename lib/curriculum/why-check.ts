/**
 * curriculum/why-check.ts — 原理の「納得チェック」を間隔反復に載せる純ロジック。
 *
 * 目的: 原理カード（curriculum/principles.ts）の Q&A は一度読んで終わりでは定着しない。
 *   公式の暗記だけが間隔反復に載り「なぜ」が載っていないと、結局「こういうものだ」に
 *   戻ってしまう。そこで納得チェックの一問一答自体を復習カードとして扱い、
 *   演習と同じ FSRS のリズムで「自分の言葉で説明できるか」を問い直す。
 *
 * 方針:
 *   - 1 チェック = 1 カード。ID は `${area}#${index}` の安定 ID（カードの並び替えに強い）。
 *   - 出題順は体系順（curriculum/graph.ts のトポロジカル順）を基準にする＝基礎から。
 *   - 出題は「既習で期限到来のもの」を優先し、余った枠を未着手（新規）で埋める。
 *     保持（忘れかけの再固定）を新規開拓より優先するのは間隔反復の定石。
 *   - スケジューラ状態（dueMs）は入力として受け取り、このモジュールは永続化も
 *     FSRS 計算も持たない（web/src/why-store.ts が担当）。DOM 非依存・決定論。
 */
import { topologicalOrder } from "./graph.js";
import { PRINCIPLE_CARDS } from "./principles.js";

/** 納得チェック1問（原理カードの checks を体系順に展開したもの）。 */
export interface WhyCheckItem {
  /** 安定 ID（`${area}#${index}`）。永続化キーとして使う。 */
  id: string;
  /** 概念領域名（CONCEPT_EDGES のノード名）。 */
  area: string;
  question: string;
  answer: string;
  /** 体系順の通し番号（基礎ほど小さい）。表示順・タイブレークに使う。 */
  order: number;
}

/** 1セッションで出す既定の問題数（多すぎると読まれない・少なすぎると進まない）。 */
export const WHY_CHECK_SESSION_SIZE = 5;

/** 納得チェックの安定 ID を作る。 */
export function whyCheckId(area: string, index: number): string {
  return `${area}#${index}`;
}

/**
 * 原理カードの checks を体系順（基礎→応用）に展開する。
 * グラフに登場しない領域のカードも取りこぼさないよう、体系順のあとに名前順で続ける
 * （テストでグラフと 1:1 を保証しているため通常は発生しないが、黙って落とさない）。
 */
function buildItems(): WhyCheckItem[] {
  const byArea = new Map(PRINCIPLE_CARDS.map((c) => [c.area, c]));
  const areas: string[] = [];
  const seen = new Set<string>();
  for (const area of topologicalOrder()) {
    if (byArea.has(area) && !seen.has(area)) {
      areas.push(area);
      seen.add(area);
    }
  }
  for (const card of [...PRINCIPLE_CARDS].sort((a, b) => a.area.localeCompare(b.area, "ja"))) {
    if (!seen.has(card.area)) {
      areas.push(card.area);
      seen.add(card.area);
    }
  }
  const items: WhyCheckItem[] = [];
  for (const area of areas) {
    const card = byArea.get(area);
    if (!card) continue;
    card.checks.forEach((check, index) => {
      items.push({
        id: whyCheckId(area, index),
        area,
        question: check.question,
        answer: check.answer,
        order: items.length,
      });
    });
  }
  return items;
}

/** 全納得チェック（体系順）。 */
export const WHY_CHECK_ITEMS: readonly WhyCheckItem[] = buildItems();

/** ID から納得チェックをひく（未知の ID は undefined）。 */
export function getWhyCheckItem(
  id: string,
  items: readonly WhyCheckItem[] = WHY_CHECK_ITEMS,
): WhyCheckItem | undefined {
  return items.find((i) => i.id === id);
}

/** 指定領域の納得チェック（カード内の順序を保つ）。 */
export function whyChecksForArea(area: string, items: readonly WhyCheckItem[] = WHY_CHECK_ITEMS): WhyCheckItem[] {
  return items.filter((i) => i.area === area);
}

/** 1チェックのスケジューラ状態（web の FSRS ビューから供給される最小情報）。 */
export interface WhyCheckState {
  /** 次回出題予定（epoch ms）。 */
  dueMs: number;
}

/** 納得チェック全体の進捗サマリー。 */
export interface WhyCheckStats {
  /** 全チェック数。 */
  total: number;
  /** 一度でも回答したチェック数。 */
  started: number;
  /** 既習のうち期限が来ている数。 */
  due: number;
  /** 未着手の数。 */
  fresh: number;
}

/** 納得チェックの進捗を集計する（純関数）。 */
export function whyCheckStats(
  states: ReadonlyMap<string, WhyCheckState>,
  nowMs: number = Date.now(),
  items: readonly WhyCheckItem[] = WHY_CHECK_ITEMS,
): WhyCheckStats {
  let started = 0;
  let due = 0;
  let fresh = 0;
  for (const item of items) {
    const state = states.get(item.id);
    if (!state) {
      fresh += 1;
      continue;
    }
    started += 1;
    if (state.dueMs <= nowMs) due += 1;
  }
  return { total: items.length, started, due, fresh };
}

/**
 * 今回出すべき納得チェックを返す。
 *
 * 並び:
 *   1. 既習で期限到来のもの（期限が古い順 → 体系順）— 忘れかけの再固定を最優先。
 *   2. 未着手のもの（体系順）— 基礎から順に開拓する。
 *
 * @param states 保存済みのスケジューラ状態（ID → dueMs）。
 * @param nowMs  現在時刻（epoch ms）。
 * @param limit  返す最大件数（既定 {@link WHY_CHECK_SESSION_SIZE}）。
 */
export function dueWhyChecks(
  states: ReadonlyMap<string, WhyCheckState>,
  nowMs: number = Date.now(),
  limit: number = WHY_CHECK_SESSION_SIZE,
  items: readonly WhyCheckItem[] = WHY_CHECK_ITEMS,
): WhyCheckItem[] {
  const reviewing: Array<{ item: WhyCheckItem; dueMs: number }> = [];
  const fresh: WhyCheckItem[] = [];
  for (const item of items) {
    const state = states.get(item.id);
    if (!state) {
      fresh.push(item);
    } else if (state.dueMs <= nowMs) {
      reviewing.push({ item, dueMs: state.dueMs });
    }
  }
  reviewing.sort((a, b) => a.dueMs - b.dueMs || a.item.order - b.item.order);
  fresh.sort((a, b) => a.order - b.order);
  return [...reviewing.map((r) => r.item), ...fresh].slice(0, Math.max(0, limit));
}
