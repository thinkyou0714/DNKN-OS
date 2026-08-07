/**
 * bookmarks.ts — 気になった問題を保存する「しおり」（純ロジック）。
 *
 * 他の資格学習アプリでは事実上の標準機能だが DENKEN-OS には無く、
 * 「後でもう一度見たい問題」を手元に残す手段が間違いノート（＝誤答した問題）
 * しかなかった。正解したが自信がなかった問題・解説をじっくり読みたい問題は
 * 拾えないため、明示的なブックマークを別に持つ。
 *
 * 保存は problemId の配列（順序＝追加順）。localStorage の肥大を防ぐため上限あり。
 */
import type { StorageLike } from "./store.js";

const BOOKMARK_KEY = "denken:bookmarks";
/** 保存上限。超えたら最も古い登録から捨てる（LOG_CAP と同じ思想）。 */
export const BOOKMARK_CAP = 500;

function read(storage: StorageLike): string[] {
  try {
    const raw = storage.getItem(BOOKMARK_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    // 壊れた値は空として扱う（学習を止めない）。
    return [];
  }
}

function write(storage: StorageLike, ids: string[]): void {
  try {
    storage.setItem(BOOKMARK_KEY, JSON.stringify(ids));
  } catch {
    // quota 超過など。保存できなくても解答は続行できる。
  }
}

/** 登録済みの problemId（追加順）。 */
export function listBookmarks(storage: StorageLike): string[] {
  return read(storage);
}

export function isBookmarked(storage: StorageLike, problemId: string): boolean {
  return read(storage).includes(problemId);
}

/** 追加/解除をトグルし、操作後の状態（true=登録済み）を返す。 */
export function toggleBookmark(storage: StorageLike, problemId: string): boolean {
  const ids = read(storage);
  const i = ids.indexOf(problemId);
  if (i >= 0) {
    ids.splice(i, 1);
    write(storage, ids);
    return false;
  }
  ids.push(problemId);
  // 上限超過分は古い順に落とす。
  while (ids.length > BOOKMARK_CAP) ids.shift();
  write(storage, ids);
  return true;
}

export function clearBookmarks(storage: StorageLike): void {
  write(storage, []);
}
