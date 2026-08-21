# 収益化 深堀調査 — 100 アイデア（2026-07）

> DENKEN-OS を「収益化できる状態」まで作るための**不足事項に特化**した深堀調査。既存の 400+ アイデア
> （`docs/strategy/ideas/`, `docs/x-strategy/`）と重複させず、**課金基盤・価格・コンバージョン・技術実装・法務**の
> ギャップを 10 テーマ × 10 = 100 で埋める。WebSearch による一次調査（SaaS/edtech ベンチマーク・Stripe/Supabase/Next 公式・日本法令）を裏取りに使用。
>
> **採点凡例**: `I`=Impact（H/M/L）, `F`=Fit（この製品への適合 H/M/L）, `E`=Effort（S/M/L）。★=次ターン実装の最優先候補。
> 数値・価格は調査時点の目安。**公開前に live ページで再確認**（特に ¥ 価格）。

---

## テーマ1. フリーミアム境界 & メータリング

1. ★ **無料は「1問/日」メーター、有料は無限類題** を厳守（既定線引き）。ハードペイウォールは初期に 80–90% を落とすが、メーター式は低意欲層を残す。`[I=H F=H E=S]` — revenuecat / 07-monetization-failure-hedge.md
2. **edtech の freemium→paid は 2.6–3.7%** が現実値（SaaS 全体 5% より低い）。財務は **2–3%** で設計、超過は上振れ扱い。`[I=H F=H E=S]` — firstpagesage
3. **Duolingo でも課金は MAU の ~8%**。8% を天井、3–5% を実務目標に。ペイウォール小細工より engagement で稼ぐ前提。`[I=M F=H E=S]` — contextsdk
4. ★ **弱点診断を「aha かつ有料境界」に置く**。診断は無料で見せ、**適応ドリル集を gate**（"Weakness Conqueror" 型）。パーソナライズが無料↔有料の最明確な差。`[I=H F=H E=M]` — oyelabs
5. **課金は価格でなく製品の問題**。無料枠の制限を「フロー中に感じさせる」— 1問/日の上限に**熱中中に**当たる設計。`[I=H F=H E=M]` — oyelabs
6. **深い解説・解法導出を有料に**、要点は無料（`docs/x-strategy/07`）。render gate（RSC）で分岐。`[I=M F=H E=S]`
7. **学習記録/進捗の蓄積 + クラウド同期を有料**（`api/sync/*` を pro でのみ）。ローカルは無料で完全動作（休眠安全）。`[I=H F=H E=M]`
8. **シェア画像は無料のまま**（バイラルの燃料 = 課金より集客価値が上）。gate しない。`[I=M F=H E=S]`
9. **CC-BY-SA データ本体は gate しない**（ライセンス上 追加制限 不可）。課金は**サービス**（適応/同期/無限/解説UI/サポート）に対して。`[I=H F=H E=S]` — CC-BY-SA 4.0 legalcode
10. **無料枠の上限に達した瞬間にだけ upsell**（アプリ起動時でなく、1問解いた直後 / 診断結果表示直後 = peak-intent）。`[I=H F=H E=S]` — contextsdk

## テーマ2. 価格設計 & アンカリング

