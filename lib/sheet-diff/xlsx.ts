/**
 * xlsx.ts — Excel ブック（.xlsx）をブラウザ内で読む（純ロジック・DOM 非依存）。
 *
 * 「CSV に保存し直してから使う」という一手間が、現場では最大の離脱要因になる。
 * かといって帳票を外部サービスへ送るわけにはいかない（このツールの売りが消える）ため、
 * 外部ライブラリなしで xlsx を解く:
 *
 *  1. xlsx は ZIP。セントラルディレクトリを読み、必要なエントリだけを取り出す。
 *     展開は標準の DecompressionStream("deflate-raw")（ブラウザ・Node 18+ 共通）。
 *  2. 中身は XML。DOMParser は Node に無いため、必要な要素だけを正規表現で拾う
 *     （信頼できない任意 XML ではなく、Excel が生成する既知の構造だけを対象にする）。
 *
 * 対応範囲: 1シート＝1表、先頭行がヘッダ、共有文字列・インライン文字列・数値・日付シリアル値。
 * 数式セルは「最後に計算された値」（<v>）を読む（Excel が保存時に必ず書いている）。
 */

import type { ParsedTable } from "./parse.js";

/** ZIP のローカルファイルヘッダ／セントラルディレクトリ／終端の各シグネチャ。 */
const SIG_CENTRAL_DIR = 0x02014b50;
const SIG_END_OF_CENTRAL_DIR = 0x06054b50;

class ByteReader {
  constructor(private readonly view: DataView) {}
  u16(offset: number): number {
    return this.view.getUint16(offset, true);
  }
  u32(offset: number): number {
    return this.view.getUint32(offset, true);
  }
}

/** ZIP 内の1エントリ（必要な情報だけ）。 */
interface ZipEntry {
  name: string;
  compressionMethod: number;
  compressedSize: number;
  localHeaderOffset: number;
}

/** セントラルディレクトリを走査してエントリ一覧を得る。壊れた ZIP は空配列。 */
function readZipEntries(bytes: Uint8Array): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const r = new ByteReader(view);

  // 終端レコードは末尾（コメント最大 64KB）から後ろ向きに探す。
  let eocd = -1;
  const minStart = Math.max(0, bytes.length - 22 - 65535);
  for (let i = bytes.length - 22; i >= minStart; i--) {
    if (r.u32(i) === SIG_END_OF_CENTRAL_DIR) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return [];

  const entryCount = r.u16(eocd + 10);
  let offset = r.u32(eocd + 16);
  const entries: ZipEntry[] = [];
  for (let i = 0; i < entryCount; i++) {
    if (offset + 46 > bytes.length || r.u32(offset) !== SIG_CENTRAL_DIR) break;
    const nameLength = r.u16(offset + 28);
    const extraLength = r.u16(offset + 30);
    const commentLength = r.u16(offset + 32);
    entries.push({
      compressionMethod: r.u16(offset + 10),
      compressedSize: r.u32(offset + 20),
      name: new TextDecoder("utf-8").decode(bytes.subarray(offset + 46, offset + 46 + nameLength)),
      localHeaderOffset: r.u32(offset + 42),
    });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

/**
 * DecompressionStream の構造的最小型。
 * DOM lib（ブラウザ）と @types/node で Uint8Array の型引数（ArrayBuffer / ArrayBufferLike）が
 * 食い違うため、pipeThrough に渡せる形だけを宣言して両環境の型検査を通す
 * （license.ts の SubtleLike と同じ方針）。
 */
type BytesTransform = ReadableWritablePair<Uint8Array, Uint8Array>;

/**
 * deflate-raw を標準 API で展開する。
 * Blob を経由せず ReadableStream を自前で作るのは、Node の型定義では
 * Uint8Array<ArrayBufferLike> が BlobPart に代入できないため。
 */
async function inflateRaw(compressed: Uint8Array): Promise<Uint8Array> {
  const source = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(compressed);
      controller.close();
    },
  });
  const stream = source.pipeThrough(new DecompressionStream("deflate-raw") as unknown as BytesTransform);
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/** 指定エントリの中身を取り出す。未対応の圧縮方式は null。 */
async function readEntry(bytes: Uint8Array, entry: ZipEntry): Promise<Uint8Array | null> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const r = new ByteReader(view);
  const base = entry.localHeaderOffset;
  // ローカルヘッダのファイル名長・拡張領域長はセントラルディレクトリと異なりうるため読み直す。
  const nameLength = r.u16(base + 26);
  const extraLength = r.u16(base + 28);
  const dataStart = base + 30 + nameLength + extraLength;
  const raw = bytes.subarray(dataStart, dataStart + entry.compressedSize);
  if (entry.compressionMethod === 0) return raw; // stored
  if (entry.compressionMethod === 8) return inflateRaw(raw); // deflate
  return null;
}

