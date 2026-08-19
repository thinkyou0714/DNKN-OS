/**
 * toolkit-store.ts — 設計計算ツールキットの状態永続化とライセンス解錠（純ロジック・DOM 非依存）。
 *
 * 保存キーは学習アプリ（denken:progress 等）と分離し、ツールキットの利用が学習データへ
 * 影響しないようにする（why-store.ts / coeff-store.ts と同じ分離方針）。
 *
 * ライセンスは entitlements.ts と同じ ECDSA 検証だが sku="toolkit" を要求する。
 * 公開鍵未設定（toolkit-config.ts）の間はゲート非作動＝全モジュール無料（fail-open）。
 */

import { type LicensePayload, verifyLicense } from "../../../lib/license/license.js";
import type { StorageLike } from "../store.js";
import {
  TOOLKIT_MONETIZATION,
  type ToolkitMonetizationConfig,
  toolkitMonetizationConfigured,
} from "./toolkit-config.js";

/** 計算条件・メモ・計算書ヘッダの保存先。 */
export const TOOLKIT_STATE_STORAGE_KEY = "denken:toolkit";
/** 検証済みツールキットライセンスの保存先（学習アプリの denken:license とは別）。 */
export const TOOLKIT_LICENSE_STORAGE_KEY = "denken:toolkitLicense";

/** 計算書ヘッダ（印刷時に表紙へ載せる欄）。 */
export interface SheetHeader {
  productName: string;
  designer: string;
  date: string;
  revision: string;
}

export interface ToolkitState {
  version: 1;
  /** moduleId → フィールド値（number 入力は number、select は string）。 */
  values: Record<string, Record<string, number | string>>;
  /** moduleId → 計算メモ。 */
  memos: Record<string, string>;
  sheet: SheetHeader;
}

export function emptyToolkitState(): ToolkitState {
  return {
    version: 1,
    values: {},
    memos: {},
    sheet: { productName: "", designer: "", date: "", revision: "" },
  };
}

/** unknown を ToolkitState として検証する（インポート・保存値読込の共通経路）。壊れていれば null。 */
export function parseToolkitState(raw: unknown): ToolkitState | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (o.version !== 1) return null;
  if (typeof o.values !== "object" || o.values === null) return null;
  if (typeof o.memos !== "object" || o.memos === null) return null;
  const values: Record<string, Record<string, number | string>> = {};
  for (const [modId, fields] of Object.entries(o.values as Record<string, unknown>)) {
    if (typeof fields !== "object" || fields === null) return null;
    const clean: Record<string, number | string> = {};
    for (const [k, v] of Object.entries(fields as Record<string, unknown>)) {
      if (typeof v === "number") {
        clean[k] = v;
      } else if (typeof v === "string") {
        // 手編集バックアップの "2" のような数値文字列は数値へ正規化する
        // （number フィールドは number しか受け付けないため。select 値は非数値文字列なのでそのまま残る）。
        const n = v.trim() === "" ? Number.NaN : Number(v);
        clean[k] = Number.isFinite(n) ? n : v;
      }
    }
    values[modId] = clean;
  }
  const memos: Record<string, string> = {};
  for (const [modId, memo] of Object.entries(o.memos as Record<string, unknown>)) {
    if (typeof memo === "string") memos[modId] = memo;
  }
  const sheetRaw = (typeof o.sheet === "object" && o.sheet !== null ? o.sheet : {}) as Record<string, unknown>;
  const sheet: SheetHeader = {
    productName: typeof sheetRaw.productName === "string" ? sheetRaw.productName : "",
    designer: typeof sheetRaw.designer === "string" ? sheetRaw.designer : "",
    date: typeof sheetRaw.date === "string" ? sheetRaw.date : "",
    revision: typeof sheetRaw.revision === "string" ? sheetRaw.revision : "",
  };
  return { version: 1, values, memos, sheet };
}

/** 保存値を読む。未保存・壊れた値は空状態（throw しない）。 */
export function loadToolkitState(storage: StorageLike): ToolkitState {
  const raw = storage.getItem(TOOLKIT_STATE_STORAGE_KEY);
  if (raw === null || raw === "") return emptyToolkitState();
  try {
    const parsed = parseToolkitState(JSON.parse(raw));
    if (parsed === null) {
      console.warn(`[toolkit] 保存値の形式が不正です: key=${TOOLKIT_STATE_STORAGE_KEY}`);
      return emptyToolkitState();
    }
    return parsed;
  } catch {
    console.warn(`[toolkit] JSON.parse 失敗: key=${TOOLKIT_STATE_STORAGE_KEY}`);
    return emptyToolkitState();
  }
}

