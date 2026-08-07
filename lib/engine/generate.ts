/**
 * generate.ts — 生成パイプライン（03-quality-pipeline の5ステップをコード化）。
 *
 * [1] 生成      テンプレートで params を振り、コードで正解を算出
 * [2] 数値検査  綺麗な値・一意・現実的か（テンプレートが draw を棄却）
 * [3] 自動検算  正解は純関数算出 ⇒ solver_checked=true
 * [4] 整合確認  narrate の解説の最終数値がコード正解と一致するか（不一致は破棄）
 * [5] 出典付与  original 主軸 / 改題は citation 必須
 *
 * ## 観測性強化（II-118/II-119/II-121）
 * - `generateOne` は `GenerateOneResult`（`{problem, attemptsUsed}`）を返す別関数
 *   `generateOneDetailed` も提供（後方互換: `generateOne` は既存通り `Problem | null` を返す）。
 * - `generate` は `onYield` オプションのロガーで累積棄却率を出力できる。
 * - `validatePhysics` で draw.physicallyValid とvalidation の一致を確認（II-114）。
 * - `checkParamsConsistency` で GenerationResult.params → Problem.params の整合確認（II-121）。
 */
import { buildAutoMc, shouldAutoConvert } from "./auto-distractors.js";
import { defaultNarrator, type Narrator, toNarrationInput } from "./narrate.js";
import type { Exam, Problem, SourceType } from "./schema.js";
import type { GenerationResult, Template } from "./templates/types.js";
import { narrationMatchesAnswer, statementMatchesParams, validateProblem } from "./validate.js";

/**
 * 自動生成問題に付与するデフォルト信頼度。
 *
 * 0.9 に設定した根拠:
 *  - [3] solver_checked=true: 純関数によるコードで正解を算出しているため数値精度は高い。
 *  - しかし human_checked=false の段階では問題文・解法の自然さ・物理的妥当性の
 *    人間的チェックが未了のため 1.0 にはしない。
 *  - minConfidence（generate オプション）との関係: デフォルト minConfidence は 0=無効。
 *    明示的に閾値を設けた場合（例: 0.95）は、この 0.9 では足切りされる。
 *    人間チェック済み問題（human_checked=true）では confidence=1.0 へ更新することを想定。
 */
const DEFAULT_CONFIDENCE = 0.9;

export interface GenerateOptions {
  count: number;
  source?: SourceType;
  citation?: string;
  narrator?: Narrator;
  rng?: () => number;
  /** 1問あたりの draw 再試行上限（汚い値の振り直し）。 */
  maxAttemptsPerProblem?: number;
  idPrefix?: string;
  startIndex?: number;
  /** confidence の足切り（これ未満は出題しない。既定0=無効）。 */
  minConfidence?: number;
  /**
   * emit する問題の exam をテンプレの宣言値から上書きする。
   * 法規のようにテンプレ内容が複数試験区分で共通の場合に、テンプレを複製・改変せず
   * 別区分（例: denken3）の問題として出題するための seam。未指定なら template.exam。
   */
  examOverride?: Exam;
  /**
   * 数値テンプレートを五肢択一へ自動変換するか（既定 false = 従来どおり numeric のまま）。
   * 一次試験は全問マークシートなので、本試形式で出したいときに true にする。
   */
  autoMc?: boolean;
  /**
   * 歩留まりロガー（II-118）。問題を1件採用するたびに呼ばれる。
   * `accepted` は採用済み件数、`rejected` は棄却累積件数、`total` は試行合計。
   * 棄却率は `rejected / total` で計算できる。既定は no-op。
   */
  onYield?: (stats: { accepted: number; rejected: number; total: number }) => void;
}

/**
 * generateOne の詳細結果（II-118）。
 * 後方互換のため generateOne は `Problem | null` のまま保持し、
 * 詳細が必要な場合は `generateOneDetailed` を使う。
 */
export interface GenerateOneResult {
  problem: Problem | null;
  /** draw 試行回数（1問あたりの physicallyValid/clean の成功まで何回掛かったか）。 */
  attemptsUsed: number;
  /** 棄却理由（問題生成に失敗した場合）。 */
  rejectionReason?: string;
}

/**
 * validatePhysics（II-114）: テンプレートの physicallyValid フラグと
 * Problem.validation.physically_valid の一致を確認する。
 *
 * generate パイプラインでは draw.physicallyValid=true の draw のみ通過する設計だが、
 * テンプレート実装のバグ（例: physicallyValid のセット漏れ）を検出するための二重チェック。
 * 不一致は問題を破棄し、理由を返す（null = 整合している）。
 */
export function validatePhysics(draw: GenerationResult, problemPhysicallyValid: boolean): string | null {
  if (draw.physicallyValid !== problemPhysicallyValid) {
    return (
      `physicallyValid 不一致: draw.physicallyValid=${draw.physicallyValid}, ` +
      `problem.validation.physically_valid=${problemPhysicallyValid}`
    );
  }
  return null;
}

