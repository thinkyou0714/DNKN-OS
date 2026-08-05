# `lib/` — ドメインロジック

純ロジックのみを置く層。DOM やネットワーク等の副作用は `clients/` 境界に隔離する。
全体構成と依存グラフは [`docs/architecture.md`](../docs/architecture.md) を参照。

| モジュール | 責務 | 仕様 |
|---|---|---|
| `engine/` | 問題生成＆検証の中核。`schema.ts`(Problem型/zod) を共通言語に、`generate`→`narrate`(言い回し)→`validate`→`gate`→`clean` を束ねる | [`automation/01`](../docs/automation/01-problem-engine.md) |
| `engine/templates/` | 科目別の**決定論ソルバ**（数値はコードで算出。LLM には出させない） | 〃 |
| `engine/xpost/` | X投稿パイプライン。`xlength`(重み付き文字数)→`toXPost`(朝/夜文面)→`publish`(予約) | [`automation/02`](../docs/automation/02-xpost-scheduler.md) |
| `clients/` | 外部I/O境界。`x-client.ts` は既定で**下書きエクスポート**（実投稿は認証後に差替） | 〃 |
| `aggregate/` | poll → 正答率・最頻誤答・難易度提案 | [`automation/03`](../docs/automation/03-answer-aggregator.md) |
| `ingest/` | 過去問取込（出典メタ必須・原典/生成分離・重複検出・要手修正フラグ） | [`automation/04`](../docs/automation/04-pastexam-ingest.md) |
| `scheduler/` | 適応出題。SM-2 ＋ FSRS ＋ 弱点診断（独立モジュール） | [`automation/05`](../docs/automation/05-adaptive-diagnosis.md) |
| `curriculum/` | 体系学習パイプライン。前提コンセプトDAG（旧 `web/src/concept-graph.ts` を移設・単一情報源化）＋原理カード（なぜ成り立つか・導出・納得チェック）＋習得状態つきロードマップ生成＋弱点の根っこ診断（前提不足の検出） | — |
| `store/` | 永続化アダプタ（インメモリ / JSONファイル / Supabase） | 〃 |
| `share-card/` | シェアカード文言生成 | [`automation/06`](../docs/automation/06-share-card-generator.md) |
| `analytics/` | 週次KPIレビュー ＋ UTM 計測（`utm.ts`） | [`automation/07`](../docs/automation/07-analytics-weekly-review.md) |
| `community/` | コミュニティ儀式（チェックイン・出戻り歓迎・卒業ロール） | [`automation/08`](../docs/automation/08-community-bot.md) |
| `correction/` | 誤り訂正の分類・対応 | [`automation/10`](../docs/automation/10-correction-monitor.md) |
| `crosspost/` | 媒体別クロスポスト下書き（丸転載しない） | [`automation/11`](../docs/automation/11-repurpose-crosspost.md) |
| `notify/` | 通知計画（頻度制御・オプトアウト・ジッター・試験カウントダウン） | [`automation/12`](../docs/automation/12-reminder-notifications.md) |
| `export/` | Obsidian/Markdown 書き出し（vault レイアウト） | README ビジョン |

## 規約

- **テストは `tests/` 配下に本構成を 1:1 ミラーで配置**する（例: `lib/engine/xpost/` ↔ `tests/engine/xpost/`）。
- import は **ESM の `.js` 拡張子付き**で書く（移植性のためパスエイリアスは使わない）。
- 副作用（fs/net/DOM）はモジュール本体に書かず、`clients/` か入口層（`scripts/`・`web/`）に寄せる。
- `Problem` 型に関わる変更は `engine/schema.ts`(zod) と
  `docs/x-strategy/templates/problem-schema.json`(JSON Schema) の**両方**を更新し、
  `tests/engine/schema-consistency.test.ts` を通すこと。
