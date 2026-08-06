/**
 * grade.ts — 採点の純ロジック（app.ts の DOM から分離してテスト可能にする）。
 *
 * 重要な是正（根本原因）:
 *   旧実装は numeric 形式でも `given === answer` の文字列完全一致で採点していた。
 *   そのため "50" の問題に "50.0"／"50"（全角）／"  50 " と入力すると数値的には
 *   正解でも不正解になっていた。numeric は数値として許容誤差つきで比較する。
 *   multiple_choice / descriptive は選択肢・センチネルの厳密一致でよい。
 */
import { ratingForScore } from "../../lib/curriculum/rubric.js";
import type { Problem } from "../../lib/engine/schema.js";
import type { Rating } from "../../lib/scheduler/types.js";

/**
 * ユーザー入力を数値文字列に正規化する。
 * - 全角数字 ０-９ → 半角 0-9
 * - 全角ピリオド／読点・句点を小数点・桁区切りに寄せる
 * - 桁区切りカンマ・空白を除去
 */
export function normalizeNumericInput(raw: string): string {
  return raw
    .replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0))
    .replace(/[．。]/g, ".")
    .replace(/[，、]/g, ",")
    .replace(/,/g, "")
    .replace(/\s+/g, ""); // 全空白を除去するため末尾 trim は不要（no-op だった）。
}

/**
 * 数値採点の許容誤差（#46）。
 *
 * 旧実装は相対 1e-6 と本番の有効数字の丸めより遥かに厳しく、模範解答が小数2桁で
 * 与えられる電験では、有効数字の取り方が1桁違うだけ（例: 14.52 に対し 14.5）でも
 * 不正解になっていた。本番は「有効数字3桁程度に丸めれば一致」を正解とみなすため、
 * 相対 0.5% 程度の許容に緩める。一方、明らかに違う値（数%以上ずれる）は弾く。
 */
export const NUMERIC_REL_TOL = 0.005; // 相対 0.5%（有効数字の丸め・桁落ちを吸収）
/** 絶対誤差の下限（極小・ゼロ近傍の答えで相対誤差が機能しないときの最低許容）。 */
export const NUMERIC_ABS_FLOOR = 1e-9;

/**
 * numeric は数値の許容誤差比較、その他（multiple_choice / descriptive）は厳密一致。
 *
 * 許容誤差 = max(NUMERIC_ABS_FLOOR, |answer| × NUMERIC_REL_TOL)。
 * 完全一致は当然正解、有効数字の丸め（例: 14.5 ≒ 14.52）も正解、
 * 数%以上ずれた明らかな誤答（例: 50 に対し 49）は不正解。
 */
export function isAnswerCorrect(problem: Problem, given: string): boolean {
  if (problem.format === "numeric") {
    const normalized = normalizeNumericInput(given);
    // 空入力を弾く: Number("") は 0 なので、答えが "0" の問題で空回答が正解扱いになるのを防ぐ。
    if (normalized === "") return false;
    const got = Number(normalized);
    const want = Number(problem.answer);
    if (!Number.isFinite(got) || !Number.isFinite(want)) return false;
    const tol = Math.max(NUMERIC_ABS_FLOOR, Math.abs(want) * NUMERIC_REL_TOL);
    return Math.abs(got - want) <= tol;
  }
  // multiple_choice の選択肢、descriptive の自己採点センチネルは厳密一致。
  return given === problem.answer;
}

/**
 * 記述(二次)の部分点自己採点（等重み版）。模範解答の各ステップのうち
 * 自分が書けた数 checked / 全 total から達成率と FSRS 評価を導く。
 *
 * 学習タブの記述採点は配点重み付きの
 * {@link import("../../lib/curriculum/rubric.js").scoreRubric} を使う。
 * こちらは「ステップを等しく数えるだけでよい」呼び出し向けに残す簡易版で、
 * 達成率→評価の閾値は `ratingForScore` に委譲して単一情報源を保つ。
 */
export function partialScore(checked: number, total: number): { pct: number; rating: Rating } {
  if (total <= 0) return { pct: 0, rating: "again" };
  const c = Math.max(0, Math.min(total, checked));
  const pct = c / total;
  return { pct, rating: ratingForScore(pct) };
}
