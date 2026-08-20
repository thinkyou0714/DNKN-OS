/**
 * index.ts — 電気設計計算ツールキットのモジュールレジストリ。
 *
 * 収録順・無料/有料の線引きの単一の真実。UI（web/src/toolkit/）はこの配列から
 * ナビゲーションとゲートを構築する。
 *
 * 線引きの根拠（docs/strategy/toolkit-product.md）:
 *  - 無料 = 抵抗ディレーティング・電圧降下（無料 Web 計算機が飽和している領域。集客用）
 *  - 有料 = コンデンサ寿命・熱計算・パターン幅（無料ツールにない領域）＋計算書出力
 */

import { capacitorModule } from "./capacitor.js";
import { resistorDeratingModule } from "./resistor-derating.js";
import { thermalModule } from "./thermal.js";
import { traceWidthModule } from "./trace-width.js";
import type { ToolkitModule } from "./types.js";
import { voltageDropModule } from "./voltage-drop.js";

export const TOOLKIT_MODULES: ToolkitModule[] = [
  resistorDeratingModule,
  voltageDropModule,
  capacitorModule,
  thermalModule,
  traceWidthModule,
];

/** 無料枠モジュールの id 一覧（表示順）。 */
export const FREE_MODULE_IDS: string[] = TOOLKIT_MODULES.filter((m) => m.tier === "free").map((m) => m.id);

export function getToolkitModule(id: string): ToolkitModule | undefined {
  return TOOLKIT_MODULES.find((m) => m.id === id);
}
