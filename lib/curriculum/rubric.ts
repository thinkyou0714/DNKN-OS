/**
 * curriculum/rubric.ts — 二次記述の採点ルーブリック（配点重み・必須キーワード）の純ロジック。
 *
 * 目的: 二次（記述）は「途中点をどれだけ拾えるか」で合否が決まる。旧実装は模範解答の
 *   ステップ数を等重みで数えていたため、次の2つの歪みがあった。
 *     1. 「ポイント:」「（補足: …）」のような採点対象外の行まで1点として数えていた。
 *        本番なら満点の答案でも 3/4 にしかならず、部分点の感覚が実際とずれる。
 *     2. 方針・公式・代入・最終値をすべて同じ重みで数えていた。実際の採点は
 *        「最終値と単位」が最も重く、方針は軽い。
 *   ステップの役割を決定論的に分類して重みを付け、さらに各ステップの必須キーワード
 *   （数値・単位・量記号）を抽出して、書いた答案との照合を自己採点の補助にする。
 *
 * 方針:
 *   - 分類は模範解答の文面だけから行う（問題データのスキーマは変更しない＝既存 9354 問に
 *     そのまま効く。リポジトリの「生成物はコードから決定論的に導く」方針に合わせる）。
 *   - 公式(formula)と代入(substitution)は同じ重み 2 にしてある。両者の判別は文面依存で
 *     揺れうるが、重みが同じなので分類が揺れても点数は変わらない（安全側の設計）。
 *   - キーワード照合はあくまで「チェック候補の提案」。最終的な自己採点は学習者が決める
 *     （文章の正しさは機械には判定できないため、断定しない）。
 *
 * DOM 非依存・状態なし・決定論。
 */
import type { Rating } from "../scheduler/types.js";

/** 模範解答ステップの役割。 */
export type RubricRole = "approach" | "formula" | "substitution" | "calculation" | "conclusion" | "note";

/**
 * 役割ごとの配点重み。
 *
 * 二次の採点実務に合わせ「方針 < 過程 < 最終値＋単位」の順に重くする。
 * note（補足・ポイント）は採点対象外なので 0 — ここが旧実装との最大の違いで、
 * 満点の答案が満点になるようにするための修正。
 */
export const ROLE_WEIGHTS: Readonly<Record<RubricRole, number>> = {
  approach: 1,
  formula: 2,
  substitution: 2,
  calculation: 2,
  conclusion: 3,
  note: 0,
};

/** 役割の表示名（UI のバッジ）。 */
export const ROLE_LABELS: Readonly<Record<RubricRole, string>> = {
  approach: "着眼",
  formula: "公式",
  substitution: "代入",
  calculation: "計算",
  conclusion: "結論",
  note: "補足",
};

/** 役割の説明（なぜこの配点かを学習者に示す）。 */
export const ROLE_HINTS: Readonly<Record<RubricRole, string>> = {
  approach: "方針・着眼点。書けていると部分点の土台になる",
  formula: "使う公式の提示。本番でも確実な得点源",
  substitution: "数値の代入。式に数字を入れた過程",
  calculation: "計算の過程",
  conclusion: "最終値と単位。配点が最も重い（単位落としは減点）",
  note: "参考情報。採点対象外",
};

/** ルーブリックの1項目（模範解答1ステップ）。 */
export interface RubricItem {
  /** 模範解答内のステップ index（安定。UI のチェック状態キーに使う）。 */
  index: number;
  /** ステップ本文。 */
  text: string;
  /** 推定した役割。 */
  role: RubricRole;
  /** 配点重み（note は 0）。 */
  weight: number;
  /** この項目に現れる必須キーワード（数値リテラル・単位・量記号）。 */
  keywords: string[];
  /** この項目に現れる単位（記述で落としやすい。結論項目では特に重要）。 */
  units: string[];
}

/** 採点対象外（補足）と判定する行頭パターン。 */
const NOTE_PREFIXES = ["ポイント", "補足", "注意", "参考", "memo", "メモ"];
/** 方針・着眼と判定する行頭パターン。 */
const APPROACH_PREFIXES = ["着眼点", "着眼", "方針", "考え方"];

