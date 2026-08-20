/**
 * diff.ts — 設計帳票の変更点抽出（純ロジック・DOM 非依存）。
 *
 * 汎用のテキスト差分（WinMerge 等）と違い、**キー列で行を突合してセル単位の変更を出す**。
 * 行の並び替えを変更として誤検出しないこと、部品表・端子表のように「品番で1行」が
 * 決まっている帳票で「何がどう変わったか」を直接出せることが、設計現場での価値になる。
 *
 * 各社で列名が違う（「品番」「部品番号」「Part No.」）問題は列名エイリアス（正準名への写像）で吸収する。
 */

import type { ParsedTable } from "./parse.js";

export interface DiffOptions {
  /** 行を突合するキー列（正準名）。複数指定で複合キー。 */
  keyColumns: string[];
  /** 比較から外す列（改訂日・出力時刻など、毎回変わる列）。 */
  ignoreColumns?: string[];
  /** 生の列名 → 正準名 の写像（各社雛形の吸収）。旧新どちらの帳票にも適用する。 */
  columnAliases?: Record<string, string>;
  /** 前後の空白を無視して比較する（既定 true）。 */
  trimValues?: boolean;
  /** 英字の大小を無視して比較する（既定 false）。 */
  ignoreCase?: boolean;
  /** 数値として等しければ同値とみなす（"1.0" と "1" 等。既定 true）。 */
  numericEquality?: boolean;
}

export interface CellChange {
  column: string;
  before: string;
  after: string;
}

/** 行を「正準列名 → 値」で表したもの。 */
export type RowRecord = Record<string, string>;

export interface ChangedRow {
  key: string[];
  changes: CellChange[];
  /** 変更後の行（参考表示用）。 */
  after: RowRecord;
}

export interface DuplicateKey {
  side: "old" | "new";
  key: string[];
  count: number;
}

export interface SheetDiff {
  ok: true;
  keyColumns: string[];
  /** 実際に突き合わせた列（両方に存在し、キー列・除外列でないもの）。 */
  comparedColumns: string[];
  columnsOnlyInOld: string[];
  columnsOnlyInNew: string[];
  added: RowRecord[];
  removed: RowRecord[];
  changed: ChangedRow[];
  unchangedCount: number;
  /** キーが重複した行（帳票としての異常。先勝ちで比較し、ここに記録する）。 */
  duplicateKeys: DuplicateKey[];
}

export type SheetDiffResult = SheetDiff | { ok: false; errors: string[] };

/** 列名の表記ゆれを吸収する（前後空白・全角空白・連続空白）。 */
export function normalizeColumnName(name: string): string {
  return name.replace(/[\s　]+/g, " ").trim();
}

/** 生の列名にエイリアスを適用して正準名にする。 */
export function canonicalColumn(name: string, aliases: Record<string, string> = {}): string {
  const normalized = normalizeColumnName(name);
  return aliases[normalized] ?? normalized;
}

/** 表を「正準列名 → 値」の行レコード配列に変換する。重複列は先勝ち。 */
function toRecords(table: ParsedTable, aliases: Record<string, string>): { columns: string[]; records: RowRecord[] } {
  const columns: string[] = [];
  const indexOfColumn: Array<{ column: string; index: number }> = [];
  table.header.forEach((raw, i) => {
    const col = canonicalColumn(raw, aliases);
    if (col === "" || columns.includes(col)) return;
    columns.push(col);
    indexOfColumn.push({ column: col, index: i });
  });
  const records = table.rows.map((row) => {
    const rec: RowRecord = {};
    for (const { column, index } of indexOfColumn) rec[column] = row[index] ?? "";
    return rec;
  });
  return { columns, records };
}

/** 比較用に値を正規化する。 */
function normalizeValue(value: string, opts: DiffOptions): string {
  let v = opts.trimValues === false ? value : value.trim();
  if (opts.ignoreCase === true) v = v.toLowerCase();
  return v;
}

/** 2つのセル値が実質同じか（数値同値の扱いを含む）。 */
export function valuesEqual(a: string, b: string, opts: DiffOptions): boolean {
  const na = normalizeValue(a, opts);
  const nb = normalizeValue(b, opts);
  if (na === nb) return true;
  if (opts.numericEquality === false) return false;
  // "1.0" と "1"、"1,000" と "1000" のような表記差を同値とみなす（帳票では日常的に起きる）。
  const fa = Number(na.replace(/,/g, ""));
  const fb = Number(nb.replace(/,/g, ""));
  if (na === "" || nb === "" || !Number.isFinite(fa) || !Number.isFinite(fb)) return false;
  return fa === fb;
}

