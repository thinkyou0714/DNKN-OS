/**
 * sheet-diff-config.ts — 帳票変更点抽出ツール（web/sheet-diff.html）の収益化設定。
 *
 * toolkit-config.ts と同じ思想: `publicKeyJwk` が null のあいだはゲートが作動せず
 * すべての機能が無料のまま。署名鍵は学習アプリ・ツールキットと共通で、商品の区別は
 * ライセンスの sku（"sheetdiff"）が行う。
 *
 * 無料/有料の線引き（docs/strategy/sheet-diff-product.md）:
 *  - 無料: 2つの帳票を突合して変更点を画面に全件表示（集客の中心。ここは絞らない）
 *  - 有料: 変更点一覧の CSV 書き出し・レポート印刷・列マッピングのプリセット保存
 */

import type { LicenseJwk } from "../../../lib/license/license.js";
import type { GateConfig } from "../license-gate.js";
import { MONETIZATION } from "../monetization-config.js";

export type SheetDiffMonetizationConfig = GateConfig;

export const SHEET_DIFF_MONETIZATION: SheetDiffMonetizationConfig = {
  enabled: true,
  purchaseUrl: "",
  // 学習アプリと同じ公開鍵を使う（keygen 1回で全商品を運用できる）。
  publicKeyJwk: MONETIZATION.publicKeyJwk as LicenseJwk | null,
};
