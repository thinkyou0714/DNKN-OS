import type { Problem } from "../engine/schema.js";

export interface AuditThresholds {
  minValidated: number;
  minDescriptive: number;
}

export interface InvalidProblemFile {
  file: string;
  reason: string;
}

/**
 * テンプレ監修の要約（lib/audit/template-supervision.ts のレポートから必要分だけ受け取る）。
 * status 監査が engine のテンプレレジストリを直接読まずに済むよう、呼び出し側が渡す。
 */
export interface TemplateSupervisionSummary {
  /** 全テンプレ数。 */
  total: number;
  /** 監修済み（監修後に変更されていない）テンプレ数。 */
  supervised: number;
  /** 要再監修（監修後にテンプレが変更された）テンプレ数。 */
  stale: number;
  /** 台帳にあるが実在しない topic の数。 */
  orphans: number;
}

export interface AuditInput {
  problems: Problem[];
  invalidSchema: number;
  testFiles: number;
  thresholds?: Partial<AuditThresholds>;
  invalidFiles?: InvalidProblemFile[];
  /** テンプレ監修の状況（省略時はテンプレ監修に関する監査を行わない）。 */
  templateSupervision?: TemplateSupervisionSummary;
}

export interface AuditCliOptions {
  json: boolean;
  strict: boolean;
  thresholds: Partial<AuditThresholds>;
}

export interface AuditSummary {
  okForRelease: boolean;
  problems: {
    total: number;
    validSchema: number;
    invalidSchema: number;
    invalidFiles: InvalidProblemFile[];
    byStatus: Record<string, number>;
    bySubject: Record<string, number>;
    byFormat: Record<string, number>;
    validated: number;
    supervisorChecked: number;
  };
  tests: {
    files: number;
  };
  /** テンプレ監修の状況（入力に無ければ省略）。 */
  templates?: TemplateSupervisionSummary & { coverage: number };
  recommendations: string[];
}

export const DEFAULT_THRESHOLDS: AuditThresholds = {
  minValidated: 50,
  minDescriptive: 10,
};

function numberOption(args: string[], name: string): number | undefined {
  const prefix = `--${name}=`;
  const raw = args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  if (raw === undefined) return undefined;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) throw new Error(`${prefix}<non-negative-integer> を指定してください`);
  return value;
}

export function parseAuditCliOptions(args: string[]): AuditCliOptions {
  const thresholds: Partial<AuditThresholds> = {};
  const minValidated = numberOption(args, "min-validated");
  const minDescriptive = numberOption(args, "min-descriptive");
  if (minValidated !== undefined) thresholds.minValidated = minValidated;
  if (minDescriptive !== undefined) thresholds.minDescriptive = minDescriptive;

  return {
    json: args.includes("--json"),
    strict: args.includes("--strict"),
    thresholds,
  };
}

function increment(map: Record<string, number>, key: string | undefined): void {
  map[key ?? "(unset)"] = (map[key ?? "(unset)"] ?? 0) + 1;
}

export function auditStatus(input: AuditInput): AuditSummary {
  const thresholds = { ...DEFAULT_THRESHOLDS, ...input.thresholds };
  const byStatus: Record<string, number> = {};
  const bySubject: Record<string, number> = {};
  const byFormat: Record<string, number> = {};
  let supervisorChecked = 0;

  for (const p of input.problems) {
    increment(byStatus, p.status);
    increment(bySubject, p.subject);
    increment(byFormat, p.format ?? "multiple_choice");
    if (p.validation.supervisor_checked) supervisorChecked++;
  }

  const invalidFiles = input.invalidFiles ?? [];
  const invalidSchema = Math.max(input.invalidSchema, invalidFiles.length);
  const validated = input.problems.filter((p) => p.status === "validated" || p.status === "published").length;
  const recommendations: string[] = [];

  if (invalidSchema > 0) recommendations.push(`${invalidSchema}件の問題データがZod schemaを通過していません。`);
  if (validated < thresholds.minValidated)
    recommendations.push(
      `validated/published問題は${validated}件です。まず${thresholds.minValidated}件を目標に増やしてください。`,
    );
  if (supervisorChecked === 0)
    recommendations.push("監修済み問題がまだありません。公開ベータ前に監修フローを通してください。");
  if ((byFormat.descriptive ?? 0) < thresholds.minDescriptive)
    recommendations.push(
      `記述式(descriptive)が少ないため、二次試験向けに最低${thresholds.minDescriptive}件を目標にしてください。`,
    );

  // テンプレ監修の破れを品質ゲートに載せる。要再監修・孤児は「気づかないまま放置される」のが
  // 最大の害なので、専用コマンドを叩かなくても audit に出るようにする（strict では失敗させる）。
  const ts = input.templateSupervision;
  if (ts) {
    if (ts.stale > 0)
      recommendations.push(
        `テンプレ監修が無効化されたものが${ts.stale}件あります（監修後にテンプレが変更されました）。` +
          "npm run supervision:templates で確認し、再監修してください。",
      );
    if (ts.orphans > 0)
      recommendations.push(
        `監修台帳に実在しない topic が${ts.orphans}件あります（テンプレの改名・削除）。` +
          "data/supervision/templates.json を整理してください。",
      );
  }

  return {
    okForRelease: recommendations.length === 0,
    problems: {
      total: input.problems.length + invalidSchema,
      validSchema: input.problems.length,
      invalidSchema,
      invalidFiles,
      byStatus,
      bySubject,
      byFormat,
      validated,
      supervisorChecked,
    },
    tests: { files: input.testFiles },
    ...(ts ? { templates: { ...ts, coverage: ts.total > 0 ? ts.supervised / ts.total : 0 } } : {}),
    recommendations,
  };
}

export function formatAuditSummary(summary: AuditSummary): string {
  const lines = [
    "DENKEN-OS status audit",
    `- release-ready: ${summary.okForRelease ? "yes" : "no"}`,
    `- problems: ${summary.problems.total} total / ${summary.problems.validated} validated-or-published`,
    `- schema: ${summary.problems.validSchema} valid / ${summary.problems.invalidSchema} invalid`,
    `- subjects: ${JSON.stringify(summary.problems.bySubject)}`,
    `- formats: ${JSON.stringify(summary.problems.byFormat)}`,
    `- test files: ${summary.tests.files}`,
  ];

  if (summary.templates) {
    const t = summary.templates;
    lines.push(
      `- templates supervised: ${t.supervised}/${t.total} (${(t.coverage * 100).toFixed(1)}%)` +
        `${t.stale > 0 ? ` / stale: ${t.stale}` : ""}${t.orphans > 0 ? ` / orphans: ${t.orphans}` : ""}`,
    );
  }

  if (summary.problems.invalidFiles.length > 0) {
    lines.push("invalid problem files:");
    for (const f of summary.problems.invalidFiles) lines.push(`- ${f.file}: ${f.reason}`);
  }

  if (summary.recommendations.length > 0) {
    lines.push("recommendations:");
    for (const r of summary.recommendations) lines.push(`- ${r}`);
  } else {
    lines.push("recommendations: none");
  }

  return lines.join("\n");
}
