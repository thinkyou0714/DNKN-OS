/**
 * tests/sheet-diff/xlsx.test.ts — Excel ブック（.xlsx）読み込みの検証。
 *
 * フィクスチャは Python の zipfile で組み立てた実 ZIP（独立実装）で、Excel が出力するのと
 * 同じ構造を持つ: 共有文字列・リッチテキスト・インライン文字列・数式の結果・空欄セルの省略・
 * 複数シート。自前の ZIP ライタでテストすると「自分の実装同士で辻褄が合うだけ」になるため、
 * あえて別実装で作ったバイト列を固定して読み取り側だけを検証する。
 */
import { describe, expect, it } from "vitest";
import { diffSheets, type SheetDiff } from "../../lib/sheet-diff/diff.js";
import { parseDelimited } from "../../lib/sheet-diff/parse.js";
import {
  columnIndexOf,
  looksLikeZip,
  parseSharedStrings,
  parseSheetNames,
  parseWorksheet,
  readXlsxSheet,
} from "../../lib/sheet-diff/xlsx.js";

/** 部品表（2シート・空欄・数式・リッチテキストを含む）の xlsx。 */
const XLSX_BASE64 =
  "UEsDBBQAAAAIAEQTFl1BIKOF2gAAAEQBAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbH1QvU7DMBDeeQrLK4odGBBCSToUGIGhPMBh" +
  "XxIrts+yryV9e5yWiYHpdPf96rrdGrw4YS6OYi/vVCsFRkPWxamXn4fX5lGKwhAteIrYyzMWuRtuusM5YRFVHEsvZ+b0pHUxMwYo" +
  "ihLGioyUA3Bd86QTmAUm1Pdt+6ANRcbIDW8ecuiecYSjZ/Gy1vO1SJVLsb/ytqheQkreGeAK6w3VQ/dee2dnUXxA5jcIlaVXr78p" +
  "L19Ei/rf5BTtn6YNjaMzaMkcQ5WokjKCLTMiB68uUwVw8fY3X1+eMPwAUEsDBBQAAAAIAEQTFl2eOH/PzAAAAAUBAAAPAAAAeGwv" +
  "d29ya2Jvb2sueG1ss7GvyM1RKEstKs7Mz7NVMtQzUFJIzUvOT8nMS7dVCg1x07VQUiguScxLSczJz0u1VapMLVayt+OyKc8vyk7K" +
  "z89WAOrPK7ZVyigpKbDS1y9OzkjNTSzWyy9IzQPKpOUX5SaWALlF6frFBUWpiSnFGampJbk5+kYGBmb6uYmZeUp2NmCxYiitkJeY" +
  "C7TnZfOKp5MbXyxcAbQeJOyZAnSdkkKRVSaQUeSZYqikj6rh2ZSdL1Y0Pd249NnaLUh6jJD0GIH06MNs04d5wQ4AUEsDBBQAAAAI" +
  "AEQTFl2ly8IB7QAAAFUBAAAUAAAAeGwvc2hhcmVkU3RyaW5ncy54bWyzsa/IzVEoSy0qzszPs1Uy1DNQUkjNS85PycxLt1UKDXHT" +
  "tVBSKC5JzEtJzMnPS7VVqkwtVrK347IpLi5RAGrNK7ZVyigpKbDS1y9OzkjNTSzWyy9IzQPKpOUX5SaWALlF6frFBUWpiSnFGamp" +
  "Jbk5+kYGBmb6uYmZeUoKyfmleSW2SuZKCqV5mYWlqc4wvp1NcaadTYnd08mNz6eustEvsbPRB4lARJ9N3fCyvR9d9GnTzBcNzeii" +
  "QYYYuru2PuuarqNgqG8SjqHaCFWkCCT4vHPns80rIBJFUDG1nBJrR7X0Emu4MFiPPjBc7ABQSwMEFAAAAAgARBMWXcZ2IvUnAQAA" +
  "VAIAABgAAAB4bC93b3Jrc2hlZXRzL3NoZWV0MS54bWx1kl9OhDAQxt89BZknTZTybzfGlG5W1Mf1wfUADZSFCC1pG1Zv4A28gk9e" +
  "S4/hAAaQZB+adL5v5jeTaenmta6cVmhTKhmD73rgCJmqrJSHGJ73D1fX4BjLZcYrJUUMb8LAhp3Ro9IvphDCOgiQJobC2uaGEJMW" +
  "oubGVY2Q6ORK19xiqA/ENFrwrC+qKxJ43prUvJTAaK/dccsRrNXR0TgJyml32frg2BgMxi3zKGkZJemfdzv3/P9eMveC0SPIn7oE" +
  "Y5dglh0uugQLxsCfV0Qn+OHID2fZqwVp7q1PkKKRFPXZpaxKKZ6sRr00jFqW4AIslnXRNHs07MZdLVaXDBjTA3KWPO6S7f5+h+cc" +
  "fj7f4RK+vz7ggpK8q0cFw+VoZHo3SsYPwX4BUEsDBBQAAAAIAEQTFl3siiSy5wAAAJQBAAAYAAAAeGwvd29ya3NoZWV0cy9zaGVl" +
  "dDIueG1sdZBRSgMxEIbfPUXI+3ayeShFsikV8QLqAcLu2A3dTJZksPrqGQS9gOAVxOuIeAzTIi1C923mz/z/NxmzfAiDuMeUfaRG" +
  "1jMlBVIbO0/rRt7eXFULKTI76twQCRv5iFku7ZnZxrTJPSKLEkC5kT3zeA6Q2x6Dy7M4IpWXu5iC49KmNeQxoev2pjCAVmoOwXmS" +
  "1uy1S8euBKe4FalsUuR2V6xqKbiRngZPeM2p6D5bw/b7+ePn/ckAWwM7Bdo/x8Wk4+Xt6/P1vwMK70jVB6qeyFidAk4Na6XnlVpU" +
  "qj4JheO/DRwOan8BUEsBAhQDFAAAAAgARBMWXUEgo4XaAAAARAEAABMAAAAAAAAAAAAAAIABAAAAAFtDb250ZW50X1R5cGVzXS54" +
  "bWxQSwECFAMUAAAACABEExZdnjh/z8wAAAAFAQAADwAAAAAAAAAAAAAAgAELAQAAeGwvd29ya2Jvb2sueG1sUEsBAhQDFAAAAAgA" +
  "RBMWXaXLwgHtAAAAVQEAABQAAAAAAAAAAAAAAIABBAIAAHhsL3NoYXJlZFN0cmluZ3MueG1sUEsBAhQDFAAAAAgARBMWXcZ2IvUn" +
  "AQAAVAIAABgAAAAAAAAAAAAAAIABIwMAAHhsL3dvcmtzaGVldHMvc2hlZXQxLnhtbFBLAQIUAxQAAAAIAEQTFl3siiSy5wAAAJQB" +
  "AAAYAAAAAAAAAAAAAACAAYAEAAB4bC93b3Jrc2hlZXRzL3NoZWV0Mi54bWxQSwUGAAAAAAUABQBMAQAAnQUAAAAA";