/**
 * 電験で使う単位（長いものから照合するため、判定時に長さ降順へ並べ替える）。
 * 数値の直後に現れたときだけ単位とみなす（"m" が語中で誤爆するのを防ぐ）。
 */
const UNITS: readonly string[] = [
  "kvar",
  "Mvar",
  "var",
  "MVA",
  "kVA",
  "VA",
  "kWh",
  "MW",
  "kW",
  "mW",
  "W",
  "kV",
  "MV",
  "mV",
  "V",
  "kA",
  "mA",
  "A",
  "MΩ",
  "kΩ",
  "mΩ",
  "Ω",
  "μF",
  "pF",
  "nF",
  "mF",
  "F",
  "mH",
  "μH",
  "H",
  "Wb",
  "kHz",
  "MHz",
  "Hz",
  "N·m",
  "N",
  "kg",
  "km",
  "cm",
  "mm",
  "m",
  "kJ",
  "MJ",
  "J",
  "kPa",
  "MPa",
  "Pa",
  "°C",
  "°",
  "%",
  "ms",
  "μs",
  "min",
  "rad",
  "s",
  "h",
  "T",
  "K",
  "t",
];

/** 単位を長さ降順に並べた照合順（kW を W より先に当てる）。 */
const UNITS_BY_LENGTH: readonly string[] = [...UNITS].sort((a, b) => b.length - a.length);

/** 正規表現メタ文字のエスケープ。 */
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 「数値＋単位」を拾う正規表現（単位は長い順に並べる）。 */
const NUMBER_WITH_UNIT_RE = new RegExp(`(-?\\d+(?:\\.\\d+)?)\\s*(${UNITS_BY_LENGTH.map(escapeRe).join("|")})`, "g");

/**
 * 添字の数字（r2・s1・P1 など、英字の直後に付く数字）を取り除く。
 * 「数値リテラルが入っているか」の判定で添字を数値と誤認しないための前処理。
 */
function stripSubscripts(text: string): string {
  return text.replace(/[A-Za-zΑ-Ωα-ωА-я][0-9]+/g, (m) => m.replace(/[0-9]+/g, ""));
}

/** 添字を除いた上で、数値リテラルを含むか。 */
function hasNumericLiteral(text: string): boolean {
  return /\d/.test(stripSubscripts(text));
}

/** 行頭がいずれかの接頭辞で始まるか（全角コロン・空白のゆれを吸収）。 */
function startsWithAny(text: string, prefixes: readonly string[]): boolean {
  const head = text.trimStart();
  return prefixes.some((p) => head.startsWith(p));
}

/**
 * ステップ1行の役割を推定する。
 *
 * 判定順:
 *   1. 括弧で囲まれた行・「ポイント/補足/注意…」で始まる行 → note（採点対象外）
 *   2. 「着眼点/方針…」で始まる行 → approach
 *   3. 採点対象の最後の行で等号を含む → conclusion（最終値）
 *   4. 等号を含み数値リテラルがある → substitution
 *   5. 等号を含む → formula
 *   6. それ以外 → calculation
 *
 * @param text          ステップ本文。
 * @param index         ステップの index。
 * @param lastScoringIndex 採点対象（note 以外）の最後の index。
 */
export function classifyStep(text: string, index: number, lastScoringIndex: number): RubricRole {
  const trimmed = text.trim();
  // 全体が括弧で囲まれた行は補足（例: 「（補足: 厳密式もあるが…）」「（t=T で 63.2%）」）。
  if (/^[（(]/.test(trimmed)) return "note";
  if (startsWithAny(trimmed, NOTE_PREFIXES)) return "note";
  if (startsWithAny(trimmed, APPROACH_PREFIXES)) return "approach";
  const hasEquals = /[=≒≈]/.test(trimmed);
  if (index === lastScoringIndex && hasEquals) return "conclusion";
  if (hasEquals) return hasNumericLiteral(trimmed) ? "substitution" : "formula";
  return "calculation";
}

/** ステップ本文から単位を抽出する（数値の直後に現れたものだけ・重複なし・出現順）。 */
export function extractUnits(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(NUMBER_WITH_UNIT_RE)) {
    const unit = m[2];
    if (unit !== undefined && !out.includes(unit)) out.push(unit);
  }
  return out;
}

