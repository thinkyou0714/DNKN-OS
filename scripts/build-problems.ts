/**
 * build-problems.ts — オフライン学習アプリ用の問題セット(web/problems.json)を
 * 全テンプレートから決定論的に生成する。
 *
 * 方針:
 *  - 各 topic を seed 固定で生成 → 再実行しても同じ出力（CI/差分が安定）。
 *  - 正解はコード算出・StubNarrator（LLM不要）で数値は不変。
 *  - statement 重複は除去し、topic ごとに最大 PER_TOPIC 件を採用。
 *  - 生成物は status="draft"（未監修）。アプリ側はデモ注記を表示する。
 *
 * 使い方:
 *   npm run build:problems              （既定で web/problems.json を上書き）
 *   npm run build:problems -- --per-topic 5
 *   npm run build:problems -- --help
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generate } from "../lib/engine/generate.js";
import { StubNarrator } from "../lib/engine/narrate.js";
import type { Problem, Subject } from "../lib/engine/schema.js";
import { getTemplate, listTopics } from "../lib/engine/templates/index.js";
import { validateProblem, validateProblemSet } from "../lib/engine/validate.js";
import {
  MANIFEST_FILE,
  type ProblemManifest,
  SHARD_DIR,
  SUBJECT_SLUGS,
  shardFileName,
} from "../lib/shared/problem-shards.js";
// G3 が lib/shared/rng.ts を新設予定。同一 xorshift 出力を保証。
import { hashSeed, seededRng } from "../lib/shared/rng.js";
import { atomicWriteFileSync, printHelp, validateOrExit } from "./shared.js";

const HELP = `\
build-problems — web/problems.json を全テンプレートから決定論的に生成する

使い方:
  npm run build:problems [-- オプション]

オプション:
  --per-topic <n>  topic ごとの採用問題数（既定: 300）
  --help, -h       このヘルプを表示して終了

例:
  npm run build:problems
  npm run build:problems -- --per-topic 5
`;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** 係数の値だけを並べた署名（キー順固定）。 */
function paramsSignature(p: Problem): string {
  const params = p.params ?? {};
  // Object.keys(params) で取得したキーは params 内に必ず存在する。
  return Object.keys(params)
    .sort()
    .map((k) => `${k}=${(params[k] as { value: number }).value}`)
    .join("|");
}

async function buildForTopic(topic: string, perTopic: number): Promise<Problem[]> {
  const template = getTemplate(topic);
  if (!template) return [];
  // 多めに生成 → statement 重複を除去 → 上限まで採用（綺麗な draw の枯渇に強い）。
  const candidates = await generate(template, {
    count: perTopic * 6,
    // 一次試験は全問マークシート五肢択一。数値テンプレは生成時に五択化する。
    autoMc: true,
    narrator: new StubNarrator(),
    rng: seededRng(hashSeed(topic)),
    idPrefix: "TMP",
  });
  const seen = new Set<string>();
  const seenParams = new Set<string>();
  const unique: Problem[] = [];
  for (const p of candidates) {
    if (seen.has(p.statement)) continue;
    // 係数署名でも重複除去（文面が違っても数値が同一の実質重複を排除）。
    const sig = paramsSignature(p);
    if (seenParams.has(sig)) continue;
    seen.add(p.statement);
    seenParams.add(sig);
    unique.push(p);
    if (unique.length >= perTopic) break;
  }
  return unique;
}

/** 旧・連番ID時代（mainに出荷済みの405問）の署名→ID対応。
 *  既存ユーザーの解答ログ・間違いノート（problemId参照）を壊さないため、
 *  内容が同一の問題には出荷済みのIDをそのまま使い続ける（Codexレビュー対応）。 */
const LEGACY_IDS: Record<string, string> = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "legacy-ids.json"), "utf8"),
) as Record<string, string>;

function stableId(p: Problem, taken: Set<string>): string {
  const base = `${p.topic}|${paramsSignature(p)}`;
  const legacy = LEGACY_IDS[base];
  if (legacy && !taken.has(legacy)) {
    taken.add(legacy);
    return legacy;
  }
  let h = hashSeed(base);
  let id = `G-${h.toString(16).padStart(8, "0").toUpperCase()}`;
  // 万一の衝突は再ハッシュで回避（決定論を保つ）。
  while (taken.has(id)) {
    h = hashSeed(`${base}#${h}`);
    id = `G-${h.toString(16).padStart(8, "0").toUpperCase()}`;
  }
  taken.add(id);
  return id;
}