function fixture(): Uint8Array {
  return Uint8Array.from(Buffer.from(XLSX_BASE64, "base64"));
}

describe("columnIndexOf", () => {
  it("セル参照から0始まりの列番号を得る（Z→25・AA→26・BC→54）", () => {
    expect(columnIndexOf("A1")).toBe(0);
    expect(columnIndexOf("C12")).toBe(2);
    expect(columnIndexOf("Z9")).toBe(25);
    expect(columnIndexOf("AA1")).toBe(26);
    expect(columnIndexOf("BC12")).toBe(54);
  });
});

describe("XML 抽出（共有文字列・シート名・セル）", () => {
  it("リッチテキスト（複数の t 要素に割れた文字列）を連結して1つにする", () => {
    const xml = "<sst><si><t>単純</t></si><si><r><t>特</t></r><r><t>注</t></r></si></sst>";
    expect(parseSharedStrings(xml)).toEqual(["単純", "特注"]);
  });

  it("XML の実体参照を戻す", () => {
    expect(parseSharedStrings("<sst><si><t>A&lt;B&gt;&amp;C</t></si></sst>")).toEqual(["A<B>&C"]);
  });

  it("シート名を表示順に取り出す", () => {
    const xml =
      '<workbook><sheets><sheet name="表1" sheetId="1"/><sheet name="表&amp;2" sheetId="2"/></sheets></workbook>';
    expect(parseSheetNames(xml)).toEqual(["表1", "表&2"]);
  });

  it("空欄セル（XML から省かれる）はセル参照から位置を復元して詰める", () => {
    const xml =
      '<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>a</t></is></c><c r="C1"><v>3</v></c></row></sheetData></worksheet>';
    expect(parseWorksheet(xml, [])).toEqual([["a", "", "3"]]);
  });

  it("自己閉じセルも空欄として扱う", () => {
    const xml =
      '<worksheet><sheetData><row r="1"><c r="A1"><v>1</v></c><c r="B1"/><c r="C1"><v>3</v></c></row></sheetData></worksheet>';
    expect(parseWorksheet(xml, [])).toEqual([["1", "", "3"]]);
  });
});