11. ★ **予備校/通信講座にアンカー**（電験講座は ¥33,000 日建 → ¥74,000 ユーキャン → ¥117,700 アガルート → ¥200,000 TAC）。¥980–1,480/月 は「¥10万講座より桁違いに安い」。`[I=H F=H E=S]` — agaroot
12. **参考書コストを第2アンカー**に（完全マスター4冊×¥3,630 + 数学 + 過去問 = 独学で ¥20,000–40,000 紙代）。年額 Pro（~¥9,800–14,800）=「参考書より安く、適応する」。`[I=H F=H E=S]` — ohmsha
13. ★ **Studyplus の実価格点を踏襲**（Premium ¥980/月 or ¥7,900/年、Basic ¥600/月 or ¥4,800/年）。JP 学習アプリの実証済み WTP。`[I=H F=H E=S]` — edtechzine
14. **年額を強く push（実質2ヶ月無料 framing）**。Studyplus 年額=月額8.06ヶ月分。試験は季節性 → 試験サイクルに合わせた年額が LTV と心理の両方に効く。`[I=H F=H E=S]` — edtechzine
15. **STUDYing のコスト構造ストーリーを流用**（校舎なし・紙なし・広告少 → 価格に還元）。ソロ開発の限界費用ほぼゼロも同じレバー。「構造的に安い、品質は落とさない」。`[I=M F=H E=S]` — fukugyo-shindanshi
16. ★ **STUDYing は電験を扱っていない = 空きスロット**。オンライン適応の電気主任技術者枠はカテゴリ王者不在 → ¥19,800 巨人との正面衝突が無い。`[I=H F=H E=S]` — studying lineup
17. ★ **合格お祝い金（cash-back / 無料月）**を導入。価格を「条件付き返金」に見せ購入をデリスク、**合格 testimonial** を生成（狭いニッチで最強の社会的証明）。`[I=H F=H E=M]` — kiryusblog
18. **early-bird は 3–6ヶ月の窓 → 新規のみ値上げ**。早期採用者は grandfather（据置）で retention moat。「永年」を約束するなら厳守。`[I=M F=H E=M]` — payproglobal
19. **値上げは legacy の ~5% に先行ロールアウト**し「価値の再評価」で framing。移行後48hは決済 fraud 誤検知に注意。`[I=L F=M E=M]` — payproglobal
20. **合格実績が溜まったら値上げ**（`02-app-growth.md` #100）。実績＝値付けの正当化。`[I=M F=H E=S]`

## テーマ3. コンバージョン & アクティベーション（Aha）

21. ★ **サインアップは「最初の1問を解いた後」まで遅延**（Duolingo の最大の勝ち筋 = D1 retention +20%）。アカウント壁の前に1問解かせる。`[I=H F=H E=M]` — junoschool
22. ★ **time-to-value < 5分**。起動 → 実電験問題を1問 → 「あなたの弱点は X」表示、セットアップ無し。`[I=H F=H E=M]` — junoschool
23. **reverse trial を検討**（N日フル Pro → 1問/日 無料へ自動降格）。締め出さないまま +10–40% conversion。「適応を体験させてからメーター化」に合致。`[I=H F=M E=M]` — thegrowthmind
24. **trial を張るなら 2–4週間**（17–32日 trial は median 45.7% vs 3–7日 26.8%）。適応/弱点機能への露出時間が課金判断を作る。`[I=M F=M E=S]` — airbridge
25. **trial 込みペイウォール画面 > 機能羅列**（A/B の 64.5% で勝ち）。flip 時は trial offer を画面に。`[I=M F=M E=S]` — airbridge
26. **23% の freemium 転換は install 6週間後以降**。低意欲層を残す 1問/日 は正しい。焦って hard paywall にしない。`[I=M F=H E=S]` — revenuecat
27. **behavior-triggered nudge で conversion ~2倍**（Toppr +133%、Testbook +15%）。「力率を3回落としています」等を課金 prompt に配線。`[I=H F=M E=M]` — webengage
28. **オンボーディングを発信コンテンツ兼用に**（`02-app-growth.md` #32）。1本で新規教育と集客。`[I=M F=H E=S]`
29. **初日に必ず「1問解けた成功体験」**を届ける設計を約束（`02-app-growth.md` #34）。activation 率を上げる。`[I=H F=H E=S]`
30. **診断→弱点判明の衝撃を入口体験に**（`02-app-growth.md` #33）。早期 aha = 継続の起点。`[I=H F=H E=M]`

## テーマ4. リテンション & ゲーミフィケーション

31. ★ **streak を Day1 から組込む**（後付け機能にしない）。目標選択 → 7/14/30日 commit → **signup 前に streak 開始**。損失回避が retention エンジン（Duolingo 2026 で DAU +36% YoY）。`[I=H F=H E=M]` — strivecloud
32. ★ **streak freeze（許し）を事前配布**。救えるのは既にポケットにある freeze だけ（lapse したユーザーは買いに戻らない）。streak の backfire 防止。`[I=H F=H E=S]` — deconstructoroffun
33. **月次レポート（Spotify Wrapped 型）**を発信文化に（`02-app-growth.md` #48）。節目の再訪と拡散。`[I=M F=H E=M]`
34. **試験日逆算イベント**を発信×アプリで連動（`02-app-growth.md` #45）。利用密度↑。`[I=M F=H E=S]`
35. **XP/quest/achievements/mascot は main に実装済** → これを課金導線（Pro で XP ブースト等はしない＝pay-to-win 回避、代わりに Pro=無限練習で XP を稼げる幅が広い）に自然接続。`[I=M F=H E=S]`
36. **連続誤答の介入**（既存 `intervention.ts`）を「基礎回帰 + Pro 解説への誘い」に配線。`[I=M F=M E=S]`
37. **leech 検出**（既存 `leech.ts`）で「この論点で詰まっています → Pro の解法動画」導線。`[I=M F=M E=M]`
38. **休眠ユーザーへ Web Push / メールで新機能・試験カウントダウン**（既存 `notify/schedule.ts` を配線）。`[I=M F=M E=M]`
39. **リーグ戦/ランキングのスクショ映え**（`02-app-growth.md` #27）で再訪と投稿。`[I=L F=M E=M]`
40. **「継続が一番すごい」価値観の刷り込み**（`02-app-growth.md` #47）で前向きに戻す。`[I=L F=H E=S]`

