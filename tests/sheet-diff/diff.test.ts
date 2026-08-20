/**
 * tests/sheet-diff/diff.test.ts — 帳票差分エンジンの検証。
 * 「行の並べ替えを変更と誤検出しない」「キー列で突合する」という、汎用テキスト差分に対する
 * 本ツールの差別化点そのものを固定する。
 */
import { describe, expect, it } from "vitest";
import {
  canonicalColumn,
  changedCellCount,
  diffSheets,
  isNoChange,
  normalizeColumnName,
  type SheetDiff,
  valuesEqual,
} from "../../lib/sheet-diff/diff.js";
import { parseDelimited } from "../../lib/sheet-diff/parse.js";

const OLD = parseDelimited(["品番,数量,単価,備考", "R1,2,10,", "R2,3,20,共通", "C1,1,50,"].join("\n"));
const NEW = parseDelimited(["品番,数量,単価,備考", "R2,3,25,共通", "R1,2,10,", "D1,4,80,新規"].join("\n"));

/** ok を前提に本体を取り出す（設定不備は別テストで扱う）。 */
function ok(result: ReturnType<typeof diffSheets>): SheetDiff {
  expect(result.ok, result.ok ? "" : result.errors.join(" / ")).toBe(true);
  return result as SheetDiff;
}

describe("diffSheets — 基本の突合", () => {
  const diff = ok(diffSheets(OLD, NEW, { keyColumns: ["品番"] }));

  it("キー列で突合するので行の並べ替えは変更にならない", () => {
    // R1 は位置が 1行目→2行目 に動いたが内容は同じ。
    expect(diff.unchangedCount).toBe(1);
    expect(diff.changed.map((c) => c.key[0])).toEqual(["R2"]);
  });

  it("追加・削除・セル単位の変更を分けて出す", () => {
    expect(diff.added.map((r) => r.品番)).toEqual(["D1"]);
    expect(diff.removed.map((r) => r.品番)).toEqual(["C1"]);
    expect(diff.changed[0]?.changes).toEqual([{ column: "単価", before: "20", after: "25" }]);
    expect(changedCellCount(diff)).toBe(1);
  });

  it("キー列は比較対象から外れ、残りの列が比較対象になる", () => {
    expect(diff.keyColumns).toEqual(["品番"]);
    expect(diff.comparedColumns).toEqual(["数量", "単価", "備考"]);
    expect(isNoChange(diff)).toBe(false);
  });

  it("同一の帳票同士では変更なしになる", () => {
    const same = ok(diffSheets(OLD, OLD, { keyColumns: ["品番"] }));
    expect(isNoChange(same)).toBe(true);
    expect(same.unchangedCount).toBe(3);
  });
});

describe("diffSheets — 列の扱い", () => {
  it("片側にしかない列は比較せず、列追加/列削除として報告する", () => {
    const a = parseDelimited("品番,数量,旧欄\nR1,1,x");
    const b = parseDelimited("品番,数量,新欄\nR1,1,y");
    const diff = ok(diffSheets(a, b, { keyColumns: ["品番"] }));
    expect(diff.comparedColumns).toEqual(["数量"]);
    expect(diff.columnsOnlyInOld).toEqual(["旧欄"]);
    expect(diff.columnsOnlyInNew).toEqual(["新欄"]);
    expect(diff.changed).toEqual([]);
    expect(isNoChange(diff)).toBe(false);
  });

  it("ignoreColumns の列は変更として数えない（出力日時など毎回変わる欄）", () => {
    const a = parseDelimited("品番,数量,出力日\nR1,1,2026-08-01");
    const b = parseDelimited("品番,数量,出力日\nR1,1,2026-08-19");
    expect(ok(diffSheets(a, b, { keyColumns: ["品番"] })).changed).toHaveLength(1);
    const ignored = ok(diffSheets(a, b, { keyColumns: ["品番"], ignoreColumns: ["出力日"] }));
    expect(ignored.changed).toEqual([]);
    expect(ignored.comparedColumns).toEqual(["数量"]);
  });

  it("列名エイリアスで各社雛形の表記差を吸収する", () => {
    const a = parseDelimited("部品番号,数量\nR1,1");
    const b = parseDelimited("Part No.,数量\nR1,2");
    const aliases = { 部品番号: "品番", "Part No.": "品番" };
    const diff = ok(diffSheets(a, b, { keyColumns: ["品番"], columnAliases: aliases }));
    expect(diff.changed[0]?.changes).toEqual([{ column: "数量", before: "1", after: "2" }]);
    expect(diff.columnsOnlyInOld).toEqual([]);
  });

  it("列名の前後空白・全角空白のゆれは正規化して同じ列とみなす", () => {
    expect(normalizeColumnName("  品 番 ")).toBe("品 番");
    expect(normalizeColumnName("品番　")).toBe("品番");
    expect(canonicalColumn(" 部品番号 ", { 部品番号: "品番" })).toBe("品番");
    const a = parseDelimited("品番 ,数量\nR1,1");
    const b = parseDelimited("品番,数量\nR1,2");
    expect(ok(diffSheets(a, b, { keyColumns: ["品番"] })).changed).toHaveLength(1);
  });
});