/**
 * ステップ本文から必須キーワードを抽出する。
 *
 * 拾うもの:
 *   - 数値＋単位（"39.6kW" → "39.6kW"）。二次で落としやすい単位を分けずに1語で持つ。
 *   - 単位の付かない数値リテラル（"0.5" など。添字は除く）。
 *   - 等号の左辺の量記号（"Vo=120V" → "Vo"）。
 *
 * キーワードが1つも取れない行（文章だけの方針など）は空配列を返し、
 * 照合の対象外として扱う（機械判定できないものを判定したことにしない）。
 */
export function extractKeywords(text: string): string[] {
  const out: string[] = [];
  const push = (s: string): void => {
    const v = s.trim();
    if (v.length > 0 && !out.includes(v)) out.push(v);
  };
  // 1. 数値＋単位（単位ごと1語にする）。
  const consumed: Array<[number, number]> = [];
  for (const m of text.matchAll(NUMBER_WITH_UNIT_RE)) {
    if (m.index === undefined) continue;
    push(`${m[1]}${m[2]}`);
    consumed.push([m.index, m.index + m[0].length]);
  }
  // 2. 単位の付かない数値リテラル（添字を除去した文字列から拾う）。
  const stripped = stripSubscripts(text);
  for (const m of stripped.matchAll(/-?\d+(?:\.\d+)?/g)) {
    if (m.index === undefined) continue;
    // すでに「数値＋単位」として拾った位置は二重に数えない（位置は概ね一致する）。
    const inConsumed = consumed.some(([s, e]) => m.index !== undefined && m.index >= s && m.index < e);
    if (!inConsumed) push(m[0]);
  }
  // 3. 等号の左辺の量記号（先頭の説明文を除いた最後の語）。
  const eq = text.search(/[=≒≈]/);
  if (eq > 0) {
    const lhs = text.slice(0, eq).trim();
    // "1相あたり P1" → "P1"、"比例推移: r2/s1" → "r2/s1"
    const lastToken = lhs
      .split(/[\s:：]/)
      .filter((t) => t.length > 0)
      .pop()
      // 補足行の "（t=T…" のような開き括弧を落とす（記号として無意味なため）。
      ?.replace(/^[（(]+/, "");
    if (lastToken !== undefined && lastToken.length > 0 && lastToken.length <= 12) push(lastToken);
  }
  return out;
}

/**
 * 模範解答（Problem.solution）から重み付きルーブリックを組み立てる。
 * 採点対象が1つも無い（全行が補足）異常なケースでは、すべてを calculation として扱い
 * 採点を成立させる（学習を止めないための防御。通常の問題では発生しない）。
 */
export function buildRubric(solution: readonly string[]): RubricItem[] {
  // note 判定だけ先に行い、「採点対象の最後の行」を確定してから本判定する。
  const isNote = solution.map((text) => {
    const trimmed = text.trim();
    return /^[（(]/.test(trimmed) || startsWithAny(trimmed, NOTE_PREFIXES);
  });
  let lastScoringIndex = -1;
  isNote.forEach((note, i) => {
    if (!note) lastScoringIndex = i;
  });
  const allNotes = lastScoringIndex === -1;
  return solution.map((text, index) => {
    const role: RubricRole = allNotes ? "calculation" : classifyStep(text, index, lastScoringIndex);
    return {
      index,
      text,
      role,
      weight: ROLE_WEIGHTS[role],
      keywords: extractKeywords(text),
      units: extractUnits(text),
    };
  });
}

/**
 * 達成率から FSRS 評価へ写す（部分点の閾値の単一情報源）。
 *   満点=easy / 2/3以上=good / 1/3以上=hard / それ未満=again
 * 2/3 は二次の合格圏（約60%）に安全余裕を持たせた目安。
 */
export function ratingForScore(pct: number): Rating {
  if (pct >= 1) return "easy";
  if (pct >= 2 / 3) return "good";
  if (pct >= 1 / 3) return "hard";
  return "again";
}

/** 重み付き採点の結果。 */
export interface RubricScore {
  /** 獲得した重みの合計。 */
  earned: number;
  /** 採点対象の重みの合計（note を含まない）。 */
  possible: number;
  /** 達成率 0..1（possible=0 なら 0）。 */
  pct: number;
  /** FSRS 評価。 */
  rating: Rating;
  /** 採点対象の項目数（note を除く）。 */
  scoringCount: number;
  /** チェックされた採点対象の項目数。 */
  checkedCount: number;
  /** チェックされなかった採点対象の項目（重みの大きい順→index 順）。 */
  missed: RubricItem[];
}

/**
 * チェックされた項目から重み付き部分点を算出する。
 * note（重み0）はチェックの有無にかかわらず点数に影響しない。
 *
 * @param items   buildRubric の結果。
 * @param checked チェックされたステップ index の集合。
 */
export function scoreRubric(items: readonly RubricItem[], checked: Iterable<number>): RubricScore {
  const set = new Set(checked);
  let earned = 0;
  let possible = 0;
  let scoringCount = 0;
  let checkedCount = 0;
  const missed: RubricItem[] = [];
  for (const item of items) {
    if (item.weight <= 0) continue;
    possible += item.weight;
    scoringCount += 1;
    if (set.has(item.index)) {
      earned += item.weight;
      checkedCount += 1;
    } else {
      missed.push(item);
    }
  }
  const pct = possible > 0 ? earned / possible : 0;
  missed.sort((a, b) => b.weight - a.weight || a.index - b.index);
  return { earned, possible, pct, rating: ratingForScore(pct), scoringCount, checkedCount, missed };
}

/** 検索・照合用の正規化（NFKC・小文字化・空白除去）。 */
function norm(s: string): string {
  return s.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
}

/** キーワード照合でチェック候補として提案する一致率の下限。 */
export const KEYWORD_SUGGEST_THRESHOLD = 0.6;

/** 1項目のキーワード照合結果。 */
export interface KeywordMatch {
  /** 対象ステップの index。 */
  index: number;
  /** 答案に現れたキーワード。 */
  matched: string[];
  /** 答案に見つからなかったキーワード。 */
  missing: string[];
  /** 一致率 0..1（キーワードが無い項目は 0）。 */
  ratio: number;
  /**
   * チェック候補として提案するか。
   * 採点対象（重み>0）で、キーワードがあり、一致率が閾値以上のときだけ true。
   * note（補足）は点にならないので提案しない（チェックが付いても無意味な操作を促さない）。
   */
  suggested: boolean;
}

/**
 * 学習者が書いた答案テキストと各項目のキーワードを照合する。
 *
 * これは自己採点の「補助」であり判定ではない。文章表現の正しさは機械には測れないため、
 * 提案されたチェックを最終的に採用するかは学習者が決める（UI もそう扱うこと）。
 */
export function matchRubricKeywords(items: readonly RubricItem[], answerText: string): KeywordMatch[] {
  const haystack = norm(answerText);
  return items.map((item) => {
    const matched: string[] = [];
    const missing: string[] = [];
    for (const kw of item.keywords) {
      if (haystack.length > 0 && haystack.includes(norm(kw))) matched.push(kw);
      else missing.push(kw);
    }
    const ratio = item.keywords.length > 0 ? matched.length / item.keywords.length : 0;
    return {
      index: item.index,
      matched,
      missing,
      ratio,
      suggested: item.weight > 0 && item.keywords.length > 0 && ratio >= KEYWORD_SUGGEST_THRESHOLD,
    };
  });
}

/** 答案テキストから、チェック候補として提案するステップ index を返す（index 昇順）。 */
export function suggestedCheckedIndices(items: readonly RubricItem[], answerText: string): number[] {
  return matchRubricKeywords(items, answerText)
    .filter((m) => m.suggested)
    .map((m) => m.index);
}

/**
 * 答案に書かれていない単位を返す（重複なし・模範解答の出現順）。
 * 単位落としは二次の典型的な減点なので、採点後に個別に指摘するために使う。
 * 採点対象（note 以外）の項目の単位だけを見る。
 */
export function missingUnits(items: readonly RubricItem[], answerText: string): string[] {
  const haystack = norm(answerText);
  const out: string[] = [];
  for (const item of items) {
    if (item.weight <= 0) continue;
    for (const unit of item.units) {
      if (!out.includes(unit) && !haystack.includes(norm(unit))) out.push(unit);
    }
  }
  return out;
}
