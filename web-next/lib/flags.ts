/**
 * 収益化の feature flag（休眠設計）。既定は OFF（実課金なし）。
 *
 * - `billingEnabled()`  … サーバ側の課金有効判定（RSC / route handler / entitlement 解決で使う）。
 * - `publicBillingEnabled()` … クライアントに露出してよい mirror（pricing CTA の出し分け）。
 *
 * 本番化（flip ON）は env を true にするだけ（コード変更なし）。詳細: docs/monetization/ARCHITECTURE.md §A.2。
 */
export function billingEnabled(): boolean {
  return process.env.BILLING_ENABLED === "true";
}

export function publicBillingEnabled(): boolean {
  return process.env.NEXT_PUBLIC_BILLING_ENABLED === "true";
}
