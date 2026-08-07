/**
 * persistence.ts — 学習データの寿命を延ばすための永続化リクエスト。
 *
 * DENKEN-OS の学習履歴・FSRSカードは localStorage だけに存在する。
 * 電験は科目合格制で最長3年使うアプリなのに、既定の localStorage は
 * 「ブラウザのストレージ逼迫時に無警告で破棄されうる（best-effort）」扱いで、
 * 数年分の学習記録が前触れなく消える可能性があった。
 *
 * `navigator.storage.persist()` を呼ぶと、対応ブラウザでは領域が persistent に
 * 昇格し、ユーザーが明示的に削除しない限り自動破棄されなくなる。
 * 非対応ブラウザ・拒否時も学習は継続できるため、結果は「参考情報」として扱う。
 */

export type PersistState = "persisted" | "not-persisted" | "unsupported";

/**
 * 永続化を要求する（冪等。既に persisted なら再要求しない）。
 * Safari 等では自動的に拒否されることがあるが、その場合も例外は投げない。
 */
export async function requestPersistence(): Promise<PersistState> {
  const s = navigator.storage;
  if (!s || typeof s.persist !== "function" || typeof s.persisted !== "function") {
    return "unsupported";
  }
  try {
    if (await s.persisted()) return "persisted";
    return (await s.persist()) ? "persisted" : "not-persisted";
  } catch {
    // 権限系の例外はここで吸収する（学習を止めない）。
    return "unsupported";
  }
}

/** 現在の永続化状態を読むだけ（要求はしない）。設定画面の表示用。 */
export async function persistenceState(): Promise<PersistState> {
  const s = navigator.storage;
  if (!s || typeof s.persisted !== "function") return "unsupported";
  try {
    return (await s.persisted()) ? "persisted" : "not-persisted";
  } catch {
    return "unsupported";
  }
}

export const PERSIST_LABEL: Record<PersistState, string> = {
  persisted: "保護されています（ブラウザが自動削除しません）",
  "not-persisted": "保護されていません（ブラウザの空き容量が減ると削除される可能性があります）",
  unsupported: "このブラウザでは保護状態を確認できません",
};
