# Changelog

このプロジェクトの主な変更を記録する。形式は [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/)、
バージョニングは [Semantic Versioning](https://semver.org/lang/ja/) に従う。

## [Unreleased]

### 橋渡し収益（C案）— アフィリエイト・note・応援の導線100案深堀りと実装（既定では挙動不変）

[`docs/strategy/ideas/17-bridge-revenue-100.md`](docs/strategy/ideas/17-bridge-revenue-100.md) に
4系統×25=100案を調査・トリアージし、推奨実装セット（約39案）を実装。
**全導線は `web/src/bridge-config.ts` の設定が空の間、一切表示されない（fail-open）。**

#### Added
- **基盤**: `bridge-config.ts`（URL/ID設定）・`bridge.ts`（端末内クリック計測台帳・
  ナッジ頻度制御=アプリ全体1日1件+種類別クールダウン・オプトアウト・UTMファーストタッチ）・
  `lib/bridge/links.ts`（書名→検索結果リンク生成=ASIN陳腐化回避）
- **教材ガイド**（公式タブ）: 一次定番/二次/過去問/実務書＋**電卓は持込規定
  （一般電卓のみ可・関数電卓不可）の解説を必ず併記**。タグ設定時のみアフィリ化＋PR開示バッジ
- **設定タブ**: 応援（寄付）/作者コンテンツ(note/BOOTH)/招待リンク/ご案内オプトアウト/
  計測JSONエクスポート/法的情報（特商法テンプレ・返金特約・アフィリ開示）
- **進捗タブ**: 弱点→演習・要強化科目→強化+攻略note・試験カウントダウン節目カード(100/60/30日)・
  試験後の労いカード（合否に触れない）・月次リキャップ+シェア・学習記録のMarkdown書き出し
- **模試/学習**: 判定後の攻略記事カード・結果→演習回遊・採点後の「深掘り一冊」(閉じたdetails)・
  目標達成時の応援1行（頻度予算内のみ）
- **ペイウォール誠実化**: 無料範囲の明示・本人の積み上げの承認・価格アンカー(config)・
  「今は無料の復習で続ける」逆導線・購入ボタンに placement別UTM+クリック計測
- **シェア**: appUrl設定時に url フィールドへ UTM 付与（本文は不変・バッジ/月次/試験後）
- **文書**: `docs/strategy/monetization-policy.md`（無料保護憲章・寄付とProの区分・返金・
  OSS(MIT)と課金の両立・CC-BY-SA整理・スポンサー基準）・`.github/FUNDING.yml`（コメントアウト設置）
- **計測→意思決定**: `lib/analytics/weekly-review.ts` に導線ファネル節（表示→クリック→CTR）
- テスト15件（fail-open不変条件・頻度制御・台帳・ファーストタッチ・電卓ガイドの正確性ガード）

### 収益化 — フリーミアム基盤（ライセンスキー方式・既定では挙動不変）

戦略 `docs/x-strategy/07`（収益ブリッジ フェーズ3「アプリ フリーミアム」）の実装。
**サーバ・アカウント登録なし**で動くライセンスキー方式を採用し、販売開始手順は
[`docs/strategy/monetization-setup.md`](docs/strategy/monetization-setup.md) に集約。

#### Added
- **ライセンスキー検証** `lib/license/license.ts`: `DENKEN1.<payload>.<sig>` 形式・
  ECDSA P-256 署名を WebCrypto で端末内検証（オフライン動作・公開鍵のみ埋め込み＝偽造不可）。
  期限（JST・exp 当日まで有効）/ sku / 改ざんを検査。
- **プラン判定と無料枠** `web/src/entitlements.ts`: 無料=学習タブの**新しい問題**1日N問
  （既定10・JST日次リセット。復習ドリル・間違いノート・再出題は数えない）、
  Pro=無制限演習＋模試＋スキルドリル。復習・進捗・公式集・質問タブは無料のまま。
- **UI**: 模試タブ/スキルドリルの Pro ゲート（`views/paywall.ts`）・学習タブの残数表示・
  設定タブ「Pro ライセンス」カード（キー適用/削除・購入導線）。
- **販売者CLI**: `npm run license:keygen`（鍵生成・secrets/ は gitignore）/
  `npm run license:issue -- --email ... [--exp YYYY-MM-DD]`（発行＋自己検証）。
- **テスト26件**: 署名ラウンドトリップ・改ざん/期限切れ/別鍵の拒否・日次リセット・
  quota 耐性・**「公開鍵未設定ならゲート絶対不作動」の不変条件**。
- ライセンスキーをバックアップ書き出しに追加（機種変更で失わない。APIキーは従来どおり除外）。

#### 重要な不変条件
- `web/src/monetization-config.ts` の `publicKeyJwk` が `null`（出荷時既定）の間、
  全ゲートが不作動＝**既存ユーザーの挙動は一切変わらない**。販売者が
  `license:keygen` → 公開鍵貼付 → `purchaseUrl` 設定した時点で初めて有効化される。

#### レビュー後の堅牢化（8観点並列レビュー → 検証 → 是正）
- 復習ドリル・間違いノート・再出題（requeue）を無料枠の対象外に（ゲート/カウンタ両方）。
- バックアップ: 空文字ライセンス（削除トゥームストーン）を書き出さない・復元でも
  有効キーを上書きしない。復元直後に `initEntitlements` を再実行（再読込不要で反映）。
- 進行中の模試はロック状態が変わっても再開・完了できる（採点機会を奪わない）。
- 公開鍵 JWK の形状検証（EC/P-256/x/y 必須・秘密鍵 `d` 入り拒否・不正は fail-open）。
  `freeDailyLimit: 0` は「演習も Pro 専用」として機能する（キルスイッチ兼用を解消）。
- `applyLicenseKey` の保存失敗（quota/プライベートモード）で reject せずセッション内解錠。
- 無料枠切れ時にペイウォールカードが2枚重なる表示を解消。起動時のライセンス検証を
  スケルトン描画後へ移動（初期表示を待たせない）。
- レイアウト規約準拠: ライセンス純ロジックを `web/src/` → `lib/license/` へ移動
  （scripts→web の依存を解消）。鍵生成 API を共通化しテストヘルパーも一元化。

### デザイン全面刷新 — 「上質な紙の参考書と朱色の採点ペン」

学習アプリ（`web/`）のビジュアルアイデンティティを、青系の汎用UIから
**生成りの紙地 × 墨の文字 × 朱（テラコッタ）× 明朝の問題文**へ一新。DOM構造・クラス名・挙動は不変。

#### Changed（ビジュアル）
- **デザイントークン刷新**: 紙地 `#f2efe5`（暗: 温黒 `#1f1d19`）・朱アクセント `#a84b26`（暗: `#e59a76`）・
  温色の ok/ng/warn 系。全テキスト系ペアの **WCAG AA (≥4.5:1) をスクリプトで機械検証**（両テーマ・46ペア）。
- **タイポグラフィ**: `--font-serif`（Georgia→ヒラギノ明朝系）を導入し、見出し・**問題文（本試験の問題冊子の趣）**・
  大数字をセリフ/明朝に。h2 に朱の◆マーカー。統計/タイマー系は等幅数字（`tabular-nums`）。
- **コンポーネント**: 主ボタンをフラットな朱に（グラデーション廃止）。金色系（習得中チップ・コンボ）を
  `--gold` 系トークンへ集約。ダークの通知バッジは `--ng-contrast` 導入でコントラスト是正（白文字→墨文字）。
- **ブランド同期**: `icon.svg`（朱地×生成り稲妻）・manifest `theme_color`/`background_color`・
  `theme-color` メタを新パレットへ同期。紙吹雪（`fx.ts`）とデンタマ王冠の宝石（`mascot.ts`）から
  旧パレット色（`#5d83f7` 等）を温色系へ置換。
- **不変条件の維持**: FOUCスクリプト（CSP sha256）バイト無変更・SRI/SWバージョンは `build:web` が再注入・
  print / reduced-motion / フォーカスリング / `palt` / セレクタ網羅（テンプレートリテラル組立クラス含む）を全て保持。

### 品質深掘り第5ラウンド — 検証ゲート実効化・ajv⇄zod parity（挙動不変）

成熟コードベース（4ラウンド済）に対し3系統の並列深掘り監査で約100候補を抽出・トリアージし、
**検証済みで不変条件（挙動・`web/problems.json` バイト・全テスト緑）を壊さない安全項目のみ**を実装。
カタログとトリアージは [`docs/refactoring/round5/`](docs/refactoring/round5/ideas-100.md)。
監査指摘には**誤報が複数含まれ**、実コード検証で却下した（aggregate 最頻誤答の非決定性／BACKUP_KEYS の sound 欠落／数値入力の aria 欠落／設定 setter の未クランプ ＝ いずれも既対応・誤報）。

#### Fixed（根本是正）
- **ajv⇄zod スキーマドリフト是正**: `problem-schema.json`(ajv) に `minLength:1`（id/topic/statement/answer）・
  `minItems:1`（solution）を追加し zod `.min(1)` と一致させた。空文字・空配列を**両検証系で拒否**する
  ドリフトテストを追加（実データ52件は全て非空のため `validate:data` 不変・schema は生成に不使用で problems.json バイト不変）。
- **ドキュメントのドリフト訂正**: 第3ラウンド triage がカバレッジ閾値を「86/77 に床上げ・実装」と記載していたが、
  実体は `vitest.config.ts` の安定フロア（84/76/91/89）のまま。訂正注記を追加し現フロア方針を正とした。

#### Added（検証ゲート・テスト・ベストプラクティス）
- **下限ゲートの testability**: `validate-problems.ts` の `EXPECTED_MIN_FILES` 下限ゲートを純関数 `minFilesGate` に抽出し、
  **失敗パス（51件で fail・全削除で fail）を明示テスト**。「データを削って閾値だけ下げる偽グリーン化」を機械的に防ぐ回帰ピンを追加。
- **RLS 列ガードのカバレッジ**: `rls-mock.test.ts` に migration 0005 の列内容ガード（`topic` 非空 WITH CHECK）の
  純関数モデルと4観点テストを追加（所有ガードと併存することを確認）。
- **PR テンプレ**: 必須CI（validate/secrets-scan/dependency-review/codeql）と任意CI（e2e=非ブロッキング）を明記。

#### Changed（軽微・安全）
- 設定の「1日の目標」入力欄を、クランプ後の実保存値へ再同期（`reviewCap` と挙動統一・保存値は不変）。
- `grade.ts` の冗長な末尾 `.trim()` を削除（`\s+` 全除去後の no-op＝出力バイト同一）。

### リファクタリング第4ラウンド — 重複排除・明確化（挙動不変）

3ラウンド（G1–G9 / RG1–RG8 / 第3ラウンド堅牢化）を経た成熟コードベースに対し、
5系統の並列監査で**挙動を変えない安全な改善のみ**を抽出・トリアージし、高確度の6件を実装。
`web/problems.json` は**バイト不変**、テスト**1362件**全緑、カバレッジ閾値維持（stmts85.6/branch77.9/funcs92.9/lines90.1）。

- **重複関数の排除**: `figures/index.ts` のプライベート `loopFrame()` を削除し、同一実装の
  公開 `primitives.loopFrame`（従来未使用）に配線（SVG出力は完全一致）。
  `web/src/views/practice.ts` のローカル `bar()` を削除し `ui/widgets.ts` の `bar` に統一。
- **共有定数の一元化**: 2ファイルに重複していた選択肢マーク `["①".."⑥"]` を `lib/shared/choices.ts`
  に集約。3ファイルに散在していた保存データキー（`denken:seenLevel` ほか）を `web/src/storage-keys.ts`
  に集約（キー値は逐語維持＝保存形式不変）。
- **誤誘導コメントの是正**: `dashboard.ts` の `accuracyComponent` は本体が単純な 0..1 クランプなのに
  JSDoc/コメントが存在しない「0.6 アンカー線形写像」を記述し互いに矛盾していた。コメントのみを実態に
  合わせて修正（戻り値式は不変）。
- **テスト基盤の整理**: 11テストファイルの `T-0001` インライン読込を既存ヘルパー `loadProblemFixture`
  に移行し、`__dirname`/path ボイラープレートを削減（同一 JSON を読むため値・アサーションは不変）。

### 最高品質化 深掘り100 第2弾 — 試験忠実度・学習機能・テスト基盤（PR #45 ほか）

第1弾(#39)で設計提示に留めた大型項目を実装。テスト 1273→**1362件**。

- **一次のマークシート化（5択MC）**: 共有 `buildMcChoices`（綺麗・一意・正解包含をゲート）で
  4択→5択へ拡張＋一次numericの5択変種化。MC問題 52→121。距離詞は√3/係数/百分率/単位/項落としの
  具体的な誤概念。正解はコード算出のまま。新テンプレ（対称座標法・故障計算系 ほか）。
- **学習機能**: 公式導出ドリル（解説ステップ並べ替え）・電卓速算ドリル（√3/√2/π・単位換算）・
  年度別通し模試（分野/論点分散の重み付け・本番時間）・FSRS問題単位の苦手優先（誤答済み問題を
  同一論点内で優先）・前提コンセプトグラフ（学習順のおすすめ）。
- **UI仕上げ**: 直前モードバナー・二次選択・記述入力欄・draftチップ・推移スパークライン・
  合格予測カード・各ドリルUIのCSSをデザイントークン準拠で整備（reduced-motion尊重）。
- **テスト基盤**: マイグレーション静的検証（文単位SQLトークナイザ・順序/RLS網羅）・a11yスモーク
  （jsdom+axe）・Playwright E2E雛形＋非必須ワークフロー。Lighthouseはfollow-up。

### 最高品質化 深掘り100 — 根本原因改善＋ベストプラクティス（PR #39）

4観点の並列深掘り監査（エンジン/ドメイン正確性・Webアプリ・学習設計/試験忠実度・テスト/CI）と
firsthand 精読で約123件を抽出し、100アイデアとして全実装。カタログは
[`docs/strategy/ideas/16-supreme-quality-100.md`](docs/strategy/ideas/16-supreme-quality-100.md)。
テスト 1057→**1273件**・自動生成問題 948→**996問**・テンプレ 106→**112種**。設計の根幹は温存。

#### Fixed（正しさ・整合性の根本是正）
- 週次クエストカードが恒久0%だったバグ（`logsOfDay`(週idx)→`logsOfWeek`）。
- 反ハルシネーション照合の偽陽性を是正（解説全体→**結論ステップ**一致／上付き指数 ×10⁻³ 対応）。
- LLM書換え問題文のパラメータ整合検証＋`defaultStatement`フォールバック（内部矛盾の防止）。
- 力率 cosθ=1 を「（遅れ）」と誤表記しない（2テンプレ）。テンプレ topic 重複の読込時検出。
- `<main aria-live>`による全画面読み上げ・データリセットの半壊・`record()`の二重parse を是正。

#### Added（信頼性・a11y・試験忠実度・学習科学）
- **試験日逆算スケジューリング**（`lib/scheduler/exam-aware`）: 残日数で目標保持率を引き上げ・
  最大間隔を試験日で打切り・直前14日は集中復習モード（復習上限引き上げ／弱点バナー）。
- **本番試験の再現**: 科目別の実試験時間・一次は4科目必須の合否判定・二次は120+60を合算
  108/180で判定・模試履歴と推移・二次の6問中4問/4問中2問の選択式。
- 記述は解答を考えてから模範解答開示・数値採点の有効数字許容・科目別合格予測。
- ゲーミフィケーション再整合（努力＝hardを最高評価／習得クエスト）・弱点診断のBayes平滑化・
  インターリービング＋誤答の同セッション再出題。
- 信頼性/a11y: ビュー切替フォーカス移動・スキップリンク・履歴(hash)ルーティング・
  キーボードヘルプのフォーカストラップ・SWのstale-while-revalidate・トーストのキュー化・
  バックアップの形状検証・容量事前警告・チャットのMarkdown安全描画・CSP整理・manifest強化。
- エンジン拡充: 新テンプレ6種（二電力計法／V結線／キルヒホッフ2メッシュ／複素Z並列／
  PWMインバータ／中性点抵抗接地の一線地絡=難易度5）・法規MC誤答理由の具体化。

#### CI / インフラ
- web/src をカバレッジ計測対象に（ラチェット閾値）・deploy を validate 成功にゲート・
  生成物（problems.json/data）の鮮度CIガード・CodeQL(SAST)・dependabot・release版数チェック・
  Supabase復旧経路のテスト・schema-drift を strict:true に。

### Added — 過去問20年分の出題傾向を織り込む（理論・法規を重点拡充, PR #37）

過去問を**逐語コピーせず**、頻出テーマのテンプレ網羅＋出題傾向メタで「20年分を織り込む」。
本プロジェクトの核心（**正解はコードで算出**・著作権回避・テーマ網羅 = `docs/automation/04 §1`）と整合。

- **出題傾向メタ基盤** (`lib/engine/templates/types.ts`, `helpers.ts`):
  `PastExamCoverage` 型（`area` 出題分野 / `frequency` 頻度 high|mid|low / `years` 代表年度 / `note`）を新設。
  `defineTemplate` が `pastExam` を受理（`exactOptionalPropertyTypes` 対応）。
  **逐語の問題文・数値は一切含めない**（型コメントに明記）。
- **20年分の正準出題分野マップ** (`lib/engine/templates/pastexam-areas.ts`):
  理論8分野・法規8分野を正準化（`PASTEXAM_WINDOW=[2006,2025]`）。網羅度計測の基準データ。
- **カバレッジ計測** (`lib/audit/pastexam-coverage.ts` ＋ `scripts/pastexam-coverage.ts` ＋ `npm run coverage:pastexam`):
  各テンプレの `pastExam.area` を正準分類と突き合わせ、科目別の分野カバレッジ・未カバー頻出分野・
  メタ付与率を算出（`--json` 対応）。傾向分析・改題出題の重み付けの元データ。
- **新規テンプレ10種**（すべて正解をコード算出・`isCleanAnswer` ゲート・検算対応）:
  - 理論7: オペアンプ非反転増幅 / ソレノイド内の磁界 / 平行導体間の電磁力 / 相互インダクタンスと合成 /
    Δ-Y変換 / 点電荷の電位 / テブナンの定理
  - 法規3: 漏えい電流 / 電線の実長 / 支持物の根入れ深さ
  テンプレ総数 88→98、自動生成問題 788→879問（理論259・法規99）。
- **既存32テンプレ（理論19・法規13）に出題傾向メタをバックフィル**。
  結果: 理論7/8分野・法規7/8分野をカバー（理論/法規ともメタ付与100%）。
  法規「電気計算（B問題）」は電力/機械と科目横断のため法規単独では未カバーとして**正直に可視化**（⚠表示）。
- **テスト** (`tests/engine/pastexam-{theory,regulation}-templates.test.ts`, `pastexam-coverage.test.ts`):
  各式の代表値検証・全分岐・受入条件（理論/法規の全テンプレにメタ・未知area無し・理論の頻出未カバー無し）。
  全テスト 994→1057件・カバレッジ閾値（stmts86/branch76/funcs96/lines93）グリーン。

### Added — 過去問20年分カバレッジを残り4科目へ拡張（全6科目を網羅, PR #37）

理論・法規で実証した「逐語コピーなし・出題傾向メタ」方式を、電力・機械・電力管理・機械制御へ拡張。
全6科目の20年分カバレッジを `npm run coverage:pastexam` で一望できるようにした。

- **正準出題分野マップを全6科目へ拡張** (`lib/engine/templates/pastexam-areas.ts`):
  電力8・機械8・電力管理5・機械制御3分野を追加（理論8・法規8と合わせ **37分野**）。
  `trackedSubjects()` が全6科目を返し、カバレッジ集計の対象になる。
- **新規テンプレ3種**（すべて正解をコード算出・`isCleanAnswer` ゲート・検算対応）:
  - 機械: 同期速度（Ns=120f/p）/ 誘導電動機の二次銅損（Pc2=s·P2）
  - 電力: 揚水発電の総合効率（η=発電電力量/揚水電力量×100）
  テンプレ総数 98→101、自動生成問題 879→909問。
- **既存56テンプレ（電力18・機械19・電力管理10・機械制御9）に出題傾向メタをバックフィル**。
  結果（`coverage:pastexam`）: 追跡科目平均 **94%**・メタ付与 **101/101（100%）**。
  機械8/8・電力管理5/5・機械制御3/3 を完全カバー、電力7/8（「原子力・新エネルギー」は計算問題が少なく未カバーとして可視化）。
- **受入テスト強化** (`tests/engine/pastexam-coverage.test.ts` を6科目対応に更新, `pastexam-secondary-templates.test.ts` 新規):
  「全6科目の全テンプレにメタ・未知area無し・メタ付与率100%」を受入ゲート化。新規3式の代表値検算を追加。

### Added — 法規の最新化・充実化: 全6科目100%カバレッジ達成（PR #37）

法規科目を最新法令で充実化し、全37分野を100%カバー（追跡平均100%）。法令値は WebSearch で出典検証済み。

- **新規法規テンプレ3種**（コード算出・検算対応）:
  - **変圧器容量の選定**（S=設備容量×需要率/力率〔kVA〕）: 従来「科目横断」として未カバーだった
    法規「電気計算（B問題）」を、電力科目の重複でない独自の容量選定計算で埋め、**法規8/8**に。
  - **特別高圧の絶縁耐力試験電圧**（電技解釈15条: 最大使用電圧7000V超60000V以下→×1.25）。
  - **小規模事業用電気工作物の範囲**（2023年3月施行の最新トピック: 太陽光10kW以上50kW未満・
    風力20kW未満。技術基準適合・基礎情報届出・使用前自己確認の義務）。
- 既存13法規テンプレの法令値を監査 → 接地/絶縁/電圧区分/離隔/供給電圧維持等は**現行法令と一致**（更新不要）を確認。
- テンプレ 103→106種、自動生成問題 933→948問。`coverage:pastexam` で**全6科目100%・メタ付与106/106**。

### Added — カバレッジ仕上げ: 未カバー分野の網羅・拡充・単位統一（PR #37）

レビュー推奨を全実装し、全6科目のカバレッジをほぼ完全（追跡平均98%）にした。

- **未カバー分野を埋める新規テンプレ2種**（コード算出・`isCleanAnswer`・検算対応）:
  - 電力「原子力・新エネルギー」: 原子力発電の電気出力（Pe=η·Qt）
  - 理論「電子理論」: トランジスタの電流増幅率（hFE=Ic/Ib）
  これで理論8/8・電力8/8・機械8/8・電力管理5/5・機械制御3/3 をカバー（法規のみ
  「電気計算（B問題）」が電力/機械と科目横断のため意図的に未カバー＝⚠で可視化）。
  テンプレ 101→103種、自動生成問題 909→933問。
- **低yieldテンプレのパラメータ拡張**（式不変・出題の多様性向上）:
  Δ-Y変換（9→15値）・電線の実長（clean組合せ 8→21）・支持物の根入れ深さ（4→5値）。
- **単位表記の統一**: テンプレートの抵抗単位を全件 `"ohm"`→`"Ω"` に統一（17テンプレ）。
  混在を解消し、生成問題の params 表記を一貫化。
- **回帰ガード**: `pastExam.years` が20年窓[2006,2025]内であることを検証するテストを追加。
- 検証: `npm run verify` グリーン（全1084テスト）・独立レビュー APPROVE（物理式の独立検算・
  単位統一の無関係箇所非変更・スコープ整合を確認）。

### Changed — コードベース大規模リファクタ 第2ラウンド（Wave 1〜3: RG1〜RG8, PR #36, 2026-06-15）

本リファクタは**外部挙動を変えない**（生成問題データ・保存データ形式・UI文言・採点結果は不変）。

**変更なし**: `web/problems.json` バイト列・localStorage キー・Supabase テーブル外部インターフェース・
既存ユーザーの間違いノート・解答ログ・FSRS 状態。既存テストは無変更でグリーン（994件）。

#### Wave 1: ドメイン・エンジン・サービス層（RG1〜RG4 並列）

- **RG1 テンプレ物理制約・ファクトリ全移行** (`lib/engine/templates/**`, `lib/shared/constants.ts`):
  残り74テンプレを `defineTemplate` ファクトリへ完全移行（全87テンプレが統一形式）。
  `lib/engine/templates/helpers.ts` に `constrainRange(value, min, max)` と `isNonNegative(value)` を追加
  （物理制約チェックを各テンプレに散在させず一元化）。
  `lib/shared/constants.ts` を新設し `POWER_FACTOR_TOLERANCE=1e-9` を集約（力率上限比較の誤差許容）。
  `helpers.ts` が `POWER_FACTOR_TOLERANCE` を re-export することでテンプレートは1か所から参照できる。

- **RG2 エンジン型表現力・検証深化・観測性** (`lib/engine/{schema,generate,validate,narrate}.ts`):
  `source` フィールドを discriminated union で型化（`type!=="original"` 時に `citation` を型レベル必須化）。
  `validatePhysics(draw, physicallyValid)` を追加（テンプレートの `physicallyValid` フラグと問題の整合を確認）。
  `validateProblemSet(problems)` を追加（同一 topic 内の酷似 params による実質重複を検出）。
  `generateOneDetailed` が `attemptsUsed`・`rejectionReason` を返し、棄却回数・段階の可視化が可能に。
  `narrate` に `telemetry` フック口を追加（フォールバック率・原因・モデルを記録できる基盤）。
  `validation.rejection_reason?` フィールドを追加（`human_checked=false` の理由の記録）。

- **RG3 CLI 堅牢化・図ヘルパー・xpost 出力制御** (`lib/engine/cli.ts`, `lib/engine/figures/`):
  CLI に `-t`（`--topic` 短縮形）・`-v`/`--version`（版数表示）を追加。
  `--xpost-limit <N>`（出力件数上限・既定10）・`--xpost-out <path>`（ファイル出力）を追加し stdout 肥大を防止。
  不明オプションを警告・段階別エラーメッセージを追加。
  `lib/engine/figures/primitives.ts` に共通プリミティブヘルパーを抽出（軸/目盛/ラベルの重複解消）。

- **RG4 スケジューラ・知識・ストア堅牢性** (`lib/scheduler/**`, `lib/store/**`, `lib/chat/`, `lib/ingest/`):
  `lib/scheduler/index.ts` に `getScheduler("fsrs" | "sm2")` ファクトリを追加（type-safe スケジューラ選択）。
  SM-2 に Wozniak 1990 の根拠を JSDoc で明記・ease 異常値 warning を追加。
  Supabase ストアに lenient モード（行の zod 検証失敗時はスキップして記録、1件破損で全停止しない）を追加。
  `lib/ingest/ingest.ts` に `parseCitation(year, examType, subject)` を追加（不完全出典のフォーマット強制）。
  `ReviewState.createdAtMs` を追加（古い state 誤参照リスク軽減のための生成時刻メタ）。
  `lib/chat/knowledge.ts` に `KNOWLEDGE_META` を追加（各セクションのレビュー基準・定期レビュー基準化）。

#### Wave 2: Web・テスト・配信（RG5〜RG7 並列）

- **RG5 Web パフォーマンス・状態** (`web/src/`):
  `xp.ts` に `xpByDayCached()`・`dashboard.ts` に `byTopicCached()`・
  `achievements.ts` に `evaluateAchievementsCached()` を追加
  （毎描画 O(n) 集計を差分更新キャッシュ化・ログ追記時のみ再計算）。
  `state/practice.ts` に combo/hints/answered の setter を追加（全体 render ではなく必要部分のみ更新）。

- **RG6 Web ビュー・アクセシビリティ・DOM 安全** (`web/src/views/**`, `web/src/ui/**`):
  `views/exam.ts` に `clearExamTimer()` を追加（模試タイマーの setInterval リークを一元解消・II-156）。
  `views/router.ts` に per-view エラー境界を追加（1タブの描画例外が全タブを白画面にしない・II-162）。
  `render()` を `root.replaceChildren()` + `aria-busy` トグルに変更（SR のフォーカス破壊を防止・II-157）。
  トースト消滅に `aria-live` を適正化（残60秒警告を SR に通知・II-158/159）。
  `ui/dom.ts` に `$req<T>(host, sel)` を追加（querySelector null 黙殺を防ぐガード付き取得・II-170）。
  `ui/safe-html.ts` に `SafeHtml` branded type と `safeHtml()` を追加（`h()` の `html` 属性に型保証・II-169）。

- **RG7 テスト・CI・セキュリティ・データ層** (`tests/**`, `web/index.html`, `web/sw.js`, `supabase/migrations/`):
  `tests/integration/` を新設（生成→検証→保存→読込の E2E 統合テスト）。
  共有ヘルパーへのファズテスト（`constrainRange`/`buildChoices`/`percentage`/`pick` へランダム入力1000回）。
  時刻依存テストに `vi.useFakeTimers()` を徹底適用。
  `web/index.html` に `Content-Security-Policy` meta タグと `dist/app.js` への SRI（sha384）を追加（II-182/183）。
  `web/sw.js` をv20に更新。`scripts/build-web.ts` がバンドルハッシュから `CACHE` 値を自動更新（手動管理廃止・II-187）。
  `supabase/migrations/0004_rls_fk_notnull.sql` を追加（UPDATE/DELETE RLS ポリシー・FK CASCADE・difficulty NOT NULL 補完・II-186）。
  CI にバンドルサイズバジェット（`BUNDLE_SIZE_LIMIT_KB` 超過で失敗）を追加（II-188）。

#### Wave 3: ドキュメント（RG8）

- **RG8 ドキュメント整合** (`README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md`, `docs/**`):
  本エントリ参照。詳細は下記。
  `docs/adr/0002-types-and-observability.md` 新設（discriminated union 採用・観測フック・キャッシュ戦略の設計判断）。

---

### Changed — コードベース大規模リファクタ（Wave 1〜3: G1〜G9）

本リファクタは**外部挙動を変えない**（生成問題データ・保存データ形式・UI文言・採点結果は不変）。

**変更なし**: `data/problems/*.json` / `web/problems.json` のバイト列、localStorage キー、
Supabase テーブル構造、既存ユーザーの間違いノート・解答ログ・FSRS 状態。

#### Wave 1: 基盤リファクタ（G1〜G5 並列）

- **G1 テンプレヘルパー層新設** (`lib/engine/templates/helpers.ts`):
  82テンプレートにコピペされていた `pick()` を一元化（空配列ガード付き）。
  `buildChoices()`・`percentage()`・`ensureRange()`・`defineTemplate()` ファクトリを追加。
  `ε=1e-6` を `ANSWER_EPSILON` として `clean.ts` から一元提供。
- **G2 エンジンコア強化** (`lib/engine/`):
  `DENKEN_NARRATOR_MODE=auto|stub|api` で明示制御可能に。
  `DENKEN_NARRATE_MODEL` 定数抽出と `.env.example` への記載。
  `lib/engine/index.ts` barrel 新設（単一入口）。
- **G3 lib 堅牢化** (`lib/shared/`, `lib/store/`, `lib/`):
  `lib/shared/time.ts` に `DAY_MS`/`JST_OFFSET_MS` を一元化。
  `lib/shared/rng.ts` に `seededRng`/`hashSeed` を一元化。
  Supabase 行→ドメイン変換を zod で検証（無検証キャスト8箇所を是正）。
- **G4 web モジュール** (`web/src/`):
  `dates.ts` 新設（JST日付ユーティリティ）。`sanitize.ts` 新設（SVGサニタイザ）。
  SW: `addAll` 失敗時の `skipWaiting` 競合を修正・未キャッシュオフライン時のフォールバック追加。
- **G5 スクリプト・CI・設定**:
  `scripts/shared.ts` 新設（原子的書き込み `atomicWriteFileSync`・`printHelp`・`validateOrExit`）。
  全スクリプトに `--help` 対応。`build:problems` に `--per-topic` フラグ。
  `validate.yml`: push は main のみ・アーティファクト保存（coverage/dist）・`GITHUB_STEP_SUMMARY` 出力。
  `release.yml` 新設（タグ push で `release:check` → GitHub Release 草稿）。
  renovate に `helpers:pinGitHubActionDigests`。`.npmrc` に `engine-strict=true`。
  `supabase/migrations/0003_indexes.sql` 追加。

#### Wave 2: 構造リファクタ（G6〜G7 並列）

- **G6 app.ts モノリス分割** (`web/src/`):
  2,570行のモノリスを `app.ts`（90行エントリポイント）＋19モジュールに分割。
  `ui/`（dom/toast/widgets）・`views/`（router + 7画面）・`state/`（app/exam/practice）を新設。
  挙動・文言・DOM構造・保存データは不変。
- **G7 テスト基盤強化** (`tests/`):
  `tests/helpers/storage.ts`・`rng.ts`・`fixtures.ts` に共有ヘルパーを集約。
  `schema-drift.test.ts`（I-069）・`generate-from-roundtrip.test.ts`（I-067）を新設。
  テスト総数 851件（Wave 1 開始時から増加）。
  カバレッジ閾値: stmts85 / branch76 / funcs92 / lines89。

#### Wave 3: 仕上げ（G8〜G9 並列）

- **G8 ドキュメント整合** (`README.md`, `CONTRIBUTING.md`, `docs/`): 本エントリ参照。
  `docs/adr/0001-dual-schema-validation.md` 新設（二重スキーマ設計判断の記録）。
- **G9 lint/型設定厳格化** (`tsconfig*.json`, `biome.json`): `noExplicitAny`/`noNonNullAssertion` 解除・全違反修正。

---

### Added
- **問題データ拡充（深掘り100）**: `docs/strategy/ideas/14-problem-data-100.md`。
  - **テンプレート 53→65種（+12）**: 法規4種（B種接地抵抗=解釈17条・低圧絶縁抵抗=省令58条・
    電圧の区分=省令2条・架空電線の高さ=解釈68条。条文名を解説に明記）／電力3種（コンバインド
    サイクル効率・火力燃料消費量・設備利用率）／機械2種（電気加熱・変圧器並行運転の負荷分担）／
    理論2種（RLC直列共振・電磁誘導起電力）／機械制御1種（二次系のωn・ζ）。
  - **web/problems.json 405→589問（+184）**: PER_TOPIC 8→10。最弱だった法規 34→60問、
    択一(MC) 24→40問（一次の本番形式へ前進。MC誤答に「取り違えの理由」を付与）。
  - 全新テンプレに固定値検算テスト（+13。手計算期待値の回帰防止）。横断不変条件
    （綺麗な値・選択肢一意・レンジ内・解説整合）は既存テストが新テンプレへ自動適用。
  - 汎用摂動による自動MC化は「誤答の教育価値が低い」ため意図的不採用とし、
    テンプレ別の典型ミス誤答設計（次期）を採ることをドキュメントに明記。

- **出題範囲の徹底網羅（深掘り100・第2弾）**: `docs/strategy/ideas/15-syllabus-coverage-100.md`。
  - **テンプレート 65→88種（+23）**: 理論6（クーロン力/RL時定数/直列合成容量/抵抗温度/単相直列RL/
    磁気回路）・電力5（比速度/速度調定率/電線実長/電圧降下PQ式/タップ切換）・機械5（回転体出力/
    蓄電池容量/励磁電流/はずみ車加速/逆二乗照度）・法規4（接地種別/支線安全率/屋内対地電圧/
    供給電圧維持）・二次3（負帰還合成ゲイン/損失係数/合成最大需要）。
  - **web/problems.json 589→788問（+199）**: 法規77問・MC49問。88topic。
  - **問題IDの安定化**: 出荷済み405問（main）のIDは `legacy-ids.json`（署名→旧ID対応）で**完全温存**し、
    新規問題のみ内容由来ハッシュ `G-{FNV1a(topic|係数)}` を採用。既存ユーザーの間違いノートを
    一切壊さず、以後はテンプレ追加・並び替えでもIDが不変（Codexレビュー2巡の指摘に根本対応）。
  - 係数署名による実質重複の除去・build時の科目×形式マトリクス出力・再生成のバイト一致を確認。
  - **高圧架空電線の高さテンプレの曖昧さ排除**: 低圧の4m例外と混同しないよう高圧に限定
    （Codexレビュー対応）。
  - 新テンプレ全種に固定値検算テスト（エンジンテスト 239→263）。
  - 方針の明文化: 過去問の**原文は収録しない**（著作権＋環境制約）。公知の頻出テーマ体系の
    タクソノミー化で「20年分の網羅」を実現し、原文改題は lib/ingest の将来枠とする。

### Fixed
- **README の問題数表記の乖離を是正**: 「29テンプレ/220問」のまま放置されていた表記を
  実数（65テンプレ/589問）に更新し、`npm run audit:status` を一次情報とする方針を明記。

### Added
- **Duolingo型ゲーミフィケーション基盤（深掘り100）**: `docs/strategy/ideas/13-gamification-duolingo-100.md`。
  - **XP/レベル/称号**（`web/src/xp.ts`）: 評価連動XP（again=2/hard=8/good=10/easy=12・不正解にも参加報酬）＋
    同日コンボボーナス＋クエスト全達成ボーナス。**解答ログから完全導出**（保存キーなし＝遡及付与・
    バックアップ/リセットと常に整合）。電験テーマの称号14段（見習い電気係→電験マイスター）。
    ヘッダにXPピル・進捗タブにレベルカードと週間XPチャート・レベルアップ祝賀。
  - **日替わりクエスト3種**（`web/src/quests.ts`）: JST日番号を種にした決定論抽選
    （解答数/正解数/連続正解/論点の幅/「余裕」評価）。全達成 +20XP。学習・進捗タブに進捗バー表示、
    模試の解答も算入。
  - **ストリークお守り**（`web/src/freeze.ts`）: 7日継続ごとに1個獲得（最大2）。欠席日を次回起動時に
    **自動で肩代わり**してストリークを守る。ヘッダ表示（🔥日数 🧊×個数）・発動/獲得トースト。
    予兆ナッジ/シェア文言も実効ストリークに統一。
  - **実績バッジ18種**（`web/src/achievements.ts`）: 蓄積/継続/コンボ/全科目踏破/朝活/夜型/不死鳥/
    パーフェクトデー/レベル到達。ログから遡及判定・解除トースト・進捗タブにグリッド（ロック中も提示）。
  - **マスコット「デンタマ」**（`web/src/mascot.ts`）: 電気の玉の妖精（インラインSVG・表情5種）。
    学習タブで状況に反応（目標達成を祝う/ストリーク危機を心配/復帰を歓迎・台詞は日替わりローテーション）、
    解答直後のリアクション、復習ナッジにも表情を添付。
  - **祝賀演出**（`web/src/fx.ts`）: 紙吹雪（節目限定）・WebAudio合成の効果音（正解/不正解/レベルアップ/
    達成。設定でオフ可）・XPフロート・ハプティクス。prefers-reduced-motion を尊重。
  - 設定に**効果音トグル**を追加。バックアップ対象キーに freeze/badges/sound を追加。
    新規・拡張テスト72件（合計480件）。SW キャッシュ v14。
- **継続強化 第2弾**（同上ドキュメントの追補実装）:
  - **ウィークリークエスト3種**: JST週番号（月曜はじまり）の決定論抽選（週合計解答/正解/学習日数/
    論点の幅/パーフェクトデー）。全達成 +50XP は累計XPの導出に算入。進捗タブに進捗カード、
    達成の瞬間は祝賀トースト。
  - **科目別XP**・**次称号ティーザー**（レベルカードに「Lv.Nで『◯◯』」）・**「自分の記録」統計**
    （学習日数・最高コンボ・1日最多解答・クエスト全達成日・パーフェクトデー・お守り救援回数）。
  - **キーボードで評価**: FSRS評価バーを 1〜3 キーで選択（番号バッジ表示。解答→評価→次へを
    キーボードだけで周回できる）。
  - **「あと1問」文脈ナッジ**（クエスト残り1のときだけ表示）・**デンタマ呼吸アニメ**・
    **マスコット非表示設定**・**正解ポップ/不正解シェイク**のマイクロモーション。
  - **基盤堅牢化**: グローバル error/unhandledrejection 捕捉（学習記録の安全を伝えるトースト・
    セッション1回）。タブ開きっぱなしで日をまたぐPWA向けに、再表示時にもお守りブリッジを実行。
    新規テスト17件（合計497件）。SW キャッシュ v15。
- **継続強化 第3弾（節目と導線）**:
  - **目標設定ウィザード**: 初回オンボーディングで試験日と1日目標（5/10/20問）を30秒で設定
    （コミットメントと一貫性。デンタマが案内）。
  - **セッション終了サマリー**: 日次目標達成の瞬間に「今日のまとめ」（獲得XP・解答数・正答率・連続日数）
    ＋**明日のクエスト予告**（決定論抽選だから予告できる＝翌日の再訪フック）。
  - **ストリーク大台スペシャル**: 30/50/100/200/365日で最優先トースト＋紙吹雪増量＋ファンファーレ。
    お守りブリッジで一気に伸びても通過済み大台を取りこぼさない。
  - **実績3種追加（計21種）**: 初マスター（論点をeasy×3）・無傷の三十日（お守りに頼らず30日）・
    月間皆勤賞（ひと月に20日学習）。
  - **マスター済み論点チップ**（弱点の隣に「できるようになったこと」を見せる）・
    **ゴーストレース**（今日のXP vs 過去7日平均の自分）・**コンボ5以上で発光**。
  - **キーボードショートカットヘルプ**（?キー）・**A2HS導線**（ストリーク3日目に一度だけ提案＋設定に追加ボタン）・
    記述の自己採点にもハプティクス。
    新規テスト13件（合計510件）。SW キャッシュ v16。
- **継続強化 第4弾（報酬の深みと健全性）**:
  - **XPブースト**: デイリークエスト全達成後、その日の残りの正解XPが×1.5。時間制でなく
    ログ順序基準にすることで「XPはログから完全導出」の決定論を維持（増分カウンタでO(n)判定）。
  - **おやすみ予約**: 「今日学習済み」の日だけ明日を休みに予約でき、ストリークは維持。
    連続予約は構造的に不可（休んだ翌日は学習しないと予約できない）＝乱用を防ぎつつ
    「休む勇気」をストリークの罰にしない。予約日はお守りを消費しない。
  - **デンタマの成長**: Lv10+で星バッジ、Lv20+で安全ヘルメット、Lv40+で金の王冠（SVGアクセサリー）。
    **まめ知識ボタン**で教科書レベルの電験トリビア12種を順繰りに話す。
  - **効果音の音量4段階**（オフ/小/中/大・変更時に試聴・旧オン/オフ設定と後方互換）・
    **実績タップでシェア**（Web Share API→クリップボードfallback）。
  - **バグ修正**: ショートカットヘルプがカード内クリックでも閉じる問題（stopPropagation）。
    新規・更新テスト14件（合計524件）。SW キャッシュ v17。
- **継続強化 第5弾（仕上げと監査）**:
  - **不死鳥・改**実績（ブランク復帰後に7日連続。計22種）・**これまでのあゆみ**累計サマリー・
    **歴代最長ストリーク**（お守り/おやすみの肩代わり日も連続として評価）・**XP/学習日**表示。
  - **a11y**: レベル/クエストの進捗バーに role=progressbar・aria-valuenow を付与。
  - クエスト難易度の適応（アイデア22）は「XPはログから完全導出」の決定論と両立しないため
    意図的に保留と明記（LOG_CAP の間引きで過去日の再計算が揺れるため）。
    新規テスト3件（合計527件）。

### Fixed
- **数値問題の空入力が「不正解」として記録されるバグを根本是正**: 学習・模試とも空入力は採点せず
  入力欄へフォーカスを返す（誤タップ・キー操作ミスが FSRS の記憶状態を汚さない）。
- **模試「中断」の誤タップで途中経過が即座に破棄される問題**: 確認ダイアログを挟む（破壊的操作の保護）。
- **祝賀トーストの上書き衝突**: 目標達成・レベルアップ等が同時発生すると後勝ちで消えていたため、
  重要度順（レベル＞お守り＞クエスト＞実績＞目標）に1本化。
- **学習記録リセットの不整合**: XP/実績/お守り関連キーも併せて初期化（ログ導出系と保存系のズレ防止）。

### Fixed
- **描画例外でアプリ全体が白画面になる脆さを根本是正（エラーバウンダリ）**: `render()` を try/catch で
  囲い、例外時は「学習記録は安全」＋再読込導線の復旧画面（role=alert）を表示。原因詳細は `textContent`
  で安全に提示（XSS 回避）。純ロジック `errorDetail`/`recoveryView` にテスト追加。
- **復習キューの洪水による離脱を根本対策**: 久々の復帰時に大量の復習が一度に出ていた問題を、1日上限
  （既定30・設定可）でバッチ化し「残りは明日」を案内。復習バッジも「今日出す分」に同期。

### Added
- **信頼性・アクセシビリティ・学習継続の品質向上（深掘り100）**: `docs/strategy/ideas/12-reliability-a11y-retention-100.md`。
  - **オフライン表示**: ヘッダに通信状態 pill（role=status）＋ online/offline 追従。完全オフライン動作を
    「障害ではなく状態」として明示。
  - **ストリーク予兆ナッジ**: `streakStatus` が active/at-risk/broken を判定。「昨日まで継続中だが今日まだ」
    を検出して背中を押し、間が空いたら軽い再開を促す。
  - **アクセシビリティ**: ナビを WAI-ARIA tablist 化（role=tablist/tab・aria-selected・tabindex ロービング）、
    タブの左右矢印キー移動。
  - **設定**: 1日の復習上限（5〜200・既定30）を追加。バックアップ対象にも反映。
  - テスト追加（復習バッチ化・ストリーク3状態・エラー詳細抽出・復習上限クランプ）。SW v13。

### Fixed
- **模試「時間制限」の本実装（看板と実装の乖離を根本是正）**: 従来は経過時間の表示のみで制限が無かった。
  形式別の持ち時間（一次3分/問・記述10分/問・上限120分）から制限時間を算出し、残り時間カウントダウン
  （ラスト1分は警告色）＋時間切れで自動終了。未解答は本番同様0点だが、未出題問題に FSRS 記録は付けない
  （記憶状態を汚さない）。`examTimeLimitMs` にテスト追加。
- **localStorage 書き込み失敗・ログ無限成長の根本対策**: iOS プライベートモードや quota 超過で
  `setItem` が throw すると採点フローごと落ちていた潜在不具合を `safeSet` で吸収（保存失敗でも学習継続）。
  解答ログに上限（`LOG_CAP`=5000、古い順に間引き）を設け、長期使用での quota 到達を構造的に防止。
- **問題データ読込失敗の行き止まり解消**: 失敗時にリトライ導線つきのエラー状態を表示（`reloadProblems` 分離）。

### Added
- **学習アプリ品質向上（深掘り100の実装分）**: `docs/strategy/ideas/11-app-quality-100.md`。
  - **バックアップ**: 学習データの書き出し/復元（設定タブ）。app/version 検証・許可リスト外キーの無視・
    APIキー除外。復元結果をトーストで明示。
  - **模試の見直し**: 結果画面に問題別○×リスト（展開で問題文＋解説）と「間違いだけ再演習」ドリル
    （テスト効果の回収）。所要時間と制限時間を併記。
  - **学習体験**: ヒント段階開示（解答前に着眼点→次ステップ、最大2段・使用数を結果に表示）、
    解答の経過時間表示、選択肢の番号バッジ（キーボード1〜9の可視化）、出題切替時の問題文フォーカス、
    日次目標達成の祝いトースト、初回3ステップオンボーディング。
  - **公式検索**: 名前・式・補足の部分一致フィルタ（NFKC正規化で％Z⇔%Z等の表記ゆれ吸収、
    フォーカスを保ったままリスト更新）。
  - テスト追加（制限時間・バックアップ・保存安全化・公式検索・時間整形）。SW v12。
- **AI質問チャット（質問タブ）**: 電験の用語・公式・試験制度・勉強法に答えるチャットを学習OSに統合。
  静的PWA（バックエンド無し）の制約を踏まえた2層構成 — ①オフライン既定は `lib/chat/knowledge.ts` の
  検証済みナレッジ60件（全エントリ出典必須・法規は条文名）から日本語バイグラム検索（NFKC正規化＋
  エイリアス辞書）で引用回答＝構造的にハルシネーション不能、②設定タブに自分の Anthropic API キーを
  登録（BYOK・localStorage のみ）すると、ローカル検索結果を接地コンテキストに注入（RAG）した Claude の
  ストリーミング回答へ切替。範囲外拒否・出典明示・不確実性の明言・`_`/`^` 数式記法をシステムプロンプトで
  強制し、法規・制度の回答には改正注意を自動付与。API障害時はローカル回答へフォールバック。
  UI は吹き出し＋おすすめ質問チップ＋関連質問＋ストリーミングカーソル＋履歴消去（デザイントークン準拠）。
  テスト（検索回帰・回答合成・プロンプト・SSE/履歴ストア）を追加。
  `docs/strategy/ideas/10-ai-chat-100.md`（深掘り100）。SW v11。

### Fixed
- **物理的妥当性の根本原因修正**: 揚水ポンプ/巻上機テンプレの総合効率に η=0.98 が含まれ、
  「綺麗な答え」になるため選ばれていたが、複合効率98%は非現実的なのに `physically_valid: true`
  で出荷されていた（コードベース全体のバグ監査で検出）。`ETA_SET` を現実値[0.7,0.8]に絞り、
  `realistic_range` も [0.6,0.9] に是正。問題集を再生成。

### Added
- **検証済み問題を31→52件に拡充（audit目標50を達成）**: ループで追加した21テンプレを固定値検算済みの
  係数で `data/problems` に収録（法規 2→4 等、全6科目を補強）。記述18・全形式バランス改善。
- **二次記述の部分点ルーブリック自己採点**: 模範解答の各ステップを採点観点チェックリスト化し、
  書けた項目から達成率（部分点%）と合格圏判定を提示。達成率を FSRS 評価（easy/good/hard/again）に
  写像し、二次の「途中点を確実に取る」戦略を日々の演習に落とし込む。純ロジック `partialScore` に
  テスト追加（スキーマ非変更・既存 solution を採点観点に活用）。`docs/strategy/ideas/09-secondary-exam-mastery-100.md`。SW v10。

### Changed
- **UI/UXデザインの全面刷新（洗練デザインへ）**: `web/` を依存なし（オフライン堅持）のまま、
  明/暗2系統の意味命名デザイントークン（色/余白/角丸/影/モーション）を導入。半透明blurの
  セグメントタブ、ブランド付きヘッダ＋ステータスpill、選択肢/ボタン/カード/解説/進捗バー/図枠を
  面＋影＋hover/activeで磨き、`focus-visible` リング・控えめなフェードイン・`prefers-reduced-motion`
  対応・`theme-color` 出し分けを追加。`docs/strategy/ideas/08-ui-design-100.md`。Service Worker v7。

### Added
- **過去問頻出テーマのテンプレ拡充（29→50種・全6科目を網羅）**: 計測(分流器/倍率器)・
  電界・%Z容量換算・揚水/巻上/照明動力・風圧/許容張力・電圧降下率/負荷率/不等率/送電効率・
  最大効率負荷率・直流発電機・磁気エネルギー・電力量・全波整流・昇圧チョッパ・
  送電電力(安定度)・短絡電流(オーム法) 等。各々を固定値検算テストで担保（全テンプレ歩留まり≥20）。
- **図解と構造化解説（電験王のような図式を織り込む）**:
  - `lib/engine/figures/` — 外部依存なしの**インラインSVG**描画基盤（プリミティブ＋12トピックの
    図ビルダー）。回路図（三相Y/直並列/RC/最大電力/ブリッジ/変圧器）、ベクトル図（電力三角形/
    同期発電機）、線路図（単相電圧降下）、ブロック線図（一次遅れ系）、特性曲線（比例推移）。
    `currentColor`でテーマ追従、`<title>`/`role=img`でアクセシブル。
  - `GenerationResult.figure`→`Problem.figure` を生成/seed/build 全経路に配線。学習・模試で図を描画。
  - 解説を主要トピックで「着眼点→公式→代入→計算→ポイント/別解」に構造化。
  - problems.json 96問・data 12問を図付きに再生成。図スモークテスト12件。Service Worker v6。
  - `docs/strategy/ideas/07-figures-explanations-100.md` — 図式・解説の深掘り100。
- **学習エンジンの大幅強化（電験二種 合格力に直結する深掘り100の実装）**:
  - エンジン: 決定論テンプレートを **7→29種** に拡充（全6科目・**二次=記述8種**）。
    閉形式の固定値検算テスト22件＋科目カバレッジ検証。
  - データ: `scripts/build-problems.ts`（`npm run build:problems`）で全テンプレから
    **220問**を決定論生成し `web/problems.json` を再構築（記述69問・全件 validate 通過）。
  - 記憶: Web の復習を **SM-2→FSRS** に移行し、**4段階自己評価**（again/hard/good/easy）と
    目標保持率設定を導入。FSRS Card を localStorage に永続化（Date 復元込み）。
  - 学習機能: タブ型SPA（**学習/復習/模試/進捗/公式/設定**）。時間制限模試（合格ライン60%・
    科目別内訳）、復習キュー、**間違いノート**、科目別到達度ダッシュボード、試験カウントダウン、
    日次目標、公式集、科目ドリル、**数式の軽量整形**（KaTeX非依存）、キーボード操作、aria-live。
  - 純ロジック（`web/src/{dashboard,exam,review,plan,settings,mathfmt}.ts`）に**ユニットテスト49件**。
  - ドキュメント: `docs/strategy/exam-structure.md`（試験構造＋学習科学に基づく学習法）と
    `docs/strategy/ideas/06-exam-mastery-100.md`（学習エンジン強化の深掘り100）。
  - Service Worker を v4 に更新。`npm run verify` 緑（255テスト）。
- `docs/strategy/ideas/05-deep-audit-2026-06.md` — コードベース深掘り監査100（根本原因×ベストプラクティス、対応状況付き）。
- `web/src/grade.ts` — 採点の純ロジック（DOM から分離してテスト可能化）。numeric は数値比較、選択式/記述は厳密一致。
- `web/src/select.ts` — 出題選択の純ロジック（弱点 topic 優先＋直近出題の重複回避）。テスト付き。
- `AnswerLog.problemId`（任意）— 問題単位の集計の素地。web `record`・supabase append/byUser に配線。
- 全7テンプレートの不変条件テスト（`tests/engine/template-invariants.test.ts`、多数 seed で params レンジ内・
  選択肢一意・綺麗な値・解説整合を横断検証）。aggregate/classify 閾値/select/problemId のテストも追加。
- 採点・JST境界・通知時刻・週次重複・CLI検証・PII拒否のユニットテスト。
- `narrate` / `cli`（parseArgs/argErrors/makeRng）/ `supabase-store`（疑似クライアントで3ストア＋error伝播）/
  `fsrs`（4採点）/ `x-client`（下書き）/ `narrationMatchesAnswer` のテストを追加し、カバレッジ回帰フロアを
  stmts75→85 / branch65→76 / funcs80→92 / lines80→89 に引き上げ。
- CLI に `--help`/`-h` と USAGE、引数検証（`--count`/`--source`/`--citation`/`--seed`）。
- CI の checkout に `persist-credentials: false`、各ジョブに `timeout-minutes`。
- `docs/architecture.md` — モジュール依存グラフ（mermaid）・レイヤ構成・設計不変条件。
- `lib/README.md` — 13モジュールの責務索引表と規約。
- `SECURITY.md` — 脆弱性開示方針と機密情報（APIキー / Supabase RLS）の取扱い注記。
- `.github/CODEOWNERS` — レビュー自動アサイン。
- `.nvmrc` — Node バージョン固定（CI と整合）。
- `package.json` にメタデータ（`repository` / `bugs` / `homepage` / `keywords` / `author`）。
- カバレッジ回帰ゲート（`vitest.config.ts` に閾値、CI で `test:coverage` を実行）。
- PWA アプリアイコン（`web/icon.svg`、maskable 対応）でインストール可能に。
- CI の最小権限化（`permissions: contents: read`）と `setup-node` の npm キャッシュ。
- 公開ゲート(`engine/gate.ts`)のユニットテストと、公開境界の fail-closed テスト。
- `.gitattributes`（LF 正規化 ＋ 生成物の linguist マーキング）。
- `supabase/migrations/0002_problems_updated_at.sql` — `updated_at` を保つ
  BEFORE UPDATE トリガ（関数は `search_path` 固定）。SQL ガードテストも追加。
- 弱点診断の順序非依存を保証する回帰テスト。

### Changed
- `lib/engine/cli.ts` を**直接実行時のみ `main()`**（`import.meta.url` 判定）に。import しても副作用が出ず
  テスト可能に。`parseArgs`/`argErrors`/`makeRng` をエクスポート。
- `lib/store/file-store.ts` の書き込みを**原子的**（temp＋`rename`）にし、クラッシュ/並行時の JSON 破損を防止。
- `actions/checkout` を v6 に統一。dependency-review の `fail-on-severity` を high→moderate に厳格化。
- `lib/correction/classify.ts` の判定閾値を引数化（`DEFAULT_THRESHOLD`、実データで較正可能）。
- `web/sw.js` のキャッシュ版を v2→v3（web アセット変更時に既存 PWA クライアントへ確実に配信。版数の更新規約をコメント化）。
- テンプレ文の文字列連結（`+`）をテンプレートリテラルに統一（lint info 一掃。生成文字列は不変）。
- `lib/engine/` の X投稿関連を `lib/engine/xpost/`（`toXPost` / `xlength` / `publish` + barrel）に再編。
  生成/検証ロジックと投稿関心事を分離。テストも `tests/engine/xpost/` へミラー移動。

### Fixed
- **オフラインアプリの numeric 採点バグ**（`web/src/app.ts`）: 文字列完全一致で `"50"≠"50.0"`・`"3.2"≠"3.20"`・
  全角数字が誤判定されていた。numeric を数値の許容誤差比較に是正し、入力正規化（全角/桁区切り/空白）を追加。
- **ストリーク/学習時間の日境界が UTC**（`web/src/store.ts`）: 朝(JST)の学習が前日扱いで連続日数が途切れていた。
  既定 JST(+9h)・設定可能な日境界に是正。
- **通知時刻 `parseHHMM` の NaN**（`lib/notify/schedule.ts`）: `"20:xx"` 等で `setHours(NaN)` になりうる箇所を
  範囲検証＋既定フォールバックに。
- **週次レビューの TOP/FLOP 重複**（`lib/analytics/weekly-review.ts`）: 投稿数が少ない週に同一投稿が両セクションへ。
  TOP を除外して FLOP を選ぶよう是正。
- **シェアカードの PII 未配線**（`lib/share-card/card-text.ts`）: `hasPii` を `cardText` 本体に配線し
  メール/電話の混入を拒否。
- **vault 書き出しが無検証**（`scripts/export-vault.ts`）: `validateProblem` で不正な問題を除外＋警告。
- **numeric採点の空入力バグ**（`web/src/grade.ts`）: `Number("")===0` のため答えが `"0"` の問題で空回答が
  正解扱いになりうる箇所を、正規化後が空なら不正解として弾くよう是正（Codex レビュー指摘）。
- **集計の votes/choices 長不一致**（`lib/aggregate/aggregate.ts`）: 既知選択肢に対応する票だけで集計する防御に。
- **supabase の `answer_logs.problem_id` を常に null 保存**していたのを `problemId` 保存に是正。
- 型チェックが通らなかった問題を修正（`@types/node` を devDependencies に明示追加）。
- zod v4 移行漏れを修正（`z.record(paramField)` → `z.record(z.string(), paramField)`）。
- 環境変数名の不一致を是正（`supabase-store.ts` の例を `.env.example` と同じ `SUPABASE_ANON_KEY` に統一）。
- README のテスト件数表記がドリフトしていたのを解消（陳腐化する数値を撤去）。
- **公開ゲートの未配線（安全ホール）を是正**: `engine/gate.ts` がどこからも呼ばれず、
  `scheduleProblem` が検証状態に関わらず投稿予約できていた。`meetsValidationGate` を
  公開境界に配線し、検証4項目未充足・`retracted` を fail-closed で拒否するようにした。
- **弱点診断の順序依存バグ**: `aggregateByTopic` が `dueMs` にログ配列末尾の時刻を入れ、
  順不同入力（`order` 未指定の Supabase 取得など）で最新時刻にならず弱点優先度が狂っていた。
  `Math.max` で最新時刻を採用し、`answer_logs.byUser` に `order by answered_at` を追加。

## [0.1.0] - 2026-05-29

### Added
- 問題生成＆検証エンジン MVP（決定論ソルバ＋検算＋出典＋CLI、5科目テンプレ）。
- CI品質ゲート（Biome ＋ 型チェック ＋ ajv スキーマ検証 ＋ vitest）。
- X投稿生成＋予約、解答集計、過去問取込、適応出題（SM-2/FSRS）＋永続化、
  コミュニティ儀式、通知計画、シェアカード／クロスポスト／誤り訂正／週次KPI。
- オフライン学習アプリ MVP（PWA・localStorage・Service Worker）。
- Obsidian/Markdown 書き出し。
- デュアルライセンス（コード=MIT / データ・docs=CC-BY-SA-4.0）。

[Unreleased]: https://github.com/thinkyou0714/denken-os/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/thinkyou0714/denken-os/releases/tag/v0.1.0

## 未リリース

### 追加
- **問題単位の復習** — 誤答した問題を個別に期日管理（新キー `denken:problemCards`）。誤答時のみカードを作り、3回連続正解で卒業、上限300件。復習タブに「今日の解き直し」を追加。
- **試験区分フィルタ** — 三種 / 二種一次 / 二種二次で出題を絞る（設定）。学習ログ・FSRSカードは保持。
- **法規マップ** — 資料タブに法規の全体像（配点・法令体系・出題枠・頻出パターン・重要数値）。
- **問題をさがす** — 科目 / 頻出度 / 難易度 / 出典 / 形式 / キーワードで絞り込み、その場で演習。
- **科目合格プラン** — 免除の残り回数（最大連続5回）と、今回受ける科目の推奨（進捗タブ・三種選択時）。
- **誤答フィードバック** — 選んだ選択肢に固有の「なぜ間違えたか」を表示（`distractors` をスキーマに追加）。
- **しおり** — 気になった問題を保存し、まとめて再演習。
- **学習時間** — 今日 / 直近7日 / 累計を進捗タブに表示。
- **文字サイズ設定** — 小 / 標準 / 大 / 特大。
- **CBT見直しフラグ** — 模試中に印を付け、結果画面でまとめて再演習。
- **データ保護** — `navigator.storage.persist()` を要求し、状態を設定タブに表示。

### 変更
- 出題は過去問の頻出度で重み付け（high が当たりやすい）。弱点優先とFSRSの経路は不変。
- 問題生成の採用上限を頻出度で配分（high は2倍、low は半分）。
- 図（SVG）に `role="img"` と代替テキストを付与。

### 修正
- Service Worker が combined `problems.json` と科目別シャードを二重にプリキャッシュしていた（45.6MB → 23.2MB）。
- 生成器が出力していた誤答解説（`distractors`）がスキーマ未定義のため破棄されていた。