/**
 * params 逆写像バリデータ（II-121）。
 *
 * GenerationResult.params と Problem.params の整合を確認するヘルパー。
 * テンプレートの実装が Problem.params に正しく転写されているかを検証する。
 *
 * 確認内容:
 * - draw.params の各キーが problem.params に存在すること
 * - 値（value）が一致すること
 *
 * 戻り値: 不整合のリスト（空 = 整合）。
 */
export function checkParamsConsistency(draw: GenerationResult, problemParams: Problem["params"]): string[] {
  if (!problemParams) {
    if (Object.keys(draw.params).length === 0) return [];
    return ["draw.params にキーがあるが problem.params が undefined"];
  }
  const issues: string[] = [];
  for (const [key, spec] of Object.entries(draw.params)) {
    if (!(key in problemParams)) {
      issues.push(`draw.params["${key}"] が problem.params に存在しない`);
      continue;
    }
    const pVal = problemParams[key];
    if (pVal === undefined) continue; // key in check の後だが noUncheckedIndexedAccess ガード
    if (pVal.value !== spec.value) {
      issues.push(`draw.params["${key}"].value=${spec.value} だが problem.params["${key}"].value=${pVal.value}`);
    }
  }
  return issues;
}

function makeId(prefix: string, n: number): string {
  return `${prefix}-${String(n).padStart(4, "0")}`;
}

/**
 * テンプレートから1問を生成して Problem を組み立てる。
 * 汚い draw・narrate 数値不整合は null を返す（呼び出し側で再試行/スキップ）。
 *
 * 後方互換: 既存シグネチャを維持。詳細結果（attemptsUsed 等）は `generateOneDetailed` を使う。
 */
export async function generateOne(
  template: Template,
  opts: {
    id: string;
    source: SourceType;
    citation?: string;
    narrator: Narrator;
    rng: () => number;
    maxAttempts: number;
    minConfidence?: number;
    examOverride?: Exam;
    autoMc?: boolean;
  },
): Promise<Problem | null> {
  const detailed = await generateOneDetailed(template, opts);
  return detailed.problem;
}

/**
 * テンプレートから1問を生成し、詳細結果（attemptsUsed 含む）を返す（II-118）。
 *
 * `attemptsUsed` は draw 試行回数（physicallyValid/clean な draw が得られるまでの試行数）。
 * 全試行失敗なら `attemptsUsed === opts.maxAttempts`、`problem === null`。
 */
