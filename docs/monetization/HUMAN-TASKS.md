# 収益化フェーズ 人間タスク（DENKEN-OS）

> 既存 `docs/strategy/human-tasks.md`（立ち上げ全般）の **収益化・課金レイヤー特化の差分**。
> コード・AI では肩代わりできず、**本人が手続き/判断/承認する必要がある**ものに絞る。
> 課金基盤は「休眠(flip 可能)」で実装されるため、下記の多くは **本番化(flip ON)の直前まで不要**。フェーズ順に並べる。
> 分類: **[必須]**=法的義務/技術前提 **[推奨]**=防御的 **[確認]**=該当性判断（専門家確認推奨）。
>
> ⚠️ 本書はコンプラ**調査**であり法的助言ではない。特商法/景表法/ライセンス→**行政書士・弁護士**、税務→**税理士** に launch 前確認を推奨。

---

## フェーズ A — 実装〜検証（休眠のまま・アカウントだけ先に）

課金は flag OFF/test mode なので、下記は「基盤を通しで検証する」ための最小手続き。

- [ ] [必須] **Supabase プロジェクト作成**（無料枠可）。`SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` を取得。Auth → URL Configuration に **Redirect URLs（`/auth/callback`）と環境別 Site URL** を登録（登録漏れは session が黙って落ちる）。
- [ ] [必須] **Stripe アカウント（test mode で開始）**。`sk_test_` / `price_…(test)` / `whsec_…(test)` を発行。Product=「Pro 月額」を test で作成。Stripe CLI で `stripe listen --forward-to .../api/stripe/webhook` を回して webhook を検証。
- [ ] [必須] **Vercel プロジェクト作成 + GitHub 連携**。env（NEXT_PUBLIC_* と server secret）を Vercel 側に登録。プレビューデプロイで動作確認。
- [ ] [確認] **本番 Anthropic API の商用再利用可否**を利用規約で確認（問題生成/解説を有料機能で使うなら）。
- [ ] [推奨] **価格の初期仮決め**（本番前でも LP の pricing 表示に要る。フェーズ B で確定）。

## フェーズ B — 価格・オファー設計（人間の意思決定）

- [ ] [必須] **月額/年額の価格決定**。アンカー = 電験の参考書/通信講座コスト（数千円〜十数万円）。「参考書◯冊より安い」の文脈化（`docs/strategy/ideas/02-app-growth.md` #93）。
- [ ] [確認] **フリーミアム線引きの最終確定**（設計の既定: 無料=1問/日・固定問題・要点/シェア画像、有料=無限類題・適応・深い解説・同期）。カニバリ回避（`docs/x-strategy/07-monetization-failure-hedge.md`）。
- [ ] [推奨] **early-bird / 合格保証 / 返金** 方針の決定（初課金障壁を下げる。安売り感は出さない）。
- [ ] [必須] **課金開始タイミングの判断**（原則: 合格 or 一定規模の後 = flag ON の GO 判断）。**これは人間のみのゲート**。

## フェーズ C — 本番化（flip ON）の直前 = 法務・事務（ここが重い）

> flag を ON にして実課金を始める前に、下記の **[必須]** を満たす必要がある。

### 特定商取引法（通信販売・2022改正）
- [ ] [必須] **「特定商取引法に基づく表記」ページを作成・掲示**（フッター等から容易に到達）。掲載: 事業者氏名・住所・連絡先、販売価格(税込)、支払時期/方法、役務提供時期、申込みの撤回/解除条件、返品特約。
  - 出典: 消費者庁 通信販売 https://www.no-trouble.caa.go.jp/what/mailorder/
- [ ] [必須] **氏名は戸籍上の本名**（または法務局で**商号登記**した屋号）。開業届の屋号・サイト名だけでは不可。
  - 出典: https://houmu931.jp/column/tokuteisyoutorihikihou-notation/
- [ ] [確認] 自宅住所を出したくない → **バーチャルオフィス**住所の記載可否を検討（連絡が確実に取れる措置が条件）。電話番号は「請求あれば遅滞なく開示」スキームの検討。
  - 出典: https://virtualoffice1.jp/virtualoffice_blog/specified-commercial-law/ / https://www.no-trouble.caa.go.jp/what/mailorder/advertising.html
- [ ] [必須] **申込み最終確認画面に6項目を一覧表示**（分量/自動更新の旨・各回代金と総額・支払時期方法・提供時期・申込期限・解約条件）。改正法12条の6。
  - 出典: https://www.it-houmu.com/archives/2178
- [ ] [必須] **「お試し」「いつでも解約」等で定期契約でないと誤認させない**（違反で消費者に取消権 + 行政処分）。
  - 出典: https://compliance-ad.jp/info/2022/
- [ ] [必須] **デジタルの返品不可を明示**（明示しないと法定8日返品が適用されうる）。

### 解約・自動更新（消費者契約法）
- [ ] [必須] **解約導線を申込みと同等に容易に**。解約手段/受付時間を限定するなら開示。
  - 出典: https://compliance-ad.jp/control/2025/
