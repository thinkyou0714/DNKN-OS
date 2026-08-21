# 収益化実装 タスク分解 — Codex `/goal` spec T01–T20

> `ARCHITECTURE.md` を依存順の**7フィールド /goal spec**に分解したもの。次ターンに Codex(gpt-5.5-codex, xhigh, `--write`)へ
> **依存順**で1つずつ渡す（`/goal <このファイルの該当 T セクション>`）。各 T は独立検証可能・小さめ（目安 ≤5 files / ≤300 行）。
> `[ADDITIVE-SAFE]`=新規のみ / `[SHARED]`=共有・分岐ファイルに触れる（レビュー厳格化）。
> 全 spec 共通の前置き（各 `/goal` に自動付与）: 「調査だけで終わらず、必要なコード変更・修正・確認まで行い、実装完了状態にすること」。
> Next 16 の前提（`proxy.ts` / Serwist `--webpack` / async `cookies()/headers()` / webhook node runtime）は `ARCHITECTURE.md §A.7` を必ず参照。

---

## T01 — 基点ブランチ + 分岐決定 doc  `[ADDITIVE-SAFE]` (Phase 0)
- **目的**: `origin/main` を基点に固定し、`feat/eval-2026-06` の各プリミティブを「再実装/置換/drop」のどれにするか記録。
- **対象ファイル**: `docs/monetization/00-base-decision.md`（本 PR で作成済 — 実装時は追認・更新のみ）。
- **実装してほしい内容**: `origin/main` から `feat/monetization` を分岐。`mergeBackup` / `assertNoServerSecrets` / `{reviews,logs}` 形状は branch 限定 → store レベル再実装 / Next guard 置換。`feat/eval-2026-06` は参照凍結。
- **変更してはいけない範囲**: コード変更なし。stale ブランチのマージなし。
- **完了条件**: (1) 決定 doc に 4 分岐プリミティブそれぞれの解決策が載る。(2) `git merge-base --is-ancestor origin/main HEAD` が真。
- **テスト/確認方法**: `git merge-base` 確認、doc レビュー。
- **期待する出力**: 決定 doc + 新ブランチ。変更ファイル一覧・確認事項・残懸念。

## T02 — workspace 境界 `@denken/core`  `[SHARED]` (Phase 1)
- **目的**: `lib/**` にパッケージ identity を与え、Next 消費と `server-only` 秘密境界を可能にする。
- **対象ファイル**: `package.json`(root, `workspaces` 追加), `lib/package.json`(新: name `@denken/core`, `type:module`, `exports` map), `tsconfig.json`(paths)。
- **実装してほしい内容**: npm workspaces `["lib","web"]`。`@denken/core` の subpath exports（`./store`,`./scheduler`,`./analytics/*`,`./share-card`,`./engine`）。`.js` 拡張子 import はそのまま動かす（ソース移動なし）。
- **変更してはいけない範囲**: `lib/` 配下のファイル移動禁止。scripts/tests の相対 import 書換え禁止。`lib` の実行時挙動変更禁止。
- **完了条件**: (1) `npm run typecheck` + `npm test` が無改変で緑。(2) scratch TS から `import { ProblemStore } from "@denken/core/store"` が解決。
- **テスト/確認方法**: `npm run verify`（web build を除く）。
- **期待する出力**: 動く内部パッケージ・挙動変更ゼロ。

## T03 — Next.js 16 アプリ scaffold  `[SHARED]` (Phase 1)
- **目的**: 静的 `web/index.html` を置換する App Router シェルを立ち上げる。
- **対象ファイル**: `web/next.config.ts`, `web/app/layout.tsx`, `web/app/(marketing)/page.tsx`(placeholder), `web/tailwind.config.ts`, `web/components.json`(shadcn), `biome.json`(生成 UI の overrides)。
- **実装してほしい内容**: Next 16 + Tailwind + shadcn（`--no-eslint` で init）。`transpilePackages:["@denken/core"]`、`moduleResolution:"bundler"` + `.js`→`.ts` resolver。`.nvmrc`/`engines` を Node 22 に。
- **変更してはいけない範囲**: 2つ目の linter(ESLint) 追加禁止。SPA ロジックの移植はまだしない。`lib/**` に触れない。
- **完了条件**: (1) `@denken/core` の1シンボルを import する `next build` 成功。(2) `biome check` が新規ファイルで通る。
- **テスト/確認方法**: `next build`, `biome check web/`。
- **期待する出力**: ビルド可能な空 Next アプリ + design-system baseline。

