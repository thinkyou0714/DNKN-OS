# 収益化（Monetization）— 設計・調査パッケージ

DENKEN-OS を「収益化できる状態」まで作るための **調査 + 設計** 一式。実装本体は次段（Codex `/goal` T01–T20）。

## 方針（承認済み）
- **アーキテクチャ**: フル Next.js 16 (App Router) + shadcn/ui + Supabase Auth(magic-link) + Stripe サブスク + Vercel。offline-first 維持。
- **稼働姿勢**: 全部作るが **休眠 / flip 可能**（Stripe test mode + `BILLING_ENABLED=false`）。本番化＝キー差替え + flag ON。
- **基点**: `origin/main`（緑・1400 tests・Next 宣言済・996 問）。
- **課金モデル**: 無料=1問/日+要点+固定問題+シェア画像 / 有料=無限類題+深い解説+弱点適応+進捗同期。
- **ライセンス境界**: 課金は**サービス**に対して。CC-BY-SA データ本体は独占/クローズド化しない。

## ドキュメント
| ファイル | 内容 |
|---|---|
| [`00-base-decision.md`](00-base-decision.md) | 基点=`origin/main` の決定・ベースライン健全性（1400 tests 緑）・ブランチ分岐 RB1/RB2 の棚卸しと推奨 |
| [`RESEARCH-2026-07.md`](RESEARCH-2026-07.md) | 収益化 深堀調査 100 アイデア（impact×fit/effort 採点）+ 次ターン最優先候補 + 一次出典 |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | 休眠/flip 可能な Next.js SaaS の目標構成（ground-truth 補正・Next16 注意・entitlement/Auth/同期/CSP/CI 設計） |
| [`goals/GOALS.md`](goals/GOALS.md) | 実装タスク分解 T01–T20（依存順・7フィールド /goal spec・ADDITIVE-SAFE/SHARED マーク） |
| [`HUMAN-TASKS.md`](HUMAN-TASKS.md) | 収益化フェーズの人間タスク（Supabase/Stripe/Vercel アカウント・特商法/開業届/インボイス・監修・価格判断） |

## 関連（既存）
- 収益化モデルの正典: [`../x-strategy/07-monetization-failure-hedge.md`](../x-strategy/07-monetization-failure-hedge.md)
- コンプラ基盤: [`../x-strategy/04-compliance.md`](../x-strategy/04-compliance.md)
- 立ち上げ全般の人間タスク: [`../strategy/human-tasks.md`](../strategy/human-tasks.md)
- 参照実装（社内・private）: `thinkyou0714/lab-lms`（`@supabase/ssr` + Stripe + pricing + verify script）

## 次のアクション（次ターン）
1. `origin/main` から `feat/monetization` を分岐（T01）。
2. Codex(`/goal`, xhigh, `--write`)へ **依存順**で T02→… を dispatch。各 T を Opus-max/reviewer で検証。
3. Phase 1（Next 移植・SW・CSP・CI）が最難関 → ここを厚くレビュー。
4. 課金は最後まで flag OFF。人間の GO 判断（合格/規模）まで本番化しない。