- [ ] [推奨] 自動更新/無料→有料切替は **ボタン付近に明記 + 切替前の案内メール**。規約の奥に隠さない。
  - 出典: https://ec-houmu.com/contract/jidou-keizoku
- [ ] [必須] **プライバシーポリシー + 利用規約**を作成（UGC 問題の権利処理、学習データの扱い、解約情報提供の努力義務を含む）。

### 税務・事業
- [ ] [必須(罰則なし)] **開業届**を事業開始から1ヶ月以内に税務署へ。
  - 出典: https://www.freee.co.jp/kb/kb-kaigyou/by-when/
- [ ] [推奨] **青色申告承認申請書**を開業から2ヶ月以内（同時提出が確実）。最大65万円控除・赤字繰越。
  - 出典: https://www.nta.go.jp/taxes/tetsuzuki/shinsei/annai/shinkoku/annai/09.htm
- [ ] [確認] **インボイス登録は任意**。B2C デジタルサブスク中心なら**登録しない**のが基本（登録すると1000万以下でも消費税・事務負担）。事業者顧客が増えるなら2割特例含め再検討。
  - 出典: https://www.nta.go.jp/taxes/shiraberu/zeimokubetsu/shohi/keigenzeiritsu/invoice_kojin_01.htm
- [ ] [必須(Stripe要件)] **Stripe 本人確認**（ビジネスタイプ=個人事業主、本人名義口座、本人確認書類）。確認完了まで入金保留。
  - 出典: https://support.stripe.com/topics/verification
- [ ] [確認] 通常のカード継続課金は**前払式支払手段に非該当** → 資金決済法の届出は通常不要。ただし**事前購入型ポイント/回数券を導入するなら該当しうる**（有効期限6ヶ月未満で適用除外検討、未使用残高1000万超で供託）。
  - 出典: https://topcourt-law.com/new_business/subscription-service / https://www.s-kessai.jp/businesses/prepaid/q_and_a/
- [ ] [推奨] **事業用銀行口座**の整備、会計ソフト導入（記帳の日常化）。

## フェーズ D — マーケ/アフィリ（ブリッジ収益・ステマ規制）

- [ ] [必須] **ステマ規制（2023/10 施行）**: 自サイト/SNS の宣伝に「広告/PR」を**明瞭表示**。広告主本人の投稿・自サイト誘導も対象。
  - 出典: https://www.caa.go.jp/policies/policy/representation/fair_labeling/stealth_marketing
- [ ] [必須] **アフィリエイトリンク記事に #PR/広告 明示** + 優良誤認/有利誤認を避ける。ASP（A8等）の PR 表記運用基準に従う。虚偽レビュー禁止。
  - 出典: https://a8pr.jp/2023/08/31/fairlabeling/ / https://support.a8.net/ec/policy/pr-notation/
- [ ] [推奨] **アフィリエイト登録**（Amazon アソシエイト等 — 参考書/電卓）で在庫リスクゼロのブリッジ収益を先に検証。

## 恒常 — ライセンス/コンテンツ（設計に組込み済だが人間が最終確認）

- [ ] [必須] **CC-BY-SA-4.0 の帰属(BY)+継承(SA)を保つ**。課金対象は**サービス**（適応・同期・無限・解説UI・会員機能）で、**CC-BY-SA データ本体を専有/クローズド化しない**（追加制限は不可）。
  - 出典: https://creativecommons.org/licenses/by-sa/4.0/legalcode.en / https://tyc.rei-yumesaki.net/material/corpus/cc-by-sa/
- [ ] [必須] **電験過去問の改題は出典明記 + 改題明記**（年度・期・試験区分）、教育目的の範囲。
  - 出典: https://www.shiken.or.jp/chief/third/qa/
- [ ] [推奨] **監修者（合格者/技術士）を1〜2名確保**（品質と権威ギャップを同時に補完。有料コンテンツの信頼の核）。
- [ ] [判断] **問題の published 承認 / 訂正の承認**（人間のみ。有料在庫の品質ゲート）。

---

## 依存関係サマリ（何を先にやるか）
1. フェーズ A のアカウント3つ（Supabase/Stripe test/Vercel）→ 基盤検証に必要。**今すぐ着手可**。
2. フェーズ B の価格/線引き/GO 判断 → LP 完成前に仮決め、flip 前に確定。**人間の意思決定**。
3. フェーズ C の法務一式 → **flip ON の直前に必須**（それまでは休眠なので猶予あり）。専門家確認を挟む。
4. フェーズ D は ブリッジ収益を早く回すなら先行可（課金 flip とは独立）。

> **重要**: 課金基盤が「休眠 flip 可能」で実装されるおかげで、重い法務（フェーズ C）は**合格/規模到達まで先送りできる**。
> これは戦略doc『課金は合格 or 一定規模の後』と整合し、立ち上げ期の「処理能力超過」を避ける設計上の狙い。
