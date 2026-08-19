/**
 * types.ts — 電気設計計算ツールキットの共有型と共通ヘルパ（純ロジック・DOM 非依存）。
 *
 * 設計方針（docs/strategy/toolkit-product.md）:
 *  - 各計算モジュールは「フィールド仕様（宣言的）＋純関数 compute ＋根拠解説」の3点セット。
 *    UI（web/src/toolkit/）はフィールド仕様から汎用レンダリングするだけで、数値の正しさは
 *    すべてこの層のテスト（tests/toolkit/）で担保する。
 *  - 判定は ok/warn/ng の3値。「閾値の90%まで=ok / 閾値まで=warn / 超過=ng」で統一し、
 *    閾値そのものはユーザーが変更できる（既定値は一般的なディレーティング慣行）。
 *  - 表示丸めは有効数字3〜4桁で統一（formatSig）。compute は丸めず全精度で返す。
 */

/** 合否判定の3値。warn は「合格だが余裕が小さい」。 */
export type Verdict = "ok" | "warn" | "ng";

export interface FieldOption {
  value: string;
  label: string;
}

/** 入力フィールドの宣言的仕様。UI はこれを汎用レンダリングする。 */
export interface FieldSpec {
  key: string;
  label: string;
  /** 表示単位（例: "W" "℃" "mm²"）。number フィールドでは必ず明示する。 */
  unit?: string;
  kind: "number" | "select";
  defaultValue: number | string;
  /** 下限（既定は「以上」。minExclusive で「より大きい」に切替）。 */
  min?: number;
  minExclusive?: boolean;
  /** 上限（「以下」）。極端な入力を弾く安全弁。 */
  max?: number;
  /** 入力欄の下に出す補足（前提条件・よくある値など）。 */
  help?: string;
  options?: FieldOption[];
  /** 指定 select フィールドが特定値のときだけ表示・検証する。 */
  showIf?: { key: string; equals: string };
}

export interface FieldError {
  key: string;
  message: string;
}

/** 計算結果の1行（ラベル・値・単位・表示桁数）。 */
export interface ResultItem {
  label: string;
  value: number;
  unit?: string;
  /** 有効数字（既定 3）。 */
  digits?: number;
}

export interface ModuleResult {
  ok: boolean;
  errors?: FieldError[];
  items?: ResultItem[];
  /** 判定に使った負荷率[%]（Infinity は「使用不可」を意味し ng）。 */
  usagePercent?: number;
  verdict?: Verdict;
  /** 前提条件・適用限界などの注記（結果と一緒に必ず表示する）。 */
  notes?: string[];
}

/**
 * 根拠解説。「結論 → 式 → 各項の意味 → よくある誤解 → 参照すべき一次情報」の順で
 * 実務者が読んで納得できる文章にする（商品価値の中核。最終監修は販売者が行う）。
 */
export interface ExplanationDoc {
  conclusion: string[];
  formula: string[];
  terms: string[];
  pitfalls: string[];
  primarySources: string[];
}

/** 無料/有料の区分。free は集客用（Web 公開）、paid はライセンス解錠。 */
export type ToolkitTier = "free" | "paid";

export interface ToolkitModule {
  id: string;
  title: string;
  /** ナビゲーション用の短い名前。 */
  shortTitle: string;
  description: string;
  tier: ToolkitTier;
  fields: FieldSpec[];
  compute(values: Record<string, number | string>): ModuleResult;
  explanation: ExplanationDoc;
}

// ---- 判定 ----

/**
 * 負荷率[%] を閾値[%] で3値判定する。
 * 閾値の 90% 以下 = ok（余裕あり）／ 閾値以下 = warn（合格・余裕小）／ 超過 = ng。
 * 非有限（Infinity/NaN）は「その条件では使用できない」ため ng。
 */
export function judgeUsage(usagePercent: number, thresholdPercent: number): Verdict {
  if (!Number.isFinite(usagePercent)) return "ng";
  if (usagePercent <= thresholdPercent * 0.9) return "ok";
  if (usagePercent <= thresholdPercent) return "warn";
  return "ng";
}

/** ng > warn > ok の順で悪い方を返す（複数観点の総合判定用）。 */
export function worstVerdict(a: Verdict, b: Verdict): Verdict {
  const rank: Record<Verdict, number> = { ok: 0, warn: 1, ng: 2 };
  return rank[a] >= rank[b] ? a : b;
}

