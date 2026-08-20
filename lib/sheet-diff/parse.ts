/**
 * parse.ts — 設計帳票（CSV/TSV）のパーサ（純ロジック・DOM 非依存）。
 *
 * RFC 4180 準拠のクォート処理を持つ最小パーサ。外部ライブラリを使わないのは、
 * 帳票の中身を絶対に外へ出さない（＝依存を増やさない・ブラウザ内で完結させる）ためと、
 * 区切り自動判定や不揃い行の扱いを設計帳票向けに寄せたいため。
 *
 * 対応:
 *  - 区切り文字の自動判定（カンマ / タブ / セミコロン）
 *  - クォート内の改行・区切り文字・"" によるエスケープ
 *  - CRLF / LF / CR の混在
 *  - 先頭 BOM の除去（Excel が書き出す UTF-8 CSV 対策）
 */

/** 判定・指定に使える区切り文字。 */
export const DELIMITERS = [",", "\t", ";"] as const;
export type Delimiter = (typeof DELIMITERS)[number];

export interface ParsedTable {
  delimiter: Delimiter;
  /** 1行目をヘッダとして扱う。 */
  header: string[];
  /** ヘッダ列数に合わせて右詰めパディング済みのデータ行。 */
  rows: string[][];
  /** ヘッダと列数が違った行の数（帳票の壊れ検知に使う）。 */
  raggedRowCount: number;
}

/**
 * 区切り文字を推定する。1行目（クォートを考慮しない粗い走査）で最多の候補を選ぶ。
 * 同数ならカンマを優先する（日本語圏の帳票で最も多い）。
 */
export function detectDelimiter(text: string): Delimiter {
  const firstLine = text.replace(/^\uFEFF/, "").split(/\r\n|\n|\r/, 1)[0] ?? "";
  let best: Delimiter = ",";
  let bestCount = 0;
  for (const d of DELIMITERS) {
    const count = firstLine.split(d).length - 1;
    if (count > bestCount) {
      best = d;
      bestCount = count;
    }
  }
  return best;
}

/**
 * CSV/TSV を解析する。空入力・ヘッダのみでも throw せず空テーブルを返す。
 * @param delimiter 省略時は detectDelimiter で推定
 */
export function parseDelimited(text: string, delimiter?: Delimiter): ParsedTable {
  const src = text.replace(/^\uFEFF/, "");
  const d = delimiter ?? detectDelimiter(src);

  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;
  let fieldStarted = false;

  const endField = (): void => {
    record.push(field);
    field = "";
    fieldStarted = false;
  };
  const endRecord = (): void => {
    endField();
    // 完全な空行（1列だけで中身が空）はレコードとして数えない。
    if (!(record.length === 1 && record[0] === "")) records.push(record);
    record = [];
  };

  for (let i = 0; i < src.length; i++) {
    const c = src[i] as string;
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"' && !fieldStarted) {
      inQuotes = true;
      fieldStarted = true;
      continue;
    }
    if (c === d) {
      endField();
      continue;
    }
    if (c === "\n") {
      endRecord();
      continue;
    }
    if (c === "\r") {
      // CRLF は LF 側で締めるため、ここでは CR 単独改行だけを処理する。
      if (src[i + 1] !== "\n") endRecord();
      continue;
    }
    field += c;
    fieldStarted = true;
  }
  // 末尾に改行がない場合の締め。
  if (field !== "" || record.length > 0) endRecord();

  const header = records.shift() ?? [];
  const width = header.length;
  let raggedRowCount = 0;
  const rows = records.map((r) => {
    if (r.length !== width) raggedRowCount++;
    const padded = r.slice(0, width);
    while (padded.length < width) padded.push("");
    return padded;
  });

  return { delimiter: d, header, rows, raggedRowCount };
}

/** 1フィールドを CSV としてクォートする（区切り・引用符・改行を含むときだけ）。 */
export function quoteField(value: string, delimiter: Delimiter = ","): string {
  if (value.includes('"') || value.includes(delimiter) || /[\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** 行の配列を CSV 文字列にする（Excel 互換のため CRLF 改行）。 */
export function toDelimitedText(rows: string[][], delimiter: Delimiter = ","): string {
  return rows.map((r) => r.map((c) => quoteField(c, delimiter)).join(delimiter)).join("\r\n");
}

// ---- 文字コード ----

export type SheetEncoding = "utf-8" | "shift_jis";

/**
 * 帳票ファイルのバイト列を文字列にする。
 *
 * Excel が日本語環境で書き出す CSV は Shift_JIS が今も多数派で、UTF-8 として読むと
 * 全列が文字化けして「全行が変更」に見えてしまう。UTF-8 として厳密デコードできるかで
 * 判定し、できなければ Shift_JIS として読み直す（BOM 付き UTF-8 は前者で通る）。
 */
export function decodeSheetBytes(bytes: Uint8Array): { text: string; encoding: SheetEncoding } {
  try {
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(bytes), encoding: "utf-8" };
  } catch {
    // UTF-8 として不正 → Shift_JIS とみなす。それも失敗する環境では置換文字つきで読む
    // （読めないより、化けても表示して利用者に気付かせるほうがよい）。
    try {
      return { text: new TextDecoder("shift_jis").decode(bytes), encoding: "shift_jis" };
    } catch {
      return { text: new TextDecoder("utf-8").decode(bytes), encoding: "utf-8" };
    }
  }
}
