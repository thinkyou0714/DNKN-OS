/**
 * curriculum/solution-slides.ts — 解法スライド（解く流れの1枚ずつ再生）の純ロジック。
 *
 * 目的: 解説を「読む」のではなく、実際に解くときの思考の流れとして「再生」させる。
 *   模範解答（Problem.solution）を 1ステップ=1スライド に分割し、先頭に「問題を読む」、
 *   末尾に「答えと検算」を足した紙芝居（スライドデッキ）を組む。各スライドには
 *   ルーブリック役割（着眼/公式/代入/計算/結論/補足）と、その場面で頭の中で行うことを
 *   言語化した「実戦の思考」ガイドを付ける。
 *
 * 方針:
 *   - 問題データのスキーマは変更しない。既存の solution 配列と rubric.ts の役割分類だけから
 *     決定論的に組み立てる（既存の全問題にそのまま効く。生成物はコードから導く方針に合わせる）。
 *   - スライドは表示専用の派生データであり、ここでは整形（formatMath 等）を行わない。
 *     本文は生テキストで持ち、描画側が整形する（将来のスライド書き出し・動画台本化にも使える形）。
 *
 * DOM 非依存・状態なし・決定論。
 */
import { buildRubric, type RubricRole } from "./rubric.js";

/** スライドの種類。cover=問題を読む / step=解答ステップ / answer=答えと検算。 */
export type SlideKind = "cover" | "step" | "answer";

/** 解法スライドの1枚。 */
export interface SolutionSlide {
  kind: SlideKind;
  /** スライド見出し（"問題" / "STEP n" / "答え"）。役割の表示名は role から引く。 */
  title: string;
  /** 本文（整形前の生テキスト。描画側で formatMath 等を適用する）。 */
  body: string;
  /** 実戦の思考ガイド（この場面で頭の中で行うことの言語化）。 */
  thought: string;
  /** step スライドのみ: ルーブリック役割（バッジ・配点の重みに対応）。 */
  role?: RubricRole;
  /** step スライドのみ: 元 solution 配列内の index。 */
  stepIndex?: number;
}

/** 解法スライドのデッキ（cover + steps + answer）。 */
export interface SolutionSlideDeck {
  slides: SolutionSlide[];
  /** step スライドの枚数（cover/answer を除く）。 */
  stepCount: number;
}

/** スライド化に必要な問題の最小形（Problem の構造的サブセット）。 */
export interface SlideSource {
  statement: string;
  answer: string;
  solution: readonly string[];
}

/** 先頭スライド（問題を読む）の実戦の思考。 */
export const COVER_THOUGHT =
  "最初の30秒: 問われている量と、与えられた値・単位に印を付ける。まだ計算しない（先に出題の型を見抜く）。";

/** 末尾スライド（答え）の実戦の思考。 */
export const ANSWER_THOUGHT =
  "締めの検算: 桁・単位・符号が現実的かを確かめる。本番ではここに1分使うと取りこぼしが消える。";

/**
 * 役割ごとの実戦の思考ガイド。
 * 「解説の各行を読むとき」ではなく「本番で自分がその行を書くとき」に何を考えるかを言語化する
 * （試験を実際に解く中でしか見えない思考の流れを、教材として再現するための文言）。
 */
export const THOUGHT_BY_ROLE: Readonly<Record<RubricRole, string>> = {
  approach: "解法の分岐点。どの原理・等価回路で解くかをここで決める。迷ったら問題文の条件へ戻る。",
  formula: "使う公式を先に書き切る。本番では式が書けた時点で部分点が入る（数値より先に式）。",
  substitution: "単位を揃えてから代入する。k/M・min/s・%の換算ミスはこの瞬間に起きる。",
  calculation: "計算を進める。丸めは最後の1回だけ（途中で丸めると有効数字がずれる）。",
  conclusion: "最終値に単位を付けて答える。配点が最も重い行。単位落としは本番の典型減点。",
  note: "補足（採点対象外）。次に似た問題が出たときの引き出しとして持ち帰る。",
};

/**
 * 問題から解法スライドのデッキを組む。
 * ステップの役割分類は rubric.ts（buildRubric）と同一なので、採点ルーブリックの
 * バッジ表示と必ず一致する（同じ問題で役割の食い違いが起きない）。
 */
export function buildSolutionSlides(p: SlideSource): SolutionSlideDeck {
  const rubric = buildRubric(p.solution);
  const steps: SolutionSlide[] = rubric.map((item, i) => ({
    kind: "step",
    title: `STEP ${i + 1}`,
    body: item.text,
    thought: THOUGHT_BY_ROLE[item.role],
    role: item.role,
    stepIndex: item.index,
  }));
  const slides: SolutionSlide[] = [
    { kind: "cover", title: "問題", body: p.statement, thought: COVER_THOUGHT },
    ...steps,
    { kind: "answer", title: "答え", body: p.answer, thought: ANSWER_THOUGHT },
  ];
  return { slides, stepCount: steps.length };
}

/**
 * スライド index を [0, slideCount-1] に丸める（矢印キー連打・不正値に安全）。
 * slideCount<=0 や非有限値は 0 を返す。
 */
export function clampSlideIndex(index: number, slideCount: number): number {
  if (slideCount <= 0 || !Number.isFinite(index)) return 0;
  return Math.min(Math.max(Math.trunc(index), 0), slideCount - 1);
}

/**
 * 自動再生のペース（1枚あたりの表示ミリ秒）。動画のように流す「再生モード」の速さの語彙。
 * 表示時間は「読む＋実戦の思考を追う」時間なので、短すぎる選択肢は置かない。
 */
export const AUTOPLAY_PACES = [
  { key: "slow", label: "ゆっくり", ms: 12_000 },
  { key: "normal", label: "ふつう", ms: 8_000 },
  { key: "fast", label: "はやい", ms: 5_000 },
] as const;

/** 自動再生ペースの1項目。 */
export type AutoplayPace = (typeof AUTOPLAY_PACES)[number];

/**
 * 自動再生での次のスライド index。最後のスライドに達していたら null（自動では閉じない。
 * 学習者の意図しないタイミングでモーダルが消えるのを避け、停止して答えの画面で待つ）。
 */
export function nextAutoplayIndex(current: number, slideCount: number): number | null {
  const cur = clampSlideIndex(current, slideCount);
  return cur >= slideCount - 1 ? null : cur + 1;
}
