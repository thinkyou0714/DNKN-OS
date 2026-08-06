/**
 * template-supervision.ts — テンプレート単位の監修（合格者レビュー）管理（純関数）。
 *
 * 背景: 配信中の問題（web/problems.json）は 151 テンプレから約 9,354 問が生成される。
 *   1問ずつ監修するのは非現実的だが、テンプレは式・パラメータレンジ・解説の出どころなので、
 *   **テンプレ1つを監修すれば、そこから出る全問題（平均約62問）がまとめて担保される**。
 *   問題単位の監修（audit/supervision.ts）と補完関係にある。
 *
 * 【この仕組みの核心 — 変更検知】
 *   テンプレはコードなので、監修後に式やレンジを編集すれば監修の前提は崩れる。
 *   「監修済み」フラグだけを持つと、編集後も監修済みを主張し続ける嘘の記録になる。
 *   そこで監修時にテンプレの **振る舞いのフィンガープリント** を記録し、
 *   現在の振る舞いと一致しなくなったものを「要再監修(stale)」として必ず表に出す。
 *
 *   フィンガープリントはソース文字列ではなく「決定論的に生成した問題そのもの」から作る。
 *   コメントや変数名の変更では無効化されず、式・レンジ・解説・選択肢が変われば必ず無効化される
 *   （＝監修者が実際に見たものが変わったときだけ再監修を求める）。
 *
 * 監修の実体は人間（電験合格者）の判断であり、コードは検知と可視化しか行わない。
 * 台帳に監修済みを書き込むのは実行者の責任という点は audit/supervision.ts と同じ。
 *
 * DOM 非依存・状態なし・決定論。
 */
import type { GenerationResult, Template } from "../engine/templates/types.js";
import { hashSeed, seededRng } from "../shared/rng.js";

/** フィンガープリントに使う生成サンプル数（多いほど変更検知が鋭いが計算は重くなる）。 */
export const FINGERPRINT_SAMPLES = 8;
/** サンプル収集の最大試行回数（generate は不成立の draw で null を返すため）。 */
const FINGERPRINT_MAX_ATTEMPTS = FINGERPRINT_SAMPLES * 40;

/**
 * 生成結果から「監修者が実際に目にする内容」だけを安定した文字列に落とす。
 * ここに含めた要素が変われば監修は無効化される（＝再監修が必要になる）。
 */
function resultSignature(r: GenerationResult): string {
  // params はキー順を固定して並べる（オブジェクトの列挙順に依存しないため）。
  const params = Object.keys(r.params)
    .sort()
    .map((k) => {
      const v = r.params[k];
      return `${k}=${v?.value ?? ""}${v?.unit ?? ""}`;
    })
    .join(",");
  return [
    r.format ?? "multiple_choice",
    r.answerText,
    r.answerUnit,
    (r.choices ?? []).join("|"),
    r.defaultStatement,
    r.defaultSolution.join("␟"),
    params,
    String(r.physicallyValid),
  ].join("␞");
}

/**
 * テンプレのメタ情報の署名（監修対象に含まれる宣言的な情報）。
 * パラメータの現実的レンジは監修の主要な確認事項なので必ず含める。
 */
function metaSignature(t: Template): string {
  const specs = Object.keys(t.paramSpecs)
    .sort()
    .map((k) => {
      const s = t.paramSpecs[k];
      const range = s?.realistic_range ?? [];
      return `${k}:${range.join("~")}:${s?.unit ?? ""}:${s?.required === false ? "opt" : "req"}`;
    })
    .join(",");
  const pastExam = t.pastExam ? `${t.pastExam.area}/${t.pastExam.frequency}` : "";
  return [t.topic, t.subject, t.exam, String(t.difficulty), specs, pastExam].join("␞");
}

/**
 * 変更検知用の安定ハッシュ（FNV-1a を2種のオフセットで回して 64bit 相当の16進にする）。
 *
 * 暗号学的強度は不要（敵対的な衝突を防ぐ用途ではなく、編集の検知が目的）。
 * 依存を増やさず lib をブラウザ非依存に保つため node:crypto は使わない。
 */
export function stableHash(text: string): string {
  let a = 2166136261;
  let b = 2166136261 ^ 0x9e3779b9;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    a ^= c;
    a = Math.imul(a, 16777619);
    // b は逆方向の重み付けで独立性を持たせる（同じ入力の別ビュー）。
    b ^= c + i;
    b = Math.imul(b, 2246822519);
  }
  const hex = (n: number): string => (n >>> 0).toString(16).padStart(8, "0");
  return `${hex(a)}${hex(b)}`;
}