## T04 — 56-module SPA を `(app)` client route へ移植  `[SHARED]` (Phase 1・最大／タブ毎に再分割推奨)
- **目的**: 7タブのゲーミフィ App（practice/review/exam/chat/dashboard/formulas/settings）を React 化。offline + a11y を保持。
- **対象ファイル**: `web/app/(app)/layout.tsx`, `web/app/(app)/*/page.tsx`, `web/components/**`(`web/src/ui/*`,`web/src/views/*` 由来), `web/lib/progress/provider.tsx`。
- **実装してほしい内容**: `LocalProgress`(`web/src/store.ts` から無改変 import)を client provider で wrap。`views/*` の render 関数を component 化。streak/XP/stats を SSR-safe `mounted` guard（hydrate まで skeleton）。`aria-live`・`mathToSpeech`・focus 移動・`role=tab`/矢印ナビを保持。
- **変更してはいけない範囲**: `lib/**` 純ロジック・`web/src/store.ts`/`backup.ts` の挙動を変えない。localStorage 由来値を SSR しない。
- **完了条件**: (1) 全7タブが描画され offline で解答記録できる（ローカルのみ）。(2) hydration mismatch 警告なし・各タブ axe clean。
- **テスト/確認方法**: `next build`, offline 手動スモーク, `vitest-axe`/Playwright a11y。
- **期待する出力**: App Router 上の機能等価 SPA。

## T05 — Serwist offline SW  `[SHARED]` (Phase 1)
- **目的**: 手書き `sw.js` を Next のハッシュ済チャンク precache manifest に置換。
- **対象ファイル**: `web/sw/index.ts`(serwist source), `web/next.config.ts`(`withSerwist`), `web/app/manifest.ts`, `web/sw.js` 削除。
- **実装してほしい内容**: app shell を cache-first precache + `problems.json` を SWR + offline fallback(`/~offline`)。`build-web.ts` の SW stamping を退役。**Next16: `next build --webpack`、Vercel 向けに `minimatch` 依存追加**。
- **変更してはいけない範囲**: アセット list をハードコードしない。API/auth/stripe route をキャッシュしない。
- **完了条件**: (1) 初回訪問後に完全 offline 起動。(2) 新デプロイで stale precache が固着しない。
- **テスト/確認方法**: Chrome DevTools offline, Lighthouse PWA。
- **期待する出力**: 自動 revision の offline SW。

## T06 — nonce-CSP proxy + session refresh  `[ADDITIVE-SAFE]` (Phase 1)
- **目的**: Next hydration + Supabase/Anthropic と両立する strict CSP を復活。
- **対象ファイル**: `web/proxy.ts`(Next16 で middleware 改名・Node runtime), `web/lib/supabase/{server,browser,middleware}.ts`。
- **実装してほしい内容**: per-request nonce; `script-src 'self' 'nonce' 'strict-dynamic'`; `connect-src` allowlist（Supabase http+ws, Stripe, Anthropic, self）; 同一 proxy で Supabase session cookie を refresh。`await headers()` で nonce 参照。
- **変更してはいけない範囲**: `script-src` に `unsafe-inline` を足さない。`connect-src` を allowlist 超で広げない。
- **完了条件**: (1) 全タブで CSP violation がコンソールに出ない。(2) reload 跨ぎで session 維持。
- **テスト/確認方法**: DevTools console; proxy unit test（header に nonce + allowlist を含む）。
- **期待する出力**: nonce CSP + session 配線。

