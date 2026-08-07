/**
 * 科目合格プランの不変条件。
 * 制度は「最初に合格した試験以降、最大で連続5回まで免除」＝**回数**で数える。
 * 年数で数えると年2回実施のぶんズレるため、ここを取り違えないことをテストで固定する。
 */
import { describe, expect, it } from "vitest";
import {
  MAX_EXEMPT_SITTINGS,
  planSummary,
  recommendSubjects,
  type SubjectPass,
  subjectStatuses,
} from "../../web/src/subject-plan.js";

describe("科目合格の免除回数", () => {
  it("直近の回に合格した科目は5回ぶん免除が残る", () => {
    const st = subjectStatuses([{ subject: "理論", sittingsAgo: 0 }]);
    const rironn = st.find((s) => s.subject === "理論");
    expect(rironn?.passed).toBe(true);
    expect(rironn?.remaining).toBe(MAX_EXEMPT_SITTINGS);
    expect(rironn?.expiringSoon).toBe(false);
  });

  it("5回経過すると免除が切れる（未合格と同じ扱いに戻る）", () => {
    const st = subjectStatuses([{ subject: "電力", sittingsAgo: MAX_EXEMPT_SITTINGS }]);
    const power = st.find((s) => s.subject === "電力");
    expect(power?.passed).toBe(false);
    expect(power?.remaining).toBe(0);
  });

  it("残り1回になったら失効間近として警告する", () => {
    const st = subjectStatuses([{ subject: "機械", sittingsAgo: MAX_EXEMPT_SITTINGS - 1 }]);
    expect(st.find((s) => s.subject === "機械")?.expiringSoon).toBe(true);
  });

  it("未登録の科目は未合格として扱う", () => {
    const st = subjectStatuses([]);
    expect(st).toHaveLength(4);
    expect(st.every((s) => !s.passed)).toBe(true);
  });
});

describe("受験科目の推奨", () => {
  const readiness = new Map([
    ["理論", 0.3],
    ["電力", 0.8],
    ["機械", 0.2],
    ["法規", 0.75],
  ]);

  it("合格済み科目は推奨対象から外れる", () => {
    const passes: SubjectPass[] = [{ subject: "電力", sittingsAgo: 1 }];
    const recs = recommendSubjects(subjectStatuses(passes), readiness);
    expect(recs.map((r) => r.subject)).not.toContain("電力");
  });

  it("到達度が高い科目ほど優先される", () => {
    const recs = recommendSubjects(subjectStatuses([]), readiness);
    expect(recs[0]?.subject).toBe("電力");
  });

  it("合格済みの失効が近いと、残り科目の優先度が一律に上がる", () => {
    const calm = recommendSubjects(subjectStatuses([{ subject: "電力", sittingsAgo: 0 }]), readiness);
    const urgent = recommendSubjects(subjectStatuses([{ subject: "電力", sittingsAgo: 4 }]), readiness);
    const calmTop = calm[0]?.priority ?? 0;
    const urgentTop = urgent[0]?.priority ?? 0;
    expect(urgentTop).toBeGreaterThan(calmTop);
  });

  it("残り科目数に応じた要約を返す", () => {
    expect(planSummary([])).toContain("すべて合格");
    const one = recommendSubjects(
      subjectStatuses([
        { subject: "理論", sittingsAgo: 0 },
        { subject: "電力", sittingsAgo: 0 },
        { subject: "機械", sittingsAgo: 0 },
      ]),
      readiness,
    );
    expect(planSummary(one)).toContain("法規");
  });
});