## テーマ5. ブリッジ収益（課金 flip 前に回す）

41. ★ **課金が眠る間もアフィリ送客で稼ぐ**。電験講座は ¥10万+ なので **アフィリ送客レッグだけで初期はサブスクを上回りうる**。アガルート/TAC/ユーキャンへの導線を今から。`[I=H F=H E=M]` — jp-wat
42. ★ **Amazon アソシエイト「電験二種 必携リスト」ページ**（完全マスター×4 + 関数電卓 + 過去問）。**¥1,000 上限は 2024/8 撤廃** → ¥3,630 参考書・¥5,000+ 電卓が uncapped。`[I=M F=H E=S]` — affiliate.amazon.co.jp
43. **note 有料記事 ¥1,000–2,500**（教育帯）で需要を低リスク検証（「二次 論説 頻出テーマまとめ」）。手数料 10%+カード5%。`[I=M F=H E=S]` — sungrove
44. **note 買切マガジンは ¥1,980 or ¥2,980**（平均 ¥2,553、median より上に置く）。1年分の問題 PDF に。`[I=M F=M E=S]` — note
45. **note 定期購読は使わない**（手数料20%・価格 launch 後ロック）。recurring は自前 Stripe に。note は単発デジタル物のみ。`[I=M F=H E=S]` — yukemuri-blog
46. ★ **広告除去/過去問 pack unlock の micro-monetization**（過去問道場は 100%無料+広告で 85万+ユーザー、ad 除去 ¥880 one-time / 科目 unlock ~¥160、全科目 ¥1,600）。サブスク前の低リスク WTP 検証。`[I=M F=H E=M]` — app-liv
47. **JP 資格アプリの支配的 hybrid = 無料+広告 → 広告除去 → content unlock → 講座送客**。この4段を DENKEN-OS にも敷く。`[I=H F=H E=M]` — jp-wat
48. **Studyplus は三本柱**（広告 targeting / BtoC サブスク / BtoB 校向け ¥750/生徒/月）。「注意 + サブスク + 機関」の複線を将来の柱に。`[I=M F=M E=L]` — firstcvc
49. **法人/スクール向けプラン**を将来の単価跳ね（`02-app-growth.md` #99）。企業の電験取得支援需要。`[I=M F=M E=L]`
50. **合格保証/返金で不安を消す**（`02-app-growth.md` #95）。初課金障壁↓。お祝い金(#17)と統合。`[I=M F=H E=M]`

## テーマ6. Stripe サブスク 実装ベストプラクティス（技術）

51. ★ **webhook は raw body（`await req.text()`）で署名検証**。`request.json()` は再直列化で検証が必ず失敗。`stripe.webhooks.constructEvent(body, sig, secret)`。`[I=H F=H E=S]` — docs.stripe.com/webhooks
52. ★ **webhook route は `export const runtime = "nodejs"`**（Edge は Node crypto 無し）。署名は `headers.get("stripe-signature")`。`[I=H F=H E=S]`
53. ★ **auth proxy matcher から `api/stripe/webhook` を除外**（negative-lookahead）。除外漏れ = "No signatures found" の #1 本番障害。`[I=H F=H E=S]` — vercel/next.js#48885
54. **`checkout.session.completed` で provision、`invoice.paid`/`invoice.payment_failed`/`customer.subscription.updated|deleted` で同期**。必要な event だけ購読。`[I=H F=H E=S]` — stripe SaaS subscriptions
55. ★ **Stripe→app user は Checkout Session の `client_reference_id`（Supabase user.id、≤200字）+ `metadata`**。Portal session は client_reference_id 不可。`[I=H F=H E=S]` — stripe checkout sessions
56. **Stripe customer ID をユーザーに紐付け、Portal は customer ID だけで開く**（+ return_url）。deep link は `flow_data`。`[I=M F=H E=S]` — stripe portal
57. ★ **冪等は `evt_` event ID で dedup**（retry で不変・最大3日 at-least-once）。event ID を PK の台帳（`billing_events`）に。`[I=H F=H E=S]`
58. **side effect の前に event 行を claim（同一 tx 理想）**。crash-after-side-effect の二重適用を防ぐ。downstream は upsert/絶対状態で冪等に。`[I=H F=H E=M]` — hooklistener
59. **2xx を速く返す・順序に依存しない**。処理済み event も 200 で retry を止める。`[I=M F=H E=S]`
60. **test mode: `stripe listen --forward-to .../api/stripe/webhook` の `whsec_` + `stripe trigger …`** で通し検証（休眠のまま完全 exercise）。`[I=H F=H E=S]`

