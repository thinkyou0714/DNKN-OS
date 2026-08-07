/**
 * build-web.ts — オフライン学習アプリを esbuild で単一バンドルにする。
 * web/src/app.ts（DOM）が lib/* の純ロジック(scheduler/diagnosis/share-card)を import する。
 * lib は ESM の `.js` 拡張子付き import を使うため、`.js`→`.ts` を解決するプラグインを噛ませる。
 *
 * ビルド後に生成物のサイズレポート（生バイト・gzip サイズ）を出力する。
 * sourcemap の sources が空の場合は異常として throw する。
 *
 * ## SRI / SW バージョン自動化（RG7）
 * - app.js の SHA-384 を計算して web/index.html の __SRI_HASH__ プレースホルダを書き換える。
 * - 全キャッシュ対象アセットの内容ハッシュ先頭8文字を使って web/sw.js の版数トークンを
 *   "<SW_MAJOR>-<hash>" に書き換える（SW_MAJOR 定数が唯一の真実）。
 * - バンドルサイズ予算チェック: BUNDLE_SIZE_LIMIT_KB 環境変数（既定 500）超過時は警告。
 *   GITHUB_STEP_SUMMARY が設定されていれば GitHub Actions のサマリーに書き込む。
 */
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { build } from "esbuild";
import { allShardSlugs, MANIFEST_FILE, SHARD_DIR } from "../lib/shared/problem-shards.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

/** 相対 import の `.js` 指定を、実在する `.ts` に解決する。 */
const tsResolve = {
  name: "ts-resolve",
  setup(b: import("esbuild").PluginBuild) {
    b.onResolve({ filter: /^\.{1,2}\/.*\.js$/ }, (args) => {
      const tsPath = resolve(args.resolveDir, args.path.replace(/\.js$/, ".ts"));
      if (existsSync(tsPath)) return { path: tsPath };
      return undefined;
    });
  },
};

/** バイト数を人間が読みやすい形式に変換する。 */
function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

/** ファイルのサイズ情報（生バイト・gzip サイズ）を取得する。 */
function getFileSizeInfo(filePath: string): { raw: number; gzip: number } {
  const raw = statSync(filePath).size;
  const content = readFileSync(filePath, "utf-8");
  const gzip = gzipSync(content).length;
  return { raw, gzip };
}

/** サイズレポートを表形式で出力する。 */
function printSizeReport(files: Array<{ name: string; raw: number; gzip: number }>): void {
  const cols = {
    name: Math.max(8, ...files.map((f) => f.name.length)),
    raw: Math.max(8, ...files.map((f) => fmtBytes(f.raw).length)),
    gzip: Math.max(8, ...files.map((f) => fmtBytes(f.gzip).length)),
  };
  const sep = `+-${"-".repeat(cols.name)}-+-${"-".repeat(cols.raw)}-+-${"-".repeat(cols.gzip)}-+`;
  const header = `| ${"ファイル".padEnd(cols.name)} | ${"生サイズ".padEnd(cols.raw)} | ${"gzip".padEnd(cols.gzip)} |`;
  console.error(sep);
  console.error(header);
  console.error(sep);
  for (const f of files) {
    const row = `| ${f.name.padEnd(cols.name)} | ${fmtBytes(f.raw).padStart(cols.raw)} | ${fmtBytes(f.gzip).padStart(cols.gzip)} |`;
    console.error(row);
  }
  console.error(sep);
}

