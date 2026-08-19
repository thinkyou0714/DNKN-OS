/**
 * tests/toolkit/trace-width.test.ts — IPC-2221 近似式の手計算照合。
 * 期待値は A = (I/(k×ΔT^0.44))^(1/0.725) を実装と独立に電卓計算した値。
 * 「1oz 外層・ΔT10K で 1A ≒ 0.30mm」という定石アンカーとの一致も確認する。
 */
import { describe, expect, it } from "vitest";
import {
  allowableCurrentA,
  computeTraceWidth,
  requiredTraceWidthMm,
  traceWidthModule,
} from "../../lib/toolkit/trace-width.js";

const BASE = { layer: "external", current: 2, tempRise: 10, thickness: 35, width: 1, threshold: 80 };

describe("requiredTraceWidthMm / allowableCurrentA", () => {
  it("外層 1oz・ΔT10K・2A → 必要幅 0.7814mm", () => {
    expect(requiredTraceWidthMm(2, 10, 35, "external")).toBeCloseTo(0.781437462908628, 8);
  });

  it("定石アンカー: 外層 1oz・ΔT10K・1A → 0.300mm", () => {
    expect(requiredTraceWidthMm(1, 10, 35, "external")).toBeCloseTo(0.3003865208333049, 8);
  });

  it("内層は係数半分で同条件の必要幅が広がる（2A → 2.033mm）", () => {
    expect(requiredTraceWidthMm(2, 10, 35, "internal")).toBeCloseTo(2.0328625490354195, 8);
  });

  it("許容電流: 幅1mm・1oz・外層・ΔT10K → 2.392A／幅2mm・2oz・ΔT20K → 8.864A", () => {
    expect(allowableCurrentA(1, 10, 35, "external")).toBeCloseTo(2.3915621994461254, 8);
    expect(allowableCurrentA(2, 20, 70, "external")).toBeCloseTo(8.863971933100231, 8);
  });

  it("往復整合: 必要幅に対する許容電流は元の電流に戻る", () => {
    const w = requiredTraceWidthMm(3, 20, 70, "external");
    expect(allowableCurrentA(w, 20, 70, "external")).toBeCloseTo(3, 8);
  });
});

describe("computeTraceWidth", () => {
  it("2A・幅1mm → 負荷率 83.6% = ng（閾値80%）、幅1.2mmなら ok/warn 側へ", () => {
    const r = computeTraceWidth({ ...BASE });
    expect(r.usagePercent).toBeCloseTo((2 / 2.3915621994461254) * 100, 6);
    expect(r.verdict).toBe("ng");
    const wide = computeTraceWidth({ ...BASE, width: 1.2 });
    expect(wide.verdict).not.toBe("ng");
  });

  it("近似式の適用範囲の注記が必ず付く", () => {
    const r = computeTraceWidth({ ...BASE });
    expect(r.notes?.[0]).toContain("近似");
  });

  it("バリデーション: 電流の適用上限35A・温度上昇の範囲・幅0 を弾く", () => {
    expect(computeTraceWidth({ ...BASE, current: 36 }).ok).toBe(false);
    expect(computeTraceWidth({ ...BASE, tempRise: 0.5 }).ok).toBe(false);
    expect(computeTraceWidth({ ...BASE, width: 0 }).ok).toBe(false);
  });

  it("モジュール定義: 有料枠", () => {
    expect(traceWidthModule.tier).toBe("paid");
  });
});
