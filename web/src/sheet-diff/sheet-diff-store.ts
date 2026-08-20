/**
 * sheet-diff-store.ts — 帳票変更点抽出ツールの設定永続化とライセンス解錠（純ロジック・DOM 非依存）。
 *
 * 保存するのは「突合の設定」だけで、帳票の中身は一切保存しない。
 * 機密データを端末にすら残さないのがこのツールの売り（＝法人利用での差別化）であり、
 * localStorage に業務データが残らないことを設計上の不変条件にする。
 */

import type { LicensePayload } from "../../../lib/license/license.js";
import type { DiffOptions } from "../../../lib/sheet-diff/diff.js";
import { type ApplyLicenseResult, createLicenseGate } from "../license-gate.js";
import type { StorageLike } from "../store.js";
import { SHEET_DIFF_MONETIZATION, type SheetDiffMonetizationConfig } from "./sheet-diff-config.js";

/** 突合プリセットの保存先（帳票の中身は保存しない）。 */
export const SHEET_DIFF_STATE_STORAGE_KEY = "denken:sheetDiff";
/** 検証済みライセンスの保存先。 */
export const SHEET_DIFF_LICENSE_STORAGE_KEY = "denken:sheetDiffLicense";

/** 各社雛形に対応する突合設定。帳票の種類ごとに1つ作って使い回す。 */
export interface DiffPreset {
  name: string;
  keyColumns: string[];
  ignoreColumns: string[];
  /** 生の列名 → 正準名。「部品番号」「Part No.」を「品番」に寄せる用途。 */
  aliases: Record<string, string>;
  numericEquality: boolean;
  ignoreCase: boolean;
}

export interface SheetDiffState {
  version: 1;
  presets: DiffPreset[];
  /** 直近に選択していたプリセット名（空なら既定設定）。 */
  activePreset: string;
}

export function defaultPreset(name = "既定"): DiffPreset {
  return { name, keyColumns: [], ignoreColumns: [], aliases: {}, numericEquality: true, ignoreCase: false };
}

export function emptySheetDiffState(): SheetDiffState {
  return { version: 1, presets: [], activePreset: "" };
}

/** プリセットを diffSheets の options に変換する。 */
export function presetToOptions(preset: DiffPreset): DiffOptions {
  return {
    keyColumns: preset.keyColumns,
    ignoreColumns: preset.ignoreColumns,
    columnAliases: preset.aliases,
    numericEquality: preset.numericEquality,
    ignoreCase: preset.ignoreCase,
  };
}

/** 文字列配列として妥当な要素だけを拾う（インポート値の型汚染を防ぐ）。 */
function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.trim() !== "").map((v) => v.trim());
}

function parsePreset(raw: unknown): DiffPreset | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.name !== "string" || o.name.trim() === "") return null;
  const aliases: Record<string, string> = {};
  if (typeof o.aliases === "object" && o.aliases !== null) {
    for (const [k, v] of Object.entries(o.aliases as Record<string, unknown>)) {
      if (typeof v === "string" && v.trim() !== "") aliases[k.trim()] = v.trim();
    }
  }
  return {
    name: o.name.trim(),
    keyColumns: stringArray(o.keyColumns),
    ignoreColumns: stringArray(o.ignoreColumns),
    aliases,
    // 既定は「数値同値を無視する」= true。壊れた値でも安全側の既定へ倒す。
    numericEquality: o.numericEquality !== false,
    ignoreCase: o.ignoreCase === true,
  };
}

/** unknown を SheetDiffState として検証する。壊れていれば null。 */
export function parseSheetDiffState(raw: unknown): SheetDiffState | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (o.version !== 1) return null;
  if (!Array.isArray(o.presets)) return null;
  const presets = o.presets.map(parsePreset).filter((p): p is DiffPreset => p !== null);
  const activePreset = typeof o.activePreset === "string" ? o.activePreset : "";
  return { version: 1, presets, activePreset };
}

/** 保存値を読む。未保存・壊れた値は空状態（throw しない）。 */
export function loadSheetDiffState(storage: StorageLike): SheetDiffState {
  const raw = storage.getItem(SHEET_DIFF_STATE_STORAGE_KEY);
  if (raw === null || raw === "") return emptySheetDiffState();
  try {
    const parsed = parseSheetDiffState(JSON.parse(raw));
    if (parsed === null) {
      console.warn(`[sheet-diff] 保存値の形式が不正です: key=${SHEET_DIFF_STATE_STORAGE_KEY}`);
      return emptySheetDiffState();
    }
    return parsed;
  } catch {
    console.warn(`[sheet-diff] JSON.parse 失敗: key=${SHEET_DIFF_STATE_STORAGE_KEY}`);
    return emptySheetDiffState();
  }
}

/** 保存する。quota 超過などの失敗は false。 */
export function saveSheetDiffState(storage: StorageLike, state: SheetDiffState): boolean {
  try {
    storage.setItem(SHEET_DIFF_STATE_STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

/** 同名なら置き換え、無ければ追加する（プリセット一覧は名前が主キー）。 */
export function upsertPreset(state: SheetDiffState, preset: DiffPreset): SheetDiffState {
  const presets = state.presets.filter((p) => p.name !== preset.name);
  presets.push(preset);
  presets.sort((a, b) => a.name.localeCompare(b.name, "ja"));
  return { ...state, presets, activePreset: preset.name };
}

export function removePreset(state: SheetDiffState, name: string): SheetDiffState {
  const presets = state.presets.filter((p) => p.name !== name);
  return { ...state, presets, activePreset: state.activePreset === name ? "" : state.activePreset };
}

export function findPreset(state: SheetDiffState, name: string): DiffPreset | undefined {
  return state.presets.find((p) => p.name === name);
}

// ---- ライセンス解錠（sku="sheetdiff"）----

const gate = createLicenseGate("sheetdiff", SHEET_DIFF_LICENSE_STORAGE_KEY, SHEET_DIFF_MONETIZATION);

export function sheetDiffUnlocked(): boolean {
  return gate.unlocked();
}

export function sheetDiffInfo(): LicensePayload | null {
  return gate.info();
}

/** 機能ゲートが作動中か（収益化が設定済み かつ 未解錠）。 */
export function sheetDiffLocked(cfg: SheetDiffMonetizationConfig = SHEET_DIFF_MONETIZATION): boolean {
  return gate.locked(cfg);
}

/** 収益化が実際に作動する状態か（購入導線を出すかの判定）。 */
export function sheetDiffMonetizationConfigured(cfg: SheetDiffMonetizationConfig = SHEET_DIFF_MONETIZATION): boolean {
  return gate.configured(cfg);
}

export function initSheetDiffEntitlements(
  storage: StorageLike,
  nowMs: number = Date.now(),
  cfg: SheetDiffMonetizationConfig = SHEET_DIFF_MONETIZATION,
): Promise<boolean> {
  return gate.init(storage, nowMs, cfg);
}

export function applySheetDiffLicenseKey(
  storage: StorageLike,
  key: string,
  nowMs: number = Date.now(),
  cfg: SheetDiffMonetizationConfig = SHEET_DIFF_MONETIZATION,
): Promise<ApplyLicenseResult> {
  return gate.apply(storage, key, nowMs, cfg);
}

export function clearSheetDiffLicense(storage: StorageLike): void {
  gate.clear(storage);
}

/** テスト用: モジュール内キャッシュを初期化する。アプリ本体からは呼ばない。 */
export function __resetSheetDiffEntitlementsForTest(): void {
  gate.__resetForTest();
}
