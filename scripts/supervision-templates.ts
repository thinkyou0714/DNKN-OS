#!/usr/bin/env tsx
/**
 * supervision-templates.ts — テンプレート単位の監修（合格者レビュー）ワークフロー。
 *
 * 問題単位の監修（supervision-status/packet/mark）は data/problems/ の 52 問が対象だが、
 * 配信中の約 9,354 問は 151 テンプレから生成されているため1問ずつは追えない。
 * テンプレ1つを監修すれば、そこから出る全問題（平均約62問）がまとめて担保される。
 *
 * サブコマンド:
 *   status  監修カバレッジと監修待ちキュー（レバレッジ順）を表示
 *   packet  監修待ちテンプレのレビューパケット(Markdown)を書き出す
 *   mark    監修済みとして台帳に記録する（現在のフィンガープリントを保存）
 *
 * ⚠️ 監修フラグは「人間（電験合格者）が監修した」という主張であり、実行者が責任を負う。
 *    コードは監修の中身を判定しない。ただし **監修後にテンプレが変更されたことは検知し**、
 *    その記録を「要再監修」として必ず表に出す（嘘の監修済みを残さないため）。
 *
 * 使い方:
 *   npm run supervision:templates
 *   npm run supervision:templates -- --json
 *   npm run supervision:templates:packet -- --out out/template-packet.md
 *   npm run supervision:templates:mark -- --supervisor "山田太郎" 三相交流電力 力率改善
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  formatTemplateSupervisionReport,
  type TemplateReviewItem,
  templateFingerprint,
  templateSupervisionReport,
  upsertLedgerEntry,
} from "../lib/audit/template-supervision.js";
import type { Problem } from "../lib/engine/schema.js";
import { getTemplate, listTopics } from "../lib/engine/templates/index.js";
import type { Template } from "../lib/engine/templates/types.js";
import { hashSeed, seededRng } from "../lib/shared/rng.js";
import { atomicWriteFileSync, printHelp } from "./shared.js";
import { loadTemplateLedger, saveTemplateLedger } from "./supervision-io.js";

const HELP = `\
supervision-templates — テンプレ単位の監修カバレッジ管理

使い方:
  npm run supervision:templates [-- オプション]              # 状況表示
  npm run supervision:templates:packet [-- オプション]       # レビューパケット生成
  npm run supervision:templates:mark -- [オプション] <topic> [<topic> ...]

オプション:
  --json                結果を JSON で出力（status のみ）
  --out <path>          出力先ファイル（packet のみ。既定: 標準出力）
  --subject <科目>      科目で絞る（packet のみ。例: 法規／電力管理）
  --limit <N>           先頭 N 件だけ出す（packet のみ。一度に見る量を絞る）
  --stale-only          要再監修だけを出す（packet のみ）
  --supervisor <name>   監修者名（mark のみ。必須）
  --note <text>         監修コメント（mark のみ。任意）
  --date <YYYY-MM-DD>   監修日（mark のみ。既定: 実行日）
  --help, -h            このヘルプを表示して終了

例:
  # 法規から20件ずつ進める（推奨の進め方）
  npm run supervision:templates:packet -- --subject 法規 --limit 20 --out out/houki.md
  # 変更で無効化されたものだけ再監修する
  npm run supervision:templates:packet -- --stale-only --out out/stale.md

注意:
  監修済みの記録は「人間が監修した」という主張です。実行者が責任を負います。
  監修後にテンプレを編集すると振る舞いのフィンガープリントが変わり、
  その記録は自動的に「要再監修」として表示されます（記録は消えません）。
`;

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_PROBLEMS_PATH = join(__dirname, "../web/problems.json");

/** パケットに載せる生成サンプルの数（監修者が式とレンジを確かめるのに十分な数）。 */
const PACKET_SAMPLES = 3;

