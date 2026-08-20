import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts", "lib/**/*.test.ts"],
    // E2E（Playwright）の *.spec.ts は別ランナーで実行する。include は *.test.ts のみのため
    // 通常は一致しないが、将来の取り違えを防ぐため明示的に除外しておく（E2E はブラウザ要・
    // この sandbox では browser download 不可のため非必須ワークフローで実行する）。
    exclude: ["**/node_modules/**", "**/dist/**", "tests/infra/e2e/**"],
    environment: "node",
    coverage: {
      provider: "v8",
      // text/html はローカル閲覧用、lcov は外部ツール連携用、json-summary は CI のバッジ/比較用。
      reporter: ["text", "html", "lcov", "json-summary"],
      // lib 全体 + web のロジック層を計測対象に含める（#75/#87）。
      // ただし DOM glue（state/ui/views）は node 環境で import 時に window/document へ触れて
      // 評価できないため除外する。これらは tests/web から間接的にしか到達せず、
      // include に残すと 0% ファイルとして全体率を不当に押し下げる。
      include: ["lib/**/*.ts", "web/src/**/*.ts"],
      // toolkit/ui・sheet-diff/ui は別商品ページの DOM glue（state/ui/views と同じ理由で除外）。
      exclude: [
        "web/src/state/**",
        "web/src/ui/**",
        "web/src/views/**",
        "web/src/toolkit/ui/**",
        "web/src/sheet-diff/ui/**",
      ],
      // 実測値を整数へ切り捨てた回帰防止フロア。値を上げるのは歓迎、下げる場合は理由をPRに記すこと。
      // 計測範囲が lib のみ → lib + web ロジック層（web/src の DOM glue を除く）へ拡大したため、
      // 床値も新しい実測に合わせて再設定した（#75/#87）。
      // 第4ラウンド(2026-06-17): include に web/src/**（state/ui/views を除外）を追加。
      //   全テスト緑・安定時の実測は stmts84.88 / branch77.23 / funcs92.11 / lines89.88。
      //   実測を整数へ切り捨てた値をフロアに採用（stmts84 / lines89）。
      //   branch/funcs はテンプレ拡充の進行で小幅変動するため floor から 1pt の余裕を残す
      //   （branch76 / funcs91）。CI を緑に保ちつつ回帰を防ぐ安全側設定。値を上げるのは歓迎。
      thresholds: {
        statements: 84,
        branches: 76,
        functions: 91,
        lines: 89,
      },
    },
  },
});
