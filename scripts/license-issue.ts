#!/usr/bin/env tsx
/**
 * license-issue.ts — Pro ライセンスキーを発行する販売者ツール。
 *
 * secrets/license-signing-key.json（license:keygen が生成）の秘密鍵で署名した
 * ライセンスキーを標準出力に出す。発行後すぐ公開鍵で自己検証してから出力するため、
 * 出力されたキーは必ずアプリで有効化できる。
 *
 * 使い方:
 *   npm run license:issue -- --email buyer@example.com                # 買い切り
 *   npm run license:issue -- --email buyer@example.com --exp 2027-08-31  # 期限付き
 *   npm run license:issue -- --note "モニター配布"                     # 識別子なし発行
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  KNOWN_SKUS,
  type LicenseJwk,
  type LicensePayload,
  signLicense,
  verifyLicense,
} from "../lib/license/license.js";
import { printHelp } from "./shared.js";

const HELP = `\
license-issue — ライセンスキーを発行する（要: license:keygen 済み）

使い方:
  npm run license:issue -- [--sku pro|toolkit] [--email <購入者メール>] [--exp YYYY-MM-DD] [--note <メモ>]

例:
  npm run license:issue -- --email buyer@example.com               # Pro 買い切り（無期限）
  npm run license:issue -- --sku toolkit --email buyer@example.com # 設計計算ツールキット
  npm run license:issue -- --email buyer@example.com --exp 2027-08-31
  npm run license:issue -- --note "レビュアー特典"

オプション:
  --sku <sku>      対象商品（pro=学習アプリ / toolkit=設計計算ツールキット。既定: pro）
  --email <addr>   購入者の識別子（キーに埋め込まれる。問い合わせ照合用・任意）
  --exp <date>     有効期限 YYYY-MM-DD（JST・この日まで有効。省略時は無期限）
  --note <text>    発行メモ（キーに埋め込まれる・任意）
  --key <path>     鍵ファイルの場所（既定: secrets/license-signing-key.json）
  --help, -h       このヘルプを表示して終了
`;

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_KEY_FILE = join(__dirname, "../secrets/license-signing-key.json");

/** `--flag value` 形式の値を取り出す（無ければ undefined）。 */
function argValue(argv: string[], flag: string): string | undefined {
  const i = argv.indexOf(flag);
  if (i < 0) return undefined;
  const v = argv[i + 1];
  if (v === undefined || v.startsWith("--")) {
    console.error(`${flag} には値が必要です（例: ${flag} xxx）`);
    process.exit(1);
  }
  return v;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) printHelp(HELP);

  const known = new Set(["--sku", "--email", "--exp", "--note", "--key"]);
  const flags = argv.filter((a) => a.startsWith("-"));
  const unknown = flags.filter((a) => !known.has(a));
  if (unknown.length > 0) {
    console.error(`不明なオプションです: ${unknown.join(", ")}（--help で使い方を表示）`);
    process.exit(1);
  }

  const sku = argValue(argv, "--sku") ?? "pro";
  const email = argValue(argv, "--email");
  const exp = argValue(argv, "--exp");
  const note = argValue(argv, "--note");
  const keyFile = argValue(argv, "--key") ?? DEFAULT_KEY_FILE;

  if (!(KNOWN_SKUS as readonly string[]).includes(sku)) {
    console.error(`--sku は ${KNOWN_SKUS.join(" / ")} のいずれかで指定してください（受領値: ${sku}）`);
    process.exit(1);
  }
  if (exp !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(exp)) {
    console.error(`--exp は YYYY-MM-DD 形式で指定してください（受領値: ${exp}）`);
    process.exit(1);
  }
  if (!existsSync(keyFile)) {
    console.error(`鍵ファイルがありません: ${keyFile}\n先に npm run license:keygen を実行してください。`);
    process.exit(1);
  }

  const stored = JSON.parse(readFileSync(keyFile, "utf8")) as { privateJwk?: LicenseJwk; publicJwk?: LicenseJwk };
  if (!stored.privateJwk || !stored.publicJwk) {
    console.error(`鍵ファイルの形式が不正です: ${keyFile}（privateJwk / publicJwk が必要）`);
    process.exit(1);
  }

  const payload: LicensePayload = {
    sku,
    ...(email !== undefined ? { sub: email } : {}),
    ...(exp !== undefined ? { exp } : {}),
    ...(note !== undefined ? { note } : {}),
  };
  const licenseKey = await signLicense(payload, stored.privateJwk);

  // 出力前の自己検証: 公開鍵で有効性を確認し、壊れたキーを購入者に渡す事故を防ぐ。
  const check = await verifyLicense(licenseKey, stored.publicJwk, Date.now(), sku);
  if (!check.ok) {
    console.error(`発行したキーの自己検証に失敗しました: ${check.reason}`);
    console.error("鍵ファイルの公開鍵と秘密鍵が対応していない可能性があります（license:keygen からやり直し）。");
    process.exit(1);
  }

  console.log("✅ ライセンスキーを発行しました（購入者へこのままコピーして送付）:");
  console.log("");
  console.log(licenseKey);
  console.log("");
  console.log(
    `  プラン: ${payload.sku} ／ 期限: ${payload.exp ?? "無期限（買い切り）"} ／ 宛先: ${payload.sub ?? "-"}`,
  );
  if (sku === "toolkit") {
    console.log("  有効化: 設計計算ツールキット（toolkit.html）の ライセンス欄 → キーを適用");
  } else {
    console.log("  有効化: アプリの 設定タブ → Pro ライセンス → キーを適用");
  }
}

void main();
