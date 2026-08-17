/**
 * curriculum/narration-script.ts — 解法動画のナレーション台本の決定論生成。
 *
 * 目的: 解法スライド（solution-slides.ts）をそのまま動画収録に使えるように、
 *   スライド1枚=台本1セグメントのナレーション台本へ変換する。収録者は台本を
 *   読み上げながらスライドを送るだけで「解く流れの動画」が撮れる状態にし、
 *   収録コストを下げる（docs/strategy/ideas/20 §22）。
 *
 * 方針（エンジンの narrate 系と同じ思想）:
 *   - 数式・数値はスライド本文からの逐語転記。台本側で言い換えない
 *     （読み間違い・数値改変の防止。正しさはコードが担保し、台本は言い回しだけを足す）。
 *   - 役割（着眼/公式/代入/計算/結論/補足）ごとの導入句だけを機械的に付ける。
 *   - 尺の見積もりは日本語ナレーションの標準的な速さ（約300字/分）から決定論で計算する。
 *
 * DOM 非依存・状態なし・決定論。
 */

import type { RubricRole } from "./rubric.js";
import { ROLE_LABELS } from "./rubric.js";
import { buildSolutionSlides, type SlideSource, type SolutionSlide } from "./solution-slides.js";

/** 日本語ナレーションの読み上げ速度（字/秒）。約300字/分。 */
export const NARRATION_CHARS_PER_SEC = 5;
/** セグメント間の間（スライド送り・息継ぎ）の秒数。 */
export const SEGMENT_PAUSE_SEC = 2;
/** 1セグメントの最低秒数（短い行でも画面を読ませる時間を確保する）。 */
export const MIN_SEGMENT_SEC = 5;

/** 台本の1セグメント（スライド1枚に対応）。 */
export interface ScriptSegment {
  /** スライド番号（1始まり）。 */
  slideNo: number;
  /** 見出し（"問題" / "STEP n・役割" / "答え"）。 */
  title: string;
  /** 読み上げ本文。スライド本文を逐語で含む。 */
  narration: string;
  /** 実戦の思考（そのまま読み上げてよい。画面にも出るので省略しても成立する）。 */
  thought: string;
  /** 推定読み上げ秒数（narration＋thought の文字数から算出）。 */
  seconds: number;
}

/** 動画1本ぶんの台本。 */
export interface VideoScript {
  segments: ScriptSegment[];
  /** 推定合計秒数（全セグメントの合計）。 */
  totalSeconds: number;
  /** スライド枚数（= セグメント数）。 */
  slideCount: number;
}

/** 台本ヘッダに載せる問題メタ（任意）。 */
export interface ScriptMeta {
  id?: string;
  subject?: string;
  topic?: string;
}

/** 読み上げ文字数から推定秒数を出す（下限・間を含む）。 */
export function estimateNarrationSeconds(text: string): number {
  return Math.max(MIN_SEGMENT_SEC, Math.ceil(text.length / NARRATION_CHARS_PER_SEC) + SEGMENT_PAUSE_SEC);
}

/** 役割ごとの導入句。本文には手を入れず、前に置くだけ。 */
const ROLE_LEAD: Readonly<Record<RubricRole, string>> = {
  approach: "まず方針から。",
  formula: "使う公式を書きます。",
  substitution: "数値を代入します。",
  calculation: "計算を進めます。",
  conclusion: "最終値を出します。",
  note: "ここで補足です。",
};

/** スライド1枚のナレーション本文（本文は逐語転記）。 */
function narrationFor(slide: SolutionSlide): string {
  if (slide.kind === "cover") return `今回はこの問題を解きます。${slide.body}`;
  if (slide.kind === "answer") return `答えは「${slide.body}」です。`;
  const role = slide.role ?? "calculation";
  return `${ROLE_LEAD[role]}${slide.body}`;
}

/** スライド1枚の台本見出し（step は役割名を添える）。 */
function titleFor(slide: SolutionSlide): string {
  if (slide.kind !== "step") return slide.title;
  const role = slide.role ?? "calculation";
  return `${slide.title}・${ROLE_LABELS[role]}`;
}

/** 問題から動画台本を組む（スライドデッキと1:1対応）。 */
export function buildVideoScript(p: SlideSource): VideoScript {
  const deck = buildSolutionSlides(p);
  const segments = deck.slides.map((slide, i): ScriptSegment => {
    const narration = narrationFor(slide);
    return {
      slideNo: i + 1,
      title: titleFor(slide),
      narration,
      thought: slide.thought,
      seconds: estimateNarrationSeconds(`${narration}${slide.thought}`),
    };
  });
  const totalSeconds = segments.reduce((a, s) => a + s.seconds, 0);
  return { segments, totalSeconds, slideCount: segments.length };
}

/** 秒数を「約m分s秒」表記にする（60秒未満は秒のみ）。 */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.trunc(totalSeconds));
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return m > 0 ? `約${m}分${rest}秒` : `約${s}秒`;
}

/** 台本を収録用 Markdown に整形する。 */
export function formatVideoScript(script: VideoScript, meta: ScriptMeta = {}): string {
  const head = [meta.subject, meta.topic].filter((v): v is string => Boolean(v)).join("・");
  const lines: string[] = [
    `# 解法動画 台本${head ? ` — ${head}` : ""}`,
    "",
    ...(meta.id ? [`- 問題ID: ${meta.id}`] : []),
    `- 推定尺: ${formatDuration(script.totalSeconds)}（スライド${script.slideCount}枚）`,
    "",
    "> 数式・数値はスライド本文からの逐語転記。台本側で言い換えない（読み間違い・数値改変の防止）。",
    "> 「実戦の思考」はそのまま読み上げてよい。画面にも表示されるため、尺が厳しければ省略しても成立する。",
    "",
  ];
  for (const seg of script.segments) {
    lines.push(
      `## ${seg.slideNo}. ${seg.title}（${formatDuration(seg.seconds)}）`,
      "",
      `ナレーション: ${seg.narration}`,
      "",
      `実戦の思考: ${seg.thought}`,
      "",
    );
  }
  return lines.join("\n");
}
