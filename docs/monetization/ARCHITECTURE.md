# DENKEN-OS 収益化レイヤー — 実装アーキテクチャ（設計）

> **Status**: 設計（design-only）。本書は次段の実装（Codex `/goal` T01–T20）の単一参照点。
> **基点ブランチ**: `origin/main`（`AGENTS.md` が `Stack: TypeScript / Next.js (web/)` を宣言済み）。
> **稼働姿勢**: 全部作るが **休眠 / flip 可能** — Stripe は test mode、課金は feature flag（既定 OFF）。本番化＝キー差替え＋flag ON。実課金は発生しない。
> **参照実装**: 社内 `thinkyou0714/lab-lms`（Next 16 + `@supabase/ssr` + `stripe ^20` + Vercel + pricing、`verify-magic-link` / `verify-pricing` script 同梱）。Auth/Stripe/pricing は本実装を翻案する（ゼロ設計しない）。

---

## 0. Ground-truth 前提（最初に読む）

`origin/main` に対して実検証した結果、eval ブランチ前提の一部プリミティブは **基点に存在しない**。設計はこれを織り込む。

| プリミティブ | `origin/main`（基点） | `feat/eval-2026-06`（stale） | 帰結 |
|---|---|---|---|
| `web/src/app.ts` | **薄い（~102行）**。アプリは `web/src/{views,state,ui}`（56 module）に分割済 | 一枚岩寄り | 移行対象は ~56 module。**既にモジュラー**なのは追い風。 |
| `mergeBackup(existing,incoming)` | **無い**（`backup.ts` は `exportBackup`/`importBackup` のみ） | あり（`{reviews,logs}` を突合） | 同期の突合は **store レベルで再実装**（cherry-pick 不可）。 |
| local store 形状 | `denken:cards`（ts-fsrs `Card` map）+ `denken:logs` | `{reviews, logs}` | 形状が別物 → 意図的に再設計。 |
| `assertNoServerSecrets` + `tests/web/build-guard.test.ts` | **無い** | あり（esbuild 固有） | Next では **`next build` 後の `.next/static/**` scan** に置換。 |

**基点で確認済:**
- `createSupabaseStores(url,key)`（`lib/store/supabase-store.ts`）は **session 無しの静的キー**でクライアント生成 → RLS 下で `auth.uid()` が NULL（＝**認証 seam**）。
- `ReviewStateRow` の mapper は `reps/lapses/interval_days/ease/due_at/last_review_at` を持つが **`stability`/`difficulty` を落とし**、`state`/`scheduled_days` 列が**無い** → ts-fsrs `Card` が無損失往復できない。
- migration `0001–0005` に **billing/entitlements/profiles テーブルは無い**。基点には既に `0005_rls_column_checks.sql` + `tests/supabase/rls-mock.test.ts` があり、新 migration はこの不変条件に適合させる。
- `web/index.html` の CSP は strict（`script-src 'self' 'sha256-…'`, `connect-src 'self' https://api.anthropic.com`）。SW は手書き `denken-os-v21-<hash>`（6 アセット、`scripts/build-web.ts` が刻印）。

---

## A. 目標アーキテクチャ（休眠 / flip 可能）

### A.1 リポジトリ & アプリ構成

**推奨: npm workspaces で最小改変。** `lib/**` は root 据え置きで内部パッケージ `@denken/core` 化、`web/` を Next.js 16 アプリに。
理由: `lib/**` は `scripts/**`・`tests/**`・web バンドルが消費する framework 非依存 ESM。パッケージ境界を切ると、`import "server-only"` による
クライアント/サーバ秘密境界が「タダで」手に入り、数百の相対 import を動かさずに済む。