/** 監修者がテンプレ単位で確認する観点。問題単位のチェックリストとは狙いが違う。 */
const CHECKLIST: readonly string[] = [
  "計算式そのものが物理的に正しいか（次元・係数・符号。generate の算出式を追う）",
  "パラメータの現実的レンジ(realistic_range)が実機・実系統としてありうる値か",
  "生成サンプルの答えが独立計算と一致するか（下のサンプル全件を検算する）",
  "解説(defaultSolution)の筋道が飛躍なく、最終値に単位が付いているか",
  "誤答選択肢が『実際に起こる典型ミス』に対応しているか（distractor の reason）",
  "出題分野メタ(pastExam)の分野・頻度が実際の出題傾向と整合するか",
  "法規・制度を扱う場合、最新の改正に整合するか（古い基準を引いていないか）",
];

/** 全テンプレをレジストリ順（topic 昇順）で取り出す。 */
function allTemplates(): Template[] {
  const out: Template[] = [];
  for (const topic of listTopics()) {
    const t = getTemplate(topic);
    if (t) out.push(t);
  }
  return out;
}

/**
 * topic → 生成問題数を web/problems.json から実測する。
 * ファイルが無い/壊れている場合は空マップ（レバレッジ表示が0になるだけで動作は続く）。
 */
function problemCountByTopic(): Map<string, number> {
  const counts = new Map<string, number>();
  if (!existsSync(WEB_PROBLEMS_PATH)) return counts;
  try {
    const problems = JSON.parse(readFileSync(WEB_PROBLEMS_PATH, "utf8")) as Problem[];
    for (const p of problems) counts.set(p.topic, (counts.get(p.topic) ?? 0) + 1);
  } catch {
    // 実測できないだけなので握りつぶす（監修作業自体は続けられる）。
  }
  return counts;
}

/** 引数から `--key value` / `--key=value` を取り出す。 */
function getOption(argv: string[], key: string): string | undefined {
  const eq = argv.find((a) => a.startsWith(`${key}=`));
  if (eq) return eq.slice(key.length + 1);
  const i = argv.indexOf(key);
  if (i >= 0 && i + 1 < argv.length) return argv[i + 1];
  return undefined;
}

/** オプションとその値を除いた位置引数（topic 名）だけを取り出す。 */
function positionalArgs(argv: string[], valueOptions: readonly string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] as string;
    if (a.startsWith("--")) {
      // `--key value` 形式なら次の要素も読み飛ばす（`--key=value` は自己完結）。
      if (!a.includes("=") && valueOptions.includes(a)) i++;
      continue;
    }
    out.push(a);
  }
  return out;
}

// ---- status ----

function runStatus(argv: string[]): void {
  const report = templateSupervisionReport({
    templates: allTemplates(),
    ledger: loadTemplateLedger(),
    problemCountByTopic: problemCountByTopic(),
  });
  if (argv.includes("--json")) console.log(JSON.stringify(report, null, 2));
  else console.log(formatTemplateSupervisionReport(report));
}

// ---- packet ----

/** テンプレから決定論的にサンプルを生成する（パケット表示用）。 */
function sampleResults(template: Template, count: number): string[] {
  const rng = seededRng(hashSeed(template.topic));
  const out: string[] = [];
  for (let i = 0; i < count * 40 && out.length < count; i++) {
    const r = template.generate(rng);
    if (!r) continue;
    const params = Object.entries(r.params)
      .map(([k, v]) => `${k}=${v.value}${v.unit ?? ""}`)
      .join(", ");
    const lines = [`**サンプル${out.length + 1}**（params: ${params}）`, "", `> ${r.defaultStatement}`, ""];
    if (r.choices && r.choices.length > 0) {
      lines.push(`選択肢: ${r.choices.map((c, j) => `${j + 1}) ${c}`).join("　")}`, "");
    }
    lines.push(`**正解: ${r.answerText} ${r.answerUnit}**`, "", "解説:");
    for (const s of r.defaultSolution) lines.push(`  ${s}`);
    if (r.distractors && r.distractors.length > 0) {
      lines.push("", "誤答の想定:");
      for (const d of r.distractors) lines.push(`  - ${d.text} — ${d.reason}`);
    }
    out.push(lines.join("\n"));
  }
  return out;
}