/** CLI 引数をパースする純関数（テスト可能）。 */
export function parseCliOptions(argv: string[]): { perTopic: number } {
  if (argv.includes("--help") || argv.includes("-h")) {
    printHelp(HELP);
  }
  // 既定300: 電験二種二次対策の在庫拡充（第2弾）。テンプレートの一意な係数組合せが
  // 上限に満たない topic は取れるだけ採用する（perTopic は上限であり割当ノルマではない）。
  let perTopic = 300;
  const idx = argv.indexOf("--per-topic");
  if (idx >= 0) {
    const val = argv[idx + 1];
    if (!val || !/^\d+$/.test(val) || Number(val) < 1) {
      process.stderr.write(`エラー: --per-topic には正の整数を指定してください\n`);
      process.exit(1);
    }
    perTopic = Number(val);
  }
  return { perTopic };
}

/**
 * 科目別シャードとマニフェストを web/problems/ に書き出す（分割ロード対応）。
 *
 * - 全6科目それぞれに `<slug>.json`（問題配列）を出力する。該当問題が0件の科目でも
 *   空配列のシャードを必ず出力する（sw.js の固定プリキャッシュ一覧と整合させ、
 *   404 による install 失敗を防ぐ）。
 * - manifest.json は各シャードの記述子（subject/slug/file/count）と合計数・版数を持つ。
 * - version は combined JSON の内容ハッシュ（決定論的・タイムスタンプ非依存）。
 * - シャード内の問題順は combined 配列の並びを保つ（決定論的）。
 */
