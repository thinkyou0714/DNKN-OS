/**
 * tests/web/sheet-diff-store.test.ts — 帳票ツールのプリセット永続化とライセンス解錠。
 *  - 保存するのは突合設定だけで、帳票の中身は保存しないこと
 *  - 公開鍵未設定の間はゲート非作動（fail-open 不変条件）
 *  - sku="sheetdiff" のキーだけが解錠でき、他商品のキーは拒否されること
 */
import { beforeEach, describe, expect, it } from "vitest";
import { signLicense } from "../../lib/license/license.js";
import type { GateConfig } from "../../web/src/license-gate.js";
import {
  __resetSheetDiffEntitlementsForTest,
  applySheetDiffLicenseKey,
  clearSheetDiffLicense,
  defaultPreset,
  emptySheetDiffState,
  findPreset,
  initSheetDiffEntitlements,
  loadSheetDiffState,
  parseSheetDiffState,
  presetToOptions,
  removePreset,
  SHEET_DIFF_LICENSE_STORAGE_KEY,
  SHEET_DIFF_STATE_STORAGE_KEY,
  saveSheetDiffState,
  sheetDiffLocked,
  sheetDiffMonetizationConfigured,
  sheetDiffUnlocked,
  upsertPreset,
} from "../../web/src/sheet-diff/sheet-diff-store.js";
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

function cfgWith(pub: GateConfig["publicKeyJwk"]): GateConfig {
  return { enabled: true, purchaseUrl: "https://example.com/buy", publicKeyJwk: pub };
}

beforeEach(() => {
  __resetSheetDiffEntitlementsForTest();
});

describe("プリセットの保存・読込", () => {
  it("保存 → 読込の往復でプリセットが一致する", () => {
    const s = new MemStorage();
    const state = upsertPreset(emptySheetDiffState(), {
      ...defaultPreset("部品表"),
      keyColumns: ["品番"],
      ignoreColumns: ["出力日"],
      aliases: { 部品番号: "品番" },
    });
    expect(saveSheetDiffState(s, state)).toBe(true);
    expect(loadSheetDiffState(s)).toEqual(state);
  });

  it("未保存・壊れた JSON・形式不正は空状態を返す（throw しない）", () => {
    const s = new MemStorage();
    expect(loadSheetDiffState(s)).toEqual(emptySheetDiffState());
    s.setItem(SHEET_DIFF_STATE_STORAGE_KEY, "{broken");
    expect(loadSheetDiffState(s)).toEqual(emptySheetDiffState());
    s.setItem(SHEET_DIFF_STATE_STORAGE_KEY, JSON.stringify({ version: 9, presets: [] }));
    expect(loadSheetDiffState(s)).toEqual(emptySheetDiffState());
  });

  it("インポート時に壊れたプリセット・非文字列の列名は落とす", () => {
    const parsed = parseSheetDiffState({
      version: 1,
      presets: [
        {
          name: "ok",
          keyColumns: ["品番", 5, "", " 図番 "],
          ignoreColumns: null,
          aliases: { " 部品番号 ": "品番", x: 1 },
        },
        { name: "", keyColumns: [] },
        "not-an-object",
      ],
      activePreset: "ok",
    });
    expect(parsed?.presets).toHaveLength(1);
    expect(parsed?.presets[0]?.keyColumns).toEqual(["品番", "図番"]);
    expect(parsed?.presets[0]?.ignoreColumns).toEqual([]);
    expect(parsed?.presets[0]?.aliases).toEqual({ 部品番号: "品番" });
  });

  it("数値同値の既定は true・大小無視の既定は false（壊れた値でも安全側へ倒す）", () => {
    const p = parseSheetDiffState({ version: 1, presets: [{ name: "p", numericEquality: "yes", ignoreCase: "yes" }] });
    expect(p?.presets[0]?.numericEquality).toBe(true);
    expect(p?.presets[0]?.ignoreCase).toBe(false);
  });

  it("同名プリセットは置き換え、削除で活性プリセットも外れる", () => {
    let state = upsertPreset(emptySheetDiffState(), { ...defaultPreset("A"), keyColumns: ["旧"] });
    state = upsertPreset(state, { ...defaultPreset("A"), keyColumns: ["新"] });
    expect(state.presets).toHaveLength(1);
    expect(findPreset(state, "A")?.keyColumns).toEqual(["新"]);
    expect(state.activePreset).toBe("A");
    state = removePreset(state, "A");
    expect(state.presets).toEqual([]);
    expect(state.activePreset).toBe("");
  });

  it("プリセットは diffSheets の options へそのまま変換できる", () => {
    const preset = { ...defaultPreset("部品表"), keyColumns: ["品番"], aliases: { 部品番号: "品番" } };
    expect(presetToOptions(preset)).toEqual({
      keyColumns: ["品番"],
      ignoreColumns: [],
      columnAliases: { 部品番号: "品番" },
      numericEquality: true,
      ignoreCase: false,
    });
  });

  it("保存対象は突合設定のみ（帳票の中身を含むキーを作らない）", () => {
    const s = new MemStorage();
    saveSheetDiffState(s, upsertPreset(emptySheetDiffState(), defaultPreset("A")));
    expect([...s.map.keys()]).toEqual([SHEET_DIFF_STATE_STORAGE_KEY]);
    const saved = s.getItem(SHEET_DIFF_STATE_STORAGE_KEY) ?? "";
    expect(saved).not.toContain("rows");
  });
});