/**
 * テンプレの「振る舞い」のフィンガープリントを計算する（決定論）。
 *
 * seed は build-problems.ts と同じ `hashSeed(topic)` を使い、実際に出荷される問題と
 * 同じ数列でサンプリングする。生成に失敗し続けるテンプレ（全 draw が null）でも
 * メタ情報だけで安定した値を返し、例外は投げない。
 */
export function templateFingerprint(template: Template, samples: number = FINGERPRINT_SAMPLES): string {
  const rng = seededRng(hashSeed(template.topic));
  const signatures: string[] = [];
  for (let i = 0; i < FINGERPRINT_MAX_ATTEMPTS && signatures.length < samples; i++) {
    let r: GenerationResult | null = null;
    try {
      r = template.generate(rng);
    } catch {
      // 生成中の例外はテンプレの欠陥だが、ここでは指紋計算を止めない
      // （欠陥そのものは template-invariants テストと監修者が拾う）。
      r = null;
    }
    if (r) signatures.push(resultSignature(r));
  }
  return stableHash([metaSignature(template), ...signatures].join("␝"));
}

/** 監修台帳の1件（人間が監修したという記録）。 */
export interface TemplateSupervisionEntry {
  /** テンプレの topic（レジストリのキー）。 */
  topic: string;
  /** 監修時点のフィンガープリント。現在値と異なれば要再監修。 */
  fingerprint: string;
  /** 監修者の名前・ハンドル（誰の判断かを残す）。 */
  supervisor: string;
  /** 監修日（ISO 8601 の日付部分）。 */
  at: string;
  /** 任意のコメント（条件付き合格の但し書きなど）。 */
  note?: string;
}

/** 監修台帳（data/supervision/templates.json）。 */
export interface TemplateSupervisionLedger {
  version: number;
  entries: TemplateSupervisionEntry[];
}

/** 台帳のフォーマットバージョン。 */
export const LEDGER_VERSION = 1;

/** 空の台帳。 */
export function emptyLedger(): TemplateSupervisionLedger {
  return { version: LEDGER_VERSION, entries: [] };
}

/**
 * 台帳 JSON を寛容に読む（壊れていても空台帳として扱い、例外を投げない）。
 * 必須フィールドが欠けた項目は黙って落とす（監修の主張として不完全なため）。
 */
export function parseLedger(jsonText: string): TemplateSupervisionLedger {
  let data: unknown;
  try {
    data = JSON.parse(jsonText);
  } catch {
    return emptyLedger();
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) return emptyLedger();
  const raw = (data as { entries?: unknown }).entries;
  if (!Array.isArray(raw)) return emptyLedger();
  const entries: TemplateSupervisionEntry[] = [];
  for (const e of raw) {
    if (typeof e !== "object" || e === null) continue;
    const o = e as Record<string, unknown>;
    if (
      typeof o.topic !== "string" ||
      typeof o.fingerprint !== "string" ||
      typeof o.supervisor !== "string" ||
      typeof o.at !== "string"
    ) {
      continue;
    }
    entries.push({
      topic: o.topic,
      fingerprint: o.fingerprint,
      supervisor: o.supervisor,
      at: o.at,
      ...(typeof o.note === "string" ? { note: o.note } : {}),
    });
  }
  return { version: LEDGER_VERSION, entries };
}

/** 台帳を topic → 項目の索引にする（重複 topic は後勝ち＝最新の記録を採用）。 */
export function ledgerIndex(ledger: TemplateSupervisionLedger): Map<string, TemplateSupervisionEntry> {
  const m = new Map<string, TemplateSupervisionEntry>();
  for (const e of ledger.entries) m.set(e.topic, e);
  return m;
}

/**
 * 台帳へ1件を追加/更新した新しい台帳を返す（純関数・元の台帳は変更しない）。
 * 並びは topic の辞書順で安定させる（差分レビューしやすくするため）。
 */
export function upsertLedgerEntry(
  ledger: TemplateSupervisionLedger,
  entry: TemplateSupervisionEntry,
): TemplateSupervisionLedger {
  const others = ledger.entries.filter((e) => e.topic !== entry.topic);
  const entries = [...others, entry].sort((a, b) => a.topic.localeCompare(b.topic, "ja"));
  return { version: LEDGER_VERSION, entries };
}