function writeShards(problems: Problem[]): void {
  const dir = join(ROOT, "web", SHARD_DIR);
  mkdirSync(dir, { recursive: true });

  // 科目 → その科目の問題（combined の並びを保持）。
  const bySubject = new Map<Subject, Problem[]>();
  for (const subject of Object.keys(SUBJECT_SLUGS) as Subject[]) bySubject.set(subject, []);
  for (const p of problems) {
    const list = bySubject.get(p.subject);
    // schema 外の科目は想定しないが、防御的に既知科目のみシャード化する。
    if (list) list.push(p);
  }

  const shards: ProblemManifest["shards"] = [];
  for (const subject of Object.keys(SUBJECT_SLUGS) as Subject[]) {
    const list = bySubject.get(subject) ?? [];
    const file = shardFileName(subject);
    atomicWriteFileSync(join(dir, file), `${JSON.stringify(list, null, 2)}\n`);
    shards.push({ subject, slug: SUBJECT_SLUGS[subject], file, count: list.length });
  }

  // 版数は combined の内容ハッシュ（同一入力→同一出力の決定論を保つ）。
  const version = createHash("sha256").update(JSON.stringify(problems)).digest("hex").slice(0, 12);
  const manifest: ProblemManifest = {
    version,
    total: problems.length,
    shards,
  };
  atomicWriteFileSync(join(dir, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`);

  const covered = shards.reduce((n, s) => n + s.count, 0);
  console.log(
    `web/${SHARD_DIR}/ を生成: ${shards.length}シャード / 計${covered}問 (manifest ${MANIFEST_FILE}, version ${version})`,
  );
}

/**
 * 過去問頻度に応じた採用上限の倍率。
 * 「ほぼ毎年出る論点」に在庫を厚く積み、「まれ」な論点で容量を食わない。
 * 倍率は上限にのみ効き、テンプレの一意な組合せが尽きればそこで止まる。
 */
const FREQUENCY_MULTIPLIER: Record<string, number> = { high: 3, mid: 1.2, low: 0.4 };

function perTopicFor(topic: string, base: number): number {
  const freq = getTemplate(topic)?.pastExam?.frequency ?? "mid";
  return Math.max(1, Math.round(base * (FREQUENCY_MULTIPLIER[freq] ?? 1)));
}

/**
 * topic → 出題傾向メタ（頻度・分野）を書き出す。
 *
 * Problem スキーマに pastExam を持たせるとデータ量が問題数ぶん膨らみ、
 * 逆にアプリ側へ手書きの表を置くとテンプレ定義と二重管理になる。
 * ここで「テンプレを唯一の情報源」として小さな辞書に落とすことで両方を避ける。
 */
function writeTopicMeta(): void {
  const meta: Record<string, { subject: string; exam?: string; frequency: string; area?: string }> = {};
  for (const topic of listTopics()) {
    const t = getTemplate(topic);
    if (!t) continue;
    meta[topic] = {
      subject: t.subject,
      ...(t.exam ? { exam: t.exam } : {}),
      frequency: t.pastExam?.frequency ?? "mid",
      ...(t.pastExam?.area ? { area: t.pastExam.area } : {}),
    };
  }
  const out = join(ROOT, "web", SHARD_DIR, "topic-meta.json");
  atomicWriteFileSync(out, `${JSON.stringify(meta)}\n`);
  const counts = Object.values(meta).reduce<Record<string, number>>((a, m) => {
    a[m.frequency] = (a[m.frequency] ?? 0) + 1;
    return a;
  }, {});
  console.log(`web/${SHARD_DIR}/topic-meta.json を生成: ${Object.keys(meta).length}topic ${JSON.stringify(counts)}`);
}

async function main(): Promise<void> {
  const { perTopic } = parseCliOptions(process.argv.slice(2));

  const all: Problem[] = [];
  for (const topic of listTopics()) {
    const items = await buildForTopic(topic, perTopicFor(topic, perTopic));
    all.push(...items);
  }

  // ID は内容由来の安定ハッシュ（テンプレ追加・並び替えでIDがズレて
  // 既存ユーザーの間違いノートが別問題を指す事故を構造的に防ぐ）。
  const taken = new Set<string>();
  const problems = all.map((p) => ({ ...p, id: stableId(p, taken) }));

  // 念のため全件 validate（壊れた問題を web に出さない）。
  const errors: string[] = [];
  for (const p of problems) {
    const r = validateProblem(p);
    if (!r.ok) {
      errors.push(`${p.id} (${p.topic}) — ${r.issues.map((i) => i.message).join("; ")}`);
    }
  }
  validateOrExit(errors, "生成問題の検証");

  // II-115: 近似重複（相対誤差で酷似する params）を検出して警告する。stableId の
  // exact-dedup では捕まらない実質重複を可視化する（build は止めない）。
  const dupIssues = validateProblemSet(problems);
  if (dupIssues.length > 0) {
    console.warn(`⚠ 近似重複の可能性 ${dupIssues.length}件:`);
    for (const i of dupIssues) console.warn(`  - ${i.message}`);
  }

  const out = join(ROOT, "web", "problems.json");
  atomicWriteFileSync(out, `${JSON.stringify(problems, null, 2)}\n`);

  // --- 科目別シャード + マニフェスト（分割ロード対応）---
  // 後方互換のため combined な problems.json は据え置き、追加で科目ごとの小さな JSON と
  // その索引（manifest.json）を書き出す。web 側はマニフェスト経由で読み、失敗時は
  // combined にフォールバックする（app-init.ts）。順序は上の problems 配列の並びを保つ
  // ため決定論的。
  writeShards(problems);
  writeTopicMeta();

  const byFormat = problems.reduce<Record<string, number>>((acc, p) => {
    const f = p.format ?? "multiple_choice";
    acc[f] = (acc[f] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`web/problems.json を生成: ${problems.length}問 / ${listTopics().length}topic`);
  console.log(
    `  形式内訳: ${Object.entries(byFormat)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ")}`,
  );
  // 科目×形式マトリクス（在庫の偏りを毎回可視化し、ドキュメント乖離の再発を防ぐ）。
  const bySubject = new Map<string, Record<string, number>>();
  for (const p of problems) {
    const row = bySubject.get(p.subject) ?? {};
    const f = p.format ?? "multiple_choice";
    row[f] = (row[f] ?? 0) + 1;
    row.total = (row.total ?? 0) + 1;
    bySubject.set(p.subject, row);
  }
  for (const [subject, row] of bySubject) {
    console.log(
      `  ${subject}: 計${row.total} (mc=${row.multiple_choice ?? 0}, num=${row.numeric ?? 0}, desc=${row.descriptive ?? 0})`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