/** テンプレ1つぶんの監修セクション。 */
export function templateReviewSection(item: TemplateReviewItem, template: Template): string {
  const specs = Object.entries(template.paramSpecs)
    .map(([k, s]) => {
      const [min, max] = s.realistic_range;
      const opt = s.required === false ? "（任意）" : "";
      return `| ${k} | ${min} 〜 ${max} | ${s.unit ?? "—"} |${opt}`;
    })
    .join("\n");
  const pastExam = template.pastExam
    ? `出題分野メタ: ${template.pastExam.area} / 頻度 ${template.pastExam.frequency}` +
      `${template.pastExam.years ? `（代表年度: ${template.pastExam.years.join(", ")}）` : ""}` +
      `${template.pastExam.note ? `\n注記: ${template.pastExam.note}` : ""}`
    : "出題分野メタ: 未設定";
  const staleNote =
    item.stage === "stale" && item.entry
      ? [
          "",
          `> ⚠️ **要再監修**: ${item.entry.at} に ${item.entry.supervisor} が監修しましたが、`,
          "> その後テンプレの振る舞いが変わっています。以前の監修結果は前提が崩れているため、",
          "> 変更点を確認して再度監修してください。",
          "",
        ].join("\n")
      : "";

  return [
    `### ${template.topic} — ${template.subject} / ${template.exam}（★${template.difficulty}）`,
    "",
    `この1件を監修すると **${item.problemCount} 問** が担保されます。`,
    staleNote,
    "",
    "#### パラメータの現実的レンジ",
    "",
    "| パラメータ | レンジ | 単位 |",
    "|---|---|---|",
    specs.length > 0 ? specs : "| （なし） | — | — |",
    "",
    pastExam,
    "",
    "#### 生成サンプル（決定論・実際に出荷される数列）",
    "",
    sampleResults(template, PACKET_SAMPLES).join("\n\n") || "（サンプルを生成できませんでした）",
    "",
    "#### 監修チェックリスト",
    CHECKLIST.map((c) => `- [ ] ${c}`).join("\n"),
    "",
    "#### 監修者記入欄",
    "- 監修者: __________",
    `- 判定: [ ] 合格（\`npm run supervision:templates:mark -- --supervisor "名前" ${template.topic}\`）／[ ] 要修正`,
    "- コメント: ",
    "",
    "---",
  ].join("\n");
}

