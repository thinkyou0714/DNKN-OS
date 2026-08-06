# web-next — DENKEN-OS Next.js 16 移行アプリ

既存の esbuild 製オフライン PWA（`../web/`）を段階的に置換する **Next.js 16 (App Router)** アプリ。
本コミット時点は **収益化の土台（LP + 料金ページ）** のみで、**課金は休眠**（`NEXT_PUBLIC_BILLING_ENABLED` 既定 OFF）。
設計の全体像は [`../docs/monetization/ARCHITECTURE.md`](../docs/monetization/ARCHITECTURE.md)、タスク分解は [`../docs/monetization/goals/GOALS.md`](../docs/monetization/goals/GOALS.md)。

## 実装済み（休眠・build 検証済み）
- Next 16 App Router scaffold（`app/layout.tsx` + `app/globals.css`「紙＋朱色」テーマ）
- LP（`app/page.tsx`）+ 料金（`app/pricing/page.tsx`）: Free / Pro プラン表 + **flag-gate CTA**（`components/cta.tsx`）
- `lib/flags.ts`（`billingEnabled` / `publicBillingEnabled`）・`lib/site.ts`（表示コンテンツ単一情報源）
- 課金 OFF 時は Pro CTA を「ウェイトリスト（準備中）」にし、checkout へ遷移させない（景表法/誤認回避）
- **セキュリティヘッダ**（`next.config.ts` `headers()`）+ **first-party UTM 計測**（`lib/analytics.ts` / `app/api/track` / `components/analytics.tsx`）
- **Supabase magic-link auth 足場**（`@supabase/ssr`）: `lib/supabase/{client,server}.ts`・`lib/auth.ts`（`getUser()`）・
  `app/(auth)/sign-in`・`app/auth/callback`・`app/account`。**Supabase 未接続時は自動休眠**（「準備中」表示・`getUser()`→null）。
- **休眠 entitlement resolver**（`lib/entitlement.ts`）: 課金 flag OFF で `free` に短絡（gate seam）

> **runtime 未検証**: 認証・課金は `next build` でコンパイル検証済みだが、実 magic-link/session/決済は
> **Supabase/Stripe プロジェクト接続後に検証**（キー = human-tasks）。未接続でも本アプリは壊れず休眠する。

## 使い方
```bash
cd web-next
npm install
npm run build      # next build（scaffold のコンパイル検証）
npm run dev        # http://localhost:3000
npm run typecheck  # tsc --noEmit
```

## 環境変数（このアプリ）
| 変数 | 既定 | 用途 |
|---|---|---|
| `BILLING_ENABLED` | `false` | サーバ側の課金有効判定（entitlement/Stripe） |
| `NEXT_PUBLIC_BILLING_ENABLED` | `false` | クライアント mirror（pricing CTA の出し分け） |
| `NEXT_PUBLIC_SUPABASE_URL` | （空=休眠） | Supabase プロジェクト URL（auth）。**人間が用意** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | （空=休眠） | Supabase anon key（auth）。**人間が用意** |

> 後続タスクで追加予定（**実キーは人間が用意 = human-tasks**）:
> `SUPABASE_SERVICE_ROLE_KEY`（webhook 書き）/ `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` /
> `STRIPE_PRICE_ID` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`。
> **`NEXT_PUBLIC_*` のみクライアントに露出可**（秘密＝service_role / stripe secret は付けない）。

## まだ実装していない（follow-up・GOALS.md 参照）
- **T02**: ルート npm workspaces 化（`@denken/core` として `lib/` 連携）— 既存 `verify` を壊さないため本コミットでは未実施
- **T04**: 既存 `web/src`（56 module SPA）の React 移植 + `LocalProgress` 連携（offline 保持）
- **T05**: Serwist offline SW（**`next build --webpack`** + Vercel 向け `minimatch` 依存が必要）
- **T06**: nonce-CSP `proxy.ts`（Next16 で middleware 改名）+ **session refresh**（RSC が user を確実に見るために必須・runtime 検証要）
- **T07**: CI/Vercel + `verify` チェーン更新 + post-build secret scan
- **T13/T16 full**: クラウド同期 / entitlement を `@denken/core` の `EntitlementStore`（PR #57）に接続（要 Supabase）
- **T17/T18**: Stripe checkout / webhook（**要 Stripe アカウント**）
- 認証・課金の **runtime 検証全般**: Supabase/Stripe/Vercel アカウント接続後（human-tasks §A）

## 既存 `../web/` との関係
現行の PWA（`../web/`, esbuild）は**そのまま稼働**（ルート `npm run verify` の `build:web` は不変）。
本アプリは additive で、移植が完了したら `web/` の役割を引き継ぐ。無料 CTA は当面 現行 PWA（GitHub Pages）へ着地する。
