/**
 * toolkit-config.ts — 電気設計計算ツールキット（web/toolkit.html）の収益化設定。
 *
 * 学習アプリの monetization-config.ts と同じ思想:
 *  - `publicKeyJwk` が null の間、機能ゲートは一切作動しない（全モジュール無料のまま）。
 *  - 署名鍵ペアは学習アプリと共通（`npm run license:keygen` 1回で両商品を運用できる）。
 *    商品の区別はライセンスの sku（"toolkit"）で行い、Pro キーではツールキットは解錠できない。
 *  - 販売開始手順は docs/strategy/toolkit-product.md を参照。
 */

import type { LicenseJwk } from "../../../lib/license/license.js";
import { isValidPublicJwk, MONETIZATION } from "../monetization-config.js";

export interface ToolkitMonetizationConfig {
  /** キルスイッチ。false にすると鍵設定済みでも全ゲートを即時解除する。 */
  enabled: boolean;
  /** 決済ページ URL（BASE / note / Stripe Payment Link 等）。空なら購入ボタンを出さない。 */
  purchaseUrl: string;
  /** 検証用公開鍵。学習アプリと共有（monetization-config.ts が単一の真実）。 */
  publicKeyJwk: LicenseJwk | null;
}

export const TOOLKIT_MONETIZATION: ToolkitMonetizationConfig = {
  enabled: true,
  purchaseUrl: "",
  publicKeyJwk: MONETIZATION.publicKeyJwk,
};

/** ツールキットの収益化が実際に作動する状態か（キルスイッチ ON かつ 有効な公開鍵）。 */
export function toolkitMonetizationConfigured(cfg: ToolkitMonetizationConfig = TOOLKIT_MONETIZATION): boolean {
  return cfg.enabled && cfg.publicKeyJwk !== null && isValidPublicJwk(cfg.publicKeyJwk);
}