function runPacket(argv: string[]): void {
  const templates = allTemplates();
  const byTopic = new Map(templates.map((t) => [t.topic, t]));
  const report = templateSupervisionReport({
    templates,
    ledger: loadTemplateLedger(),
    problemCountByTopic: problemCountByTopic(),
  });

  // 絞り込み（150件を一度に見るのは非現実的なので、科目・件数・要再監修で切れるようにする）。
  const subject = getOption(argv, "--subject");
  const staleOnly = argv.includes("--stale-only");
  const limitRaw = getOption(argv, "--limit");
  const limit = limitRaw !== undefined ? Number(limitRaw) : undefined;
  if (limit !== undefined && (!Number.isInteger(limit) || limit <= 0)) {
    console.error(`エラー: --limit は1以上の整数で指定してください（受け取った値: ${limitRaw}）。`);
    process.exit(1);
  }
  let queue = report.queue;
  if (subject !== undefined) queue = queue.filter((q) => q.subject === subject);
  if (staleOnly) queue = queue.filter((q) => q.stage === "stale");
  const filtered = queue.length;
  if (limit !== undefined) queue = queue.slice(0, limit);
  // 絞り込みの結果を必ず明示する（黙って切り詰めると「これで全部」と誤解される）。
  const filterNote =
    subject !== undefined || staleOnly || limit !== undefined
      ? [
          "",
          `絞り込み: ${[
            subject !== undefined ? `科目=${subject}` : "",
            staleOnly ? "要再監修のみ" : "",
            limit !== undefined ? `先頭${limit}件` : "",
          ]
            .filter((s) => s.length > 0)
            .join(" ・ ")}` +
            `（該当 ${filtered} 件中 ${queue.length} 件を出力。全体の監修待ちは ${report.queue.length} 件）`,
        ].join("\n")
      : "";

  const header = [
    "# DENKEN-OS テンプレ監修レビューパケット",
    "",
    `監修待ち: **${report.queue.length} 件** / 全 ${report.total} テンプレ`,
    `（うち要再監修 ${report.stale} 件・未監修 ${report.unsupervised} 件）`,
    `テンプレ監修カバレッジ: ${report.supervised}/${report.total}（${(report.coverage * 100).toFixed(1)}%）`,
    `担保できている問題数: ${report.problemsSupervised}/${report.problemsTotal} 問（${(report.problemCoverage * 100).toFixed(1)}%）`,
    filterNote,
    "",
    "並びは「要再監修 → 担保できる問題数の多い順」です。上から進めるとカバレッジが最速で伸びます。",
    "",
    "テンプレの式・レンジ・解説を確認し、合格と判断したら次のコマンドで台帳に記録してください:",
    "",
    "```sh",
    'npm run supervision:templates:mark -- --supervisor "あなたの名前" <topic>',
    "```",
    "",
    "---",
    "",
  ].join("\n");

  const body =
    queue.length === 0
      ? "該当する監修待ちのテンプレはありません。\n"
      : `${queue
          .map((item) => {
            const t = byTopic.get(item.topic);
            return t ? templateReviewSection(item, t) : "";
          })
          .filter((s) => s.length > 0)
          .join("\n")}\n`;

  const out = getOption(argv, "--out");
  const packet = header + body;
  if (out) {
    atomicWriteFileSync(out, packet);
    console.error(`テンプレ監修レビューパケットを書き出しました: ${out}`);
  } else {
    process.stdout.write(packet);
  }
}

// ---- mark ----

/** 監修日の形式（ISO 8601 の日付部分）。 */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function runMark(argv: string[]): void {
  const supervisor = getOption(argv, "--supervisor");
  if (!supervisor || supervisor.trim() === "") {
    console.error("エラー: --supervisor <name> は必須です（誰の監修かを台帳に残すため）。");
    process.exit(1);
  }
  const note = getOption(argv, "--note");
  const date = getOption(argv, "--date") ?? new Date().toISOString().slice(0, 10);
  if (!DATE_RE.test(date)) {
    console.error(`エラー: --date は YYYY-MM-DD 形式で指定してください（受け取った値: ${date}）。`);
    process.exit(1);
  }
  const topics = positionalArgs(argv, ["--supervisor", "--note", "--date", "--out"]);
  if (topics.length === 0) {
    console.error("エラー: 監修済みにする topic を1つ以上指定してください。");
    process.exit(1);
  }

  let ledger = loadTemplateLedger();
  let marked = 0;
  let failed = 0;
  for (const topic of topics) {
    const template = getTemplate(topic);
    if (!template) {
      console.error(`✗ ${topic}: そのようなテンプレはありません（npm run gen で topic 一覧を確認）`);
      failed++;
      continue;
    }
    const fingerprint = templateFingerprint(template);
    ledger = upsertLedgerEntry(ledger, {
      topic,
      fingerprint,
      supervisor: supervisor.trim(),
      at: date,
      ...(note !== undefined && note.trim() !== "" ? { note: note.trim() } : {}),
    });
    console.log(`✓ ${topic}: 監修済みとして記録しました（fingerprint: ${fingerprint}）`);
    marked++;
  }
  if (marked > 0) {
    saveTemplateLedger(ledger);
    console.log(`\n台帳を更新しました: data/supervision/templates.json（${marked} 件）`);
  }
  if (failed > 0) process.exit(1);
}

// ---- entry ----

function main(): void {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) printHelp(HELP);
  const sub = argv[0];
  const rest = argv.slice(1);
  if (sub === "packet") runPacket(rest);
  else if (sub === "mark") runMark(rest);
  else if (sub === "status" || sub === undefined) runStatus(rest);
  else {
    console.error(`不明なサブコマンド: ${sub}`);
    printHelp(HELP);
  }
}

main();