```
/ (root package.json → workspaces: ["lib","web"])
  lib/                         # → package "@denken/core"（build step 無し・source を transpilePackages で消費）
    store/{index,supabase-store,file-store}.ts   # + NEW entitlement-store.ts
    scheduler/  analytics/  share-card/  engine/ …   # 無改変（framework 非依存）
  supabase/migrations/         # + 0006_entitlements.sql, 0007_review_states_fsrs.sql
  scripts/  tests/  data/  docs/                 # import 様式は無改変
  web/                         # → Next.js 16 App Router アプリ
    app/
      layout.tsx               # root; middleware の nonce を消費
      (marketing)/{page,pricing/page}.tsx        # 公開 LP + pricing（静的）
      (app)/layout.tsx         # 認証シェル + client providers（LocalProgress, Entitlement）
      (app)/{practice,review,exam,chat,dashboard,formulas,settings}/page.tsx
      (auth)/sign-in/page.tsx
      api/
        auth/callback/route.ts
        sync/{pull,push}/route.ts
        stripe/{checkout,webhook,portal}/route.ts
        track/route.ts         # first-party 計測 sink（CSP clean）
        share/[kind]/route.tsx # Satori/OG 画像
    components/                # shadcn/ui + 移植 widget（web/src/ui, web/src/views 由来）
    lib/                       # web 専用 glue
      supabase/{browser,server,service,middleware}.ts   # service は `server-only`
      entitlement/{resolve.ts,provider.tsx,use-entitlement.ts}
      stripe/server.ts         # `server-only`
      progress/{provider.tsx,sync.ts}
      flags.ts  analytics/client.ts
    sw/ (serwist source)   middleware.ts   next.config.ts   public/{icon.svg,manifest,problems.json}
```

**`lib/**` の在り処 / import 様式**: root 据え置きで `@denken/core`。Next は `transpilePackages: ["@denken/core"]` + tsconfig `paths` で消費。
現行 `.js`→`.ts` specifier（`scripts/build-web.ts` の esbuild `tsResolve` plugin が処理）は Turbopack 下で `moduleResolution:"bundler"` + resolve rule で吸収（**リスク R8**）。

**ホスティング**: Vercel。GitHub Pages workflow（`*pages*` + dependabot pages actions）は撤去。デプロイは `npm run verify` gate 配下。

**offline-first の保全:**
- **Serwist（`@serwist/next`）** が Next の *ハッシュ済チャンク* に対する Workbox precache manifest を生成（手書き 6-アセット `sw.js` はハッシュ済チャンクに写像不可）。app shell は cache-first、`problems.json` は **stale-while-revalidate**（v21 SWR 挙動を保持）。SW 版数は Serwist の revisioned precache になり、`build-web.ts` の刻印ロジックを退役。
- **クライアント境界の永続化**: `LocalProgress`（`web/src/store.ts`）は注入 `StorageLike` 上の純ロジック → `"use client"` の下でそのまま移植し `web/lib/progress/provider.tsx` で供給。IndexedDB backing + localStorage fallback は client 限定のまま。
- **SSR-safe hydration**: streak/stats は client-only storage 由来 → stat コンポーネントを `mounted` guard（`useEffect` で hydrate するまで skeleton 表示）。streak/XP を SSR しない。
- **a11y を JSX に保持**: `aria-live`・`mathToSpeech`・focus 移動・`role=tab`/矢印ナビ（現 `web/src/views/router.ts`・`web/src/ui/*`）を JSX 移植で再現（移植タスクの完了条件に明記）。

### A.2 Feature-flag + Stripe test mode（休眠だが完全実装）

- **Flags**: `BILLING_ENABLED`（server, 既定 `false`）+ `NEXT_PUBLIC_BILLING_ENABLED`（client mirror, 既定 `false`）。加えて dev 姿勢 `ENTITLEMENT_DEFAULT` = `free` | `all_unlocked`（CI=`free` で gate を運動、local=`all_unlocked` で開発摩擦ゼロ）。
- **休眠**: `BILLING_ENABLED=false` で `resolveEntitlement()` は **Stripe も entitlements テーブルも触らず** 既定 tier に短絡。pricing CTA は checkout ではなく「準備中/ウェイトリスト」を描画。
- **Stripe test mode**: `STRIPE_SECRET_KEY=sk_test_…` / `STRIPE_PRICE_ID=price_…(test)` / `STRIPE_WEBHOOK_SECRET=whsec_…(test)`。checkout→webhook→entitlement を Stripe CLI（`stripe listen`）で通しで検証。
- **Flip 手順（1 PR で文書化）**: env 4 値を live 化（`sk_live_`, live price, live `whsec_`, 両 flag `true`）を Vercel + Supabase に反映 → live。**コード変更なし。**

