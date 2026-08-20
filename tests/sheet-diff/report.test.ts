/**
 * tests/sheet-diff/report.test.ts — 変更点一覧（提出物になる CSV とサマリ）の検証。
 */
import { describe, expect, it } from "vitest";
import { diffSheets, type SheetDiff } from "../../lib/sheet-diff/diff.js";
import { parseDelimited } from "../../lib/sheet-diff/parse.js";
import { diffRows, formatDiffCsv, summarizeDiff, summaryLine } from "../../lib/sheet-diff/report.js";

const OLD = parseDelimited(["品番,数量,単価,旧欄", "R1,2,10,x", "R2,3,20,y", "C1,1,50,z"].join("\n"));
const NEW = parseDelimited(["品番,数量,単価,新欄", "R2,4,25,a", "R1,2,10,b", "D1,4,80,c"].join("\n"));
const DIFF = diffSheets(OLD, NEW, { keyColumns: ["品番"] }) as SheetDiff;

describe("summarizeDiff / summaryLine", () => {
  it("件数を集計する（変更はセル数も数える）", () => {
    const s = summarizeDiff(DIFF, 0);
    expect(s).toEqual({
      addedRows: 1,
      removedRows: 1,
      changedRows: 1,
      changedCells: 2, // R2 の 数量 と 単価
      unchangedRows: 1,
      comparedColumns: 2, // 数量・単価（旧欄/新欄は片側のみ）
      columnsOnlyInOld: 1,
      columnsOnlyInNew: 1,
      duplicateKeys: 0,
      raggedRows: 0,
    });
  });

  it("1行サマリは件数をそのまま日本語にする", () => {
    expect(summaryLine(summarizeDiff(DIFF))).toBe("追加 1 行 ／ 削除 1 行 ／ 変更 1 行（2 セル） ／ 変更なし 1 行");
  });
});

describe("diffRows / formatDiffCsv", () => {
  it("1変更セル=1行で、区分・キー・列名・変更前後を並べる", () => {
    const rows = diffRows(DIFF);
    expect(rows[0]).toEqual(["区分", "品番", "列名", "変更前", "変更後"]);
    expect(rows).toContainEqual(["変更", "R2", "数量", "3", "4"]);
    expect(rows).toContainEqual(["変更", "R2", "単価", "20", "25"]);
    expect(rows).toContainEqual(["追加", "D1", "", "", ""]);
    expect(rows).toContainEqual(["削除", "C1", "", "", ""]);
    expect(rows).toContainEqual(["列削除", "", "旧欄", "", ""]);
    expect(rows).toContainEqual(["列追加", "", "新欄", "", ""]);
  });

  it("キー重複も一覧に出す（見落とすと突合そのものが信用できないため）", () => {
    const a = parseDelimited("品番,数量\nR1,1\nR1,9");
    const b = parseDelimited("品番,数量\nR1,1");
    const dup = diffSheets(a, b, { keyColumns: ["品番"] }) as SheetDiff;
    expect(diffRows(dup)).toContainEqual(["キー重複(旧版)", "R1", "", "", "2 行"]);
  });

  it("CSV は Excel 互換（CRLF）で、区切り・引用符を含む値をクォートする", () => {
    const a = parseDelimited('品番,備考\nR1,"抵抗, 1/4W"');
    const b = parseDelimited('品番,備考\nR1,"抵抗, 1/2W"');
    const csv = formatDiffCsv(diffSheets(a, b, { keyColumns: ["品番"] }) as SheetDiff);
    expect(csv.split("\r\n")[0]).toBe("区分,品番,列名,変更前,変更後");
    expect(csv).toContain('"抵抗, 1/4W","抵抗, 1/2W"');
  });

  it("変更なしならヘッダ行だけになる", () => {
    const same = diffSheets(OLD, OLD, { keyColumns: ["品番"] }) as SheetDiff;
    expect(diffRows(same)).toHaveLength(1);
  });

  it("複合キーはキー列ぶんの列が並ぶ", () => {
    const a = parseDelimited("図番,品番,数量\nA,R1,1");
    const b = parseDelimited("図番,品番,数量\nA,R1,2");
    const rows = diffRows(diffSheets(a, b, { keyColumns: ["図番", "品番"] }) as SheetDiff);
    expect(rows[0]).toEqual(["区分", "図番", "品番", "列名", "変更前", "変更後"]);
    expect(rows[1]).toEqual(["変更", "A", "R1", "数量", "1", "2"]);
  });
});