export async function generateOneDetailed(
  template: Template,
  opts: {
    id: string;
    source: SourceType;
    citation?: string;
    narrator: Narrator;
    rng: () => number;
    maxAttempts: number;
    minConfidence?: number;
    examOverride?: Exam;
    autoMc?: boolean;
  },
): Promise<GenerateOneResult> {
  let draw = null as ReturnType<Template["generate"]>;
  let attemptsUsed = 0;
  for (let i = 0; i < opts.maxAttempts; i++) {
    attemptsUsed = i + 1;
    draw = template.generate(opts.rng);
    if (draw) break;
  }
  if (!draw) return { problem: null, attemptsUsed, rejectionReason: "draw_failed: clean draw 取得失敗" };

  const narration = await opts.narrator.narrate(toNarrationInput(draw, template.topic, template.subject));

  // [4a] 問題文の整合確認（engine#1）: LLM リライトがパラメータ値を改変した場合は
  //   内部矛盾（問題文 vs 正解）を避けるため、決定論の defaultStatement にフォールバックする。
  //   StubNarrator は statement=defaultStatement のため通常はそのまま採用される。
  const paramValues = Object.values(draw.params).map((p) => p.value);
  const statement = statementMatchesParams(narration.statement, paramValues)
    ? narration.statement
    : draw.defaultStatement;

  // [4b] 整合確認: 解説の最終数値がコード正解と一致しなければ破棄。
  if (!narrationMatchesAnswer(narration.solution, draw.answerText)) {
    return {
      problem: null,
      attemptsUsed,
      rejectionReason: "narration_mismatch: 解説の最終数値がコード正解と不一致",
    };
  }

  const citation = opts.source === "original" ? "DENKEN-OS オリジナル問題" : opts.citation;
  if (opts.source !== "original" && !citation) {
    return {
      problem: null,
      attemptsUsed,
      rejectionReason: "citation_missing: 改題には citation が必須",
    };
  }

  const confidence = DEFAULT_CONFIDENCE;
  // confidence 足切り（怪しいものは出さない閾値, 03-quality-pipeline）。
  if (opts.minConfidence !== undefined && confidence < opts.minConfidence) {
    return {
      problem: null,
      attemptsUsed,
      rejectionReason: `confidence_too_low: confidence=${confidence} < minConfidence=${opts.minConfidence}`,
    };
  }

  let format = draw.format ?? "multiple_choice";
  let autoChoices = draw.choices;
  let autoDistractors = draw.distractors;

  // 数値解答テンプレートを本試同様の五肢択一へ自動変換する（autoMc）。
  // 一次試験は全問マークシートなので、numeric のままでは本番形式にならない。
  // テンプレートが自前の誤答を持つ場合はそちらが分野固有で質が高いので触らない。
  if (
    opts.autoMc &&
    format === "numeric" &&
    (!draw.distractors || draw.distractors.length === 0) &&
    shouldAutoConvert(draw.answerValue, draw.answerText)
  ) {
    const mc = buildAutoMc(draw.answerValue, draw.answerText, draw.answerUnit);
    if (mc) {
      format = "multiple_choice";
      autoChoices = mc.choices;
      autoDistractors = mc.distractors;
    }
  }

  const problem: Problem = {
    id: opts.id,
    exam: opts.examOverride ?? template.exam,
    subject: template.subject,
    topic: template.topic,
    format,
    difficulty: template.difficulty,
    params: draw.params,
    statement,
    ...(draw.figure ? { figure: draw.figure } : {}),
    // numeric は選択肢なし。multiple_choice のみ choices を持つ。
    ...(format === "multiple_choice" ? { choices: autoChoices } : {}),
    // 誤答の言語化（どの典型ミスでその選択肢に至るか）。テンプレが算出済みなら載せる。
    // スキーマ・validate は以前から distractors を受け付けるが、従来ここで捨てていた。
    ...(format === "multiple_choice" && autoDistractors && autoDistractors.length > 0
      ? { distractors: autoDistractors.map((d) => ({ choice: d.text, reason: d.reason })) }
      : {}),
    answer: draw.answerText,
    solution: narration.solution,
    validation: {
      solver_checked: true, // [3] 純関数で算出した正解
      human_checked: false, // 自動生成段階では未了（人間の承認ゲート）
      clean_answer: true, // [2] テンプレートが綺麗な draw だけ通す
      physically_valid: draw.physicallyValid,
      confidence,
    },
    // discriminated union: original は citation 任意、past_exam_* は citation 必須（II-113）。
    // citation は上の guard で past_exam_* のとき string であることを確認済み。
    source:
      opts.source === "original"
        ? { type: "original" as const, citation: citation ?? undefined }
        : { type: opts.source, citation: citation as string },
    stats: { answered: 0, correct_rate: 0, common_wrong_choice: draw.likelyWrongChoice },
    status: "draft", // human_checked=false のため validated にはできない
  };

  // [II-114] physicallyValid 一致確認: draw と problem.validation の不一致は破棄。
  const physicsIssue = validatePhysics(draw, problem.validation.physically_valid);
  if (physicsIssue) {
    return { problem: null, attemptsUsed, rejectionReason: physicsIssue };
  }

  // [II-121] params 整合確認: draw.params と problem.params の転写整合。
  const paramsIssues = checkParamsConsistency(draw, problem.params);
  if (paramsIssues.length > 0) {
    return { problem: null, attemptsUsed, rejectionReason: `params_mismatch: ${paramsIssues.join("; ")}` };
  }

  // 仕上げに構造+不変条件を検証（answer∈choices 等）。落ちたら破棄。
  const result = validateProblem(problem);
  if (!result.ok) {
    return {
      problem: null,
      attemptsUsed,
      rejectionReason: `validate_failed: ${result.issues.map((i) => i.message).join("; ")}`,
    };
  }
  return { problem, attemptsUsed };
}

/**
 * count 件を生成する。汚い draw 等で歩留まりが落ちても可能な限り埋める。
 *
 * `onYield` オプションで累積棄却率をリアルタイムに観測できる（II-118）。
 */
export async function generate(template: Template, opts: GenerateOptions): Promise<Problem[]> {
  const narrator = opts.narrator ?? defaultNarrator();
  const rng = opts.rng ?? Math.random;
  const source = opts.source ?? "original";
  const maxAttempts = opts.maxAttemptsPerProblem ?? 50;
  const idPrefix = opts.idPrefix ?? "G";
  const start = opts.startIndex ?? 1;

  const out: Problem[] = [];
  let n = start;
  let rejected = 0;
  // 全体としても上限を設け、無限ループを防ぐ。
  const globalCap = opts.count * maxAttempts;
  for (let tries = 0; out.length < opts.count && tries < globalCap; tries++) {
    const p = await generateOne(template, {
      id: makeId(idPrefix, n),
      source,
      ...(opts.citation !== undefined && { citation: opts.citation }),
      narrator,
      rng,
      maxAttempts,
      ...(opts.minConfidence !== undefined && { minConfidence: opts.minConfidence }),
      ...(opts.examOverride !== undefined && { examOverride: opts.examOverride }),
      ...(opts.autoMc !== undefined && { autoMc: opts.autoMc }),
    });
    if (p) {
      out.push(p);
      n++;
      opts.onYield?.({ accepted: out.length, rejected, total: tries + 1 });
    } else {
      rejected++;
    }
  }
  return out;
}