## テーマ7. Supabase Auth & Entitlement（技術）

61. ★ **`@supabase/ssr` の3クライアント分割**（browser / server(RSC・cookie) / proxy）。token は **cookie**（localStorage 不可）+ **PKCE**。`[I=H F=H E=M]` — supabase server-side auth
62. ★ **session refresh を `proxy.ts`（Next16 で middleware 改名・Node runtime）で**。`getUser()` 後に refreshed cookie を request/response 両方へ。欠くと RSC が user を見ない。`[I=H F=H E=M]`
63. ★ **callback/confirm route（`/auth/callback?code=`）で code→session 交換**。最も抜けやすい部品。`[I=H F=H E=S]`
64. ★ **server では必ず `getUser()`（`getSession()` 禁止・cookie spoof 可能）**。`[I=H F=H E=S]`
65. **Auth の Redirect URLs / 環境別 Site URL を登録**（漏れると session が黙って落ちる・prod メールが localhost を指す）。`[I=H F=H E=S]`（人間タスク）
66. ★ **entitlement はサーバ真実源: gate する1テーブル1フィールドを全所で読む**。webhook が別フィールドを更新しアプリが別を gate する古典バグを回避。`[I=H F=H E=M]` — ai-saas-safety
67. ★ **webhook は service-role で書き（RLS bypass）、client は own-row 読み（`auth.uid()=user_id`）**。client に自分の plan を報告させない。`[I=H F=H E=S]`
68. **entitlement を webhook で永続化・毎 request で Stripe を叩かない**（任意で Stripe native Entitlements + `active_entitlement_summary.updated`）。`[I=M F=H E=M]` — stripe entitlements
69. **`subscription.deleted` で明示的にアクセス判断**（即revoke or `current_period_end` まで維持）。gate するのと同じフィールドを書く + 監査ログ。`[I=M F=H E=S]`
70. ★ **休眠課金 = 恒久 disabled-by-default flag（un-gate な dead code ではない）**。全 billing UI/route を `BILLING_ENABLED=false` で gate、**off-state をテスト**。Google Cloud 2025/6 障害は un-flagged dormant code の null-deref が世界規模で発火した反面教師。`[I=H F=H E=S]` — getunleash / cloudbees

## テーマ8. Next.js 16 / PWA / offline / CSP（技術）