async function main() {
  const outfile = join(ROOT, "web/dist/app.js");
  const sourcemapFile = join(ROOT, "web/dist/app.js.map");
  const problemsFile = join(ROOT, "web/problems.json");

  let result: Awaited<ReturnType<typeof build>>;
  try {
    result = await build({
      entryPoints: [join(ROOT, "web/src/app.ts")],
      bundle: true,
      format: "esm",
      target: "es2022",
      platform: "browser",
      outfile,
      sourcemap: true,
      minify: true,
      plugins: [tsResolve],
      logLevel: "silent",
      metafile: true,
    });
  } catch (e) {
    // esbuild の BuildFailure は errors プロパティを持つ。
    if (e && typeof e === "object" && "errors" in e) {
      const errs = (e as { errors: Array<{ text: string; location?: { file: string; line: number; column: number } }> })
        .errors;
      console.error("esbuild ビルドエラー:");
      for (const err of errs) {
        const loc = err.location ? ` (${err.location.file}:${err.location.line}:${err.location.column})` : "";
        console.error(`  ✗ ${err.text}${loc}`);
      }
    } else {
      console.error(e);
    }
    process.exit(1);
  }

  if (result.errors.length > 0) {
    console.error("esbuild ビルドエラー:");
    for (const err of result.errors) {
      const loc = err.location ? ` (${err.location.file}:${err.location.line}:${err.location.column})` : "";
      console.error(`  ✗ ${err.text}${loc}`);
    }
    process.exit(1);
  }

  // sourcemap の sources が空でないことを検証する。
  if (existsSync(sourcemapFile)) {
    const smContent = readFileSync(sourcemapFile, "utf-8");
    let sm: { sources?: string[] };
    try {
      sm = JSON.parse(smContent) as { sources?: string[] };
    } catch {
      throw new Error("sourcemap ファイルのパースに失敗しました。");
    }
    if (!Array.isArray(sm.sources) || sm.sources.length === 0) {
      throw new Error("sourcemap の sources が空です。バンドル設定を確認してください。");
    }
  }

  // サイズレポートを出力する。
  const reportFiles: Array<{ name: string; raw: number; gzip: number }> = [];
  for (const [label, path] of [
    ["app.js", outfile],
    ["app.js.map", sourcemapFile],
    ["problems.json", problemsFile],
  ] as [string, string][]) {
    if (existsSync(path)) {
      const { raw, gzip } = getFileSizeInfo(path);
      reportFiles.push({ name: label, raw, gzip });
    }
  }

  console.error("web バンドルを web/dist/app.js に出力しました。");
  if (reportFiles.length > 0) {
    console.error("\nビルド生成物サイズ:");
    printSizeReport(reportFiles);
  }

  // --- SRI ハッシュ計算・index.html への注入（RG7）---
  const appJsContent = readFileSync(outfile, "utf-8");
  const sha384 = createHash("sha384").update(appJsContent).digest("base64");
  const integrityValue = `sha384-${sha384}`;

  const indexHtmlPath = join(ROOT, "web/index.html");
  if (existsSync(indexHtmlPath)) {
    const htmlContent = readFileSync(indexHtmlPath, "utf-8");
    // __SRI_HASH__ プレースホルダ、または既注入の sha384-... 値の両方を置換（冪等）。
    const newHtml = htmlContent.replace(/__SRI_HASH__|sha384-[A-Za-z0-9+/=]+/g, integrityValue);
    if (newHtml !== htmlContent) {
      writeFileSync(indexHtmlPath, newHtml, "utf-8");
      console.error(`SRI ハッシュを web/index.html に注入しました: ${integrityValue.slice(0, 20)}...`);
    } else {
      console.error("web/index.html に SRI 注入箇所が見つかりません（スキップ）。");
    }
  }

  // --- SW バージョン自動更新（II-187）---
  // sw.js がプリキャッシュする全アセットの内容を版数ハッシュに含める（Codex#1 指摘の根本対応）。
  // app.js だけをハッシュすると、problems.json や index.html/CSS のみ変わった配信で sw.js が
  // バイト不変のままになり、ブラウザが SW 更新を検知せず古いキャッシュを返し続ける。
  // SRI 注入後の index.html を読むため、この計算は SRI 注入の後に置く。
  const cachedAssetPaths = [
    outfile, // web/dist/app.js
    join(ROOT, "web/index.html"),
    join(ROOT, "web/problems.json"),
    // 分割ロード: マニフェスト＋科目別シャードもプリキャッシュ対象なので版数ハッシュに含める。
    // どれか1つでも内容が変われば sw.js のバイトが変わり、SW 更新→キャッシュ一括切替が走る。
    join(ROOT, "web", SHARD_DIR, MANIFEST_FILE),
    ...allShardSlugs().map((slug) => join(ROOT, "web", SHARD_DIR, `${slug}.json`)),
    // 出題傾向メタ（頻出度）もプリキャッシュ対象。頻度が変われば SW を更新させる。
    join(ROOT, "web", SHARD_DIR, "topic-meta.json"),
    join(ROOT, "web/manifest.webmanifest"),
    join(ROOT, "web/icon.svg"),
  ];
  const versionHash = createHash("sha256");
  for (const p of cachedAssetPaths) {
    if (existsSync(p)) versionHash.update(readFileSync(p, "utf-8"));
  }
  const shortHash = versionHash.digest("hex").slice(0, 8);
  // SW_MAJOR は SW キャッシュ世代の単一の真実。web/sw.js の版数注記（SW堅牢化第2弾=v22）と
  // 整合させる。以前は "v20" がここにハードコードされ、v21 を出荷しても CACHE が v20 の
  // まま据え置かれていた（SW-01）。
  const SW_MAJOR = "v22";
  const swVersion = `${SW_MAJOR}-${shortHash}`;

  const swJsPath = join(ROOT, "web/sw.js");
  if (existsSync(swJsPath)) {
    const swContent = readFileSync(swJsPath, "utf-8");
    // __SW_VERSION__ プレースホルダ、または既注入の v<major>-XXXXXXXX 値の両方を置換（冪等・
    // prefix 非依存）。
    const newSw = swContent.replace(/__SW_VERSION__|v\d+-[0-9a-f]{8}/g, swVersion);
    if (newSw !== swContent) {
      writeFileSync(swJsPath, newSw, "utf-8");
      console.error(`SW バージョンを web/sw.js に注入しました: denken-os-${swVersion}`);
    } else {
      console.error("web/sw.js に SW バージョン注入箇所が見つかりません（スキップ）。");
    }
  }

  // --- バンドルサイズ予算チェック（II-188）---
  const limitKb = Number(process.env.BUNDLE_SIZE_LIMIT_KB ?? "500");
  const appSizeKb = appJsContent.length / 1024;
  const budgetLine = `バンドルサイズ: ${appSizeKb.toFixed(1)} KB / 上限 ${limitKb} KB`;
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (appSizeKb > limitKb) {
    const msg = `⚠️  バンドルサイズ予算超過: ${appSizeKb.toFixed(1)} KB > ${limitKb} KB`;
    console.error(msg);
    if (summaryPath) {
      appendFileSync(summaryPath, `\n## バンドルバジェット\n\n${budgetLine} — **OVER BUDGET**\n`);
    }
    process.exit(1);
  } else {
    console.error(`✅ ${budgetLine} — 予算内`);
    if (summaryPath) {
      appendFileSync(summaryPath, `\n## バンドルバジェット\n\n${budgetLine} — OK\n`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