describe("diffSheets — 値の比較規則", () => {
  it("既定では前後空白と数値表記の差（1.0 と 1、1,000 と 1000）を同値とみなす", () => {
    const opts = { keyColumns: ["品番"] };
    expect(valuesEqual(" 1 ", "1", opts)).toBe(true);
    expect(valuesEqual("1.0", "1", opts)).toBe(true);
    expect(valuesEqual("1,000", "1000", opts)).toBe(true);
    expect(valuesEqual("1.01", "1", opts)).toBe(false);
    // 空欄と 0 は別物として扱う（未記入を 0 と混同すると帳票では事故になる）。
    expect(valuesEqual("", "0", opts)).toBe(false);
  });

  it("numericEquality=false なら文字列一致だけで判定する", () => {
    const opts = { keyColumns: ["品番"], numericEquality: false };
    expect(valuesEqual("1.0", "1", opts)).toBe(false);
    expect(valuesEqual(" 1 ", "1", opts)).toBe(true);
  });

  it("trimValues=false・ignoreCase=true が効く", () => {
    expect(valuesEqual(" A", "A", { keyColumns: [], trimValues: false })).toBe(false);
    expect(valuesEqual("abc", "ABC", { keyColumns: [], ignoreCase: true })).toBe(true);
    expect(valuesEqual("abc", "ABC", { keyColumns: [] })).toBe(false);
  });
});

describe("diffSheets — 異常系", () => {
  it("キー列が無い/未指定は errors を返す（throw しない）", () => {
    const noKey = diffSheets(OLD, NEW, { keyColumns: [] });
    expect(noKey.ok).toBe(false);
    if (!noKey.ok) expect(noKey.errors[0]).toContain("キー列");

    const missing = diffSheets(OLD, NEW, { keyColumns: ["管理番号"] });
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.errors).toHaveLength(2); // 旧版・新版の両方で不足
      expect(missing.errors[0]).toContain("旧版");
    }
  });

  it("キーの重複は先勝ちで比較しつつ、重複そのものを報告する", () => {
    const a = parseDelimited("品番,数量\nR1,1\nR1,9");
    const b = parseDelimited("品番,数量\nR1,1");
    const diff = ok(diffSheets(a, b, { keyColumns: ["品番"] }));
    expect(diff.duplicateKeys).toEqual([{ side: "old", key: ["R1"], count: 2 }]);
    expect(diff.unchangedCount).toBe(1);
  });

  it("複合キーは値に空白が含まれても取り違えない", () => {
    const a = parseDelimited("図番,品番,数量\nA 1,B,1\nA,1 B,1");
    const b = parseDelimited("図番,品番,数量\nA 1,B,2\nA,1 B,3");
    const diff = ok(diffSheets(a, b, { keyColumns: ["図番", "品番"] }));
    expect(diff.changed).toHaveLength(2);
    expect(diff.changed.map((c) => c.key)).toEqual([
      ["A 1", "B"],
      ["A", "1 B"],
    ]);
  });
});
