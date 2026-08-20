/**
 * tests/sheet-diff/parse.test.ts — 帳票 CSV/TSV パーサの検証。
 * RFC 4180 のクォート規則・改行の混在・BOM・不揃い行という、実際の帳票で
 * 事故になる入力を中心に固める。
 */
import { describe, expect, it } from "vitest";
import {
  decodeSheetBytes,
  detectDelimiter,
  parseDelimited,
  quoteField,
  toDelimitedText,
} from "../../lib/sheet-diff/parse.js";

describe("detectDelimiter", () => {
  it("1行目で最多の候補を選び、候補なしならカンマ", () => {
    expect(detectDelimiter("a,b,c\n1,2,3")).toBe(",");
    expect(detectDelimiter("a\tb\tc\n1\t2\t3")).toBe("\t");
    expect(detectDelimiter("a;b;c\n1;2;3")).toBe(";");
    expect(detectDelimiter("単一列\n値")).toBe(",");
  });

  it("BOM 付きでも先頭行を正しく見る", () => {
    expect(detectDelimiter("﻿品番\t数量\nR1\t2")).toBe("\t");
  });
});

describe("parseDelimited", () => {
  it("ヘッダと行を取り出す（区切りは自動判定）", () => {
    const t = parseDelimited("品番,数量,単価\nR1,2,10\nR2,3,20\n");
    expect(t.delimiter).toBe(",");
    expect(t.header).toEqual(["品番", "数量", "単価"]);
    expect(t.rows).toEqual([
      ["R1", "2", "10"],
      ["R2", "3", "20"],
    ]);
    expect(t.raggedRowCount).toBe(0);
  });

  it("クォート内の区切り・改行・エスケープされた引用符を保持する", () => {
    const t = parseDelimited('品番,備考\nR1,"抵抗, 1/4W"\nR2,"1行目\n2行目"\nR3,"""特注"""\n');
    expect(t.rows[0]?.[1]).toBe("抵抗, 1/4W");
    expect(t.rows[1]?.[1]).toBe("1行目\n2行目");
    expect(t.rows[2]?.[1]).toBe('"特注"');
    expect(t.rows).toHaveLength(3);
  });

  it("CRLF / LF / CR の混在と BOM を吸収する", () => {
    const t = parseDelimited("﻿a,b\r\n1,2\n3,4\r5,6");
    expect(t.header).toEqual(["a", "b"]);
    expect(t.rows).toEqual([
      ["1", "2"],
      ["3", "4"],
      ["5", "6"],
    ]);
  });

  it("列数が足りない/多い行はヘッダ幅に揃え、件数を数える", () => {
    const t = parseDelimited("a,b,c\n1,2\n3,4,5,6\n");
    expect(t.rows).toEqual([
      ["1", "2", ""],
      ["3", "4", "5"],
    ]);
    expect(t.raggedRowCount).toBe(2);
  });

  it("空入力・ヘッダのみ・空行だけでも throw しない", () => {
    expect(parseDelimited("")).toEqual({ delimiter: ",", header: [], rows: [], raggedRowCount: 0 });
    expect(parseDelimited("a,b\n").rows).toEqual([]);
    expect(parseDelimited("a,b\n\n\n").rows).toEqual([]);
  });

  it("区切り文字を明示指定できる（カンマを含む TSV の誤判定回避）", () => {
    const t = parseDelimited("品番\t備考\nR1\t抵抗, 1/4W", "\t");
    expect(t.rows[0]).toEqual(["R1", "抵抗, 1/4W"]);
  });
});

describe("quoteField / toDelimitedText", () => {
  it("区切り・引用符・改行を含むときだけクォートする", () => {
    expect(quoteField("abc")).toBe("abc");
    expect(quoteField("a,b")).toBe('"a,b"');
    expect(quoteField('a"b')).toBe('"a""b"');
    expect(quoteField("a\nb")).toBe('"a\nb"');
    expect(quoteField("a\tb", "\t")).toBe('"a\tb"');
  });

  it("書き出し → 読み込みで元の表に戻る（往復）", () => {
    const rows = [
      ["品番", "備考"],
      ["R1", "抵抗, 1/4W"],
      ["R2", '"特注"\n2行目'],
    ];
    const text = toDelimitedText(rows);
    const parsed = parseDelimited(text);
    expect([parsed.header, ...parsed.rows]).toEqual(rows);
  });
});

describe("decodeSheetBytes", () => {
  it("UTF-8（BOM 付き含む）はそのまま読む", () => {
    const utf8 = new TextEncoder().encode("品番,数量\nR1,2");
    expect(decodeSheetBytes(utf8)).toEqual({ text: "品番,数量\nR1,2", encoding: "utf-8" });
    const withBom = new Uint8Array([0xef, 0xbb, 0xbf, ...utf8]);
    expect(decodeSheetBytes(withBom).encoding).toBe("utf-8");
    // BOM は parseDelimited 側で落ちる。
    expect(parseDelimited(decodeSheetBytes(withBom).text).header).toEqual(["品番", "数量"]);
  });

  it("Shift_JIS の帳票を文字化けさせずに読む（Excel の日本語 CSV 対策）", () => {
    // 「品番,数量」＋改行＋「R1,2」を Shift_JIS で表したバイト列。
    const sjis = new Uint8Array([0x95, 0x69, 0x94, 0xd4, 0x2c, 0x90, 0x94, 0x97, 0xca, 0x0a, 0x52, 0x31, 0x2c, 0x32]);
    const decoded = decodeSheetBytes(sjis);
    expect(decoded.encoding).toBe("shift_jis");
    expect(parseDelimited(decoded.text).header).toEqual(["品番", "数量"]);
  });
});
