/**
 * license.ts — Pro ライセンスキーの発行・検証（純ロジック・DOM 非依存）。
 *
 * 形式: `DENKEN1.<base64url(payload JSON)>.<base64url(ECDSA P-256 署名)>`
 *  - 署名対象は「`DENKEN1.` + payload の base64url 文字列」そのもの。
 *    JSON の正規化（キー順・空白）に依存せず、形式バージョンも署名に束縛する。
 *  - 検証は WebCrypto（ブラウザ/Node 20+ 共通の `globalThis.crypto.subtle`）で
 *    端末内で完結する（サーバ不要・オフラインで動作）。
 *  - リポジトリに埋め込むのは公開鍵のみ（monetization-config.ts）。秘密鍵は販売者が
 *    `npm run license:keygen` でローカル生成し、リポジトリには決してコミットしない。
 *    公開鍵だけではキーを偽造できない。
 *
 * 運用手順は docs/strategy/monetization-setup.md を参照。
 */

import { JST_OFFSET_MS } from "../shared/time.js";

/** ライセンス形式のバージョン識別子（署名対象に含める）。 */
export const LICENSE_PREFIX = "DENKEN1";

/** P-256 の JWK（DOM/Node の JsonWebKey 型差異を避けるための構造的最小型）。 */
export interface LicenseJwk {
  kty: string;
  crv: string;
  x: string;
  y: string;
  /** 秘密鍵成分（公開鍵には含めない。config へ貼るのは公開鍵のみ）。 */
  d?: string;
  ext?: boolean;
  key_ops?: string[];
}

/**
 * 発行可能な sku の一覧。
 *  - "pro":     学習アプリの Pro プラン（既定）。
 *  - "toolkit": 電気設計計算ツールキットの有料版（web/toolkit.html）。
 */
export const KNOWN_SKUS = ["pro", "toolkit"] as const;

/** ライセンスの中身。exp 省略時は買い切り（無期限）。 */
export interface LicensePayload {
  /** 対象プラン（KNOWN_SKUS のいずれか。検証時は expectedSku と一致を要求）。 */
  sku: string;
  /** 購入者の識別子（メール等・任意）。問い合わせ時の照合用。 */
  sub?: string;
  /** 有効期限 "YYYY-MM-DD"（JST・この日まで有効）。省略時は無期限。 */
  exp?: string;
  /** 発行メモ（任意）。 */
  note?: string;
}

export type LicenseVerifyResult = { ok: true; payload: LicensePayload } | { ok: false; reason: string };

const EC_IMPORT_ALG = { name: "ECDSA", namedCurve: "P-256" } as const;
const EC_SIGN_ALG = { name: "ECDSA", hash: "SHA-256" } as const;

/**
 * WebCrypto SubtleCrypto の構造的最小型。
 * DOM lib（ブラウザ）と @types/node（テスト/スクリプト）で型定義が異なるため、
 * 双方に代入互換な形だけを宣言して両環境の型検査を通す。
 */
interface SubtleLike {
  importKey(
    format: "jwk",
    keyData: LicenseJwk,
    algorithm: typeof EC_IMPORT_ALG,
    extractable: boolean,
    keyUsages: readonly string[],
  ): Promise<unknown>;
  verify(algorithm: typeof EC_SIGN_ALG, key: unknown, signature: Uint8Array, data: Uint8Array): Promise<boolean>;
  sign(algorithm: typeof EC_SIGN_ALG, key: unknown, data: Uint8Array): Promise<ArrayBuffer>;
  generateKey(
    algorithm: typeof EC_IMPORT_ALG,
    extractable: boolean,
    keyUsages: readonly string[],
  ): Promise<{ privateKey: unknown; publicKey: unknown }>;
  exportKey(format: "jwk", key: unknown): Promise<LicenseJwk>;
}

/** WebCrypto が使えない環境（非 HTTPS の一部旧ブラウザ等）では null。 */
function getSubtle(): SubtleLike | null {
  const c = (globalThis as { crypto?: { subtle?: unknown } }).crypto;
  return c && typeof c === "object" && c.subtle ? (c.subtle as SubtleLike) : null;
}

// ---- base64url（btoa/atob はブラウザ・Node 16+ 共通のグローバル）----

