/**
 * cli.ts — 問題生成エンジンの入口。
 *
 * 使い方:
 *   npm run gen -- --topic 三相交流電力 --count 5
 *   npm run gen -- --topic 三相交流電力 --count 5 --xpost
 *   npm run gen -- --topic 三相交流電力 --count 100 --out out/problems.json
 *   npm run gen -- --version
 *
 * 既定では ANTHROPIC_API_KEY が無ければ決定論スタブで言い回しを生成するので、
 * API キー無しでも動く。
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { generate } from "./generate.js";
import { type Exam, examEnum, type SourceType } from "./schema.js";
import { getTemplate, listTopics } from "./templates/index.js";
import { buildXPosts } from "./xpost/index.js";

export interface Args {
  topic?: string;
  count: number;
  source: SourceType;
  citation?: string;
  out?: string;
  xpost: boolean;
  /** 先頭 N 件のみ xpost プレビュー表示（既定: 10）。 */
  xpostLimit: number;
  /** xpost プレビューをファイルに出力（省略時は stderr）。 */
  xpostOut?: string;
  seed?: number;
  /** emit する問題の exam をテンプレ宣言値から上書きする（法規のような試験区分横断テンプレ用）。 */
  exam?: string;
  help: boolean;
  version: boolean;
}

const SOURCE_TYPES: readonly SourceType[] = ["original", "past_exam_modified", "past_exam_quoted"];
const EXAMS: readonly string[] = examEnum.options;

/** --topic 直後の値がオプション（--xxx）や欠落のとき警告を出してデフォルト扱いにする。 */
function isOptionLike(v: string | undefined): boolean {
  return v === undefined || v.startsWith("--") || v === "-h" || v === "-t" || v === "-v";
}

export function parseArgs(argv: string[]): Args {
  const args: Args = {
    count: 5,
    source: "original",
    xpost: false,
    xpostLimit: 10,
    help: false,
    version: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[i + 1];
      if (isOptionLike(v)) return undefined;
      i++;
      return v;
    };
    switch (a) {
      case "--topic":
      case "-t": {
        const v = next();
        if (v !== undefined) {
          args.topic = v;
        } else {
          console.warn("警告: --topic の直後に値がありません。--topic を無視します。");
        }
        break;
      }
      case "--count": {
        // next() ガードで統一（値欠落・次オプション誤消費を防ぐ）。値が無ければ既定を維持。
        const v = next();
        if (v !== undefined) args.count = Number(v);
        break;
      }
      case "--source": {
        // 値欠落時に次のオプション（例: --out）を source として誤読しないよう next() を使う。
        const v = next();
        if (v !== undefined) args.source = v as SourceType;
        break;
      }
      case "--citation": {
        const v = next();
        if (v !== undefined) args.citation = v;
        break;
      }
      case "--out": {
        const v = next();
        if (v !== undefined) args.out = v;
        break;
      }
      case "--xpost":
        args.xpost = true;
        break;
      case "--xpost-limit": {
        const v = next();
        if (v !== undefined) args.xpostLimit = Number(v);
        break;
      }
      case "--xpost-out": {
        const v = next();
        if (v !== undefined) args.xpostOut = v;
        break;
      }
      case "--seed": {
        const v = next();
        if (v !== undefined) args.seed = Number(v);
        break;
      }
      case "--exam": {
        const v = next();
        if (v !== undefined) args.exam = v;
        break;
      }
      case "--help":
      case "-h":
        args.help = true;
        break;
      case "--version":
      case "-v":
        args.version = true;
        break;
      default:
        if (a?.startsWith("-")) console.warn(`警告: 未知のオプション: ${a}`);
    }
  }
  return args;
}

/** 引数の妥当性を検証し、人間可読のエラー一覧を返す（空配列なら OK）。topic の存在確認は呼び出し側。 */
export function argErrors(args: Args): string[] {
  const errs: string[] = [];
  if (!Number.isInteger(args.count) || args.count < 1 || args.count > 100_000) {
    errs.push("--count は 1〜100000 の整数で指定してください");
  }
  if (!SOURCE_TYPES.includes(args.source)) {
    errs.push(`--source が不正です: ${args.source}（${SOURCE_TYPES.join(" / ")} のいずれか）`);
  }
  if (args.source !== "original" && !args.citation) {
    errs.push("--source が original 以外のときは --citation（出典）が必須です");
  }
  if (args.seed !== undefined && !Number.isFinite(args.seed)) {
    errs.push("--seed は数値で指定してください");
  }
  if (args.exam !== undefined && !EXAMS.includes(args.exam)) {
    errs.push(`--exam が不正です: ${args.exam}（${EXAMS.join(" / ")} のいずれか）`);
  }
  if (!Number.isInteger(args.xpostLimit) || args.xpostLimit < 1) {
    errs.push("--xpost-limit は 1 以上の整数で指定してください");
  }
  return errs;
}

const USAGE = `DENKEN-OS 問題生成エンジン

使い方:
  npm run gen -- --topic <論点> [--count N] [--source <type>] [--citation <出典>]
                 [--out <path>] [--xpost] [--xpost-limit N] [--xpost-out <path>]
                 [--seed N] [--version]

オプション:
  --topic, -t   生成する論点（必須）。引数なしで一覧表示。
  --count       生成件数（1〜100000、既定 5）。
  --source      original | past_exam_modified | past_exam_quoted（既定 original）。
  --citation    出典（original 以外で必須）。
  --out         JSON の出力先ファイル（省略時は標準出力）。
  --xpost       朝/夜の X 投稿スレッドもプレビュー表示。
  --xpost-limit 先頭 N 件のみ xpost プレビュー（既定 10）。
  --xpost-out   xpost プレビューをファイルに出力。
  --seed        決定論 RNG のシード（再現生成用）。
  --exam        出力の試験区分をテンプレ宣言値から上書き
                （denken3 | denken2_primary | denken2_secondary）。
  --version, -v バージョン番号を表示して終了。
  -h, --help    このヘルプを表示。`;

