/**
 * テンプレート共有ヘルパー層（I-001〜I-004, I-009, I-010, II-102〜II-105）。
 *
 * 新規テンプレートはこの形を標準とする:
 *   1. pick / buildChoices / percentage / ensureRange / constrainRange / isNonNegative などのヘルパーを import する。
 *   2. 必要に応じて defineTemplate() ファクトリを使って Template を組み立てる。
 *   3. ローカルで pick() を重複定義しない。
 */
import { isCleanAnswer } from "../clean.js";
import type { Distractor, ParamSpec, PastExamCoverage, Template } from "./types.js";

// POWER_FACTOR_TOLERANCE を re-export して、テンプレートが1か所から参照できるようにする（II-103）。
export { POWER_FACTOR_TOLERANCE } from "../../shared/constants.js";

// ---------------------------------------------------------------------------
// I-001 / I-002: pick
// ---------------------------------------------------------------------------

/**
 * 配列からランダムに1要素を返す。
 * 空配列が渡された場合は明示的に Error を throw する（I-002）。
 */
export function pick<T>(arr: ReadonlyArray<T>, rng: () => number): T {
  if (arr.length === 0) throw new Error("pick: empty array");
  // arr.length > 0 を上で保証済みのため index は必ず範囲内。
  return arr[Math.floor(rng() * arr.length)] as T;
}

// ---------------------------------------------------------------------------
// I-003: buildChoices
// ---------------------------------------------------------------------------

/**
 * 正解テキストと誤答テキスト群から選択肢配列を組み立てる。
 *   - 重複を排除する。
 *   - 正解が含まれることを保証する。
 *   - 数値として解釈できる要素は数値昇順、できない要素は辞書順（混在時は数値を前に置く）。
 *
 * ※既存テンプレートがすでに独自の sort ロジックを持つ場合は、
 *   ロジックが完全一致するテンプレートのみへ適用する。
 */
export function buildChoices(correctText: string, distractorTexts: string[]): string[] {
  const all = [correctText, ...distractorTexts];
  const unique = [...new Set(all)];
  return unique.sort((a, b) => {
    const na = Number(a);
    const nb = Number(b);
    const aIsNum = Number.isFinite(na);
    const bIsNum = Number.isFinite(nb);
    if (aIsNum && bIsNum) return na - nb;
    if (aIsNum) return -1;
    if (bIsNum) return 1;
    return a < b ? -1 : a > b ? 1 : 0;
  });
}

// ---------------------------------------------------------------------------
// buildMcChoices — numeric→マークシート(五択)の選択肢を安全に組み立てる共有ヘルパー
// ---------------------------------------------------------------------------

/** buildMcChoices に渡す誤答候補（コードが算出した値 + その典型ミスの説明）。 */
export interface McDistractorSpec {
  /** コードが算出した誤答の数値（特定の典型ミスから導いた値）。 */
  value: number;
  /** どんな典型ミスに対応するか（必須・解説に使う）。 */
  reason: string;
  /** 任意: 典拠（過去問・教科書など）。 */
  sourceRef?: string;
}

/** buildMcChoices の戻り値（昇順 choices ＋ reason 付き distractors）。 */
export interface McChoices {
  /** 正解を含む選択肢（整形済み・数値昇順・重複なし）。 */
  choices: string[];
  /** 整形済みの誤答（reason 付き）。 */
  distractors: Distractor[];
  /** 整形済みの正解テキスト（choices に必ず含まれる）。 */
  answerText: string;
  /** 最頻誤答になりやすい選択肢テキスト（先頭の誤答を既定とする）。 */
  likelyWrongChoice: string;
}