/** ZIP を展開して「エントリ名 → 文字列」の辞書にする（必要なエントリだけ読む）。 */
export async function readZipTextEntries(
  bytes: Uint8Array,
  wanted: (name: string) => boolean,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const decoder = new TextDecoder("utf-8");
  for (const entry of readZipEntries(bytes)) {
    if (!wanted(entry.name)) continue;
    const content = await readEntry(bytes, entry);
    if (content !== null) out.set(entry.name, decoder.decode(content));
  }
  return out;
}

// ---- XML（Excel が生成する既知の構造だけを対象にした軽量抽出）----

/** XML のテキスト実体参照を戻す。 */
function unescapeXml(text: string): string {
  return (
    text
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
      // & は最後に戻す（&amp;lt; のような二重エスケープを壊さない）。
      .replace(/&amp;/g, "&")
  );
}

/** <t> の中身をすべて連結する（リッチテキストは複数の <t> に割れる）。 */
function joinTextNodes(xml: string): string {
  const parts: string[] = [];
  for (const m of xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) parts.push(unescapeXml(m[1] ?? ""));
  return parts.join("");
}

/** sharedStrings.xml → 文字列表。 */
export function parseSharedStrings(xml: string): string[] {
  const out: string[] = [];
  for (const m of xml.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)) out.push(joinTextNodes(m[1] ?? ""));
  return out;
}

/** セル参照（"BC12"）から 0 始まりの列番号を得る。 */
export function columnIndexOf(cellRef: string): number {
  const letters = /^([A-Z]+)/.exec(cellRef.toUpperCase())?.[1] ?? "";
  let index = 0;
  for (const ch of letters) index = index * 26 + (ch.charCodeAt(0) - 64);
  return index - 1;
}

/**
 * ワークシート XML を行×セルの二次元配列にする。
 * 欠落セル（空欄）はセル参照から位置を復元して詰める。
 */
export function parseWorksheet(sheetXml: string, sharedStrings: string[]): string[][] {
  const rows: string[][] = [];
  for (const rowMatch of sheetXml.matchAll(/<row(?:\s[^>]*)?>([\s\S]*?)<\/row>/g)) {
    const rowXml = rowMatch[1] ?? "";
    const cells: string[] = [];
    for (const cellMatch of rowXml.matchAll(/<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cellMatch[1] ?? "";
      const body = cellMatch[2] ?? "";
      const ref = /r="([A-Z]+\d+)"/i.exec(attrs)?.[1];
      const type = /t="([^"]+)"/.exec(attrs)?.[1] ?? "n";

      let value: string;
      if (type === "s") {
        // 共有文字列: <v> は文字列表のインデックス。
        const index = Number(/<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? "");
        value = Number.isInteger(index) ? (sharedStrings[index] ?? "") : "";
      } else if (type === "inlineStr") {
        value = joinTextNodes(body);
      } else if (type === "str") {
        // 数式の文字列結果。
        value = unescapeXml(/<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? "");
      } else {
        value = unescapeXml(/<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? "");
      }

      // 空欄セルは XML から省かれるため、参照が飛んでいたらその分を詰める。
      if (ref !== undefined) {
        const target = columnIndexOf(ref);
        while (cells.length < target) cells.push("");
      }
      cells.push(value);
    }
    rows.push(cells);
  }
  return rows;
}