### A.3 Entitlement モデル

**新 interface（`lib/store/entitlement-store.ts`）:**
```ts
export type Tier = "free" | "pro";
export interface Entitlement {
  userId: string;
  tier: Tier;
  status: "active" | "trialing" | "past_due" | "canceled" | "none";
  source: "stripe" | "grant" | "default";
  currentPeriodEndMs: number | null;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  updatedAtMs: number;
}
export interface EntitlementStore {
  get(userId: string): Promise<Entitlement | undefined>;               // RLS own-row 読み
  byStripeCustomer(customerId: string): Promise<Entitlement | undefined>; // service-role
  upsert(e: Entitlement): Promise<void>;                               // service-role(webhook)のみ
}
```
impl: `InMemoryEntitlementStore`（test）+ `SupabaseEntitlementStore`（`get` は per-user authed client、`upsert`/`byStripeCustomer` は service-role client）。

**check の在り処 — サーバが真実源:**
- **RSC / route handler**: `resolveEntitlement(userId,{flag})`（`web/lib/entitlement/resolve.ts`）が `cloudSync`・`adaptiveSelection`・deep explanation をサーバで強制。`api/sync/*` と適応選択 endpoint はここで hard-gate。
- **client mirror（UX のみ・境界ではない）**: `EntitlementProvider`（RSC から渡る値で hydrate）+ `useEntitlement()` → `{ tier, can(feature) }` で upsell 表示/ボタン無効化。

**フリーミアム境界 → 具体 gate**（正典: `docs/x-strategy/07-monetization-failure-hedge.md`）:

| 機能 | Free | Pro | gate 位置 |
|---|---|---|---|
| 今日の一問 | 1/日, 答え+要点 | 無限 類題演習 | select 経路が tier で件数決定・submit 時サーバ検証（強制時） |
| 弱点適応出題 | 固定セット | 適応選択 | `select()` 戦略を tier で選択（サーバ） |
| 深い解説 | 要点のみ | 完全導出 | render gate（RSC） |
| 学習記録/進捗 + クラウド同期 | ローカルのみ | サーバ同期 | `api/sync/*` が pro でなければ 402/no-op |
| シェア画像 | ✅（バイラル） | ✅ | なし |

**ライセンス guard（必須）**: 課金は **サービス**（適応/同期/無限/サポート）に対して。CC-BY-SA 問題データの独占には課金しない。
→ `problems` は公開読み（`status='published'` RLS 不変）、backup **export/import は無料**のまま。gate 対象は 適応/同期/深い解説/無限在庫/サポートのみ。

**新 migration `0006_entitlements.sql`**（不変条件テスト `tests/supabase/rls-mock.test.ts` に適合）:
```sql
create table public.entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tier text not null default 'free' check (tier in ('free','pro')),
  status text not null default 'none',
  stripe_customer_id text unique,
  stripe_subscription_id text,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.entitlements enable row level security;
-- 本人 READ のみ。insert/update/delete policy 無し → 書きは service_role のみ（RLS bypass）
create policy entitlements_select_own on public.entitlements
  for select using (auth.uid() = user_id);

-- webhook 冪等台帳: RLS on, policy ゼロ = anon/authed へ deny-all。service_role が bypass
create table public.billing_events (
  event_id text primary key,
  type text not null,
  received_at timestamptz not null default now()
);
alter table public.billing_events enable row level security;
```
不変条件適合: 両表 RLS 有効／**`using(true)` 不在**／所有表は `auth.uid()=user_id`／user UPDATE が無いので「UPDATE は SELECT とペア」は空虚に真。
**不変条件テストの拡張**: entitlements の select-own を追加し、**policy ゼロの service-role 専用表（`billing_events`）を許容**するよう明示的に緩める（T15）。

