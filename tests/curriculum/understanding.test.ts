/**
 * tests/curriculum/understanding.test.ts — 「解けるけど説明できない」検出の検証。
 * 演習正答率と納得チェック着手率の2軸集計・ギャップ判定の閾値・決定論を確認する。
 */
import { describe, expect, it } from "vitest";
import {
  explanationGaps,
  GAP_MIN_ATTEMPTS,
  type SolveLog,
  understandingByArea,
} from "../../lib/curriculum/understanding.js";
import { whyChecksForArea } from "../../lib/curriculum/why-check.js";

/** 「三相交流回路」領域にマッチする論点で、正答 n 件・誤答 m 件のログを作る。 */
function threePhaseLogs(correct: number, wrong = 0): SolveLog[] {
  return [
    ...Array.from({ length: correct }, () => ({ topic: "三相交流電力", correct: true })),
    ...Array.from({ length: wrong }, () => ({ topic: "三相交流電力", correct: false })),
  ];
}

const THREE_PHASE_CHECK_IDS = whyChecksForArea("三相交流回路").map((i) => i.id);

describe("understandingByArea", () => {
  it("論点を領域へ写像して演習の試行・正答率を集計する", () => {
    const rows = understandingByArea(threePhaseLogs(8, 2), []);
    const row = rows.find((r) => r.area === "三相交流回路");
    expect(row?.attempts).toBe(10);
    expect(row?.solveAccuracy).toBeGreaterThan(0.7);
    expect(row?.whyTotal).toBe(THREE_PHASE_CHECK_IDS.length);
    expect(row?.whyStarted).toBe(0);
    expect(row?.whyCoverage).toBe(0);
  });

  it("納得チェックの着手を数え、着手率を出す", () => {
    const rows = understandingByArea(threePhaseLogs(8, 2), THREE_PHASE_CHECK_IDS.slice(0, 1));
    const row = rows.find((r) => r.area === "三相交流回路");
    expect(row?.whyStarted).toBe(1);
    expect(row?.whyCoverage).toBeCloseTo(1 / THREE_PHASE_CHECK_IDS.length);
  });

  it("領域にマッチしない論点は無視する", () => {
    const rows = understandingByArea([{ topic: "まったく無関係な論点", correct: true }], []);
    expect(rows.every((r) => r.attempts === 0)).toBe(true);
  });

  it("領域名の昇順で安定して並ぶ（決定論）", () => {
    const a = understandingByArea(threePhaseLogs(6), []);
    const b = understandingByArea(threePhaseLogs(6), []);
    expect(a).toEqual(b);
    expect([...a].sort((x, y) => x.area.localeCompare(y.area, "ja"))).toEqual(a);
  });
});

describe("explanationGaps", () => {
  it("よく解けているのに納得チェック未着手ならギャップとして返す", () => {
    const gaps = explanationGaps(threePhaseLogs(10), []);
    expect(gaps.map((g) => g.area)).toContain("三相交流回路");
  });

  it("納得チェックを一通り確認済みならギャップにしない", () => {
    const gaps = explanationGaps(threePhaseLogs(10), THREE_PHASE_CHECK_IDS);
    expect(gaps.map((g) => g.area)).not.toContain("三相交流回路");
  });

  it("試行数が少ない領域は（正答率が高くても）ギャップにしない", () => {
    const gaps = explanationGaps(threePhaseLogs(GAP_MIN_ATTEMPTS - 1), []);
    expect(gaps.map((g) => g.area)).not.toContain("三相交流回路");
  });

  it("正答率が低い領域はギャップにしない（それは弱点であって理解ギャップではない）", () => {
    const gaps = explanationGaps(threePhaseLogs(3, 9), []);
    expect(gaps.map((g) => g.area)).not.toContain("三相交流回路");
  });

  it("解けている度合いが高い順に並ぶ", () => {
    // 三相(全問正解) と 直流(8/10) の両方をギャップ候補にする。
    const logs: SolveLog[] = [
      ...threePhaseLogs(10),
      ...Array.from({ length: 9 }, () => ({ topic: "直並列合成抵抗", correct: true })),
      { topic: "直並列合成抵抗", correct: false },
    ];
    const gaps = explanationGaps(logs, []);
    const areas = gaps.map((g) => g.area);
    expect(areas).toContain("三相交流回路");
    expect(areas).toContain("直流回路");
    expect(areas.indexOf("三相交流回路")).toBeLessThan(areas.indexOf("直流回路"));
  });

  it("学習ゼロなら空", () => {
    expect(explanationGaps([], [])).toEqual([]);
  });
});