/** テンプレ監修の状態。 */
export type TemplateSupervisionStage =
  /** 監修済みで、監修後にテンプレの振る舞いが変わっていない。 */
  | "supervised"
  /** 監修記録はあるが、テンプレが変更されて前提が崩れている（要再監修）。 */
  | "stale"
  /** 未監修。 */
  | "unsupervised";

/**
 * 現在のフィンガープリントと台帳を突き合わせて状態を判定する。
 * 台帳に記録が無ければ未監修、あってもフィンガープリントが違えば要再監修。
 */
export function templateSupervisionStage(
  currentFingerprint: string,
  entry: TemplateSupervisionEntry | undefined,
): TemplateSupervisionStage {
  if (!entry) return "unsupervised";
  return entry.fingerprint === currentFingerprint ? "supervised" : "stale";
}

/** レポート1行ぶん（テンプレ1つ）。 */
export interface TemplateReviewItem {
  topic: string;
  subject: string;
  exam: string;
  difficulty: number;
  stage: TemplateSupervisionStage;
  /** 現在のフィンガープリント。 */
  fingerprint: string;
  /** そのテンプレから生成されている問題数（分かる場合。監修のレバレッジ）。 */
  problemCount: number;
  /** 監修済み/要再監修のときの台帳記録。 */
  entry?: TemplateSupervisionEntry;
}

/** 科目ごとの集計。 */
export interface TemplateSubjectCoverage {
  subject: string;
  total: number;
  supervised: number;
  stale: number;
  unsupervised: number;
  /** 監修済みテンプレが担保している問題数。 */
  problemsSupervised: number;
  /** その科目のテンプレが生成する問題数の合計。 */
  problemsTotal: number;
}

/** テンプレ監修カバレッジのレポート。 */
export interface TemplateSupervisionReport {
  total: number;
  supervised: number;
  stale: number;
  unsupervised: number;
  /** 監修カバレッジ率（テンプレ数ベース）。 */
  coverage: number;
  /** 監修済みテンプレが担保している問題数。 */
  problemsSupervised: number;
  /** 全テンプレが生成する問題数の合計（分かる範囲）。 */
  problemsTotal: number;
  /** 問題数ベースのカバレッジ率（テンプレ監修の実効的な効果）。 */
  problemCoverage: number;
  bySubject: TemplateSubjectCoverage[];
  /**
   * 監修待ちキュー。
   * 並びは「要再監修が先 → 担保できる問題数の多い順 → topic 順」。
   * 要再監修を先頭に出すのは、一度監修した前提が崩れている＝嘘の記録が残っている状態であり、
   * 未監修より危険度が高いため。次点を問題数順にするのは、1件あたりのレバレッジが最大になる順。
   */
  queue: TemplateReviewItem[];
  /**
   * 台帳にあるが現在のレジストリに存在しない topic（辞書順）。
   *
   * テンプレの改名・削除で発生する。放置すると「監修済みのはずの論点が実在しない」まま
   * 気づかれず、カバレッジの分母がずれる。台帳から削除するか、topic を直す必要がある。
   */
  orphans: string[];
}

/** レポート生成の入力（テンプレ本体と、生成問題数の実測値）。 */
export interface TemplateSupervisionInput {
  templates: readonly Template[];
  ledger: TemplateSupervisionLedger;
  /** topic → 生成されている問題数（web/problems.json の実測。未知の topic は0扱い）。 */
  problemCountByTopic?: ReadonlyMap<string, number>;
}

