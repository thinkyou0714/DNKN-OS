/**
 * tests/infra/playwright.config.ts
 *
 * Playwright E2E のスタンドアロン設定（vitest とは別ランナー）。
 *
 * 重要:
 *   - この設定とその配下の *.spec.ts は **vitest の対象外**（vitest は *.test.ts のみ収集し、
 *     さらに vitest.config.ts で tests/infra/e2e を明示除外している）。よって既存の
 *     `npm test` / validate パイプラインを汚さない。
 *   - 実行には Chromium バイナリが必要。開発 sandbox では `npx playwright install chromium` の
 *     ダウンロード先（cdn.playwright.dev）が egress 許可外のため取得できない。
 *     そのため E2E は **非必須の別ワークフロー（.github/workflows/e2e.yml）** で、
 *     ブラウザ取得が可能な GitHub Actions ランナー上でのみ実行する。
 *   - webServer は追加依存を避けるため Node 標準モジュールだけで web/ を静的配信する。
 *     web/ のソースは編集せず、配信（読み取り）のみ行う。
 *
 * ローカル実行（ブラウザ取得が可能な環境）:
 *   npm run build:web
 *   npx playwright install chromium
 *   npm run test:e2e
 */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const webDir = resolve(repoRoot, "web");
const PORT = 4317;

// 追加依存なしの静的サーバ（Node 標準のみ）。web/ を読み取り専用で配信する。
// 実体は static-server.cjs。以前のインライン `node -e "..."` は JSON.stringify の
// ダブルクォートが sh -c のダブルクォートに剥がされ、Node がパスを正規表現として
// 解釈して常に SyntaxError で落ちていた。設定は env で渡しクォート入れ子をなくす。
const STATIC_SERVER_PATH = resolve(__dirname, "static-server.cjs");

export default defineConfig({
  testDir: resolve(__dirname, "e2e"),
  testMatch: /.*\.spec\.ts$/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  timeout: 30_000,
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `node ${JSON.stringify(STATIC_SERVER_PATH)}`,
    env: {
      E2E_WEB_ROOT: webDir,
      E2E_PORT: String(PORT),
    },
    url: `http://127.0.0.1:${PORT}/index.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