/**
 * numeric テンプレートを「マークシート（五択）」化するための選択肢ビルダ。
 *
 * 本番の電験二種・一次は五択マークシートのため、numeric の閉形式（コードが算出する唯一の真値）は
 * そのまま使いつつ、「特定の典型ミスから導いた誤答値」を加えて選択肢を構成する。
 *
 * 安全ゲート（1つでも破れば null を返し、呼び出し側で draw を捨てる）:
 *   1. 正解・全誤答の **表示文字列** がすべて「綺麗な値」（isCleanAnswer）。
 *      ※整形関数（formatKW 等）が割る/丸めることがあるため、表示後の数値で判定する。
 *   2. 表示が真値を **忠実に** 表す（丸めで汚い値を綺麗に見せかける誤答を排除）。
 *      表示数値 × displayScale が真値と一致することを要求する。
 *   3. 表示文字列が相互にすべて一意（重複する誤答は混乱を招くため不可）。
 *   4. 正解が選択肢に含まれる（answer ∈ choices を構造的に保証）。
 *   5. 誤答が正解と数値的に一致しない（formatter の桁落ちで偶然一致する誤答も排除）。
 *
 * @param answer        コードが算出した正解の数値（真値）。
 * @param distractors   誤答候補（value=典型ミスの値, reason=説明）。
 * @param formatter     正解・誤答を同一規則で整形する関数（formatClean / formatKW など）。
 * @param opts.expected 期待する選択肢数（既定5＝本番の五択）。これと一致しなければ null。
 * @param opts.displayScale 「真値 = 表示数値 × displayScale」の換算係数（既定1）。
 *      formatKW のように W→kW で割る整形関数では 1000 を渡す（真値は W、表示は kW）。
 * @returns 整形済み choices/distractors/answerText/likelyWrongChoice、または不成立で null。
 */
/**
 * 丸め容認版のマークシート五択ビルダ。
 *
 * `buildMcChoices` は「表示が真値を厳密に再現する」ことを要求するため（isCleanByDisplay）、
 * π や無理数 tanθ が絡んで答えが割り切れないテンプレートでは全 draw が棄却されてしまう。
 * 一方、本試（電験）は**丸めた数値の五択**で出題されるので、丸めた表示のまま選択肢を
 * 構成できる経路が要る。本関数はその用途に限定した姉妹関数で、
 * 「表示＝真値」の忠実性ゲートだけを外し、他の安全ゲートは同じに保つ:
 *
 *   1. 正解・全誤答の表示が有限で、小数2桁表記に収まる（formatter 経由）
 *   2. 表示文字列が相互にすべて一意（重複する誤答は不可）
 *   3. 正解が選択肢に含まれる（answer ∈ choices を構造的に保証）
 *   4. 誤答が正解と表示上一致しない
 *
 * 割り切れる答えしか出さないテンプレートでは従来どおり `buildMcChoices` を使うこと。
 */
export function buildRoundedMcChoices(
  answer: number,
  distractors: ReadonlyArray<McDistractorSpec>,
  formatter: (value: number) => string,
  opts?: { expected?: number },
): McChoices | null {
  const expected = opts?.expected ?? 5;
  if (!Number.isFinite(answer)) return null;
  for (const d of distractors) {
    if (!Number.isFinite(d.value)) return null;
  }

  const answerText = formatter(answer);
  if (!Number.isFinite(Number(answerText))) return null;

  // 正解が正の量のとき、負または表示上ゼロになる誤答は「見ただけで捨てられる」ため
  // 五択として成立しない。実際の本試の選択肢は全て同じオーダーの正の値になる。
  if (answer > 0) {
    for (const d of distractors) {
      if (d.value <= 0) return null;
      if (Number(formatter(d.value)) === 0) return null;
    }
  }

  const formatted: Distractor[] = distractors.map((d) => ({
    text: formatter(d.value),
    reason: d.reason,
    ...(d.sourceRef ? { sourceRef: d.sourceRef } : {}),
  }));
  if (formatted.some((d) => !Number.isFinite(Number(d.text)))) return null;
  // 表示が正解と一致する誤答は「誤答として成立しない」ため排除（丸めで一致する場合を含む）。
  if (formatted.some((d) => d.text === answerText)) return null;

  const texts = new Set([answerText, ...formatted.map((d) => d.text)]);
  if (texts.size !== expected) return null;

  const choices = [...texts].sort((a, b) => Number(a) - Number(b));
  return {
    choices,
    distractors: formatted,
    answerText,
    likelyWrongChoice: formatted[0]?.text ?? answerText,
  };
}

