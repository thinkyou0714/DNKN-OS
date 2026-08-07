#!/usr/bin/env tsx
/**
 * audit-status.ts — リポジトリのステータス監査。
 *
 * Default mode は advisory（exit 0）: README/status のズレと問題データ不足を
 * ブロックせずに繰り返し可能なレポートに変換する。
 * リリースゲートで失敗させたい場合は --strict を使う。
 *
 * 使い方:
 *   npm run audit:status
 *   npm run audit:status -- --strict
 *   npm run audit:status -- --json
 *   npm run audit:status -- --help
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { auditStatus, formatAuditSummary, type InvalidProblemFile, parseAuditCliOptions } from "../lib/audit/status.js";
import { templateSupervisionReport } from "../lib/audit/template-supervision.js";
import { type Problem, problemSchema } from "../lib/engine/schema.js";
import { getTemplate, listTopics } from "../lib/engine/templates/index.js";
import type { Template } from "../lib/engine/templates/types.js";
import { printHelp } from "./shared.js";
import { loadTemplateLedger } from "./supervision-io.js";

const HELP = `\
audit-status — リポジトリの品質ステータスを監査する

使い方:
  npm run audit:status [-- オプション]

オプション:
  --strict        推奨事項があれば exit 1（リリースゲート用）
  --json          結果を JSON 形式で出力
  --help, -h      このヘルプを表示して終了

例:
  npm run audit:status
  npm run audit:status -- --strict
  npm run audit:status -- --json
  npm run audit:status:strict    # package.json の短縮形（--strict 相当）
`;

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_DIR = join(ROOT, "data/problems");
const TEST_DIR = join(ROOT, "tests");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(path));
    else out.push(path);
  }
  return out;
}

/** 問題データを読み込む純関数（テスト可能）。 */
export function readProblems(dataDir: string): { parsed: Problem[]; invalidFiles: InvalidProblemFile[] } {
  const parsed: Problem[] = [];
  const invalidFiles: InvalidProblemFile[] = [];
  for (const file of readdirSync(dataDir).filter((f) => f.endsWith(".json"))) {
    const path = join(dataDir, file);
    try {
      const raw = JSON.parse(readFileSync(path, "utf8"));
      const result = problemSchema.safeParse(raw);
      if (result.success) parsed.push(result.data);
      else
        invalidFiles.push({
          file,
          reason: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
        });
    } catch (error) {
      invalidFiles.push({ file, reason: error instanceof Error ? error.message : String(error) });
    }
  }
  return { parsed, invalidFiles };
}

function main(): void {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    printHelp(HELP);
  }

  const options = parseAuditCliOptions(argv);
  const { parsed, invalidFiles } = readProblems(DATA_DIR);
  // テンプレ監修の破れ（要再監修・孤児）は専用コマンドを叩かないと気づけないため、
  // 通常の監査にも載せる（--strict ではリリースを止める）。
  const templates = listTopics()
    .map((topic) => getTemplate(topic))
    .filter((t): t is Template => t !== undefined);
  const tsReport = templateSupervisionReport({ templates, ledger: loadTemplateLedger() });
  const summary = auditStatus({
    problems: parsed,
    invalidSchema: invalidFiles.length,
    invalidFiles,
    testFiles: walk(TEST_DIR).filter((f) => f.endsWith(".test.ts")).length,
    thresholds: options.thresholds,
    templateSupervision: {
      total: tsReport.total,
      supervised: tsReport.supervised,
      stale: tsReport.stale,
      orphans: tsReport.orphans.length,
    },
  });

  if (options.json) console.log(JSON.stringify(summary, null, 2));
  else console.log(formatAuditSummary(summary));

  if (options.strict && !summary.okForRelease) process.exit(1);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