/** seed 付き決定論 RNG（再現性のため。mulberry32）。 */
export function makeRng(seed?: number): (() => number) | undefined {
  if (seed === undefined) return undefined;
  let s = seed >>> 0;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** package.json の version フィールドを読んで返す。 */
export function readVersion(): string {
  try {
    const pkgPath = resolve(fileURLToPath(import.meta.url), "../../../package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version?: string };
    return pkg.version ?? "unknown";
  } catch {
    return "unknown";
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.version) {
    console.log(readVersion());
    return;
  }

  if (args.help) {
    console.log(USAGE);
    return;
  }

  if (!args.topic) {
    console.error("エラー: --topic は必須です。利用可能な topic:");
    for (const t of listTopics()) console.error(`  - ${t}`);
    process.exit(1);
  }

  const errors = argErrors(args);
  if (errors.length > 0) {
    console.error("エラー:");
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  const template = getTemplate(args.topic);
  if (!template) {
    console.error(`未知の topic: ${args.topic}。利用可能: ${listTopics().join(", ")}`);
    process.exit(1);
  }

  // --seed 未指定でも常に seed 付きで生成し、使った seed をログする。
  // 出力の再現手段を確保するため（CLAUDE.md「決定論的なパラメータ生成」の実効化）。
  // Math.random 直流し（旧既定）は同じ出力を二度と再現できなかった。
  const effectiveSeed = args.seed ?? Date.now() >>> 0;
  if (args.seed === undefined) {
    console.error(`--seed 未指定のため seed=${effectiveSeed} を採番しました（再現するには --seed ${effectiveSeed}）。`);
  }

  let problems: Awaited<ReturnType<typeof generate>>;
  try {
    const rng = makeRng(effectiveSeed);
    problems = await generate(template, {
      count: args.count,
      source: args.source,
      ...(args.citation !== undefined && { citation: args.citation }),
      ...(rng !== undefined && { rng }),
      ...(args.exam !== undefined && { examOverride: args.exam as Exam }),
    });
  } catch (e) {
    // draw/narrate/validate 各段階のエラーに topic 文脈を付与。
    // エラーメッセージから段階を推測してログレベルを分離。
    const msg = e instanceof Error ? e.message : String(e);
    const stage = /narrat/i.test(msg) ? "narrate" : /validat/i.test(msg) ? "validate" : "draw";
    console.error(`[${stage}] topic="${args.topic}" の問題生成中にエラーが発生しました:`);
    console.error(msg);
    process.exit(1);
  }

  const json = JSON.stringify(problems, null, 2);
  if (args.out) {
    try {
      mkdirSync(dirname(args.out), { recursive: true });
      writeFileSync(args.out, `${json}\n`, "utf8");
      console.error(`${problems.length} 件を ${args.out} に書き出しました。`);
    } catch (e) {
      console.error(`[write] 出力ファイル "${args.out}" への書き込みに失敗しました:`);
      console.error(e instanceof Error ? e.message : e);
      process.exit(1);
    }
  } else {
    console.log(json);
  }

  if (args.xpost) {
    // 先頭 xpostLimit 件のみプレビュー（stdout 肥大防止 / II-126）。
    const previewProblems = problems.slice(0, args.xpostLimit);
    const xpostLines: string[] = [];
    xpostLines.push("\n--- X 投稿プレビュー（朝/夜スレッド） ---");
    if (problems.length > args.xpostLimit) {
      xpostLines.push(`（全 ${problems.length} 件中先頭 ${args.xpostLimit} 件を表示 / --xpost-limit で変更可）`);
    }

    for (const p of previewProblems) {
      try {
        const xpostRng = makeRng(effectiveSeed);
        const posts = buildXPosts(p, { ...(xpostRng !== undefined && { rng: xpostRng }) });
        const fmt = (thread: string[]) => thread.map((t, i) => `  [${i + 1}/${thread.length}] ${t}`).join("\n");
        xpostLines.push(`\n[${p.id}] 朝:\n${fmt(posts.morning)}\n\n[${p.id}] 夜:\n${fmt(posts.evening)}`);
      } catch (e) {
        // xpost 文面生成のエラーに topic・問題 ID の文脈を付与。
        xpostLines.push(
          `[xpost] topic="${args.topic}" id="${p.id}" の投稿文面生成中にエラーが発生しました: ${e instanceof Error ? e.message : e}`,
        );
      }
    }

    const xpostOutput = xpostLines.join("\n");

    if (args.xpostOut) {
      try {
        mkdirSync(dirname(args.xpostOut), { recursive: true });
        writeFileSync(args.xpostOut, `${xpostOutput}\n`, "utf8");
        console.error(`xpost プレビューを ${args.xpostOut} に書き出しました。`);
      } catch (e) {
        console.error(`[xpost-write] ファイル "${args.xpostOut}" への書き込みに失敗しました:`);
        console.error(e instanceof Error ? e.message : e);
      }
    } else {
      console.error(xpostOutput);
    }
  }
}

// 直接実行(`tsx lib/engine/cli.ts`)のときだけ走らせる。
// テスト等が parseArgs/argErrors/makeRng を import しても main の副作用(生成・process.exit)を出さない。
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