describe("readXlsxSheet — 実ファイル（ZIP）からの読み出し", () => {
  it("先頭シートをヘッダ＋行として読む（共有文字列・数値・数式の結果）", async () => {
    const res = await readXlsxSheet(fixture());
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.sheet.sheetNames).toEqual(["部品表", "改訂履歴"]);
    expect(res.sheet.table.header).toEqual(["品番", "数量", "備考"]);
    expect(res.sheet.table.rows).toEqual([
      ["R1", "2", "抵抗, 1/4W"],
      // R2 は数量セルが XML から省かれている → 空欄として復元される。
      ["R2", "", "特注<A>"],
      // inlineStr と数式の結果（v 要素）も読める。
      ["C1", "1.50", "計算"],
    ]);
    expect(res.sheet.table.raggedRowCount).toBe(0);
  });

  it("シート番号を指定すると2枚目を読める", async () => {
    const res = await readXlsxSheet(fixture(), 1);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.sheet.sheetIndex).toBe(1);
    expect(res.sheet.table.header).toEqual(["改訂", "日付"]);
    expect(res.sheet.table.rows).toEqual([["A", "2026-08-01"]]);
  });

  it("存在しないシート番号・xlsx でないバイト列は error を返す（throw しない）", async () => {
    const missing = await readXlsxSheet(fixture(), 9);
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error).toContain("シートが見つかりません");

    const notXlsx = await readXlsxSheet(new TextEncoder().encode("品番,数量"));
    expect(notXlsx.ok).toBe(false);
    if (!notXlsx.ok) expect(notXlsx.error).toContain("xlsx");
  });

  it("読み込んだ表は CSV 由来の表とそのまま突合できる（同じ ParsedTable 形）", async () => {
    const res = await readXlsxSheet(fixture());
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const csvSide = parseDelimited('品番,数量,備考\nR1,2,"抵抗, 1/4W"\nR2,,特注<A>\nC1,3,計算', ",");
    const diff = diffSheets(res.sheet.table, csvSide, { keyColumns: ["品番"] }) as SheetDiff;
    expect(diff.ok).toBe(true);
    // C1 の数量が 1.50 → 3 に変わった1点だけが差分。
    expect(diff.changed).toHaveLength(1);
    expect(diff.changed[0]?.changes).toEqual([{ column: "数量", before: "1.50", after: "3" }]);
  });
});

describe("looksLikeZip", () => {
  it("xlsx（ZIP）は true、CSV テキストは false", () => {
    expect(looksLikeZip(fixture())).toBe(true);
    expect(looksLikeZip(new TextEncoder().encode("品番,数量"))).toBe(false);
    expect(looksLikeZip(new Uint8Array([]))).toBe(false);
  });
});