**webhook → entitlement 書き経路**: checkout 生成時に `auth.uid()` が判る → Checkout Session に `client_reference_id=userId` + `metadata.user_id` を載せ、`stripe_customer_id` を service-role upsert。
webhook（`api/stripe/webhook/route.ts`, node runtime, raw body）は署名検証 → `billing_events.event_id` で dedup → user 解決（`metadata.user_id` → fallback `byStripeCustomer`）→ **service-role client** で `entitlementStore.upsert(...)`。
扱う event: `checkout.session.completed`, `customer.subscription.{updated,deleted}`, `invoice.payment_failed`。

### A.4 Auth（Supabase magic-link）+ store seam + 同期

- **per-user 認証クライアント seam（修正点）**: service-role/CLI 用に `createSupabaseStores(url,key)` は残し、`lib/store/supabase-store.ts` に **`createStoresForClient(client: SupabaseClient)`** を追加（`{problems, answerLogs, reviewStates, entitlements}` を返す）。Next では `@supabase/ssr` の `createServerClient(cookies())` で session JWT を載せ → `auth.uid()` 非 null → RLS が効く。
- **session 配線**: `web/middleware.ts` が Supabase session cookie を refresh（＋ nonce CSP 注入 — middleware は 1 本）。RSC/route handler は `web/lib/supabase/server.ts` 経由で session 読み。`api/auth/callback/route.ts` が magic-link code を交換。
- **LocalProgress に userId + 同期**: `LocalProgress` は single-user/local のまま（休眠安全: 未ログイン = ローカルのみ・挙動不変）。`SyncEngine`（`web/lib/progress/sync.ts`）を追加し、**ログイン + pro + online** の時だけ `denken:cards`/`denken:logs` をサーバ store と突合（merge **policy**: logs は `topic|atMs|problemId` で dedup、review は最新 `lastReviewMs` で LWW）— **store レベルで再実装**（`mergeBackup` は基点に無い）。push: local logs → `answer_logs`（自然キー dedup）、topic 毎の Card → `review_states`（LWW）。pull: サーバ → local blob へ merge → `clearDerivedCaches()`。
- **FSRS 往復**: ts-fsrs `Card` の `state`/`scheduled_days`/`stability`/`difficulty` をサーバ schema+mapper が落とすため、**migration `0007_review_states_fsrs.sql`** で `state smallint`（+任意 `scheduled_days`,`elapsed_days`）を追加、mapper（`reviewStateToRow`/`rowToReviewState`）を無損失往復に拡張。**`state` を再導出しない。**

### A.5 セキュリティ