## T07 — CI/deploy: verify + post-build secret scan + Vercel  `[SHARED]` (Phase 1)
- **目的**: 品質ゲート維持、Pages→Vercel、Next 下で秘密 guard。
- **対象ファイル**: `package.json`(scripts), `scripts/scan-bundle-secrets.ts`(新, esbuild guard 置換), `.github/workflows/*`(pages 撤去・verify job 追加), `vercel.json`。
- **実装してほしい内容**: `build:web`→`next build`; `.next/static/**` を 5 needle（`service_role`/`SUPABASE_SERVICE_ROLE`/`SUPABASE_JWT_SECRET`/`STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`）で fail する scan; デプロイは `npm run verify` gate 配下。
- **変更してはいけない範囲**: `verify` から `validate:data`/`typecheck:web`/`test` を落とさない。verify 無しでデプロイしない。
- **完了条件**: (1) `npm run verify` が `next build`+secret scan を通って pass。(2) client component に `STRIPE_SECRET_KEY` を注入すると scan が fail。
- **テスト/確認方法**: ローカル verify; 秘密を仕込む negative test。
- **期待する出力**: 緑 CI + Vercel デプロイ経路。

## T08 — Marketing LP + pricing（flag-gate CTA）  `[ADDITIVE-SAFE]` (Phase 2)
- **目的**: 公開ファネル入口 + 休眠する pricing。**PR #55 の LP 3案を取り込み統合**。
- **対象ファイル**: `web/app/(marketing)/page.tsx`, `web/app/(marketing)/pricing/page.tsx`, `web/lib/flags.ts`。(PR #55 `web/lp/*` を Next 化して吸収)
- **実装してほしい内容**: 静的 LP + Free/Pro pricing 表。CTA は `NEXT_PUBLIC_BILLING_ENABLED` を読み、OFF なら「準備中/ウェイトリスト」（checkout へは行かない）。価格・お祝い金・年額 push・講座アンカーは `RESEARCH-2026-07.md` §テーマ2 を反映。景表法（優良/有利誤認回避・pre-alpha 明示）を守る。
- **変更してはいけない範囲**: Stripe import はまだしない。閲覧に auth を要求しない。
- **完了条件**: (1) 両ページが静的描画・CSP clean。(2) flag OFF で CTA は checkout に絶対リンクしない。
- **テスト/確認方法**: `next build`; flag 両状態を snapshot。
- **期待する出力**: 公開 LP + pricing。

## T09 — UTM/ファネル計測配線  `[ADDITIVE-SAFE]` (Phase 2)
- **目的**: 休眠 analytics ロジックを再利用して流入を attribution。
- **対象ファイル**: `web/app/api/track/route.ts`(新), `web/lib/analytics/client.ts`(新), `@denken/core/analytics/utm`(`withUtm`/`quizLink`/`parseUtm`) 消費。
- **実装してほしい内容**: first-party same-origin event sink（CSP clean）; landing で UTM parse・attribution 永続; `weekly-review` 3-KPI で reporting。
- **変更してはいけない範囲**: `lib/analytics/*` を変えない。third-party script tag を入れない（CSP strict 維持）。
- **完了条件**: (1) landing で UTM param を捕捉・保存。(2) `/api/track` が CSP violation 無しで event 記録。
- **テスト/確認方法**: `parseUtm` 統合 unit test; 手動 UTM link。
- **期待する出力**: first-party ファネル attribution。

## T10 — Supabase magic-link auth UI + callback  `[ADDITIVE-SAFE]` (Phase 3)
- **目的**: パスワードレス サインイン。休眠安全（未ログインでアプリは動く）。
- **対象ファイル**: `web/app/(auth)/sign-in/page.tsx`, `web/app/api/auth/callback/route.ts`, `web/components/auth/*`。
- **実装してほしい内容**: magic-link 要求フォーム + callback で code 交換（PKCE）; 未ログイン = ローカルのみ（不変）。**server は `getUser()` を使う（`getSession()` 禁止）**。lab-lms の `@supabase/ssr` パターンを翻案。
- **変更してはいけない範囲**: 既存タブに auth を強制しない。ローカル利用を gate しない。
- **完了条件**: (1) magic link で sign-in・session 維持。(2) サインアウト状態でローカル機能が完全維持。
- **テスト/確認方法**: local Supabase auth; 手動 round-trip。
- **期待する出力**: 動く magic-link auth。

## T11 — store seam `createStoresForClient(authedClient)`  `[SHARED]` (Phase 3)
- **目的**: NULL-`auth.uid()` seam を修正し RLS を per-user で効かせる。
- **対象ファイル**: `lib/store/supabase-store.ts`, `web/lib/supabase/service.ts`(新, `server-only`), `tests/store/supabase-store.test.ts`。
- **実装してほしい内容**: `createStoresForClient(client)` を追加（全 store を返す）; service-role/CLI 用に `createSupabaseStores(url,key)` は残す。server helper は `@supabase/ssr` で authed client を作る。
- **変更してはいけない範囲**: mapper のフィールド semantics はここで変えない（T12 が担当）。`createSupabaseStores` の既存 signature を壊さない。
- **完了条件**: (1) authed client から作った store がそのユーザーとして query（mock 可能）。(2) 既存 store テスト緑のまま。
- **テスト/確認方法**: authed client 使用を assert する unit test; `npm test`。
- **期待する出力**: per-user store factory。

## T12 — migration `0007` + FSRS 無損失 mapper  `[SHARED]` (Phase 3)
- **目的**: FSRS `state`/`stability`/`difficulty` を永続化し ts-fsrs Card を無損失往復。
- **対象ファイル**: `supabase/migrations/0007_review_states_fsrs.sql`(新), `lib/store/supabase-store.ts`(`reviewStateToRow`/`rowToReviewState`+`ReviewStateRow`), `tests/store/supabase-mappers.test.ts`。
- **実装してほしい内容**: `state smallint`(+任意 `scheduled_days`,`elapsed_days`) を backfill→制約の順で追加（0004 パターン踏襲）; mapper を read/write 拡張（`state` を再導出しない）。
- **変更してはいけない範囲**: 既存列を落とさない。この migration で RLS policy を変えない。zod 検証挙動を保つ。
- **完了条件**: (1) ts-fsrs Card→row→Card が `state/stability/difficulty` 保持で往復。(2) backfill が SET NOT NULL に先行。
- **テスト/確認方法**: 新 mapper 往復 test; `rls-mock` 風の順序 assertion。
- **期待する出力**: 無損失 FSRS 永続化。

## T13 — SyncEngine(pull/push) + `api/sync/*`  `[SHARED]` (Phase 3)
- **目的**: merge policy 再利用のクラウド同期。休眠安全。
- **対象ファイル**: `web/lib/progress/sync.ts`(新, `{cards,logs}` を突合), `web/app/api/sync/{pull,push}/route.ts`, `tests/sync/merge.test.ts`。
- **実装してほしい内容**: merge policy を store レベルで再実装（logs は `topic|atMs|problemId` dedup、review は最新 `lastReviewMs` で LWW）; push: logs→`answer_logs`、cards→`review_states`; pull: サーバ→ local へ merge + `clearDerivedCaches()`。**ログイン + pro(T16 で配線) + online の時だけ**動く。
- **変更してはいけない範囲**: offline single-user 挙動を変えない。未ログインで同期しない。
- **完了条件**: (1) 2端末が dup log/review 消失なく収束。(2) 未ログイン経路が不変（ネットワーク無し）。
- **テスト/確認方法**: 決定論 merge unit test（conflict ケース）; 手動 2-profile 同期。
- **期待する出力**: 冪等 双方向 同期。

## T14 — `EntitlementStore` interface + impl  `[ADDITIVE-SAFE]` (Phase 4)
- **目的**: tier のストレージ抽象。
- **対象ファイル**: `lib/store/entitlement-store.ts`(新), `tests/store/entitlement-store.test.ts`。
- **実装してほしい内容**: `EntitlementStore` interface + `Entitlement` 型（`ARCHITECTURE.md §A.3`）; `InMemoryEntitlementStore` + `SupabaseEntitlementStore`（authed `get`; service-role `upsert`/`byStripeCustomer`）。
- **変更してはいけない範囲**: ここで Stripe 型に結合しない。`@denken/core` 内に留める。
- **完了条件**: (1) in-memory impl が get/upsert/byStripeCustomer test を通る。(2) `@denken/core` に Stripe import が無い。
- **テスト/確認方法**: `npm test`。
- **期待する出力**: entitlement ストレージ層。

## T15 — migration `0006` entitlements + billing_events + 不変条件テスト  `[ADDITIVE-SAFE]` (Phase 4)
- **目的**: RLS 不変条件を満たす DB テーブル。
- **対象ファイル**: `supabase/migrations/0006_entitlements.sql`(新), `tests/supabase/rls-mock.test.ts`(拡張)。
- **実装してほしい内容**: `ARCHITECTURE.md §A.3` のテーブル（own-row SELECT; service-role 書き; `billing_events` deny-all）。不変条件テストを拡張し entitlements の select-own をモデル化 + **policy 無し RLS 有効の service-role テーブルを許容**。
- **変更してはいけない範囲**: `using(true)` 禁止。entitlements に user write policy を足さない。既存テーブルの policy を弱めない。
- **完了条件**: (1) 不変条件テストが entitlements の RLS + own-row SELECT + user write 無しを assert。(2) `billing_events` が RLS on + user-accessible policy ゼロ。
- **テスト/確認方法**: `vitest tests/supabase`。
- **期待する出力**: billing schema + 緑の不変条件。

## T16 — `resolveEntitlement()` + flag + provider/hook + gate 配線  `[SHARED]` (Phase 4)
- **目的**: サーバ真実源の entitlement 解決 + client mirror + フリーミアム gate。
- **対象ファイル**: `web/lib/entitlement/{resolve.ts,provider.tsx,use-entitlement.ts}`, `web/lib/flags.ts`, gate 呼出し点（適応 select 経路・`api/sync/*`・deep-explanation render）。
- **実装してほしい内容**: `resolveEntitlement(userId,{flag})` は `BILLING_ENABLED=false` で `ENTITLEMENT_DEFAULT` に短絡; `useEntitlement().can(feature)` mirror; フリーミアム表を具体 gate に写像（1問/日・適応 on/off・同期 on/off）。
- **変更してはいけない範囲**: client mirror を security 境界にしない。CC-BY-SA データ読み/ backup export を gate しない。
- **完了条件**: (1) flag OFF → 全ユーザーが既定 tier に解決（挙動変化なし）。(2) 強制 `pro` grant で 適応+同期+深い解説 が解放、`free` で制限。
- **テスト/確認方法**: resolver × flag matrix unit test; 手動 gate 切替。
- **期待する出力**: 既定休眠の entitlement gate。

## T17 — Stripe checkout + portal route（server-only）  `[ADDITIVE-SAFE]` (Phase 5)
- **目的**: test mode のサブスク購入 + 管理。
- **対象ファイル**: `web/lib/stripe/server.ts`(`server-only`), `web/app/api/stripe/{checkout,portal}/route.ts`。
- **実装してほしい内容**: Checkout Session 生成（subscription, `STRIPE_PRICE_ID`, `client_reference_id`+`metadata.user_id`）; `stripe_customer_id` を service-role upsert; customer portal session。flag OFF で no-op/非表示。lab-lms の Stripe パターンを翻案。
- **変更してはいけない範囲**: client bundle に秘密を出さない（`server-only`）。live キー禁止。
- **完了条件**: (1) authed user 向けに test-mode checkout URL を生成。(2) secret scan(T07) 通過。
- **テスト/確認方法**: Stripe test mode + Stripe CLI; route unit test。
- **期待する出力**: checkout + portal（test mode）。

## T18 — Stripe webhook → entitlement upsert（冪等・署名検証）  `[ADDITIVE-SAFE]` (Phase 5)
- **目的**: Stripe event を安全に entitlement へ。
- **対象ファイル**: `web/app/api/stripe/webhook/route.ts`(node runtime, raw body), `scripts/scan-bundle-secrets.ts`(Stripe needle 追加), `tests/stripe/webhook.test.ts`。
- **実装してほしい内容**: `constructEvent(rawBody,sig,secret)`; `billing_events.event_id` で dedup; user 解決（`metadata.user_id`→`byStripeCustomer`）; service-role `entitlementStore.upsert`; event: `checkout.session.completed`,`customer.subscription.{updated,deleted}`,`invoice.payment_failed`。**proxy matcher から本 route を除外**。
- **変更してはいけない範囲**: 未署名 payload を信用しない。client から entitlement を書かない。live キー禁止。
- **完了条件**: (1) 無効署名 → 400・書込みなし。(2) 重複 `event_id` → entitlement 書込みは1回（冪等）。
- **テスト/確認方法**: Stripe CLI `trigger`; 署名/冪等 unit test。
- **期待する出力**: 安全な休眠 webhook。

## T19 — Satori シェア画像 + 招待  `[ADDITIVE-SAFE]` (Phase 6)
- **目的**: 休眠 share-card ロジック再利用のバイラルループ。
- **対象ファイル**: `web/app/api/share/[kind]/route.tsx`(`@vercel/og`/Satori), `@denken/core/share-card`(`cardText`,`hasPii`) + `analytics/utm`(`quizLink`) 消費。
- **実装してほしい内容**: `cardText(kind, StudyRecord)`（`streak|daily|weekly`）から OG 画像を `hasPii` guard 付きで render; 招待 link は `quizLink`。
- **変更してはいけない範囲**: `lib/share-card/*` を変えない。既存 guard で PII/URL を除去。
- **完了条件**: (1) 各 kind で画像 render。(2) `hasPii` 出力が絶対 embed されない。
- **テスト/確認方法**: route snapshot; PII guard unit test。
- **期待する出力**: シェア可能画像 + 招待 link。

## T20 — コンテンツ pipeline publish 経路  `[SHARED]` (Phase 7)
- **目的**: 「無限 類題」を実在庫（有料価値）で裏付ける。
- **対象ファイル**: `scripts/publish-problems.ts`(新), `lib/engine/*` + `lib/store`(`problems` を `status='published'` で upsert) 消費。
- **実装してほしい内容**: engine → validate(`lib/engine/gate.ts`) → service-role で `problems` を published upsert; 公開読み RLS 維持。main は既に 996 問 → validated 昇格の導線を敷く。
- **変更してはいけない範囲**: CC-BY-SA データを paywall で gate しない。`validate:data` を bypass しない。
- **完了条件**: (1) validated 問題が `status='published'` で着地し anon 読み可能。(2) published set で `validate:data` 通過。
- **テスト/確認方法**: dry-run publish; RLS 公開読み確認。
- **期待する出力**: 無限練習を支える問題在庫。

---

## 依存グラフ（dispatch 順）
```
T01
 └ T02 ─ T03 ─ T04
              ├ T05
              ├ T06 ─ T07
              └ (Phase2) T08, T09
T06 ─ (Phase3) T10 ─ T11 ─ T12 ─ T13
                              └ (Phase4) T14 ─ T15 ─ T16
                                                  └ (Phase5) T17 ─ T18
T04 ─ (Phase6) T19
T13,T16 ─ (Phase7) T20
```
> 各 T を `/goal` に渡す時は本セクションを単体ファイルに切り出してもよい（`G01-base-branch.md` 等）。design-only の本 PR では 1 ファイルに集約。
