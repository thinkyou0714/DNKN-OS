/**
 * report.ts — 帳票差分の集計とレポート出力（純ロジック・DOM 非依存）。
 *
 * 「変更点一覧」は設計レビュー・変更管理の提出物になるため、画面表示だけでなく
 * CSV（Excel で開ける）とテキスト要約の両方を決定論的に生成できるようにする。
 */

import { changedCellCount, type SheetDiff } from "./diff.js";
import { toDelimitedText } from "./parse.js";

export interface DiffSummary {
  addedRows: number;
  removedRows: number;
  changedRows: number;
  changedCells: number;
  unchangedRows: number;
  comparedColumns: number;
  columnsOnlyInOld: number;
  columnsOnlyInNew: number;
  duplicateKeys: number;
  raggedRows: number;
}

export function summarizeDiff(diff: SheetDiff, raggedRows = 0): DiffSummary {
  return {
    addedRows: diff.added.length,
    removedRows: diff.removed.length,
    changedRows: diff.changed.length,
    changedCells: changedCellCount(diff),
    unchangedRows: diff.unchangedCount,
    comparedColumns: diff.comparedColumns.length,
    columnsOnlyInOld: diff.columnsOnlyInOld.length,
    columnsOnlyInNew: diff.columnsOnlyInNew.length,
    duplicateKeys: diff.duplicateKeys.length,
    raggedRows,
  };
}

/** 人が読む1行サマリ（画面ヘッダ・計算書のヘッダに使う）。 */
export function summaryLine(summary: DiffSummary): string {
  return `追加 ${summary.addedRows} 行 ／ 削除 ${summary.removedRows} 行 ／ 変更 ${summary.changedRows} 行（${summary.changedCells} セル） ／ 変更なし ${summary.unchangedRows} 行`;
}

/**
 * 変更点一覧の行列（ヘッダ込み）。
 * 1変更セル=1行にする（ピボットせず素直に並べる）ことで Excel 側でのフィルタ・並べ替えが効く。
 */
export function diffRows(diff: SheetDiff): string[][] {
  const header = ["区分", ...diff.keyColumns, "列名", "変更前", "変更後"];
  const rows: string[][] = [header];
  const blankKeys = diff.keyColumns.map(() => "");

  for (const row of diff.changed) {
    for (const c of row.changes) {
      rows.push(["変更", ...diff.keyColumns.map((_, i) => row.key[i] ?? ""), c.column, c.before, c.after]);
    }
  }
  for (const rec of diff.added) {
    rows.push(["追加", ...diff.keyColumns.map((k) => rec[k] ?? ""), "", "", ""]);
  }
  for (const rec of diff.removed) {
    rows.push(["削除", ...diff.keyColumns.map((k) => rec[k] ?? ""), "", "", ""]);
  }
  for (const col of diff.columnsOnlyInOld) {
    rows.push(["列削除", ...blankKeys, col, "", ""]);
  }
  for (const col of diff.columnsOnlyInNew) {
    rows.push(["列追加", ...blankKeys, col, "", ""]);
  }
  for (const dup of diff.duplicateKeys) {
    const side = dup.side === "old" ? "旧版" : "新版";
    rows.push([`キー重複(${side})`, ...diff.keyColumns.map((_, i) => dup.key[i] ?? ""), "", "", `${dup.count} 行`]);
  }
  return rows;
}

/** 変更点一覧の CSV（Excel 互換の CRLF・クォート）。 */
export function formatDiffCsv(diff: SheetDiff): string {
  return toDelimitedText(diffRows(diff), ",");
}