// ---- 表示丸め ----

/**
 * 有効数字 digits 桁（既定3）で丸めた表示文字列を返す。
 * - 非有限は "—"（使用不可・未定義の表示）。
 * - 1e-3 未満・1e7 以上は指数表記のまま（桁誤読を防ぐ）。
 * - それ以外は通常表記（末尾ゼロは落ちる。丸め方針は toPrecision = 四捨五入相当）。
 */
export function formatSig(value: number, digits = 3): string {
  if (!Number.isFinite(value)) return "—";
  if (value === 0) return "0";
  const abs = Math.abs(value);
  if (abs < 1e-3 || abs >= 1e7) return value.toExponential(digits - 1);
  return Number(value.toPrecision(digits)).toString();
}

// ---- 入力検証 ----

export interface ValidatedInput {
  /** number フィールドの検証済み値。 */
  nums: Record<string, number>;
  /** select フィールドの検証済み値。 */
  sels: Record<string, string>;
}

export type ValidateResult = { ok: true; input: ValidatedInput } | { ok: false; errors: FieldError[] };

/**
 * showIf 条件を現在の入力値（select 値）で評価する。
 * 検証（validateFields）と UI の表示制御が同じ述語を共有し、
 * 「表示されているのに検証されない／隠れているのに検証される」乖離を防ぐ。
 */
export function isFieldVisible(spec: FieldSpec, values: Record<string, number | string>): boolean {
  if (spec.showIf === undefined) return true;
  return values[spec.showIf.key] === spec.showIf.equals;
}

/**
 * フィールド仕様に基づいて入力を検証する。
 * - select を先に確定し、showIf で非表示の number は検証・出力から除外する。
 * - NaN・範囲外は日本語メッセージの FieldError にまとめて返す（先頭で throw しない）。
 */
export function validateFields(fields: FieldSpec[], values: Record<string, number | string>): ValidateResult {
  const sels: Record<string, string> = {};
  const errors: FieldError[] = [];

  for (const f of fields) {
    if (f.kind !== "select") continue;
    const v = values[f.key];
    const allowed = (f.options ?? []).map((o) => o.value);
    if (typeof v === "string" && allowed.includes(v)) {
      sels[f.key] = v;
    } else if (typeof f.defaultValue === "string" && allowed.includes(f.defaultValue)) {
      sels[f.key] = f.defaultValue;
    } else {
      errors.push({ key: f.key, message: `${f.label}の選択値が不正です` });
    }
  }

  const nums: Record<string, number> = {};
  for (const f of fields) {
    if (f.kind !== "number" || !isFieldVisible(f, sels)) continue;
    const raw = values[f.key];
    const v = typeof raw === "number" ? raw : Number.NaN;
    const unit = f.unit ?? "";
    if (!Number.isFinite(v)) {
      errors.push({ key: f.key, message: `${f.label}を数値で入力してください` });
      continue;
    }
    if (f.min !== undefined && (f.minExclusive === true ? v <= f.min : v < f.min)) {
      const bound = f.minExclusive === true ? `${f.min}${unit}より大きい値` : `${f.min}${unit}以上`;
      errors.push({ key: f.key, message: `${f.label}は${bound}で入力してください` });
      continue;
    }
    if (f.max !== undefined && v > f.max) {
      errors.push({ key: f.key, message: `${f.label}は${f.max}${unit}以下で入力してください` });
      continue;
    }
    nums[f.key] = v;
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, input: { nums, sels } };
}

/**
 * 検証済み入力から number 値を取り出す。validateFields が成功していれば必ず存在するため、
 * 欠落はプログラミングバグとして throw する（ユーザー入力エラーはここまで来ない）。
 */
export function num(input: ValidatedInput, key: string): number {
  const v = input.nums[key];
  if (v === undefined) throw new Error(`[toolkit] 検証済み入力に ${key} がありません`);
  return v;
}

/** 全計算結果に付ける共通免責（UI・計算書の両方に表示する）。 */
export const TOOLKIT_DISCLAIMER =
  "本ツールの計算結果は参考値です。最終判断は設計者の責任で行い、適用規格・部品データシートの原文を必ず確認してください。";

/** データ非送信の明示（UI に常時表示する。仕様の絶対制約）。 */
export const TOOLKIT_PRIVACY_NOTE = "入力データはお使いのブラウザ内でのみ処理され、外部に送信されません。";