71. ★ **Next16 は `middleware.ts`→`proxy.ts`（Node runtime）**。session refresh と nonce-CSP は同一 `proxy.ts` に同居。`[I=H F=H E=S]` — nextjs upgrading v16
72. ★ **Turbopack 既定 → Serwist は `next build --webpack` 必須**（Next16 最大の PWA 罠）。`[I=H F=H E=S]` — serwist / next-16
73. **Vercel で Serwist は `minimatch` を明示依存追加**しないとビルド失敗。`[I=M F=H E=S]` — logrocket
74. ★ **`@serwist/next`（next-pwa 後継・Workbox）で precache manifest 自動注入**。ハッシュ済チャンクを自動 versioning、`runtimeCaching` で SWR。`[I=H F=H E=M]` — serwist
75. **`cleanupOutdatedCaches:true` + `skipWaiting`/`clientsClaim`、手動 precache には明示 `revision`、`/~offline` fallback**。`[I=M F=H E=M]` — serwist#229
76. **dev では SW 無効（`disable: NODE_ENV==="development"`）+ `reloadOnOnline:false`**。検証は `next build && next start` + DevTools Offline。`[I=M F=H E=S]`
77. **static export より Serwist**（visited-while-online route が offline 化・RSC/dynamic を保持）。未訪問 dynamic は offline page fallback。`[I=M F=H E=M]`
78. ★ **nonce CSP を proxy で生成**（`script-src 'self' 'nonce-…' 'strict-dynamic'` + object-src none / base-uri self / frame-ancestors none）。nonce を `x-nonce` header で forward、layout で `(await headers()).get('x-nonce')`。`[I=H F=H E=M]` — nextjs CSP
79. **nonce CSP は dynamic rendering を強制**（view 毎に nonce）。static 部は experimental hash-based CSP。Tailwind/shadcn は `style-src 'unsafe-inline'` を要する実務妥協。`[I=M F=H E=M]`
80. ★ **CSP に Supabase/Stripe を配線**（`connect-src` に `*.supabase.co` + `wss://` + `api.stripe.com` + `api.anthropic.com`、Stripe.js 使うなら `frame-src/script-src https://js.stripe.com`）。redirect Checkout なら frame-src 不要。`[I=H F=H E=S]`

## テーマ9. 法務・コンプラ・ライセンス（本番化 flip の前提）

81. ★ **特商法に基づく表記**（通信販売）を掲示。氏名(本名/商号登記)・住所・連絡先・税込価格・支払/提供時期・撤回解除条件・返品特約。`[必須]` `[I=H F=H E=M]` — 消費者庁
82. ★ **2022改正: 最終確認画面に6項目一覧**（分量/自動更新・各回代金と総額・支払時期方法・提供時期・申込期限・解約条件）。`[必須]` `[I=H F=H E=M]` — it-houmu
83. ★ **「お試し/いつでも解約」等で定期契約でないと誤認させない**（違反=消費者取消権+行政処分）。`[必須]` `[I=H F=H E=S]` — compliance-ad
84. **解約導線を申込みと同等に容易に**（手段/時間限定なら開示）。自動更新は切替前に案内メール。`[必須/推奨]` `[I=H F=H E=M]` — compliance-ad / ec-houmu
85. **デジタルの返品不可を明示**（明示しないと法定8日返品が適用されうる）。`[必須]` `[I=M F=H E=S]`
86. **開業届（事業開始1ヶ月以内）+ 青色申告承認（2ヶ月以内）**。Stripe 運用の技術前提ではないが所得が出るなら。`[必須(罰則なし)/推奨]` `[I=M F=H E=S]` — freee / nta
87. **インボイス登録は任意**、B2C デジタルサブスク中心なら基本 登録しない（1000万以下でも消費税・事務負担）。`[確認]` `[I=M F=H E=S]` — nta
88. **Stripe 本人確認**（個人事業主・本人名義口座・本人確認書類、完了まで入金保留）。`[必須(Stripe)]` `[I=H F=H E=S]` — stripe verification
89. ★ **CC-BY-SA-4.0: 帰属(BY)+継承(SA) を保ち、データ本体に追加制限を課さない**。課金は周辺サービスに。`[必須(ライセンス)]` `[I=H F=H E=S]` — CC legalcode
90. **電験過去問の改題は 出典明記+改題明記**（年度・期・区分）、教育目的の範囲（既存 `04-compliance.md` と整合）。`[必須]` `[I=M F=H E=S]` — 試験センター
91. **ステマ規制（2023/10）: 自サイト/SNS 宣伝に「広告/PR」明瞭表示**。広告主本人の投稿も対象。`[必須]` `[I=H F=H E=S]` — 消費者庁
92. **アフィリ記事に #PR 明示 + 優良/有利誤認回避 + ASP の PR 表記基準遵守**（虚偽レビュー禁止）。`[必須]` `[I=M F=H E=S]` — a8pr
93. **プライバシーポリシー + 利用規約**（UGC 問題の権利処理・学習データの扱い・解約情報提供の努力義務）。`[必須]` `[I=H F=H E=M]`
94. **事前購入型ポイント/回数券を入れると資金決済法に該当しうる**（有効期限6ヶ月未満で除外検討）。通常のカード継続課金は非該当。`[確認]` `[I=L F=M E=S]` — s-kessai
95. **launch 前に専門家確認**（税理士=税務 / 行政書士・弁護士=特商法・景表法・ライセンス）。特に屋号/住所・インボイス要否・CC-SA継承範囲。`[推奨]` `[I=H F=H E=S]`（人間タスク）

