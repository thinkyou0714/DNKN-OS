/**
 * tests/web/license.test.ts — Pro ライセンスの発行・検証（license.ts）。
 *
 * 実際に ECDSA P-256 鍵ペアを生成して署名→検証のラウンドトリップを確認する
 * （Node 20+ の WebCrypto はブラウザと同一 API のため、ブラウザ挙動の代理になる）。
 */
import { describe, expect, it } from "vitest";
import {
  b64urlDecodeToBytes,
  b64urlDecodeUtf8,
  b64urlEncodeBytes,
  b64urlEncodeUtf8,
  isLicenseExpired,
  jstDateString,
  LICENSE_PREFIX,
  parseLicense,
  signLicense,
  verifyLicense,
} from "../../lib/license/license.js";
import { genKeypair } from "../helpers/license.js";

/** 2026-07-06T03:00:00Z（JST 正午）を「現在」に固定する。 */
const NOW = Date.UTC(2026, 6, 6, 3, 0, 0);

describe("base64url ヘルパー", () => {
  it("バイト列を可逆にエンコード/デコードできる", () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255]);
    expect(b64urlDecodeToBytes(b64urlEncodeBytes(bytes))).toEqual(bytes);
  });

  it("UTF-8 文字列（日本語含む）を可逆に扱える", () => {
    const s = '{"sku":"pro","note":"電験二種 応援プラン"}';
    expect(b64urlDecodeUtf8(b64urlEncodeUtf8(s))).toBe(s);
  });

  it("不正な base64url は null（throw しない）", () => {
    expect(b64urlDecodeToBytes("!!invalid!!")).toBeNull();
    expect(b64urlDecodeUtf8("あいうえお")).toBeNull();
  });
});

describe("parseLicense", () => {
  it("形式が正しくない入力は null（空・部品不足・prefix 不一致・壊れた JSON）", () => {
    expect(parseLicense("")).toBeNull();
    expect(parseLicense("DENKEN1.onlytwo")).toBeNull();
    expect(parseLicense(`WRONG.${b64urlEncodeUtf8('{"sku":"pro"}')}.sig`)).toBeNull();
    expect(parseLicense(`${LICENSE_PREFIX}.${b64urlEncodeUtf8("not-json")}.sig`)).toBeNull();
    expect(parseLicense(`${LICENSE_PREFIX}..sig`)).toBeNull();
  });

  it("sku が無い / exp の形式が不正な payload は拒否する", () => {
    expect(parseLicense(`${LICENSE_PREFIX}.${b64urlEncodeUtf8('{"exp":"2027-01-01"}')}.sig`)).toBeNull();
    expect(parseLicense(`${LICENSE_PREFIX}.${b64urlEncodeUtf8('{"sku":"pro","exp":"来年まで"}')}.sig`)).toBeNull();
  });

  it("正しい payload をフィールドごと取り出せる", () => {
    const key = `${LICENSE_PREFIX}.${b64urlEncodeUtf8('{"sku":"pro","sub":"a@b.jp","exp":"2027-08-31"}')}.c2ln`;
    const parsed = parseLicense(key);
    expect(parsed?.payload).toEqual({ sku: "pro", sub: "a@b.jp", exp: "2027-08-31" });
  });
});

describe("期限判定（JST）", () => {
  it("jstDateString は JST の日付を返す（UTC 15時以降は翌日になる）", () => {
    expect(jstDateString(Date.UTC(2026, 6, 6, 3, 0, 0))).toBe("2026-07-06");
    expect(jstDateString(Date.UTC(2026, 6, 6, 16, 0, 0))).toBe("2026-07-07");
  });

  it("exp 当日までは有効・翌日から失効・exp 省略は無期限", () => {
    expect(isLicenseExpired({ sku: "pro", exp: "2026-07-06" }, NOW)).toBe(false);
    expect(isLicenseExpired({ sku: "pro", exp: "2026-07-05" }, NOW)).toBe(true);
    expect(isLicenseExpired({ sku: "pro" }, NOW)).toBe(false);
  });
});

describe("signLicense → verifyLicense ラウンドトリップ", () => {
  it("発行したキーが検証を通り payload が一致する", async () => {
    const { pub, priv } = await genKeypair();
    const key = await signLicense({ sku: "pro", sub: "buyer@example.com" }, priv);
    const res = await verifyLicense(key, pub, NOW);
    expect(res).toEqual({ ok: true, payload: { sku: "pro", sub: "buyer@example.com" } });
  });

  it("期限付きキー: 期限内は有効・期限切れは理由つきで拒否", async () => {
    const { pub, priv } = await genKeypair();
    const valid = await signLicense({ sku: "pro", exp: "2026-07-06" }, priv);
    expect((await verifyLicense(valid, pub, NOW)).ok).toBe(true);
    const expired = await signLicense({ sku: "pro", exp: "2026-07-05" }, priv);
    const res = await verifyLicense(expired, pub, NOW);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toContain("2026-07-05");
  });

  it("payload を改ざんしたキーは署名不一致で拒否する", async () => {
    const { pub, priv } = await genKeypair();
    const key = await signLicense({ sku: "pro", exp: "2026-01-01" }, priv);
    const [prefix, , sig] = key.split(".") as [string, string, string];
    // exp を伸ばした payload に元の署名を流用する攻撃を模す。
    const forged = `${prefix}.${b64urlEncodeUtf8('{"sku":"pro","exp":"2099-12-31"}')}.${sig}`;
    const res = await verifyLicense(forged, pub, NOW);
    expect(res.ok).toBe(false);
  });

  it("別の鍵ペアで発行したキーは拒否する", async () => {
    const a = await genKeypair();
    const b = await genKeypair();
    const key = await signLicense({ sku: "pro" }, a.priv);
    expect((await verifyLicense(key, b.pub, NOW)).ok).toBe(false);
  });

  it("sku が pro 以外のキーは署名が正しくても拒否する", async () => {
    const { pub, priv } = await genKeypair();
    const key = await signLicense({ sku: "basic" }, priv);
    const res = await verifyLicense(key, pub, NOW);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toContain("対象プラン");
  });

  it("でたらめな文字列は形式エラーとして拒否する（throw しない）", async () => {
    const { pub } = await genKeypair();
    for (const junk of ["", "hello", "DENKEN1.a.b", `${LICENSE_PREFIX}.${b64urlEncodeUtf8('{"sku":"pro"}')}.@@@`]) {
      const res = await verifyLicense(junk, pub, NOW);
      expect(res.ok).toBe(false);
    }
  });

  it("expectedSku='toolkit': toolkit キーを受理し、pro キーは拒否する（商品間の流用防止）", async () => {
    const { pub, priv } = await genKeypair();
    const toolkitKey = await signLicense({ sku: "toolkit", sub: "buyer@example.com" }, priv);
    const proKey = await signLicense({ sku: "pro" }, priv);
    const ok = await verifyLicense(toolkitKey, pub, NOW, "toolkit");
    expect(ok).toEqual({ ok: true, payload: { sku: "toolkit", sub: "buyer@example.com" } });
    expect((await verifyLicense(proKey, pub, NOW, "toolkit")).ok).toBe(false);
    // 逆方向: toolkit キーは既定（pro）検証を通らない。
    expect((await verifyLicense(toolkitKey, pub, NOW)).ok).toBe(false);
  });
});
