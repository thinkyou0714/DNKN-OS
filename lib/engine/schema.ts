/**
 * problem-schema.json (docs/x-strategy/templates/problem-schema.json) を
 * 実行時検証できる zod ミラー。
 *
 * draft-07 で表現できる不変条件（source citation 必須 / multiple_choice の choices>=2 /
 * status=validated|published のとき検証4項目 true）はここで表現する。
 * draft-07 で表現できない「answer ∈ choices」は validate.ts のカスタム検証で担保する
 * （problem-schema.json の $comment と同じ役割分担）。
 *
 * ## source discriminated union（II-113）
 * `sourceSchema` は `OriginalSource`（citation 任意）と
 * `PastExamSource`（citation 必須）の判別共用体として定義する。
 * 既存の `{ type: "original", citation?: string }` 形式は引き続き受理される。
 * `past_exam_modified` / `past_exam_quoted` の場合は citation が必須となり、
 * 型レベルで不変条件を表現する（既存の superRefine から型定義に昇格）。
 *
 * 後方互換: 既存の有効データ（data/problems 52件・web/problems.json）は
 * すべて受理される（`npm run validate:data` で確認）。
 */
import { z } from "zod";

export const examEnum = z.enum(["denken2_primary", "denken2_secondary", "denken3"]);
export const subjectEnum = z.enum(["理論", "電力", "機械", "法規", "電力管理", "機械制御"]);
export const formatEnum = z.enum(["multiple_choice", "numeric", "descriptive"]);
export const sourceTypeEnum = z.enum(["original", "past_exam_modified", "past_exam_quoted"]);
export const statusEnum = z.enum(["draft", "validated", "published", "retracted"]);

export type Exam = z.infer<typeof examEnum>;
export type Subject = z.infer<typeof subjectEnum>;
export type ProblemFormat = z.infer<typeof formatEnum>;
export type SourceType = z.infer<typeof sourceTypeEnum>;
export type ProblemStatus = z.infer<typeof statusEnum>;

const paramField = z.object({
  value: z.number(),
  unit: z.string().optional(),
  realistic_range: z.tuple([z.number(), z.number()]).optional(),
});

export const validationSchema = z.object({
  solver_checked: z.boolean(),
  human_checked: z.boolean(),
  clean_answer: z.boolean(),
  physically_valid: z.boolean(),
  supervisor_checked: z.boolean().optional(),
  confidence: z.number().min(0).max(1).optional(),
  /**
   * 棄却理由（II-119）。validateProblem / generateOne が問題を棄却したときにセットする任意フィールド。
   * 既存データには存在しないが optional なので後方互換。観測性のために残しておく。
   */
  rejection_reason: z.string().optional(),
});

/**
 * source フィールドの discriminated union（II-113）。
 *
 * - `OriginalSource`: type="original" のとき citation は任意（既定は自動付与）。
 * - `PastExamSource`: type="past_exam_modified"|"past_exam_quoted" のとき citation は必須。
 *
 * union として定義することで型レベルで不変条件を表現する。
 * `z.discriminatedUnion` ではなく `z.union` + 個別スキーマとする理由:
 * discriminatedUnion は exhaustive な枝が必要で、既存の refine 相当の動作（エラー path）を
 * 維持しつつ後方互換にするために union を採用する。
 *
 * 後方互換: 既存の `{ type: "original", citation?: string }` / `{ type: "past_exam_modified", citation: "..." }`
 * 形式は引き続き受理される。
 */
export const originalSourceSchema = z.object({
  type: z.literal("original"),
  citation: z.string().optional(),
});

export const pastExamSourceSchema = z.object({
  type: z.enum(["past_exam_modified", "past_exam_quoted"]),
  // 空白のみ（"   "）は出典なしと同義なので拒否する（round1 の trim 検証を維持。Codex#4 指摘）。
  citation: z
    .string()
    .refine((s) => s.trim().length > 0, { message: "source.type が original 以外のときは citation が必須です" }),
});

export const sourceSchema = z.union([originalSourceSchema, pastExamSourceSchema]);

export type OriginalSource = z.infer<typeof originalSourceSchema>;
export type PastExamSource = z.infer<typeof pastExamSourceSchema>;

export const statsSchema = z.object({
  answered: z.number().int().min(0).optional(),
  correct_rate: z.number().min(0).max(1).optional(),
  common_wrong_choice: z.string().optional(),
});

export const problemSchema = z
  .object({
    id: z.string().min(1),
    exam: examEnum.optional(),
    subject: subjectEnum,
    topic: z.string().min(1),
    format: formatEnum.optional(),
    difficulty: z.number().int().min(1).max(5),
    params: z.record(z.string(), paramField).optional(),
    statement: z.string().min(1),
    figure: z.string().optional(),
    choices: z.array(z.string()).optional(),
    /**
     * 誤答の言語化。「どの典型ミスをするとその選択肢に至るか」を選択肢ごとに持つ。
     * 生成器は以前から出力していたが schema 未定義のため zod が黙って捨てており、
     * アプリ側で型が見えず表示もできなかった（誤答フィードバックの素材が死蔵）。
     */
    distractors: z.array(z.object({ choice: z.string().min(1), reason: z.string().min(1) })).optional(),
    answer: z.string().min(1),
    solution: z.array(z.string()).min(1),
    validation: validationSchema,
    source: sourceSchema,
    stats: statsSchema.optional(),
    status: statusEnum.optional(),
  })
  .superRefine((p, ctx) => {
    // multiple_choice は choices>=2 必須（draft-07 の allOf と同じ）
    if (p.format === "multiple_choice") {
      if (!p.choices || p.choices.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["choices"],
          message: "multiple_choice では choices が 2 件以上必要です",
        });
      }
    }
    // status=validated|published は検証4項目すべて true（draft-07 の allOf と同じ）
    if (p.status === "validated" || p.status === "published") {
      const v = p.validation;
      if (!(v.solver_checked && v.human_checked && v.clean_answer && v.physically_valid)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["validation"],
          message:
            "status=validated|published は solver_checked/human_checked/clean_answer/physically_valid が全て true である必要があります",
        });
      }
    }
  });

export type Problem = z.infer<typeof problemSchema>;
