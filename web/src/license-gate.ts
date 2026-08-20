/**
 * license-gate.ts — 商品ごとのライセンス解錠ゲート（純ロジック・DOM 非依存）。
 *
 * 学習アプリ Pro・設計計算ツールキット・帳票変更点抽出ツールと商品が増えるたびに
 * 「検証してキャッシュして保存する」同じコードを書き写すのを防ぐためのファクトリ。
 * 商品の区別は sku（署名対象に含まれる）と保存キーだけで、鍵は全商品で共通にできる。
 *
 * 不変条件（entitlements.ts と同じ）:
 *  - 公開鍵が未設定・不正形状のあいだはゲートが作動しない（fail-open）。
 *    正規購入者のキーが一斉に弾かれる事故より、機能が開いたままのほうが安全側。
 *  - 保存はベストエフォート（quota 超過でもそのセッションは解錠する）。
 */

import { type LicenseJwk, type LicensePayload, verifyLicense } from "../../lib/license/license.js";
import { isValidPublicJwk } from "./monetization-config.js";
import type { StorageLike } from "./store.js";

export interface GateConfig {
  /** キルスイッチ。false にすると鍵設定済みでもゲートを即時解除する。 */
  enabled: boolean;
  /** 決済ページ URL。空なら購入ボタンを出さない。 */
  purchaseUrl: string;
  /** 検証用公開鍵。null のあいだは収益化そのものが無効。 */
  publicKeyJwk: LicenseJwk | null;
}

export type ApplyLicenseResult = { ok: true; payload: LicensePayload } | { ok: false; reason: string };

export interface LicenseGate {
  readonly sku: string;
  readonly storageKey: string;
  /** ゲートが実際に作動しうる状態か（キルスイッチ ON かつ 有効な公開鍵設定済み）。 */
  configured(cfg?: GateConfig): boolean;
  /** 解錠済みか（同期・セッション内キャッシュ）。 */
  unlocked(): boolean;
  /** 解錠中のライセンス情報（表示用）。 */
  info(): LicensePayload | null;
  /** 機能ゲートが作動中か（設定済み かつ 未解錠）。 */
  locked(cfg?: GateConfig): boolean;
  /** 起動時に保存済みライセンスを再検証してキャッシュを温める。 */
  init(storage: StorageLike, nowMs?: number, cfg?: GateConfig): Promise<boolean>;
  /** 入力されたキーを検証し、有効なら保存して解錠する。 */
  apply(storage: StorageLike, key: string, nowMs?: number, cfg?: GateConfig): Promise<ApplyLicenseResult>;
  /** ライセンスを削除して無料枠に戻す。 */
  clear(storage: StorageLike): void;
  /** テスト用: モジュール内キャッシュを初期化する。アプリ本体からは呼ばない。 */
  __resetForTest(): void;
}

/**
 * 指定 sku 専用のゲートを作る。
 * @param sku ライセンス payload の sku（"toolkit" / "sheetdiff" など）。他 sku のキーは拒否される。
 * @param storageKey 検証済みキーの保存先（商品ごとに分ける）
 * @param defaultConfig 既定の収益化設定（呼び出しごとに差し替え可能＝テスト用）
 */
export function createLicenseGate(sku: string, storageKey: string, defaultConfig: GateConfig): LicenseGate {
  let payload: LicensePayload | null = null;

  const configured = (cfg: GateConfig = defaultConfig): boolean =>
    cfg.enabled && cfg.publicKeyJwk !== null && isValidPublicJwk(cfg.publicKeyJwk);

  return {
    sku,
    storageKey,
    configured,
    unlocked: () => payload !== null,
    info: () => payload,
    locked: (cfg: GateConfig = defaultConfig) => configured(cfg) && payload === null,

    async init(storage, nowMs = Date.now(), cfg = defaultConfig) {
      payload = null;
      const pub = cfg.publicKeyJwk;
      if (pub === null || !configured(cfg)) return false;
      const key = storage.getItem(storageKey)?.trim() ?? "";
      if (key === "") return false;
      const res = await verifyLicense(key, pub, nowMs, sku);
      if (res.ok) payload = res.payload;
      return res.ok;
    },

    async apply(storage, key, nowMs = Date.now(), cfg = defaultConfig) {
      const pub = cfg.publicKeyJwk;
      if (pub === null) return { ok: false, reason: "現在は販売準備中のためライセンスを登録できません" };
      const trimmed = key.trim();
      if (trimmed === "") return { ok: false, reason: "ライセンスキーを入力してください" };
      const res = await verifyLicense(trimmed, pub, nowMs, sku);
      if (!res.ok) return res;
      try {
        storage.setItem(storageKey, trimmed);
      } catch {
        // 次回起動では無料枠に戻るが、キーの再入力で復帰できる。
      }
      payload = res.payload;
      return res;
    },

    clear(storage) {
      storage.setItem(storageKey, "");
      payload = null;
    },

    __resetForTest() {
      payload = null;
    },
  };
}