export function buildMcChoices(
  answer: number,
  distractors: ReadonlyArray<McDistractorSpec>,
  formatter: (value: number) => string,
  opts?: { expected?: number; displayScale?: number },
): McChoices | null {
  const expected = opts?.expected ?? 5;
  const displayScale = opts?.displayScale ?? 1;

  // 正解・誤答の数値が有限かつ表示が綺麗・忠実であることを要求する。
  if (!isCleanByDisplay(answer, formatter, displayScale)) return null;
  for (const d of distractors) {
    if (!isCleanByDisplay(d.value, formatter, displayScale)) return null;
    // 桁落ち等で誤答が正解と数値一致するものは「誤答として成立しない」ため排除。
    if (Math.abs(d.value - answer) < EPSILON_TOL) return null;
  }

  const answerText = formatter(answer);
  const formattedDistractors: Distractor[] = distractors.map((d) => ({
    text: formatter(d.value),
    reason: d.reason,
    ...(d.sourceRef ? { sourceRef: d.sourceRef } : {}),
  }));

  // 表示文字列の一意性（正解 + 全誤答）。重複があれば不成立。
  const texts = new Set([answerText, ...formattedDistractors.map((d) => d.text)]);
  if (texts.size !== expected) return null;
  // 念のため正解が誤答テキストに混じっていないことを再確認（数値一致ゲートと二重化）。
  if (formattedDistractors.some((d) => d.text === answerText)) return null;

  const choices = [...texts].sort((a, b) => Number(a) - Number(b));

  return {
    choices,
    distractors: formattedDistractors,
    answerText,
    // 先頭に並べた誤答を最頻誤答の既定とする（呼び出し側で上書き可）。
    likelyWrongChoice: formattedDistractors[0]?.text ?? answerText,
  };
}

/** buildMcChoices 内の「数値一致」判定の許容誤差（表示前の真値の比較に使う）。 */
const EPSILON_TOL = 1e-9;

/**
 * value が有限で、formatter の **表示文字列** が綺麗な値であり、かつ表示が真値を忠実に表すか。
 * 「表示数値 × displayScale ≒ 真値」を要求し、丸めで汚い値を綺麗に見せかける誤答を弾く。
 */
function isCleanByDisplay(value: number, formatter: (v: number) => string, displayScale: number): boolean {
  if (!Number.isFinite(value)) return false;
  const shown = Number(formatter(value));
  if (!Number.isFinite(shown)) return false;
  if (!isCleanAnswer(shown)) return false;
  // 表示が真値を忠実に表しているか（formatKW の W→kW 換算等を考慮）。
  const reconstructed = shown * displayScale;
  const tol = Math.max(EPSILON_TOL, Math.abs(value) * 1e-9);
  return Math.abs(reconstructed - value) <= tol;
}

// ---------------------------------------------------------------------------
// I-004: percentage
// ---------------------------------------------------------------------------

/**
 * 分率（numerator / denominator × 100）を返す。
 * denominator が 0 の場合は NaN を返す（呼び出し側で物理的成立判定を行うこと）。
 */
export function percentage(numerator: number, denominator: number): number {
  if (denominator === 0) return Number.NaN;
  return (numerator / denominator) * 100;
}

// ---------------------------------------------------------------------------
// I-010: ensureRange
// ---------------------------------------------------------------------------

/**
 * value が [min, max] の閉区間に収まるかを返す。
 * テンプレートの物理的成立判定・paramSpecs のレンジ検証に使う。
 */
export function ensureRange(value: number, range: readonly [number, number]): boolean {
  const [min, max] = range;
  return value >= min && value <= max;
}

// ---------------------------------------------------------------------------
// II-102: constrainRange — 物理制約チェック共有ヘルパー
// ---------------------------------------------------------------------------