## テーマ10. 計測 & グロースループ（収益の PDCA）

96. ★ **first-party `/api/track`（same-origin）で計測**（CSP clean・Plausible/PostHog は connect-src/script 許可要）。`lib/analytics/utm.ts` を LP attribution に再利用。`[I=M F=H E=M]`
97. **追う指標を3つに絞る**（既存 KPI: 保存/リプ往復/フォロー転換 + 収益は 新規登録/activation率/free→paid 転換）。`weekly-review.ts` 再利用。`[I=M F=H E=S]` — 01-roadmap
98. **どの投稿/媒体が install・課金に繋がったか週次レビュー**（UTM 媒体別）。効く媒体に寄せる。`[I=M F=H E=M]` — 02-app-growth #83
99. **無料→有料の転換率を計測し導線を磨く**（`02-app-growth.md` #89）。手前の価値を発信で強調。`[I=H F=H E=M]`
100. **build in public: A/B・失敗施策も発信で共有**（`02-app-growth.md` #85/#90）。学びが信頼と流入と協力者を生む。`[I=M F=H E=S]`

---

## 次ターン実装の最優先候補（★ を impact×fit/effort で抽出）

> 設計 T01–T20（`ARCHITECTURE.md` §C / `goals/`）にほぼ写像済み。研究由来で**特に効く**もの:

| 優先 | アイデア | 対応タスク |
|---|---|---|
| P0 | 1問/日メーター + 弱点診断を有料境界に（#1/#4） | T16 |
| P0 | サインアップ遅延（1問後）+ TTV<5分（#21/#22） | T04/T10 |
| P0 | 休眠 = disabled-by-default flag + off-state テスト（#70） | T16 |
| P0 | webhook raw body/署名/冪等/proxy 除外（#51–#57） | T18 |
| P0 | `@supabase/ssr` 3クライアント + proxy session + getUser（#61–#64） | T10/T11 |
| P0 | Serwist `--webpack` + minimatch + nonce-CSP（#72/#73/#78） | T05/T06 |
| P1 | 価格 = Studyplus 点 + 講座アンカー + 年額 push（#11/#13/#14） | T08（pricing 表示） |
| P1 | 合格お祝い金（#17）+ アフィリ送客レッグ（#41/#42/#47） | T08/T19（＋人間） |
| P1 | streak Day1 + freeze 事前配布（#31/#32） | T04（main の xp/quests に接続） |
| P1 | 特商法6項目 + ステマ #PR + CC-SA 帰属（#81/#82/#89/#91） | 人間タスク（flip 前） |

---

## 出典（一次調査）

**SaaS/edtech monetization**
- Freemium 転換ベンチ / EdTech 2.6–3.7%: https://firstpagesage.com/seo-blog/saas-freemium-conversion-rates/
- Hard/soft/freemium・trial 長さ・trial込みペイウォール: https://www.airbridge.io/en/blog/hard-vs-soft-paywalls
- reverse trial（+10–40%）: https://thegrowthmind.substack.com/p/freemium-free-trial-reverse-trial
- freemium 遅延転換/survivorship: https://www.revenuecat.com/blog/growth/hard-paywall-vs-soft-paywall/
- EdTech 無料→有料レバー・Duolingo 8% MAU: https://oyelabs.com/features-to-convert-free-users-to-paid-in-an-edtech-platform/ / https://contextsdk.com/blogposts/optimizing-subscription-offers-for-edtech-success
- personalized campaign uplift（Toppr/Testbook）: https://webengage.com/blog/how-edtech-companies-increase-student-engagement-revenue/
- Duolingo onboarding/TTV/streak: https://www.junoschool.org/article/duolingo-onboarding-experience/ / https://www.strivecloud.io/blog/gamification-examples-boost-user-retention-duolingo / https://duolingo.deconstructoroffun.com/mechanics/streaks
- 電験講座価格: https://www.agaroot.jp/denken3/column/denken3-correspondence-course/
- 完全マスター価格: https://www.ohmsha.co.jp/book/9784274208249/
- Studyplus 価格/モデル: https://edtechzine.jp/article/detail/3517 / https://www.firstcvc.jp/company/studyplus.co.jp
- STUDYing 低価格モデル/お祝い金/lineup: https://fukugyo-shindanshi.com/studying/reason_for_low_price.html / https://kiryusblog.com/studying-price/ / https://studying.jp/lineup.html
- grandfather/early-bird: https://payproglobal.com/how-to/manage-grandfathering-pricing/
- note 価格/手数料: https://www.sungrove.co.jp/note-paid-article/ / https://note.com/niko_book1990/n/n86f15f4f16e6 / https://www.yukemuri-blog.com/note-paid-articles-market/
- Amazon アソシエイト率/上限撤廃: https://affiliate.amazon.co.jp/help/node/topic/GJ2QX3RTJ9ELJMPP
- JP 資格アプリ monetization（過去問道場/電験アプリ）: https://app-liv.jp/education/kentei/0035/ / https://www.jp-wat.com/column/biz/shikaku-biz/denken3shu-app/