describe("ライセンス解錠（fail-open と sku 分離）", () => {
  it("公開鍵が null の間はゲート非作動＝有料機能も使える", () => {
    const cfg = cfgWith(null);
    expect(sheetDiffMonetizationConfigured(cfg)).toBe(false);
    expect(sheetDiffLocked(cfg)).toBe(false);
  });

  it("公開鍵設定後はロックされ、sheetdiff キーで解錠・再起動でも復元する", async () => {
    const { pub, priv } = await genKeypair();
    const cfg = cfgWith(pub);
    const s = new MemStorage();
    expect(await initSheetDiffEntitlements(s, NOW, cfg)).toBe(false);
    expect(sheetDiffLocked(cfg)).toBe(true);

    const key = await signLicense({ sku: "sheetdiff", sub: "buyer@example.com" }, priv);
    expect((await applySheetDiffLicenseKey(s, key, NOW, cfg)).ok).toBe(true);
    expect(sheetDiffUnlocked()).toBe(true);
    expect(s.getItem(SHEET_DIFF_LICENSE_STORAGE_KEY)).toBe(key);

    __resetSheetDiffEntitlementsForTest();
    expect(await initSheetDiffEntitlements(s, NOW, cfg)).toBe(true);
    expect(sheetDiffUnlocked()).toBe(true);
  });

  it("他商品のキー（pro / toolkit）ではこのツールを解錠できない", async () => {
    const { pub, priv } = await genKeypair();
    const cfg = cfgWith(pub);
    const s = new MemStorage();
    for (const sku of ["pro", "toolkit"]) {
      const key = await signLicense({ sku }, priv);
      const res = await applySheetDiffLicenseKey(s, key, NOW, cfg);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.reason).toContain("対象プラン");
    }
    expect(sheetDiffUnlocked()).toBe(false);
  });

  it("クリアで無料枠に戻る／鍵未設定時の適用は販売準備中メッセージ", async () => {
    const { pub, priv } = await genKeypair();
    const cfg = cfgWith(pub);
    const s = new MemStorage();
    const key = await signLicense({ sku: "sheetdiff" }, priv);
    await applySheetDiffLicenseKey(s, key, NOW, cfg);
    clearSheetDiffLicense(s);
    expect(sheetDiffUnlocked()).toBe(false);
    const noCfg = await applySheetDiffLicenseKey(s, key, NOW, cfgWith(null));
    expect(noCfg.ok).toBe(false);
    if (!noCfg.ok) expect(noCfg.reason).toContain("販売準備中");
  });
});
