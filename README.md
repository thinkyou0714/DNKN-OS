# DENKEN-OS

> 電験 (電気主任技術者試験) の合格を「再現性のある学習プロセス」として体系化するプロジェクト

## Status

**Pre-alpha — コア実装着手** (2026-05-29)

問題生成＆検証エンジン (MVP)・運用ロジック・CI品質ゲート・オフラインWeb MVPを実装済み。
現時点で本番接続していないものは、X実投稿・外部Supabaseプロジェクト・課金の決済リンク（フリーミアム基盤自体は実装済み・販売者セットアップ待ち）・監修フロー・大規模問題データ。
実運用前の人間タスクは [`docs/strategy/human-tasks.md`](docs/strategy/human-tasks.md)、品質ハードニング方針は [`docs/strategy/03-quality-hardening-plan.md`](docs/strategy/03-quality-hardening-plan.md) に分離した。
進捗を追いたい方は Watch / Star してください。

### 実装済み（`lib/` `scripts/` `.github/`）

| 領域 | 実装 | 仕様 |
|---|---|---|
| 問題生成＆検証エンジン | `lib/engine/`（決定論ソルバ＋検算＋出典＋CLI、**テンプレ160種＝全6科目**: 一次 理論/電力/機械/法規＋二次 電力管理/機械制御。過去問頻出テーマを網羅。MC＋numeric＋descriptive形式＋図解SVG） | `docs/automation/01` |
| 過去問出題傾向カバレッジ | `lib/engine/templates/pastexam-areas.ts`（20年分の正準出題分野マップ＝**全6科目40分野**）＋`lib/audit/pastexam-coverage.ts`＋`npm run coverage:pastexam`。各テンプレに**出題傾向メタ（分野/頻度・逐語引用なし）**を付与し、全6科目の分野網羅度を定量化（**全40分野100%カバー**・傾向分析・改題出題の重み付けの元データ） | `docs/automation/04` |
| CI品質ゲート | `.github/workflows/validate.yml` ＋ `scripts/validate-problems.ts`（ajv）＋ Biome ＋ 型チェック ＋ `npm run verify` | `docs/automation/09` |
| アプリのデプロイ | `.github/workflows/deploy-pages.yml`（main マージで `web/` を GitHub Pages へ自動公開） | README ビジョン |
| X投稿生成＋予約 | `lib/engine/toXPost.ts`＋`xlength.ts`（重み付き280字・自動スレッド）＋`publish.ts`（poll併設・朝→夜引用） | `docs/automation/02` |
| 解答集計 | `lib/aggregate/`（poll→正答率・最頻誤答・難易度提案） | `docs/automation/03` |
| 過去問取込 | `lib/ingest/`（出典メタ必須・原典/生成分離・重複検出・要手修正フラグ） | `docs/automation/04` |
| 適応出題＋永続化 | `lib/scheduler/`（SM-2＋**FSRS**＋弱点診断。Webは FSRS を採用）＋`lib/store/`（インメモリ/JSONファイル/**Supabase実装**）＋`supabase/migrations`（RLS付きDDL） | `docs/automation/05` |
| コミュニティ儀式 | `lib/community/`（チェックイン・出戻り歓迎・卒業ロール） | `docs/automation/08` |
| 通知計画 | `lib/notify/`（頻度制御・オプトアウト・ジッター・試験カウントダウン） | `docs/automation/12` |
| シェアカード文言 / クロスポスト / 誤り訂正 / 週次KPI・UTM計測 | `lib/share-card` `lib/crosspost` `lib/correction` `lib/analytics`（`utm.ts`） | `docs/automation/06,07,10,11` |
| **オフライン学習アプリ（学習OS）** | `web/`（PWA・タブ型: 学習/復習/模試/質問/進捗/公式/設定。**図解(回路図/ベクトル図/ブロック図のインラインSVG)＋構造化解説**・**FSRS＋4段階評価**・弱点優先＋科目ドリル・**間違いノート**・**時間制限模試(合格判定)**・科目別到達度・試験カウントダウン・数式整形・自動生成12890問。**試験日逆算スケジューリング（直前モード）・科目別合格予測・本番再現模試（科目別実時間・一次4科目/二次合算判定）・二次の問題選択式・年度別通し模試・公式導出ドリル・電卓速算ドリル・前提コンセプトグラフ（学習順）・一次5択マークシート**。esbuild・Service Worker） | README ビジョン |
| **ゲーミフィケーション（継続の仕組み）** | `web/src/`（**XP/レベル/称号**=解答ログから完全導出・**日替わり/ウィークリークエスト**・**ストリークお守り**=7日ごと獲得で欠席日を自動カバー・**実績バッジ22種**・マスコット**「シンクウ」**=状況反応するインラインSVG・**自分の記録**統計・紙吹雪/効果音/XPフロートの祝賀演出） | `docs/strategy/ideas/13-gamification-duolingo-100.md` |
| **AI質問チャット（質問タブ）** | `lib/chat/`（検証済みナレッジ60件＝出典必須＋日本語バイグラム検索＋RAGプロンプト）＋`web/src/chat.ts`（**オフラインは内蔵ナレッジで即答／APIキー設定時は Claude をブラウザ直結(BYOK)でストリーミング**。法規は改正注意を自動付与） | `docs/strategy/ideas/10-ai-chat-100.md` |
| Obsidian/Markdown 書き出し | `lib/export/markdown.ts` ＋ `scripts/export-vault.ts`（vault レイアウト） | README ビジョン |
| **収益化（フリーミアム基盤）** | `lib/license/`＋`web/src/entitlements.ts`（**ECDSA署名ライセンスキー**＝サーバ不要のオフライン検証・無料枠=新規1日N問（復習/再出題は対象外）・模試/スキルドリルのProゲート。**既定=公開鍵未設定では全機能無料のまま**＝挙動不変）＋`scripts/license-keygen.ts`/`license-issue.ts`（販売者CLI: 鍵生成・キー発行） | `docs/strategy/monetization-setup.md` |
| **橋渡し収益（アフィリ・note・応援）** | `web/src/bridge-config.ts`＋`bridge.ts`（**config駆動・全既定空=導線非表示**。教材ガイド(公式タブ)・note/応援/招待導線・**非侵襲原則の機構化**=1日1件/学習中禁止/オプトアウト・**PR開示バッジ**(ステマ規制)・端末内クリック計測+UTMファーストタッチ）＋`docs/strategy/monetization-policy.md`（無料保護憲章・返金・OSS両立） | `docs/strategy/ideas/17-bridge-revenue-100.md` |
| **電気設計計算ツールキット（第2の商品・通年需要）** | `web/toolkit.html`＋`lib/toolkit/`（設計実務者向けの独立ページ。**抵抗ディレーティング・コンデンサ寿命(10℃2倍則＋周波数補正)・半導体熱計算(定常＋繰り返しパルス Zth)・電圧降下(単相2線/直流/単相3線/三相3線・力率＋リアクタンス)・IPC-2221パターン幅**の5モジュール。計算結果だけでなく**「なぜその式・係数か」の根拠解説**と**計算書印刷(PDF)**つき。完全ブラウザ内処理=データ非送信。無料2＋有料3モジュールを sku=`toolkit` のライセンスキーでゲート・**公開鍵未設定では全機能無料のまま**） | `docs/strategy/toolkit-product.md` |
| **帳票変更点抽出ツール（第3の商品・B2B/競合最薄）** | `web/sheet-diff.html`＋`lib/sheet-diff/`（部品表・端子表などの設計帳票を**キー列で突合**し、追加/削除/**セル単位の変更**を抽出。行の並べ替えを変更と誤検出しない・**各社雛形の列名エイリアス**・数値表記差(1.0と1)の同値扱い・**Shift_JIS自動判定**・キー重複検出。CSV書き出し/レポート印刷/プリセット保存が sku=`sheetdiff` の有料枠。**帳票は外部送信せず localStorage にも保存しない**） | `docs/strategy/sheet-diff-product.md` |

> ハルシネーション根本対策: **正解は LLM に出させずコードで算出**、最後に解説の数値と照合（不一致は破棄）。
> X 実投稿は無料API枠廃止(2026/2)＋凍結回避のため**既定で下書きエクスポート**（`lib/clients/x-client.ts`）。出題には poll を併設し、集計の一次ソースにする。
> 日本語は1文字=2カウントで280字を超えやすいため、投稿は重み付き長で自動スレッド分割。
> `problem-schema.json`(ajv) と zod 定義の**ドリフトをテストで検知**。Supabase スキーマは RLS 付きで `supabase/migrations/` に DDL を用意（実投稿/永続化の実体は認証取得後にアダプタ接続）。
> 二次=記述(descriptive)は自動採点せず**自己採点**（模範解答＋採点観点を提示）。`data/problems/` に手検算済みの validated 問題（T-0001〜0003）を収録。
> アプリ公開手順: Settings → Pages → Source = "GitHub Actions" にすると、main マージで自動デプロイされる。

### 使い方

```bash
npm install
npm run gen -- --topic 三相交流電力 --count 5            # 問題を生成（JSON を標準出力）
npm run gen -- --topic 誘導電動機の回転速度 --count 5     # 他: 直並列合成抵抗 / コンデンサの静電エネルギー(numeric)
npm run gen -- --topic 三相交流電力 --count 5 --xpost    # 朝/夜の投稿スレッドも表示
npm run validate:data                                     # data/ の問題を schema 検証（CIと同じ）
npm run export:vault -- --out out/vault                   # 問題を Obsidian Markdown に書き出し
npm run build:problems                                    # 全160テンプレから web/problems.json＋科目別シャード(web/problems/)を再生成（12890問・出荷済みIDは温存＋新規は内容由来の安定ID）
npm run coverage:pastexam                                 # 過去問20年分の出題分野カバレッジを集計（--json 対応）
npm run build:web                                         # オフライン学習アプリをバンドル → web/dist/
npm run lint                                              # Biome（lint + format チェック）
npm run typecheck && npm run typecheck:web               # 型チェック（lib/scripts/tests + web）
npm run verify                                            # CI と同一のプリプッシュ確認（lint+型+データ検証+テスト+ビルドを一括実行）
npm run audit:status                                      # 問題数・形式・監修状況の棚卸し
npm run supervision:status                                # 監修カバレッジ（合格者レビュー進捗・科目/論点別）。--json 対応
npm run supervision:packet -- --out out/packet.md         # 監修待ち問題のレビューパケット(Markdown)を書き出し
npm run supervision:mark -- T-0001                        # 合格者が監修合格と判断した問題のフラグを安全に立てる
npm run supervision:templates                             # テンプレ単位の監修カバレッジ（1件で平均81問を担保）。--json 対応
npm run supervision:templates:packet -- --out out/tp.md   # 監修待ちテンプレのレビューパケット（式・レンジ・生成サンプル3件）
npm run supervision:templates:mark -- --supervisor "名前" 三相交流電力  # テンプレを監修済みとして台帳に記録
npm run release:check                                     # 公開前の厳格チェック（audit strict含む）
npm test                                                  # ユニットテスト（vitest）
```

引数なしの `npm run gen` で利用可能な topic 一覧を表示。`-t` は `--topic` の短縮形。

`build:problems` には `--per-topic <N>`（既定 300）フラグで1トピックあたりの生成数を変更できる。
`gen` / `build:problems` / `validate:data` / `export:vault` / `audit:status` はいずれも `--help`（`-h`）で使用方法を表示する。
`gen` には `--xpost-limit <N>` (stdout 出力件数上限) / `--xpost-out <path>` (ファイル出力) / `--version` (`-v`) も追加されている。

**環境変数**（`.env.example` 参照）:
- `ANTHROPIC_API_KEY` — 解説文の言い回し生成（未設定時は決定論スタブで動作。数値はどちらもコード算出で同一）。
- `DENKEN_NARRATOR_MODE` — `auto`（既定）| `stub` | `api`。`auto` は API キーがあれば `api`、なければ `stub`。
- `DENKEN_NARRATE_MODEL` — ナレーターモデル名（既定 `claude-haiku-4-5`）。

**Node バージョン要件**: `.nvmrc` = 22、`package.json` の `engines` = `>=20`、`.npmrc` で `engine-strict=true`。
Node 20 未満では `npm install` / `npm ci` が即失敗する（不整合の早期検出）。

### オフライン学習アプリ（`web/`）

`npm run build:web` 後（`web/src/` を編集した場合は毎回実行）、
`web/` を静的配信（例 `npx serve web`）すると、ブラウザで学習できます。

**`web/src/` の構成（RG6 リファクタ後）:**

```
web/src/
  app.ts            — エントリポイント（90行。初期化・SW登録のみ）
  app-init.ts       — 問題データ読込（科目別シャード＋マニフェスト。失敗時は combined problems.json にフォールバック）
  keyboard.ts       — グローバルキーボードハンドラ
  ui/
    dom.ts          — DOM ヘルパー・h() タグビルダー・$req() null ガード（SafeHtml branded type）
    safe-html.ts    — SafeHtml branded type・safeHtml() キャスト（XSS 防止）
    toast.ts        — トースト通知（aria-live で SR に通知）
    widgets.ts      — 共通ウィジェット
  views/
    router.ts       — タブ型ルーティング・ヘッダ・ナビ（per-view エラー境界）
    practice.ts     — 学習タブ
    practice-grade.ts
    practice-rewards.ts
    review.ts       — 復習タブ
    exam.ts         — 模試タブ（clearExamTimer でタイマーリーク解消）
    chat.ts         — 質問タブ
    dashboard.ts    — 進捗タブ
    formulas.ts     — 公式タブ
    settings.ts     — 設定タブ
  state/
    app.ts          — アプリ全体の状態（テーマ・インストールプロンプト等）
    exam.ts         — 模試セッション状態（timerId 一元管理）
    practice.ts     — 学習セッション状態（combo/hints setter）
  dates.ts          — JST 日付ユーティリティ（shared）
  sanitize.ts       — SVG サニタイザ
  errors.ts         — recoveryView()（エラー境界用復旧 UI ヘルパー）
  （その他ロジックモジュール: xp/quests/freeze/achievements/fsrs/grade/select 等）
```

タブ型の学習OS（**学習 / 復習 / 模試 / 質問 / 進捗 / 公式 / 設定**）:

- **学習**: 弱点優先 or 科目ドリル。**図解（回路図・ベクトル図・ブロック図・特性曲線のインラインSVG）**＋
  **ヒント段階開示**（解答前に着眼点だけ覗ける）＋解答→即解説（着眼点/公式/代入/計算/ポイント・数式整形・経過時間）→
  **FSRS の4段階自己評価**（again/hard/good/easy）。選択肢は番号バッジつきでキーボード 1〜9 でも解答可。初回は3ステップガイド表示。
- **つづける仕組み（Duolingo型）**: 解答で **XP**（評価連動＋同日コンボボーナス。解答ログから完全導出）→
  **レベルと電験称号**（見習い電気係→フェーザ術師→電験マイスター・次称号ティーザー付き）。
  **日替わりクエスト3種**（全達成+20XP）＋**ウィークリークエスト3種**（全達成+50XP）・
  **ストリークお守り**（7日継続ごとに獲得・欠席日を次回起動時に自動カバー・最大2個）・**実績バッジ22種**（遡及判定）。
  マスコット**「シンクウ」**が状況に反応（目標達成を祝う/ストリーク危機を心配/ブランク復帰を歓迎・台詞は日替わり・
  設定で非表示可）。正解音・紙吹雪・XPフロート・ハプティクス・正解ポップ/不正解シェイクの祝賀演出
  （効果音は設定でオフ可・prefers-reduced-motion 尊重）。FSRS評価は 1〜3 キーでも選択可。
- **復習**: FSRS 期限の復習キュー（**1日上限でバッチ化**し復習の洪水を防止）＋**間違いノート**（誤答した問題を再演習＝想起練習）。
  **ストリークが途切れそうなときは予兆ナッジ**で背中を押す。日次目標達成は即時に祝うトースト。
- **模試**: **制限時間（一次3分/問・記述10分/問）の残り時間カウントダウン＋時間切れ自動終了**・合格ライン60%判定・科目別内訳で本番を再現。
  結果には**問題別○×の見直しリスト**（解説展開）と**間違いだけ再演習**ドリル。
- **質問**: **AIチャット**。オフラインでは検証済みナレッジ60件（用語/公式/制度/勉強法・出典付き）から即答。
  設定タブに自分の Anthropic API キーを登録すると（BYOK）、ローカル検索結果を接地コンテキストとして注入した
  Claude のストリーミング回答に切り替わる。法規・制度の回答には改正注意を自動付与。キーは端末内 localStorage のみ。
- **進捗**: **レベルカード（称号・次レベルまでのXPバー）**・**週間XPチャート**・**今週のクエスト**・
  科目別到達度・**科目別XP**・**自分の記録（自己ベスト統計）**・弱点TOP5・7日復習見込み・
  **試験カウントダウン**・日次目標・**実績バッジグリッド（解除数/22）**。
- **公式 / 設定**: 公式集（**検索フィルタつき**）、試験日・1日目標・**効果音（音量4段階）**・**おやすみ予約（🔥維持）**・
  **1日の復習上限**・FSRS目標保持率・AIチャット（APIキー/モデル）・
  **学習データのバックアップ（書き出し/復元。APIキーは含まない）**・データリセット。

UIは **WAI-ARIA tablist**（タブは左右矢印で移動）・描画例外時の**エラーバウンダリ**（学習記録は保持したまま復旧）・
**オフライン状態表示**を備えます。記憶状態は FSRS で localStorage に保存。Service Worker により**オフラインでも動作**します（バックエンド不要）。
学習法と試験構造は [`docs/strategy/exam-structure.md`](docs/strategy/exam-structure.md)、学習エンジンの改善計画100は
[`docs/strategy/ideas/06-exam-mastery-100.md`](docs/strategy/ideas/06-exam-mastery-100.md)、
ゲーミフィケーション設計100は [`docs/strategy/ideas/13-gamification-duolingo-100.md`](docs/strategy/ideas/13-gamification-duolingo-100.md) を参照。
`web/problems.json` は自動生成のデモ問題（コード検算済み・未監修）。数万問規模へのスケールに備え、
同じ内容を科目別シャード（`web/problems/<slug>.json`）＋索引（`web/problems/manifest.json`）にも分割出力し、
アプリはシャード経由で読み込む（単一巨大ファイルの一括 parse を避ける。combined はフォールバック用に維持）。

## Vision

電験三種・二種を独学で合格するための学習 OS。一度合格した知見を、次の受験者が再利用できる形で体系化することを目指します。

- 過去問データベース + 解説 markdown
- 弱点分野の自動診断 + 問題自動生成 (Claude API)
- 学習進捗の可視化 (Supabase で記録、Next.js でダッシュボード)
- Obsidian vault 形式でも配布 (個人学習者が手元で展開可能)
- n8n で過去問・解説の取り込み自動化

## Predicted stack

- **Frontend**: Next.js 16 (App Router) + shadcn/ui
- **Backend**: Supabase (Auth + Postgres + Storage)
- **Payment**: Stripe (会員制を想定)
- **AI**: Claude API (問題生成・解説) + Ollama (オフライン QA)
- **Source format**: Obsidian markdown (画像 / 数式 / 回路図対応)
- **Automation**: n8n (問題集 import / リマインダー)

## Roadmap (tentative)

| Milestone | Target | Status |
|---|---|---|
| M0 README + vision | 2026-05 | done |
| M0.5 Core engine / offline MVP | 2026-06 | in progress（問題生成・検証・PWA・Supabase DDLは実装済み） |
| M1 validated問題データ拡充 | 2026-06 | next（`npm run audit:status` で棚卸し、T-0001〜0003のみ validated） |
| M2 実Supabase/Auth接続 + 監修フロー | 2026-07 | not started |
| M3 βテスター向け運用 | 2026-08 | not started |
| M4 公開ベータ (無料 trial) | 2026-Q4 | not started |

## 情報発信・戦略ドキュメント

プロダクトと並行して進める情報発信の戦略・調査結果・運用・自動化の実装指示は
[`docs/`](docs/README.md) に体系的にまとめてある。

- [`docs/strategy/`](docs/strategy/) — コンセプト（凡人成り上がり）・図解・ロードマップ・評価・品質ハードニング・調査アイデア計600
- [`docs/x-strategy/`](docs/x-strategy/README.md) — X発信の運用パッケージ（コピペ可のテンプレ／問題スキーマ）
- [`docs/automation/`](docs/automation/README.md) — 自動化の実装指示（未実装のタスク仕様）

ポジションは「凡人が電験二種に挑む当事者 × 学習アプリ開発 × 共闘」。
「今日の一問」をエンジンにアプリの成長へ繋げる。品質保証・著作権・持続性の根本対策まで織り込み済み。

## License

デュアルライセンス（[`LICENSES.md`](LICENSES.md) に詳細）:
- ソースコード（`lib/`, `scripts/`, `web/`, `tests/`, `types/`, `supabase/`）= **MIT**（[`LICENSE`](LICENSE)）
- 問題データ（`data/`）／ドキュメント（`docs/`）= **CC-BY-SA-4.0**（[`LICENSE-DATA`](LICENSE-DATA)）
- 過去問由来データは `source.type` で出自を区別し、原著作の利用条件に従う（CC-BY-SA は原著作者の権利を上書きしない）。

## Contact

- GitHub Issues / Discussions (このリポ)
- 関連リポ: [thinkyou0714](https://github.com/thinkyou0714)

## Why "DENKEN"

「電験」のローマ字。学習 OS は「電験合格までのアルゴリズム化」を目指す思想を持つため、試験名そのものをプロダクト名に採用。

## Claude Code で開発する (web / cloud 対応)

このリポジトリは **Claude Code on the web**（claude.ai/code のクラウドセッション）に対応しています。

- 依存は `.claude/bootstrap.sh`（SessionStart フック）が `npm ci` で自動インストール（ローカルでは `node_modules` があれば no-op）。
- クラウドセッションは `AGENTS.md` と `.claude/skills/`（例: `run-tests`）を自動ロード。
- MCP は本リポジトリではローカル専用（ホスト型サーバー未設定）。詳細は
  [`.github/docs/claude-code-web-readiness.md`](https://github.com/thinkyou0714/.github/blob/main/docs/claude-code-web-readiness.md)。
