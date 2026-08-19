/**
 * tests/toolkit/types.test.ts — ツールキット共通ヘルパの検証。
 *  - judgeUsage の3値境界（90%=ok / 100%=warn / 超過=ng / 非有限=ng）
 *  - worstVerdict の順序
 *  - formatSig の丸め・指数表記切替・非有限
 *  - validateFields の NaN・範囲・showIf・select 検証
 */
import { describe, expect, it } from "vitest";
import { type FieldSpec, formatSig, judgeUsage, num, validateFields, worstVerdict } from "../../lib/toolkit/types.js";

describe("judgeUsage", () => {
  it("閾値の90%以下は ok・閾値以下は warn・超過は ng", () => {
    expect(judgeUsage(45, 50)).toBe("ok");
    expect(judgeUsage(45.0001, 50)).toBe("warn");
    expect(judgeUsage(50, 50)).toBe("warn");
    expect(judgeUsage(50.0001, 50)).toBe("ng");
  });

  it("Infinity / NaN は ng（使用不可）", () => {
    expect(judgeUsage(Number.POSITIVE_INFINITY, 50)).toBe("ng");
    expect(judgeUsage(Number.NaN, 50)).toBe("ng");
  });
});

describe("worstVerdict", () => {
  it("ng > warn > ok の順で悪い方を返す", () => {
    expect(worstVerdict("ok", "warn")).toBe("warn");
    expect(worstVerdict("ng", "warn")).toBe("ng");
    expect(worstVerdict("ok", "ok")).toBe("ok");
  });
});

describe("formatSig", () => {
  it("有効数字3桁（既定）で丸める", () => {
    expect(formatSig(3.559999)).toBe("3.56");
    expect(formatSig(61.81818)).toBe("61.8");
    expect(formatSig(226274.17)).toBe("226000");
    expect(formatSig(0.781437)).toBe("0.781");
  });

  it("桁数指定・ゼロ・非有限・指数域", () => {
    expect(formatSig(2.5077818, 4)).toBe("2.508");
    expect(formatSig(0)).toBe("0");
    expect(formatSig(Number.POSITIVE_INFINITY)).toBe("—");
    expect(formatSig(0.0000123)).toBe("1.23e-5");
    expect(formatSig(12345678)).toBe("1.23e+7");
  });
});

const FIELDS: FieldSpec[] = [
  {
    key: "mode",
    label: "モード",
    kind: "select",
    defaultValue: "a",
    options: [
      { value: "a", label: "A" },
      { value: "b", label: "B" },
    ],
  },
  { key: "x", label: "電力", unit: "W", kind: "number", defaultValue: 1, min: 0, minExclusive: true, max: 100 },
  {
    key: "y",
    label: "温度",
    unit: "℃",
    kind: "number",
    defaultValue: 25,
    min: -55,
    showIf: { key: "mode", equals: "b" },
  },
];

describe("validateFields", () => {
  it("正常値は nums / sels に分類され、showIf 非表示のフィールドは要求されない", () => {
    const r = validateFields(FIELDS, { mode: "a", x: 5 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.input.sels.mode).toBe("a");
      expect(num(r.input, "x")).toBe(5);
      expect(r.input.nums.y).toBeUndefined();
    }
  });

  it("showIf が成立すると対象フィールドも検証される", () => {
    const r = validateFields(FIELDS, { mode: "b", x: 5, y: Number.NaN });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.map((e) => e.key)).toEqual(["y"]);
  });

  it("NaN・下限（exclusive）・上限を日本語メッセージで弾く", () => {
    const r = validateFields(FIELDS, { mode: "a", x: 0 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.message).toBe("電力は0Wより大きい値で入力してください");
    const r2 = validateFields(FIELDS, { mode: "a", x: 101 });
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.errors[0]?.message).toBe("電力は100W以下で入力してください");
    const r3 = validateFields(FIELDS, { mode: "a", x: Number.NaN });
    expect(r3.ok).toBe(false);
    if (!r3.ok) expect(r3.errors[0]?.message).toBe("電力を数値で入力してください");
  });

  it("不正な select 値は既定値へフォールバックする", () => {
    const r = validateFields(FIELDS, { mode: "zzz", x: 1 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.input.sels.mode).toBe("a");
  });
});