/** 保存する。quota 超過などの失敗は false（呼び出し側でトースト表示）。 */
export function saveToolkitState(storage: StorageLike, state: ToolkitState): boolean {
  try {
    storage.setItem(TOOLKIT_STATE_STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

/** JSON エクスポート（人が読める整形付き）。 */
export function exportToolkitStateJson(state: ToolkitState): string {
  return JSON.stringify(state, null, 2);
}

/** JSON インポート。形式不正は null（throw しない）。 */
export function importToolkitStateJson(json: string): ToolkitState | null {
  try {
    return parseToolkitState(JSON.parse(json));
  } catch {
    return null;
  }
}

// ---- ライセンス解錠（sku="toolkit"）----

/** 検証済みツールキットライセンスの payload（未解錠なら null）。セッション内キャッシュ。 */
let _toolkitPayload: LicensePayload | null = null;

export function toolkitUnlocked(): boolean {
  return _toolkitPayload !== null;
}

export function toolkitInfo(): LicensePayload | null {
  return _toolkitPayload;
}

/** 機能ゲートが作動中か（収益化が設定済み かつ 未解錠）。 */
export function toolkitLocked(cfg: ToolkitMonetizationConfig = TOOLKIT_MONETIZATION): boolean {
  return toolkitMonetizationConfigured(cfg) && _toolkitPayload === null;
}

/** 指定 tier のモジュールが使える状態か。 */
export function toolkitTierAvailable(
  tier: "free" | "paid",
  cfg: ToolkitMonetizationConfig = TOOLKIT_MONETIZATION,
): boolean {
  return tier === "free" || !toolkitLocked(cfg);
}

/** 起動時に保存済みライセンスを再検証してキャッシュを温める（entitlements.ts と同じ方針）。 */
export async function initToolkitEntitlements(
  storage: StorageLike,
  nowMs: number = Date.now(),
  cfg: ToolkitMonetizationConfig = TOOLKIT_MONETIZATION,
): Promise<boolean> {
  _toolkitPayload = null;
  const pub = cfg.publicKeyJwk;
  if (pub === null || !toolkitMonetizationConfigured(cfg)) return false;
  const key = storage.getItem(TOOLKIT_LICENSE_STORAGE_KEY)?.trim() ?? "";
  if (key === "") return false;
  const res = await verifyLicense(key, pub, nowMs, "toolkit");
  if (res.ok) _toolkitPayload = res.payload;
  return res.ok;
}

export type ApplyToolkitLicenseResult = { ok: true; payload: LicensePayload } | { ok: false; reason: string };

/** 入力されたライセンスキーを検証し、有効なら保存して解錠する。 */
export async function applyToolkitLicenseKey(
  storage: StorageLike,
  key: string,
  nowMs: number = Date.now(),
  cfg: ToolkitMonetizationConfig = TOOLKIT_MONETIZATION,
): Promise<ApplyToolkitLicenseResult> {
  const pub = cfg.publicKeyJwk;
  if (pub === null) return { ok: false, reason: "現在は販売準備中のためライセンスを登録できません" };
  const trimmed = key.trim();
  if (trimmed === "") return { ok: false, reason: "ライセンスキーを入力してください" };
  const res = await verifyLicense(trimmed, pub, nowMs, "toolkit");
  if (!res.ok) return res;
  // 保存はベストエフォート（quota 超過でもこのセッションは解錠する。entitlements.ts と同じ）。
  try {
    storage.setItem(TOOLKIT_LICENSE_STORAGE_KEY, trimmed);
  } catch {
    // 次回起動では無料枠に戻るが、キーの再入力で復帰できる。
  }
  _toolkitPayload = res.payload;
  return res;
}

/** ライセンスを削除して無料枠に戻す。 */
export function clearToolkitLicense(storage: StorageLike): void {
  storage.setItem(TOOLKIT_LICENSE_STORAGE_KEY, "");
  _toolkitPayload = null;
}

/** テスト用: モジュール内キャッシュを初期化する。アプリ本体からは呼ばない。 */
export function __resetToolkitEntitlementsForTest(): void {
  _toolkitPayload = null;
}
