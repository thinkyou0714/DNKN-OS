/**
 * tests/helpers/toolkit.ts — 設計計算ツールキットのテスト用ヘルパー。
 *
 * 結果行はラベルで引く。配列の添字で参照すると、モジュールに項目を1行足しただけで
 * 無関係なテストが落ち、期待値の意味も読めなくなるため。
 */
import { expect } from "vitest";
import type { ModuleResult } from "../../lib/toolkit/types.js";

/** ラベル完全一致で結果値を取り出す（無ければ失敗させる）。 */
export function itemValue(result: ModuleResult, label: string): number {
  const item = result.items?.find((i) => i.label === label);
  expect(
    item,
    `結果に「${label}」がありません（実際: ${result.items?.map((i) => i.label).join(" / ")}）`,
  ).toBeDefined();
  return item?.value as number;
}

/** ラベルの行が存在するか。 */
export function hasItem(result: ModuleResult, label: string): boolean {
  return result.items?.some((i) => i.label === label) ?? false;
}

/** 注記のいずれかに部分文字列を含むか。 */
export function hasNote(result: ModuleResult, substring: string): boolean {
  return result.notes?.some((n) => n.includes(substring)) ?? false;
}