**技術（Next16 / Supabase / Stripe / Serwist / CSP）**
- Stripe webhooks / subscriptions / entitlements / checkout / portal: https://docs.stripe.com/webhooks / https://docs.stripe.com/billing/subscriptions/webhooks / https://docs.stripe.com/billing/entitlements / https://docs.stripe.com/api/checkout/sessions/create / https://docs.stripe.com/customer-management/integrate-customer-portal
- webhook 冪等: https://www.hooklistener.com/learn/webhook-idempotency-and-deduplication / vercel/next.js#48885: https://github.com/vercel/next.js/discussions/48885
- Supabase server-side auth / SSR client / advanced: https://supabase.com/docs/guides/auth/server-side/nextjs / https://supabase.com/docs/guides/auth/server-side/creating-a-client / https://supabase.com/docs/guides/auth/server-side/advanced-guide
- entitlement checklist: https://ofeliacode.github.io/ai-saas-safety/guides/stripe-subscription-access-entitlements-checklist.html
- kill switch / dormant code: https://www.getunleash.io/blog/kill-switches-best-practice / https://www.cloudbees.com/blog/how-disable-code-developers-production-kill-switch
- Serwist next: https://serwist.pages.dev/docs/next/getting-started / https://blog.logrocket.com/nextjs-16-pwa-offline-support/ / serwist#229
- Next CSP / env / server-only: https://nextjs.org/docs/app/guides/content-security-policy / https://nextjs.org/docs/pages/guides/environment-variables / vercel/next.js#41846
- Next 16 release / upgrade: https://nextjs.org/blog/next-16 / https://nextjs.org/docs/app/guides/upgrading/version-16

**日本 法務・コンプラ**
- 特商法 通信販売/広告/最終確認画面: https://www.no-trouble.caa.go.jp/what/mailorder/ / https://www.no-trouble.caa.go.jp/what/mailorder/advertising.html / https://www.it-houmu.com/archives/2178 / https://compliance-ad.jp/info/2022/ / https://compliance-ad.jp/control/2025/
- 特商法表記の書き方/バーチャルオフィス: https://houmu931.jp/column/tokuteisyoutorihikihou-notation/ / https://virtualoffice1.jp/virtualoffice_blog/specified-commercial-law/
- 消費者契約法/自動更新: https://ec-houmu.com/contract/jidou-keizoku / https://www.caa.go.jp/policies/policy/consumer_system/consumer_contract_act/
- 開業届/青色/インボイス: https://www.freee.co.jp/kb/kb-kaigyou/by-when/ / https://www.nta.go.jp/taxes/tetsuzuki/shinsei/annai/shinkoku/annai/09.htm / https://www.nta.go.jp/taxes/shiraberu/zeimokubetsu/shohi/keigenzeiritsu/invoice_kojin_01.htm
- Stripe 本人確認 / 資金決済法: https://support.stripe.com/topics/verification / https://topcourt-law.com/new_business/subscription-service / https://www.s-kessai.jp/businesses/prepaid/q_and_a/
- ステマ規制/アフィリ: https://www.caa.go.jp/policies/policy/representation/fair_labeling/stealth_marketing / https://a8pr.jp/2023/08/31/fairlabeling/ / https://support.a8.net/ec/policy/pr-notation/
- CC BY-SA 4.0 / 電験過去問: https://creativecommons.org/licenses/by-sa/4.0/legalcode.en / https://www.shiken.or.jp/chief/third/qa/

> **注記**: conversion uplift 系はベンダー/分析ブログ由来 = directional。¥価格は調査時点の目安で、**公開前に live ページで再確認**すること。Exa はクレジット切れで WebSearch のみ使用。
