import { describe, expect, it } from "vitest";
import { auditStatus, formatAuditSummary, parseAuditCliOptions } from "../../lib/audit/status.js";
import type { Problem } from "../../lib/engine/schema.js";

function problem(overrides: Partial<Problem> = {}): Problem {
  return {
    id: "A-0001",
    exam: "denken2_primary",
    subject: "理論",
    topic: "三相交流電力",
    format: "multiple_choice",
    difficulty: 2,
    statement: "statement",
    choices: ["1", "2"],
    answer: "1",
    solution: ["solution 1"],
    validation: {
      solver_checked: true,
      human_checked: true,
      clean_answer: true,
      physically_valid: true,
      supervisor_checked: false,
    },
    source: { type: "original", citation: "DENKEN-OS オリジナル問題" },
    status: "validated",
    ...overrides,
  };
}

describe("auditStatus", () => {
  it("問題数・形式・監修状況を集計して不足を推奨する", () => {
    const summary = auditStatus({ problems: [problem()], invalidSchema: 0, testFiles: 26 });

    expect(summary.okForRelease).toBe(false);
    expect(summary.problems.total).toBe(1);
    expect(summary.problems.validated).toBe(1);
    expect(summary.problems.bySubject).toEqual({ 理論: 1 });
    expect(summary.problems.byFormat).toEqual({ multiple_choice: 1 });
    expect(summary.problems.supervisorChecked).toBe(0);
    expect(summary.tests.files).toBe(26);
    expect(summary.recommendations).toContain("validated/published問題は1件です。まず50件を目標に増やしてください。");
    expect(summary.recommendations).toContain(
      "監修済み問題がまだありません。公開ベータ前に監修フローを通してください。",
    );
  });

  it("閾値を満たすと推奨なしを表示できる", () => {
    const problems = Array.from({ length: 2 }, (_, i) =>
      problem({
        id: `A-${String(i + 1).padStart(4, "0")}`,
        format: "descriptive",
        choices: undefined,
        validation: { ...problem().validation, supervisor_checked: true },
      }),
    );
    const summary = auditStatus({
      problems,
      invalidSchema: 0,
      testFiles: 1,
      thresholds: { minValidated: 2, minDescriptive: 2 },
    });

    expect(summary.okForRelease).toBe(true);
    expect(summary.recommendations).toEqual([]);
    expect(formatAuditSummary(summary)).toContain("release-ready: yes");
    expect(formatAuditSummary(summary)).toContain("recommendations: none");
  });

  it("schema不正件数と不正ファイル詳細を推奨と表示に含める", () => {
    const summary = auditStatus({
      problems: [],
      invalidSchema: 1,
      invalidFiles: [{ file: "broken.json", reason: "Unexpected token" }],
      testFiles: 0,
    });

    expect(summary.okForRelease).toBe(false);
    expect(summary.problems.invalidSchema).toBe(1);
    expect(summary.problems.invalidFiles).toEqual([{ file: "broken.json", reason: "Unexpected token" }]);
    expect(summary.recommendations[0]).toBe("1件の問題データがZod schemaを通過していません。");
    expect(formatAuditSummary(summary)).toContain("- broken.json: Unexpected token");
  });
});

describe("auditStatus — テンプレ監修の統合", () => {
  /** 監修待ち以外の推奨事項を出さない、十分に満たされた入力。 */
  function healthyInput() {
    return {
      problems: Array.from({ length: 50 }, (_, i) =>
        problem({
          id: `A-${i}`,
          format: i < 10 ? ("descriptive" as const) : ("multiple_choice" as const),
          validation: {
            solver_checked: true,
            human_checked: true,
            clean_answer: true,
            physically_valid: true,
            supervisor_checked: true,
          },
        }),
      ),
      invalidSchema: 0,
      testFiles: 26,
    };
  }

  it("テンプレ監修の情報を渡さなければ templates は付かない（既存の挙動を変えない）", () => {
    const summary = auditStatus(healthyInput());
    expect(summary.templates).toBeUndefined();
    expect(summary.recommendations).toEqual([]);
    expect(summary.okForRelease).toBe(true);
  });

  it("健全なテンプレ監修状況なら推奨事項を増やさない", () => {
    const summary = auditStatus({
      ...healthyInput(),
      templateSupervision: { total: 100, supervised: 40, stale: 0, orphans: 0 },
    });
    expect(summary.templates).toEqual({ total: 100, supervised: 40, stale: 0, orphans: 0, coverage: 0.4 });
    expect(summary.recommendations).toEqual([]);
    expect(summary.okForRelease).toBe(true);
  });

  it("要再監修があればリリース不可にする（専用コマンドを叩かなくても気づける）", () => {
    const summary = auditStatus({
      ...healthyInput(),
      templateSupervision: { total: 100, supervised: 40, stale: 3, orphans: 0 },
    });
    expect(summary.okForRelease).toBe(false);
    expect(summary.recommendations.join("\n")).toContain("テンプレ監修が無効化されたものが3件");
    expect(formatAuditSummary(summary)).toContain("stale: 3");
  });

  it("台帳の孤児（実在しない topic）もリリース不可にする", () => {
    const summary = auditStatus({
      ...healthyInput(),
      templateSupervision: { total: 100, supervised: 40, stale: 0, orphans: 2 },
    });
    expect(summary.okForRelease).toBe(false);
    expect(summary.recommendations.join("\n")).toContain("実在しない topic が2件");
    expect(formatAuditSummary(summary)).toContain("orphans: 2");
  });

  it("テンプレが0件でも 0 除算しない", () => {
    const summary = auditStatus({
      ...healthyInput(),
      templateSupervision: { total: 0, supervised: 0, stale: 0, orphans: 0 },
    });
    expect(summary.templates?.coverage).toBe(0);
  });

  it("整形出力にテンプレ監修カバレッジの行が出る", () => {
    const summary = auditStatus({
      ...healthyInput(),
      templateSupervision: { total: 151, supervised: 20, stale: 0, orphans: 0 },
    });
    expect(formatAuditSummary(summary)).toContain("templates supervised: 20/151 (13.2%)");
  });
});

describe("parseAuditCliOptions", () => {
  it("json/strictフラグと閾値オプションを解釈する", () => {
    expect(parseAuditCliOptions(["--json", "--strict", "--min-validated=3", "--min-descriptive=1"])).toEqual({
      json: true,
      strict: true,
      thresholds: { minValidated: 3, minDescriptive: 1 },
    });
  });

  it("不正な数値オプションを拒否する", () => {
    expect(() => parseAuditCliOptions(["--min-validated=-1"])).toThrow(
      "--min-validated=<non-negative-integer> を指定してください",
    );
    expect(() => parseAuditCliOptions(["--min-descriptive=1.5"])).toThrow(
      "--min-descriptive=<non-negative-integer> を指定してください",
    );
  });
});
