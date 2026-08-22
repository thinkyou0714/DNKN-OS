/**
 * index.ts — 電気設計計算ツールキットのモジュールレジストリ。
 *
 * 収録順・無料/有料の線引きの単一の真実。UI（web/src/toolkit/）はこの配列から
 * ナビゲーションとゲートを構築する。
 *
 * 線引きの根拠（docs/strategy/toolkit-product.md）:
 *  - 無料 = 電圧降下・力率改善・抵抗ディレーティング（無料 Web 計算機が飽和していて、
 *    かつ電験の論点と重なる＝検索流入の入口になる領域）
 *  - 有料 = 短絡電流・接地抵抗・コンデンサ寿命・熱計算・パターン幅（無料ツールにない領域）＋計算書出力
 */

import { capacitorModule } from "./capacitor.js";
import { groundingModule } from "./grounding.js";
import { powerFactorModule } from "./power-factor.js";
import { resistorDeratingModule } from "./resistor-derating.js";
import { shortCircuitModule } from "./short-circuit.js";
import { thermalModule } from "./thermal.js";
import { traceWidthModule } from "./trace-width.js";
import type { ToolkitModule } from "./types.js";
import { voltageDropModule } from "./voltage-drop.js";

export const TOOLKIT_MODULES: ToolkitModule[] = [
  // 電気設備系（電験の論点と直結。学習アプリからの送客先）
  voltageDropModule,
  powerFactorModule,
  shortCircuitModule,
  groundingModule,
  // 電子部品系（信頼性設計）
  resistorDeratingModule,
  capacitorModule,
  thermalModule,
  traceWidthModule,
];

/** 無料枠モジュールの id 一覧（表示順）。 */
export const FREE_MODULE_IDS: string[] = TOOLKIT_MODULES.filter((m) => m.tier === "free").map((m) => m.id);

export function getToolkitModule(id: string): ToolkitModule | undefined {
  return TOOLKIT_MODULES.find((m) => m.id === id);
}
