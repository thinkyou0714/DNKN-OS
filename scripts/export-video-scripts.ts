#!/usr/bin/env tsx
/**
 * export-video-scripts.ts — 解法動画のナレーション台本を Markdown で書き出す。
 *
 * 解法スライド（lib/curriculum/solution-slides.ts）を台本化する
 * lib/curriculum/narration-script.ts の CLI。収録者は出力された台本を読み上げながら
 * スライドを送るだけで「解く流れの動画」を撮れる（docs/strategy/ideas/20 §22-23）。
 *
 * 使い方:
 *   npm run export:video-scripts -- --id D-0001
 *   npm run export:video-scripts -- --topic 三相交流電力 --limit 5
 *   npm run export:video-scripts -- --help
 */
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildVideoScript, formatVideoScript } from "../lib/curriculum/narration-script.js";
import { atomicWriteFileSync, printHelp } from "./shared.js";

const HELP = `\
export-video-scripts — 解法動画のナレーション台本を Markdown で書き出す

使い方:
  npm run export:video-scripts [-- オプション]

オプション:
  --id <problemId>   指定IDの問題だけを台本化（複数指定可）
  --topic <topic>    指定論点の問題を台本化
  --limit <n>        書き出す最大件数（既定 10）
  --out <dir>        出力先ディレクトリ（既定 out/video-scripts）
  --help, -h         このヘルプを表示して終了

例:
  npm run export:video-scripts -- --id D-0001
  npm run export:video-scripts -- --topic 三相交流電力 --limit 5
`;

interface WebProblem {
  id: string;
  subject: string;
  topic: string;
  statement: string;
  answer: string;
  solution: string[];
}

/** ファイル名に使えない文字を避ける（問題IDは通常英数だが防御的に）。 */
function safeFileName(id: string): string {
  return id.replace(/[^\w.-]/g, "_");
}

function main(): void {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) printHelp(HELP);

  const ids: string[] = [];
  let topic: string | undefined;
  let limit = 10;
  let outDir = join("out", "video-scripts");
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--id" && argv[i + 1] !== undefined) ids.push(argv[++i] as string);
    else if (a === "--topic" && argv[i + 1] !== undefined) topic = argv[++i] as string;
    else if (a === "--limit" && argv[i + 1] !== undefined) limit = Math.max(1, Number(argv[++i]) || 10);
    else if (a === "--out" && argv[i + 1] !== undefined) outDir = argv[++i] as string;
  }

  const problems = JSON.parse(readFileSync("web/problems.json", "utf8")) as WebProblem[];
  let picked = problems;
  if (ids.length > 0) picked = picked.filter((p) => ids.includes(p.id));
  if (topic !== undefined) picked = picked.filter((p) => p.topic === topic);
  const skipped = Math.max(0, picked.length - limit);
  picked = picked.slice(0, limit);

  if (picked.length === 0) {
    process.stderr.write("❌ 条件に一致する問題がありません（--id / --topic を確認してください）\n");
    process.exit(1);
  }

  mkdirSync(outDir, { recursive: true });
  for (const p of picked) {
    const script = buildVideoScript(p);
    const md = formatVideoScript(script, { id: p.id, subject: p.subject, topic: p.topic });
    atomicWriteFileSync(join(outDir, `${safeFileName(p.id)}.md`), md);
  }
  process.stdout.write(`${picked.length} 件の台本を ${outDir} に書き出しました。\n`);
  if (skipped > 0) {
    process.stdout.write(
      `（条件一致は計 ${picked.length + skipped} 件。--limit ${limit} で ${skipped} 件を省きました）\n`,
    );
  }
}

main();