export function b64urlEncodeBytes(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** 不正な base64url は null（throw しない）。 */
export function b64urlDecodeToBytes(s: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) return null;
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  try {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

export function b64urlEncodeUtf8(text: string): string {
  return b64urlEncodeBytes(new TextEncoder().encode(text));
}

/** 不正な base64url / UTF-8 は null（throw しない）。 */
export function b64urlDecodeUtf8(s: string): string | null {
  const bytes = b64urlDecodeToBytes(s);
  if (bytes === null) return null;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

// ---- パース・期限 ----

export interface ParsedLicense {
  payloadB64: string;
  sigB64: string;
  payload: LicensePayload;
}

/** 形式・JSON・フィールド型を検査する。署名検証はしない。壊れた入力は null。 */
export function parseLicense(key: string): ParsedLicense | null {
  const parts = key.trim().split(".");
  if (parts.length !== 3) return null;
  const [prefix, payloadB64, sigB64] = parts as [string, string, string];
  if (prefix !== LICENSE_PREFIX || payloadB64 === "" || sigB64 === "") return null;
  const json = b64urlDecodeUtf8(payloadB64);
  if (json === null) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.sku !== "string" || o.sku === "") return null;
  if (o.sub !== undefined && typeof o.sub !== "string") return null;
  if (o.note !== undefined && typeof o.note !== "string") return null;
  if (o.exp !== undefined && (typeof o.exp !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(o.exp))) return null;
  const payload: LicensePayload = {
    sku: o.sku,
    ...(o.sub !== undefined ? { sub: o.sub as string } : {}),
    ...(o.exp !== undefined ? { exp: o.exp as string } : {}),
    ...(o.note !== undefined ? { note: o.note as string } : {}),
  };
  return { payloadB64, sigB64, payload };
}

/** nowMs の JST 日付を "YYYY-MM-DD" で返す（期限比較用）。 */
export function jstDateString(nowMs: number): string {
  return new Date(nowMs + JST_OFFSET_MS).toISOString().slice(0, 10);
}

/** exp 当日（JST）までは有効。exp 省略は無期限。 */
export function isLicenseExpired(payload: LicensePayload, nowMs: number): boolean {
  if (payload.exp === undefined) return false;
  return jstDateString(nowMs) > payload.exp;
}

// ---- 署名・検証 ----

/** 署名対象バイト列（形式バージョン + payload base64url）。 */
function signedBytes(payloadB64: string): Uint8Array {
  return new TextEncoder().encode(`${LICENSE_PREFIX}.${payloadB64}`);
}

/**
 * ライセンスキーを検証する（形式 → 署名 → sku → 期限の順）。
 * 失敗理由はユーザー向けの日本語で返す（設定画面のトーストにそのまま出せる）。
 * expectedSku 省略時は "pro"（既存呼び出しの互換）。ツールキットは "toolkit" を渡す。
 * 商品ごとに解錠対象を分けるため、sku 不一致は署名が正しくても拒否する。
 */
export async function verifyLicense(
  key: string,
  publicKeyJwk: LicenseJwk,
  nowMs: number,
  expectedSku = "pro",
): Promise<LicenseVerifyResult> {
  const parsed = parseLicense(key);
  if (parsed === null) return { ok: false, reason: "ライセンスキーの形式が正しくありません" };
  const sig = b64urlDecodeToBytes(parsed.sigB64);
  if (sig === null) return { ok: false, reason: "ライセンスキーの形式が正しくありません" };
  const subtle = getSubtle();
  if (subtle === null) return { ok: false, reason: "この環境ではライセンスを検証できません（WebCrypto 非対応）" };
  let valid = false;
  try {
    const pub = await subtle.importKey("jwk", publicKeyJwk, EC_IMPORT_ALG, false, ["verify"]);
    valid = await subtle.verify(EC_SIGN_ALG, pub, sig, signedBytes(parsed.payloadB64));
  } catch {
    return { ok: false, reason: "ライセンスの検証に失敗しました" };
  }
  if (!valid) return { ok: false, reason: "ライセンスの署名が一致しません" };
  if (parsed.payload.sku !== expectedSku) {
    return { ok: false, reason: "このライセンスは対象プランのものではありません" };
  }
  if (isLicenseExpired(parsed.payload, nowMs)) {
    return { ok: false, reason: `ライセンスの有効期限（${parsed.payload.exp}）が切れています` };
  }
  return { ok: true, payload: parsed.payload };
}

/**
 * ライセンスキーを発行する（販売者ツール・テスト用。秘密鍵が必要）。
 * アプリ本体からは呼ばない（バンドルには含まれるが秘密鍵なしでは意味を持たない）。
 */
export async function signLicense(payload: LicensePayload, privateKeyJwk: LicenseJwk): Promise<string> {
  const subtle = getSubtle();
  if (subtle === null) throw new Error("WebCrypto が利用できません（Node 20+ / ブラウザで実行してください）");
  const payloadB64 = b64urlEncodeUtf8(JSON.stringify(payload));
  const priv = await subtle.importKey("jwk", privateKeyJwk, EC_IMPORT_ALG, false, ["sign"]);
  const sig = new Uint8Array(await subtle.sign(EC_SIGN_ALG, priv, signedBytes(payloadB64)));
  return `${LICENSE_PREFIX}.${payloadB64}.${b64urlEncodeBytes(sig)}`;
}

/**
 * 署名鍵ペアを新規生成する（販売者ツール・テスト用）。
 * 公開鍵は検証に必要な最小フィールド（kty/crv/x/y）へ正規化して返す
 * （monetization-config.ts へそのまま貼れる形。key_ops 等の余計な属性を持ち込まない）。
 */
export async function generateLicenseKeyPair(): Promise<{ privateJwk: LicenseJwk; publicJwk: LicenseJwk }> {
  const subtle = getSubtle();
  if (subtle === null) throw new Error("WebCrypto が利用できません（Node 20+ / ブラウザで実行してください）");
  const pair = await subtle.generateKey(EC_IMPORT_ALG, true, ["sign", "verify"]);
  const privateJwk = await subtle.exportKey("jwk", pair.privateKey);
  const pub = await subtle.exportKey("jwk", pair.publicKey);
  return { privateJwk, publicJwk: { kty: pub.kty, crv: pub.crv, x: pub.x, y: pub.y } };
}
