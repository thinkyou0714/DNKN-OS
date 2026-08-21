# 収益化ビルドの基点決定 & ブランチ分岐の棚卸し（RB1 / RB2）

> 収益化レイヤーをどのブランチの上に載せるかの決定と、その根拠。実装 T01 の成果物。

## 決定（TL;DR）

- **基点 = `origin/main`**。収益化ブランチ `docs/monetization-foundation-2026-07`（本 PR）は `origin/main` から分岐。
- **`feat/eval-2026-06` は「参照のみ」**。その堅牢化を main へ取り込むかは **人間の判断事項**（本書は棚卸し＋推奨まで。自動マージはしない）。
- eval 限定プリミティブ（`mergeBackup` / `assertNoServerSecrets` / `{reviews,logs}` store 形状）は **cherry-pick せず store レベルで再実装**（形状差のため）。

## 移行前ベースライン健全性（`origin/main` @ 33f14db）

`npm ci && npm run verify` 実走結果:

| 項目 | 結果 |
|---|---|
| テスト | **104 files / 1400 tests 全 pass** |
| lint(Biome) / typecheck / typecheck:web / validate:data | pass |
| build:web バンドル | 242.1 KB（gzip 69.7）/ 上限 500 KB — 予算内 |
| `web/problems.json` | **996 問**（＝有料「無限演習」の在庫は main で既に厚い。cf. eval ブランチは 28 問） |

→ **main は緑・移行可能な健全ベース**。収益化の scaffold はこの上に安全に載る。

## RB1: ブランチ分岐（`origin/main` ↔ `feat/eval-2026-06`）

- **共通祖先（merge-base）**: `343ed9e`（2026-06-07 `chore(github-governance): harden workflow permissions`）。
- **分岐規模**: eval 限定 **30 commit** / main 限定 **27 commit**（交わっていない）。

### 各ブランチが持つ固有の価値

| ブランチ | 固有の内容（要約） |
|---|---|
| **`origin/main`（27 commit）** | 設計全面刷新(#53「上質な紙＋朱色採点ペン」)、Claude Code web-readiness+`AGENTS.md`(#54)、監修フロー可視化/`supervision:mark`(#49/#50)、e2e(Playwright)/codeql/release CI、996 問バンク、`0005_rls_column_checks.sql`+`rls-mock` test |
| **`feat/eval-2026-06`（30 commit）** | エンジン/スケジューラ堅牢化（F1 最終値アンカー、SCHED FSRS state、E4 空白 answer、DI 系）、`localStorage→IndexedDB` 移行 + schema-version、provenance gate（published 必須）、RLS 不変条件の静的テスト、テンプレ拡充（単位換算/短絡容量/6科目カバー）、`web/sw.js` `__BUILD_HASH__` guard |

### なぜ main を基点にするか
1. `AGENTS.md`(#54) が既に `Stack: TypeScript / Next.js (web/)` を宣言 → 収益化の方向（Next.js 移行）と一致。
2. CI が上位（e2e/codeql/release を保有）。
3. UI 刷新済み・996 問バンク＝プロダクトとして「顔」が先行。
4. 収益化は新規レイヤーで、main の欠く堅牢化（下記）と**衝突しない**領域が大半。

### eval の堅牢化をどうするか（人間判断・推奨）
eval には main に無い**実バグ修正**が含まれる。放置すると main 系プロダクトに既知バグが残る。推奨:
- **別 PR で段階的に main へ port**（本収益化 PR とは分離）。優先度高い候補:
  - `provenance gate（published 必須）` — 監修フローの品質契約（#49/#50 と親和）。
  - `RLS 不変条件テスト` — 収益化で **entitlements/billing テーブルを足す前に main へ入れておくと安全**（本設計の `0006`/`0007` がこの不変条件を前提にする）。
  - `IndexedDB 移行 + schema-version` — 収益化の同期層（T13）が耐久ストレージを前提にできる。
  - F1/E4/SCHED 系のエンジン修正 — 反ハルシネーション/採点/FSRS の実バグ。
- **注意**: `mergeBackup` と `{reviews,logs}` 形状、`assertNoServerSecrets`(esbuild) は main の `{cards,logs}` / Next 構成と**非互換** → これらは cherry-pick せず、本設計で **store レベル再実装（T13）/ post-build scan（T07）** に置換する。

> 実マージ・port の実行は本 PR の範囲外（human-tasks 参照）。ここでは「何を・なぜ・どの順で」を提示するに留める。

## RB2: eval ブランチ限定の失敗テスト

- 症状: `feat/eval-2026-06` で `npm test` が **1 failed / 351 passed**。`tests/web/build-guard.test.ts` が
  `web/sw.js` に `const CACHE = "denken-os-__BUILD_HASH__"` を期待するが、実ファイルは **ビルド刻印済みハッシュ**
  (`denken-os-47c4bfc132a6`) が commit されている（`build:web` の in-place stamp を誤って commit した典型ミス。
  guard 自体が意図通り検出している）。
- **根本原因**: `build:web` が `web/sw.js` を in-place で書き換える設計 + 刻印後の state を commit してしまう運用穴。
- **影響範囲**: **eval ブランチ限定**。`origin/main` は SW 版数方式が別（`denken-os-v21-<hash>`）で当該 guard test 自体が無い → **本収益化 PR（main 基点）には存在しない**。
- **対処（eval を残す場合のみ）**: `web/sw.js` の該当行を `denken-os-__BUILD_HASH__` プレースホルダへ復元して commit すれば緑化（352 pass）。
  ただし本設計では SW を **Serwist へ置換（T05）**するため、Next 移行後はこの guard/stamp 機構自体が退役する。
  → eval を main に取り込む場合のみ暫定修正、そうでなければ **Serwist 置換で恒久解消**。

## 結論
- 収益化は `origin/main`（緑・1400 tests・Next 宣言済・996 問）を基点に前進する。
- eval の価値ある堅牢化は **別 PR で human 判断のもと port**（優先: provenance / RLS 不変条件 / IDB 移行 / エンジン実バグ）。
- 非互換プリミティブは再実装で吸収。RB2 は Serwist 置換で恒久解消（暫定修正は eval 保持時のみ）。