- **nonce CSP middleware**（`web/middleware.ts`）: per-request nonce; `script-src 'self' 'nonce-<n>' 'strict-dynamic'`; `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://api.anthropic.com`; `frame-src https://js.stripe.com https://hooks.stripe.com` は **Stripe 埋込み時のみ**（redirect Checkout を優先し frame を避ける — D-4）; `img-src 'self' data:` `worker-src 'self'` `manifest-src 'self'` を保持; `style-src 'self' 'unsafe-inline'` は Tailwind/shadcn 実務上許容（後で締める）。
- **`NEXT_PUBLIC_` 境界**: anon-safe 値のみ（`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_BILLING_ENABLED`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`）。
- **秘密 leak guard 拡張**: esbuild の `assertNoServerSecrets` は Next 下で陳腐化 → **`next build` 後の `.next/static/**` scan** に置換（`service_role`, `SUPABASE_SERVICE_ROLE`, `SUPABASE_JWT_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` で fail）。加えて `web/lib/supabase/service.ts` と Stripe client に `import "server-only"` を付け、client import 時にビルド失敗させる。
- **RLS + webhook**: entitlements own-row 読み / service-role 書き; `billing_events` deny-all; webhook `stripe.webhooks.constructEvent(await req.text(), sig, secret)` + 冪等。

### A.6 CSP / CI / デプロイ変更

- `verify` チェーン: `build:web`（esbuild）を `next build` に置換; `typecheck:web`（`tsc -p web`）・`validate:data`・`test`（store/entitlement/webhook/RLS テストを含む）は維持。品質ゲートは **デプロイ前** に維持（Vercel Ignored-Build-Step で verify を呼ぶ or CI job で verify → Vercel deploy trigger）。
- **Biome vs ESLint**: Biome を唯一の linter に維持（`biome.json`: lineWidth 120・double quotes・trailing-all・`noNonNullAssertion:error`）。shadcn は `--no-eslint` で init（生成 ESLint config は削除）、生成 `web/components/ui/**` は Biome `overrides` で緩和。Node は `.nvmrc`/`engines` を 22 に揃える（Next 16 OK）。
- **lab-lms との整合**: lab-lms は ESLint/Prettier + `@supabase/ssr`。**Auth/Stripe/pricing のパターン**は lab-lms から翻案するが、**linter 方針は denken-os 側（Biome）を正**とする（lab-lms のコードを Biome 整形して取り込む）。

### A.7 Next.js 16 特有の注意（実装前に必ず反映 — 調査で確認）
> Next 16 は本設計の複数箇所に影響する破壊的変更を含む。設計・タスクはこれを前提化する。
- **`middleware.ts` → `proxy.ts` に改名（Node.js runtime で動く）**。本書の「middleware」は Next 16 では `web/proxy.ts` を指す。Supabase session refresh と nonce-CSP は同一 `proxy.ts` に同居（T06）。
- **Turbopack が既定**。Serwist は Webpack を要するため **`next build --webpack`**（もしくは serwist が Turbopack 対応するまで webpack build）。Next-16 で最大級の PWA 罠（T05）。
- **Vercel で Serwist は `minimatch` を明示 依存追加**しないとビルド失敗（T05）。
- **async request API 必須**: `await cookies()` / `await headers()` / `await params`（session 読み・nonce 読みに影響、T06/T11）。
- **webhook route は `export const runtime = "nodejs"` + raw body（`await req.text()`）+ 署名検証**。auth の `proxy.ts` matcher から `api/stripe/webhook` を **negative-lookahead で除外**（除外漏れは "No signatures found" の典型本番障害）（T18）。
- **session は必ず `supabase.auth.getUser()`（`getSession()` 禁止・cookie は spoof 可能）**。`@supabase/ssr` ≥0.10 は refresh 時に cache header を `setAll` へ渡す → Vercel/CDN が `Set-Cookie` をキャッシュしないよう適用（session 混線防止）（T10/T11）。
- **Node は 20.9+**（`.nvmrc`=22 で OK）、`next lint` は廃止（Biome を使う本設計に好都合）。
- 根拠: nextjs.org/docs（CSP/upgrading v16）, serwist.pages.dev, supabase.com/docs（server-side auth）, docs.stripe.com/webhooks。詳細出典は `RESEARCH-2026-07.md`。

---

## B. フェーズ別ロードマップ

各フェーズは出荷可能・休眠安全（flag が反転するまで既存ユーザーの挙動は不変）。

| Phase | 範囲 | 依存 | リスク |
|---|---|---|---|
| **0 — 基点確定** | `origin/main` から分岐; 分岐決定 doc（mergeBackup/guard/store 形状は branch 限定 → reimplement / replace）。docs のみ。 | — | 低 |
| **1 — Next16+shadcn scaffold** | workspace 境界（`@denken/core`）; `web/` に Next アプリ; 56-module SPA を `(app)` client route + LocalProgress provider + SSR-safe stat guard へ移植; Serwist SW; nonce-CSP middleware; Vercel + verify チェーン + post-build secret scan。 | 0 | **高**（hydration/SW/CSP/`.js`→`.ts`）→ T02–T07 に分割 |
| **2 — Pricing/LP + ファネル** | `(marketing)` LP + pricing（flag-gate CTA）; UTM 配線（`lib/analytics/utm.ts`）+ first-party `/api/track`; weekly-review KPI 再利用。**PR #55 の LP 3案を取り込み統合**。 | 1 | 低（純加算・公開） |
| **3 — Auth + クラウド同期（休眠安全）** | `@supabase/ssr` clients; magic-link + callback; store seam 修正（`createStoresForClient`）; migration `0007` + FSRS mapper; `SyncEngine` + `api/sync/*`。未ログイン/同期 OFF = 今日の挙動。 | 1 | 中〜高（FSRS 往復・merge 正しさ） |
| **4 — Entitlement gate（flag 配下）** | `EntitlementStore`（+impl）; migration `0006` + 不変条件テスト; `resolveEntitlement()` + flag + provider/hook; フリーミアム gate 配線。既定 free/all-unlocked（flag OFF）。 | 3 | 中 |
| **5 — Stripe サブスク（test mode）** | Stripe server client（`server-only`）; `api/stripe/{checkout,webhook,portal}`; `billing_events` 冪等 + 署名検証 + service-role upsert; secret guard 拡張; pricing CTA 配線（flag ON → test mode のみ）。 | 4 | 中（webhook 安全・customer→user 対応） |
| **6 — バイラル シェア画像 + 招待** | Satori/`@vercel/og` route を `lib/share-card/card-text.ts` から（`cardText`+`hasPii` 再利用）; 招待は `quizLink`/UTM。 | 1(+2) | 低〜中 |
| **7 — コンテンツ pipeline → アプリ** | `lib/engine/` publish 経路（engine → validated → `problems` published）を「無限 類題」の裏付けに配線。 | 3,4 | 中（在庫**量**が真の依存） |

---

## C. 実装タスク分解

依存順・7フィールド /goal spec は **`docs/monetization/goals/G01–G20-*.md`** に分離。`[ADDITIVE-SAFE]`=新規のみ / `[SHARED]`=共有・要注意 でマーク。

| # | タスク | 種別 | Phase |
|---|---|---|---|
| T01 | 基点ブランチ + 分岐決定 doc | ADDITIVE-SAFE | 0 |
| T02 | workspace 境界 `@denken/core` | SHARED | 1 |
| T03 | Next.js 16 アプリ scaffold | SHARED | 1 |
| T04 | 56-module SPA を `(app)` client route へ移植 | SHARED | 1 |
| T05 | Serwist offline SW | SHARED | 1 |
| T06 | nonce-CSP middleware + session refresh | ADDITIVE-SAFE | 1 |
| T07 | CI/deploy: verify + post-build secret scan + Vercel | SHARED | 1 |
| T08 | Marketing LP + pricing（flag-gate CTA、PR#55 統合） | ADDITIVE-SAFE | 2 |
| T09 | UTM/ファネル計測配線 | ADDITIVE-SAFE | 2 |
| T10 | Supabase magic-link auth UI + callback | ADDITIVE-SAFE | 3 |
| T11 | store seam `createStoresForClient(authedClient)` | SHARED | 3 |
| T12 | migration `0007` + FSRS 無損失 mapper | SHARED | 3 |
| T13 | SyncEngine(pull/push) + `api/sync/*` | SHARED | 3 |
| T14 | `EntitlementStore` interface + impl | ADDITIVE-SAFE | 4 |
| T15 | migration `0006` entitlements + billing_events + 不変条件テスト | ADDITIVE-SAFE | 4 |
| T16 | `resolveEntitlement()` + flag + provider/hook + gate 配線 | SHARED | 4 |
| T17 | Stripe checkout + portal route（server-only） | ADDITIVE-SAFE | 5 |
| T18 | Stripe webhook → entitlement upsert（冪等・署名検証） | ADDITIVE-SAFE | 5 |
| T19 | Satori シェア画像 + 招待 | ADDITIVE-SAFE | 6 |
| T20 | コンテンツ pipeline publish 経路 | SHARED | 7 |

---

## D. リスク & オープン判断

**リスク**
1. **offline SW under Next（高）**: 手書き 6-アセット `sw.js` は Next のハッシュ済チャンクに写像不可 → Serwist precache（T05）。redeploy 時の stale-precache 固着を検証。
2. **CSP テンション（高）**: Next hydration + shadcn/Tailwind が `unsafe-inline` を引く → strict-dynamic nonce で現行 strict を保持。Tailwind は `style-src 'unsafe-inline'` を要する（scoped で許容）。Stripe 埋込みは `frame-src` を要する → **redirect Checkout を優先（D-4）**。console-clean を gate（T06）。
3. **ブランチ分岐 30/27 + プリミティブ不一致（高）**: `mergeBackup`・`assertNoServerSecrets`・`{reviews,logs}` 形状は **eval 限定**。main は `{cards,logs}` で欠く → 再実装（T13）/置換（T07）。cherry-pick しない。
4. **Biome vs ESLint（中）**: shadcn/Next は ESLint 既定。Biome を正に維持・shadcn `--no-eslint`・生成 UI は Biome override。`noNonNullAssertion:error` と生成コードの衝突に注意。
5. **有料価値の在庫依存（中〜高）**: 「無限 類題 + 適応」は在庫があって初めて Pro を正当化（T20）。量が無いと売る物が無い → gate flip は在庫の厚みを待つ（「合格/規模の後」戦略と整合）。
6. **client-only stats の SSR hydration（中）**: streak/XP/due が localStorage/IDB 由来 → mismatch。`mounted` guard + skeleton（T04）。storage 由来値を SSR しない。
7. **FSRS 往復欠損（中）**: サーバ `review_states`+mapper が `stability/difficulty` を落とし `state` 列が無い → T12 で schema+mapper。**永続化・再導出しない。**
8. **`.js`→`.ts` resolver under Turbopack（中）**: `lib/**` の `.js` specifier を esbuild plugin が解決していた → `moduleResolution:"bundler"` + resolve rule（T03 で検証）。fallback = extensionless codemod or full `exports` map。
9. **ライセンス境界（コンプラ）**: 課金はサービスに対して、CC-BY-SA データ独占には課金しない。`problems` 公開読み + backup export 無料を維持し、gate は 適応/同期/深い解説/無限/サポートのみ。

**人間に戻す（or 推奨つき確定する）オープン判断**
- **D-1 dev の entitlement 既定**: CI=`free`（gate 運動）/ local=`all_unlocked`（開発摩擦ゼロ）。**推奨: この二択**。
- **D-2 restructure 深度**: 内部 `@denken/core` パッケージ（**推奨**・低 churn）vs full Turborepo。
- **D-3 eval プリミティブ**: **再実装**推奨（`{cards,logs}` vs `{reviews,logs}` の形状差で cherry-pick 不可）。
- **D-4 Stripe Checkout**: **redirect** 推奨（`frame-src js.stripe.com` を避け CSP を保つ）。
- **D-5 無料1問/日の強制**: client soft-gate（回避可）先行 → 濫用時に server 強制。**推奨: soft-gate 先行**。
- **D-6 計測 vendor**: first-party `/api/track`（CSP clean・**推奨**）vs Plausible/PostHog（`connect-src`/script 許可要）。
- **D-7 問題ソース**: static `problems.json`（offline 単純）vs Supabase published `problems`（「無限」+ 鮮度）→ **hybrid**（static core + Pro 向け server 供給）想定。

---

## 参照ファイル（実装時の要所）
- `lib/store/supabase-store.ts` — `createSupabaseStores(url,key)` の認証 seam + FSRS 欠損 mapper（T11/T12）。新 `createStoresForClient` の locus。
- `lib/store/index.ts` — `EntitlementStore` を追加する store interface（T14）。
- `web/src/store.ts` — `LocalProgress`/`StorageLike`/`denken:*` キー。offline 永続を wrap + 同期（T04/T13）。
- `supabase/migrations/0005_rls_column_checks.sql` + `tests/supabase/rls-mock.test.ts` — `0006`/`0007` が満たす RLS 不変条件パターン（T12/T15）。
- `scripts/build-web.ts` + `web/index.html`(CSP) + `web/sw.js` — `next build` + nonce middleware + Serwist に置換される esbuild/CSP/SW pipeline（T05/T06/T07）。
- 参照: `thinkyou0714/lab-lms`（`@supabase/ssr` auth / Stripe / pricing / `verify-*` script）を T10/T11/T17/T18 の翻案元とする。