/** テンプレ監修カバレッジのレポートを作る（純関数・決定論）。 */
export function templateSupervisionReport(input: TemplateSupervisionInput): TemplateSupervisionReport {
  const index = ledgerIndex(input.ledger);
  const counts = input.problemCountByTopic;
  const items: TemplateReviewItem[] = input.templates.map((t) => {
    const fingerprint = templateFingerprint(t);
    const entry = index.get(t.topic);
    const stage = templateSupervisionStage(fingerprint, entry);
    return {
      topic: t.topic,
      subject: t.subject,
      exam: t.exam,
      difficulty: t.difficulty,
      stage,
      fingerprint,
      problemCount: counts?.get(t.topic) ?? 0,
      ...(entry ? { entry } : {}),
    };
  });

  let supervised = 0;
  let stale = 0;
  let unsupervised = 0;
  let problemsSupervised = 0;
  let problemsTotal = 0;
  const bySubjectMap = new Map<string, TemplateSubjectCoverage>();
  for (const it of items) {
    if (it.stage === "supervised") supervised++;
    else if (it.stage === "stale") stale++;
    else unsupervised++;
    problemsTotal += it.problemCount;
    if (it.stage === "supervised") problemsSupervised += it.problemCount;

    const s = bySubjectMap.get(it.subject) ?? {
      subject: it.subject,
      total: 0,
      supervised: 0,
      stale: 0,
      unsupervised: 0,
      problemsSupervised: 0,
      problemsTotal: 0,
    };
    s.total++;
    if (it.stage === "supervised") {
      s.supervised++;
      s.problemsSupervised += it.problemCount;
    } else if (it.stage === "stale") s.stale++;
    else s.unsupervised++;
    s.problemsTotal += it.problemCount;
    bySubjectMap.set(it.subject, s);
  }

  const queue = items
    .filter((it) => it.stage !== "supervised")
    .sort((a, b) => {
      // 要再監修（嘘の記録が残っている状態）を最優先。
      if (a.stage !== b.stage) return a.stage === "stale" ? -1 : 1;
      // 次に、1件監修したときに担保できる問題数が多い順（レバレッジ最大化）。
      if (a.problemCount !== b.problemCount) return b.problemCount - a.problemCount;
      return a.topic.localeCompare(b.topic, "ja");
    });

  // 台帳にあるが実在しない topic（テンプレの改名・削除で取り残された記録）。
  const known = new Set(input.templates.map((t) => t.topic));
  const orphans = input.ledger.entries
    .map((e) => e.topic)
    .filter((topic) => !known.has(topic))
    .sort((a, b) => a.localeCompare(b, "ja"));

  const total = items.length;
  return {
    total,
    supervised,
    stale,
    unsupervised,
    coverage: total > 0 ? supervised / total : 0,
    problemsSupervised,
    problemsTotal,
    problemCoverage: problemsTotal > 0 ? problemsSupervised / problemsTotal : 0,
    bySubject: [...bySubjectMap.values()].sort((a, b) => a.subject.localeCompare(b.subject, "ja")),
    queue,
    orphans,
  };
}

/** レポートを人間可読なテキストへ整形する。 */
export function formatTemplateSupervisionReport(r: TemplateSupervisionReport, queueLimit = 10): string {
  const pct = (r.coverage * 100).toFixed(1);
  const ppct = (r.problemCoverage * 100).toFixed(1);
  const lines = [
    "DENKEN-OS テンプレ監修カバレッジ",
    `- テンプレ監修: ${r.supervised}/${r.total}（${pct}%）`,
    `- 要再監修（監修後にテンプレが変更された）: ${r.stale}`,
    `- 未監修: ${r.unsupervised}`,
    `- 監修が担保する問題数: ${r.problemsSupervised}/${r.problemsTotal} 問（${ppct}%）`,
    "科目別:",
  ];
  for (const s of r.bySubject) {
    lines.push(
      `- ${s.subject}: 監修 ${s.supervised}/${s.total}・要再監修 ${s.stale}・未監修 ${s.unsupervised}` +
        `（担保 ${s.problemsSupervised}/${s.problemsTotal} 問）`,
    );
  }
  if (r.stale > 0) {
    lines.push(
      `⚠️ 要再監修が ${r.stale} 件あります。監修後にテンプレが変更されており、以前の監修は前提が崩れています。`,
    );
  }
  if (r.orphans.length > 0) {
    lines.push(
      `⚠️ 台帳に実在しない topic が ${r.orphans.length} 件あります（テンプレの改名・削除）: ${r.orphans.join("・")}`,
    );
  }
  if (r.queue.length > 0) {
    lines.push(`監修待ちキュー（${r.queue.length}件・レバレッジ順・先頭最大${queueLimit}件）:`);
    for (const q of r.queue.slice(0, queueLimit)) {
      const mark = q.stage === "stale" ? "🔁要再監修" : "未監修";
      lines.push(`- [${q.subject}] ${q.topic} ★${q.difficulty} ${mark}（${q.problemCount}問を担保）`);
    }
    if (r.queue.length > queueLimit) {
      lines.push(`- … ほか ${r.queue.length - queueLimit} 件（packet で全件出力）`);
    }
  } else {
    lines.push("監修待ちキュー: なし（全テンプレ監修済み）");
  }
  return lines.join("\n");
}
