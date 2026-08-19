/**
 * tests/web/toolkit-store.test.ts — ツールキットの状態永続化とライセンス解錠。
 *  - 保存/読込/エクスポート/インポートの往復と壊れた値の安全な扱い
 *  - 公開鍵未設定の間はゲート非作動＝全モジュール無料（fail-open 不変条件）
 *  - sku="toolkit" のキーだけが解錠でき、Pro キーは拒否されること
 */
import { beforeEach, describe, expect, it } from "vitest";
import { signLicense } from "../../lib/license/license.js";
import type { ToolkitMonetizationConfig } from "../../web/src/toolkit/toolkit-config.js";
import { toolkitMonetizationConfigured } from "../../web/src/toolkit/toolkit-config.js";
import {
  __resetToolkitEntitlementsForTest,
  applyToolkitLicenseKey,
  clearToolkitLicense,
  emptyToolkitState,
  exportToolkitStateJson,
  importToolkitStateJson,
  initToolkitEntitlements,
  loadToolkitState,
  saveToolkitState,
  TOOLKIT_LICENSE_STORAGE_KEY,
  TOOLKIT_STATE_STORAGE_KEY,
  toolkitLocked,
  toolkitTierAvailable,
  toolkitUnlocked,
} from "../../web/src/toolkit/toolkit-store.js";
import { genKeypair } from "../helpers/license.js";

class MemStorage {
  map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

const NOW = Date.UTC(2026, 7, 19, 3, 0, 0);

function cfgWith(pub: ToolkitMonetizationConfig["publicKeyJwk"]): ToolkitMonetizationConfig {
  return { enabled: true, purchaseUrl: "https://example.com/buy", publicKeyJwk: pub };
}

beforeEach(() => {
  __resetToolkitEntitlementsForTest();
});

describe("状態の保存・読込・インポート/エクスポート", () => {
  it("保存 → 読込の往復で値・メモ・計算書ヘッダが一致する", () => {
    const s = new MemStorage();
    const state = emptyToolkitState();
    state.values["thermal"] = { model: "simple", power: 2.5 };
    state.memos["thermal"] = "電源部 FET の検討";
    state.sheet = { productName: "PSU-01", designer: "山田", date: "2026-08-19", revision: "A" };
    expect(saveToolkitState(s, state)).toBe(true);
    expect(loadToolkitState(s)).toEqual(state);
  });

  it("未保存・壊れた JSON・形式不正は空状態を返す（throw しない）", () => {
    const s = new MemStorage();
    expect(loadToolkitState(s)).toEqual(emptyToolkitState());
    s.setItem(TOOLKIT_STATE_STORAGE_KEY, "{broken");
    expect(loadToolkitState(s)).toEqual(emptyToolkitState());
    s.setItem(TOOLKIT_STATE_STORAGE_KEY, JSON.stringify({ version: 99 }));
    expect(loadToolkitState(s)).toEqual(emptyToolkitState());
  });

  it("エクスポート → インポートの往復が成立し、不正入力は null", () => {
    const state = emptyToolkitState();
    state.values["voltage-drop"] = { material: "cu20", area: 5.5 };
    const json = exportToolkitStateJson(state);
    expect(importToolkitStateJson(json)).toEqual(state);
    expect(importToolkitStateJson("not json")).toBeNull();
    expect(importToolkitStateJson('{"version":2}')).toBeNull();
  });

  it("インポート時に数値/文字列以外のフィールド値は黙って落とす（XSS/型汚染防止）", () => {
    const json = JSON.stringify({
      version: 1,
      values: { thermal: { power: 2, evil: { nested: true }, flag: false } },
      memos: { thermal: "ok", bad: 123 },
      sheet: { productName: "P", designer: 5 },
    });
    const state = importToolkitStateJson(json);
    expect(state?.values.thermal).toEqual({ power: 2 });
    expect(state?.memos).toEqual({ thermal: "ok" });
    expect(state?.sheet.productName).toBe("P");
    expect(state?.sheet.designer).toBe("");
  });

  it("インポート時に数値文字列は数値へ正規化し、select 値の文字列はそのまま残す", () => {
    const json = JSON.stringify({
      version: 1,
      values: { thermal: { power: "2.5", model: "heatsink" }, "voltage-drop": { area: "" } },
      memos: {},
      sheet: {},
    });
    const state = importToolkitStateJson(json);
    expect(state?.values.thermal).toEqual({ power: 2.5, model: "heatsink" });
    // 空文字は数値化できないため文字列のまま（UI 側で未入力として扱われる）。
    expect(state?.values["voltage-drop"]).toEqual({ area: "" });
  });
});

describe("ライセンス解錠（fail-open 不変条件と sku 分離）", () => {
  it("公開鍵が null の間はゲート非作動＝有料モジュールも使える", () => {
    const cfg = cfgWith(null);
    expect(toolkitMonetizationConfigured(cfg)).toBe(false);
    expect(toolkitLocked(cfg)).toBe(false);
    expect(toolkitTierAvailable("paid", cfg)).toBe(true);
  });

  it("公開鍵設定後は有料モジュールがロックされ、無料モジュールは使える", async () => {
    const { pub } = await genKeypair();
    const cfg = cfgWith(pub);
    const s = new MemStorage();
    expect(await initToolkitEntitlements(s, NOW, cfg)).toBe(false);
    expect(toolkitLocked(cfg)).toBe(true);
    expect(toolkitTierAvailable("free", cfg)).toBe(true);
    expect(toolkitTierAvailable("paid", cfg)).toBe(false);
  });

  it("toolkit キーの適用で解錠され、保存キーから再起動でも復元する", async () => {
    const { pub, priv } = await genKeypair();
    const cfg = cfgWith(pub);
    const s = new MemStorage();
    const key = await signLicense({ sku: "toolkit", sub: "buyer@example.com" }, priv);
    const res = await applyToolkitLicenseKey(s, key, NOW, cfg);
    expect(res.ok).toBe(true);
    expect(toolkitUnlocked()).toBe(true);
    expect(toolkitTierAvailable("paid", cfg)).toBe(true);
    expect(s.getItem(TOOLKIT_LICENSE_STORAGE_KEY)).toBe(key);
    // 再起動を模す: キャッシュを消して init で復元。
    __resetToolkitEntitlementsForTest();
    expect(await initToolkitEntitlements(s, NOW, cfg)).toBe(true);
    expect(toolkitUnlocked()).toBe(true);
  });

  it("Pro キー（sku=pro）ではツールキットを解錠できない", async () => {
    const { pub, priv } = await genKeypair();
    const cfg = cfgWith(pub);
    const s = new MemStorage();
    const proKey = await signLicense({ sku: "pro" }, priv);
    const res = await applyToolkitLicenseKey(s, proKey, NOW, cfg);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toContain("対象プラン");
    expect(toolkitUnlocked()).toBe(false);
  });

  it("クリアで無料枠に戻る／鍵未設定時の適用は販売準備中メッセージ", async () => {
    const { pub, priv } = await genKeypair();
    const cfg = cfgWith(pub);
    const s = new MemStorage();
    const key = await signLicense({ sku: "toolkit" }, priv);
    await applyToolkitLicenseKey(s, key, NOW, cfg);
    clearToolkitLicense(s);
    expect(toolkitUnlocked()).toBe(false);
    expect(toolkitLocked(cfg)).toBe(true);
    const noCfg = await applyToolkitLicenseKey(s, key, NOW, cfgWith(null));
    expect(noCfg.ok).toBe(false);
    if (!noCfg.ok) expect(noCfg.reason).toContain("販売準備中");
  });
});