/**
 * value が [min, max] の閉区間に収まるかを返す（II-102）。
 * ensureRange と同等だが、物理制約チェック用途であることを名前で明示する。
 * 効率 η≤1、力率≤1 等の物理上限チェックをテンプレートごとに書かないための共有ヘルパー。
 *
 * @param value  チェックする値
 * @param min    最小値（境界を含む）
 * @param max    最大値（境界を含む）
 * @param _name  デバッグ用の量の名前（将来の診断ログ用; 現在は使用しない）
 * @returns value が [min, max] に収まれば true
 *
 * @example
 * // 効率 η≤1 の物理制約チェック
 * if (!constrainRange(eta, 0, 1)) return null;
 *
 * @example
 * // 力率 cosφ≤1 の物理制約チェック（許容誤差付きは POWER_FACTOR_TOLERANCE を別途使用）
 * if (!constrainRange(cosPhi, 0, 1 + POWER_FACTOR_TOLERANCE)) return null;
 */
export function constrainRange(value: number, min: number, max: number, _name?: string): boolean {
  return value >= min && value <= max;
}

// ---------------------------------------------------------------------------
// II-105: isNonNegative — 物理量の非負ガード
// ---------------------------------------------------------------------------

/**
 * 物理量の非負ガード（II-105）。
 * 丸め誤差等で負値化した計算結果を棄却するための共有ヘルパー。
 * return null のみの暗黙的なガードを共有化する。
 *
 * @param value  チェックする物理量
 * @returns 0以上（非負）なら true
 *
 * @example
 * const power = calcPower(I, R);
 * if (!isNonNegative(power)) return null; // 丸め誤差で負値になった場合を棄却
 */
export function isNonNegative(value: number): boolean {
  return value >= 0;
}

// ---------------------------------------------------------------------------
// II-104: percentage のゼロ割 NaN についての注記は helpers.ts の percentage を参照
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// I-009: defineTemplate ファクトリ
// ---------------------------------------------------------------------------

/**
 * defineTemplate が受け取る設定オブジェクトの型。
 * `draw(rng)` でパラメータを抽選し、`buildFrom(params)` で GenerationResult を組み立てる。
 * テンプレートの generate / generateFrom 委譲はファクトリが行う。
 */
export interface TemplateSpec<P extends Record<string, number>> {
  topic: string;
  subject: Template["subject"];
  exam: Template["exam"];
  difficulty: number;
  /** 過去問の出題傾向メタ（任意）。20年分のカバレッジ可視化・傾向分析に使う。 */
  pastExam?: PastExamCoverage;
  paramSpecs: Record<keyof P & string, ParamSpec>;
  /** パラメータ名の順序（generateFrom のキー存在確認に使う）。 */
  paramOrder: (keyof P & string)[];
  /** rng を受け取ってパラメータを抽選して返す。 */
  draw(rng: () => number): P;
  /** 固定パラメータから決定論的に GenerationResult を組み立てる。不成立なら null。 */
  buildFrom(params: P): import("./types.js").GenerationResult | null;
}

/**
 * TemplateSpec から Template を組み立てるファクトリ（I-009）。
 * generate / generateFrom の委譲パターンを一元化する。
 *
 * 新規テンプレートはこの形を標準とする。
 */
export function defineTemplate<P extends Record<string, number>>(spec: TemplateSpec<P>): Template {
  return {
    topic: spec.topic,
    subject: spec.subject,
    exam: spec.exam,
    difficulty: spec.difficulty,
    // exactOptionalPropertyTypes: 未指定時はキー自体を省く（undefined を代入しない）。
    ...(spec.pastExam ? { pastExam: spec.pastExam } : {}),
    paramSpecs: spec.paramSpecs as Record<string, ParamSpec>,
    generate(rng) {
      return spec.buildFrom(spec.draw(rng));
    },
    generateFrom(rawParams) {
      // paramOrder に列挙されたすべてのキーが存在するかを確認する。
      for (const key of spec.paramOrder) {
        if (rawParams[key] === undefined) return null;
      }
      // 直前の for-of ループで全キーの存在を確認済み。undefined でないことが保証される。
      const params = Object.fromEntries(spec.paramOrder.map((k) => [k, rawParams[k] as number])) as P;
      return spec.buildFrom(params);
    },
  };
}