/**
 * 複合キーの区切り。帳票データに現れない NUL を使う（空白区切りだと
 * 「A B」1列と「A」「B」2列が衝突し、キーの復元もできない）。
 * ソースには生の制御文字を置かずエスケープで書く（git がバイナリ扱いして差分が読めなくなる）。
 */
const KEY_SEP = "\u0000";

/** 複合キーを1本の文字列にする。 */
function keyOf(record: RowRecord, keyColumns: string[], opts: DiffOptions): string {
  return keyColumns.map((c) => normalizeValue(record[c] ?? "", opts)).join(KEY_SEP);
}

/**
 * 旧版・新版の帳票を突合して変更点を抽出する。
 * キー列が両方に存在しない・キー未指定などの設定不備は errors で返す（throw しない）。
 */
export function diffSheets(oldTable: ParsedTable, newTable: ParsedTable, options: DiffOptions): SheetDiffResult {
  const aliases = options.columnAliases ?? {};
  const keyColumns = options.keyColumns.map((c) => canonicalColumn(c, aliases)).filter((c) => c !== "");
  const errors: string[] = [];
  if (keyColumns.length === 0) errors.push("突合に使うキー列を1つ以上指定してください");

  const oldSide = toRecords(oldTable, aliases);
  const newSide = toRecords(newTable, aliases);
  for (const key of keyColumns) {
    if (!oldSide.columns.includes(key)) errors.push(`キー列「${key}」が旧版の帳票にありません`);
    if (!newSide.columns.includes(key)) errors.push(`キー列「${key}」が新版の帳票にありません`);
  }
  if (errors.length > 0) return { ok: false, errors };

  const ignore = new Set((options.ignoreColumns ?? []).map((c) => canonicalColumn(c, aliases)));
  const comparedColumns = newSide.columns.filter(
    (c) => oldSide.columns.includes(c) && !keyColumns.includes(c) && !ignore.has(c),
  );
  const columnsOnlyInOld = oldSide.columns.filter((c) => !newSide.columns.includes(c));
  const columnsOnlyInNew = newSide.columns.filter((c) => !oldSide.columns.includes(c));

  const duplicateKeys: DuplicateKey[] = [];
  /** キー→行（先勝ち）。重複は duplicateKeys に積む。 */
  const indexBy = (records: RowRecord[], side: "old" | "new"): Map<string, RowRecord> => {
    const map = new Map<string, RowRecord>();
    const counts = new Map<string, number>();
    for (const rec of records) {
      const k = keyOf(rec, keyColumns, options);
      counts.set(k, (counts.get(k) ?? 0) + 1);
      if (!map.has(k)) map.set(k, rec);
    }
    for (const [k, count] of counts) {
      if (count > 1) duplicateKeys.push({ side, key: k.split(KEY_SEP), count });
    }
    return map;
  };

  const oldMap = indexBy(oldSide.records, "old");
  const newMap = indexBy(newSide.records, "new");

  const added: RowRecord[] = [];
  const removed: RowRecord[] = [];
  const changed: ChangedRow[] = [];
  let unchangedCount = 0;

  for (const [k, newRec] of newMap) {
    const oldRec = oldMap.get(k);
    if (oldRec === undefined) {
      added.push(newRec);
      continue;
    }
    const changes: CellChange[] = [];
    for (const col of comparedColumns) {
      const before = oldRec[col] ?? "";
      const after = newRec[col] ?? "";
      if (!valuesEqual(before, after, options)) changes.push({ column: col, before, after });
    }
    if (changes.length === 0) unchangedCount++;
    else changed.push({ key: k.split(KEY_SEP), changes, after: newRec });
  }
  for (const [k, oldRec] of oldMap) {
    if (!newMap.has(k)) removed.push(oldRec);
  }

  return {
    ok: true,
    keyColumns,
    comparedColumns,
    columnsOnlyInOld,
    columnsOnlyInNew,
    added,
    removed,
    changed,
    unchangedCount,
    duplicateKeys,
  };
}

/** 変更セルの総数（行数ではなくセル数）。 */
export function changedCellCount(diff: SheetDiff): number {
  return diff.changed.reduce((sum, row) => sum + row.changes.length, 0);
}

/** 変更が1件もないか（列構成の差も「変更なし」には含めない）。 */
export function isNoChange(diff: SheetDiff): boolean {
  return (
    diff.added.length === 0 &&
    diff.removed.length === 0 &&
    diff.changed.length === 0 &&
    diff.columnsOnlyInOld.length === 0 &&
    diff.columnsOnlyInNew.length === 0
  );
}