/** workbook.xml のシート名（表示順）。 */
export function parseSheetNames(workbookXml: string): string[] {
  const names: string[] = [];
  for (const m of workbookXml.matchAll(/<sheet\s([^>]*?)\/?>/g)) {
    const name = /name="([^"]*)"/.exec(m[1] ?? "")?.[1];
    if (name !== undefined) names.push(unescapeXml(name));
  }
  return names;
}

export interface XlsxSheet {
  sheetNames: string[];
  /** 読み込んだシートの位置（0 始まり）。 */
  sheetIndex: number;
  table: ParsedTable;
}

export type XlsxReadResult = { ok: true; sheet: XlsxSheet } | { ok: false; error: string };

/**
 * xlsx から1シートを読み出して ParsedTable にする（CSV と同じ形に揃える）。
 * 壊れたファイル・未対応形式は throw せず error を返す。
 * @param sheetIndex 読み出すシートの位置（既定 0＝先頭シート）
 */
export async function readXlsxSheet(bytes: Uint8Array, sheetIndex = 0): Promise<XlsxReadResult> {
  let files: Map<string, string>;
  try {
    files = await readZipTextEntries(
      bytes,
      (name) => name === "xl/workbook.xml" || name === "xl/sharedStrings.xml" || name.startsWith("xl/worksheets/sheet"),
    );
  } catch {
    return { ok: false, error: "Excel ファイルを展開できませんでした（破損しているか、対応していない形式です）" };
  }

  const workbookXml = files.get("xl/workbook.xml");
  if (workbookXml === undefined) {
    return { ok: false, error: "Excel ブックとして読めませんでした（xlsx 形式か確認してください。xls は非対応です）" };
  }
  const sheetNames = parseSheetNames(workbookXml);

  // シート XML は sheet1.xml, sheet2.xml … の連番。表示順と一致させるため番号でソートする。
  const sheetPaths = [...files.keys()]
    .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
    .sort((a, b) => Number(/(\d+)\.xml$/.exec(a)?.[1] ?? 0) - Number(/(\d+)\.xml$/.exec(b)?.[1] ?? 0));
  const target = sheetPaths[sheetIndex];
  if (target === undefined) {
    return { ok: false, error: `シートが見つかりません（${sheetPaths.length} シート中 ${sheetIndex + 1} 枚目を要求）` };
  }

  const sharedStrings = parseSharedStrings(files.get("xl/sharedStrings.xml") ?? "");
  const rows = parseWorksheet(files.get(target) ?? "", sharedStrings);
  const header = rows.shift() ?? [];
  if (header.length === 0) {
    return { ok: false, error: "1行目が空です（1行目を列名の行にしてください）" };
  }

  // ヘッダ幅に揃える（CSV パーサと同じ後処理にして、以降の突合を共通化する）。
  let raggedRowCount = 0;
  const normalized = rows.map((row) => {
    if (row.length !== header.length) raggedRowCount++;
    const padded = row.slice(0, header.length);
    while (padded.length < header.length) padded.push("");
    return padded;
  });

  return {
    ok: true,
    sheet: {
      sheetNames,
      sheetIndex,
      // 区切り文字の概念はないが、ParsedTable の形を CSV と揃えるため "," を入れる。
      table: { delimiter: ",", header, rows: normalized, raggedRowCount },
    },
  };
}

/** 先頭 4 バイトが ZIP のシグネチャ（"PK\3\4"）か。xlsx かどうかの粗い判定に使う。 */
export function looksLikeZip(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}
