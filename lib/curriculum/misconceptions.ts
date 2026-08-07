/**
 * curriculum/misconceptions.ts — 誤答から「どの誤概念でつまずいたか」を同定する純ロジック。
 *
 * 目的: 「不正解だった」だけでは何を直せばよいか分からない。電験の誤答の多くは
 *   計算力ではなく係数の取り違えであり、そのとき誤答値と正解値の比は
 *   √3・1/2・2π・1000 といった特徴的な定数になる。
 *   比を手がかりに誤概念を推定し、対応する係数ファミリ（curriculum/coefficients.ts）の
 *   ドリルへ直接つなぐ。「間違えた → 何が原因か → どこで直すか」を1本にする。
 *
 * 方針:
 *   - 判定は「選んだ値 ÷ 正解値」の比のみ（純関数・決定論）。単位や文言は見ない。
 *   - 許容誤差は 1%（{@link MISCONCEPTION_REL_TOL}）と狭く取る。√3≒1.7 のような
 *     丸めの粗さを誤概念と誤診断しないため（採点自体は 0.5% 許容なので、
 *     丸め由来の不正解をここで「係数ミス」と決めつけると学習者を混乱させる）。
 *   - 当てはまらない誤答は無理に分類せず「分類できなかった」として数える。
 *     推定なので、UI では断定せず件数とともに提示すること。
 *
 * DOM 非依存・状態なし。
 */

/** 誤答比から推定する誤概念パターン。 */
export interface MisconceptionPattern {
  /** 安定 ID（集計キー・表示順に使う）。 */
  id: string;
  /** 一言ラベル（何をしてしまったか）。 */
  label: string;
  /** どういう取り違えかの説明（正解への戻り方を含む）。 */
  detail: string;
  /** 選んだ値 ÷ 正解値 がこの比に近ければ該当とみなす。 */
  ratio: number;
  /**
   * 対応する係数ファミリ ID（curriculum/coefficients.ts の COEFFICIENT_FAMILIES）。
   * 単位・符号のように係数ドリルで扱わない誤りは undefined。
   */
  familyId?: string;
}

/**
 * 比の一致とみなす相対許容誤差。
 *
 * 狭く（1%）取るのは意図的。採点の許容誤差（grade.ts の 0.5%）をわずかに超えただけの
 * 「丸めが粗かっただけの不正解」を係数の誤概念と誤診断しないため。
 * 例: √3 を 1.7 で計算した答えは正解比 0.981 で、√3 パターン（1.732）には一致しない。
 */
export const MISCONCEPTION_REL_TOL = 0.01;

const SQRT3 = Math.sqrt(3);
const SQRT2 = Math.sqrt(2);
/** 正弦波の波形率 π/(2√2)。 */
const FORM_FACTOR = Math.PI / (2 * SQRT2);

/**
 * 誤概念パターン表（先頭から順に照合し、最初に一致したものを採用）。
 * 比が互いに十分離れているため順序に依存しないが、定義順は表示の安定にも使う。
 */
export const MISCONCEPTION_PATTERNS: readonly MisconceptionPattern[] = [
  {
    id: "sqrt3-extra",
    label: "√3 を余分に掛けた",
    detail:
      "答えが正解のちょうど √3 倍。相→線間の換算が不要な場面（Δの線間電圧・Yの線電流・1相分の計算）で √3 を掛けた可能性がある。",
    ratio: SQRT3,
    familyId: "sqrt3",
  },
  {
    id: "sqrt3-missing",
    label: "√3 を掛け忘れた（または余分に割った）",
    detail: "答えが正解の 1/√3 倍。線間量で書くべき式を相の値のまま扱ったか、三相電力の √3 を落とした可能性がある。",
    ratio: 1 / SQRT3,
    familyId: "sqrt3",
  },
  {
    id: "three-for-sqrt3",
    label: "3 倍にした（√3 と 3 の取り違え）",
    detail:
      "答えが正解のちょうど3倍。相電圧・相電流で書いた式（×3）と線間量で書いた式（×√3）が混ざった可能性がある。対称座標法の 3I0 との混同でも起きる。",
    ratio: 3,
    familyId: "sqrt3",
  },
  {
    id: "third",
    label: "1/3 にした",
    detail:
      "答えが正解の 1/3 倍。三相を1相分に割る操作を余分に行ったか、零相電流の 1/3（平均）と地絡電流の 3 倍を取り違えた可能性がある。",
    ratio: 1 / 3,
    familyId: "sqrt3",
  },
  {
    id: "sqrt2-extra",
    label: "√2 を余分に掛けた",
    detail: "答えが正解の √2 倍。実効値で答えるべきところを最大値（波高値）で出した可能性がある。",
    ratio: SQRT2,
    familyId: "sqrt2",
  },
  {
    id: "sqrt2-missing",
    label: "√2 を掛け忘れた（または余分に割った）",
    detail: "答えが正解の 1/√2 倍。最大値で答えるべきところを実効値のまま出した可能性がある。",
    ratio: 1 / SQRT2,
    familyId: "sqrt2",
  },
  {
    id: "double",
    label: "2 倍にした",
    detail:
      "答えが正解のちょうど2倍。単相2線式の「往復2線分」を三相や1線分の計算に持ち込んだか、エネルギーの 1/2 を落とした可能性がある。",
    ratio: 2,
    familyId: "two",
  },
  {
    id: "halved",
    label: "1/2 にした",
    detail:
      "答えが正解の半分。蓄積エネルギーの 1/2 を不要な場面で掛けたか、実効値表記の電力に振幅表記の 1/2 を重ねた可能性がある。",
    ratio: 0.5,
    familyId: "half",
  },
  {
    id: "twopi-extra",
    label: "2π を余分に掛けた",
    detail: "答えが正解の 2π 倍。周波数 f [Hz] を使うべき式に角周波数 ω=2πf を入れた可能性がある。",
    ratio: 2 * Math.PI,
    familyId: "omega",
  },
  {
    id: "twopi-missing",
    label: "2π を掛け忘れた",
    detail: "答えが正解の 1/(2π) 倍。角周波数 ω [rad/s] が要る式に周波数 f [Hz] をそのまま入れた可能性がある。",
    ratio: 1 / (2 * Math.PI),
    familyId: "omega",
  },
  {
    id: "pi-extra",
    label: "π を余分に掛けた",
    detail: "答えが正解の π 倍。整流の平均値換算（2/π）や角度の換算で π の位置を取り違えた可能性がある。",
    ratio: Math.PI,
    familyId: "omega",
  },
  {
    id: "pi-missing",
    label: "π を掛け忘れた",
    detail: "答えが正解の 1/π 倍。平均値・角度の換算で π を落とした可能性がある。",
    ratio: 1 / Math.PI,
    familyId: "omega",
  },
  {
    id: "form-factor-extra",
    label: "波形率 1.11 を余分に掛けた",
    detail: "答えが正解の約1.11倍。平均値で答えるべきところに正弦波の波形率を掛けた可能性がある。",
    ratio: FORM_FACTOR,
    familyId: "waveform",
  },
  {
    id: "form-factor-missing",
    label: "波形率 1.11 を掛け忘れた",
    detail: "答えが正解の約0.90倍。実効値へ直すべき平均値をそのまま答えた可能性がある。",
    ratio: 1 / FORM_FACTOR,
    familyId: "waveform",
  },
  {
    id: "percent-extra",
    label: "100 倍にした（％と実数の取り違え）",
    detail: "答えが正解のちょうど100倍。％表示の値をそのまま実数として扱ったか、最後に×100 を重ねた可能性がある。",
    ratio: 100,
    familyId: "perunit",
  },
  {
    id: "percent-missing",
    label: "1/100 にした（％への直し忘れ）",
    detail: "答えが正解の1/100。実数（p.u.）のまま％に直さなかった可能性がある。",
    ratio: 0.01,
    familyId: "perunit",
  },
  {
    id: "kilo-extra",
    label: "1000 倍にした（単位接頭辞 k）",
    detail: "答えが正解のちょうど1000倍。k（キロ）の換算を余分に掛けた可能性がある。単位を式に添えると防げる。",
    ratio: 1000,
  },
  {
    id: "kilo-missing",
    label: "1/1000 にした（単位接頭辞 k）",
    detail: "答えが正解の1/1000。W↔kW・V↔kV の換算を落とした可能性がある。単位を式に添えると防げる。",
    ratio: 0.001,
  },
  {
    id: "sign",
    label: "符号を取り違えた",
    detail: "大きさは合っているが符号が逆。基準の向き（遅れ/進み・受電/送電）の取り方を確認する。",
    ratio: -1,
  },
];

/** ID からパターンをひく（未知は undefined）。 */
export function getMisconceptionPattern(
  id: string,
  patterns: readonly MisconceptionPattern[] = MISCONCEPTION_PATTERNS,
): MisconceptionPattern | undefined {
  return patterns.find((p) => p.id === id);
}

/**
 * 解答文字列から数値を取り出す（"39.6" / "2%" / "1.5Ω" / "−3" など）。
 * 全角数字・全角マイナス・桁区切りカンマを吸収する。数値が無ければ undefined。
 */
export function parseAnswerValue(raw: string): number | undefined {
  const normalized = raw
    .replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0))
    .replace(/[．。]/g, ".")
    .replace(/[，、]/g, "")
    .replace(/,/g, "")
    .replace(/[−–—ー]/g, "-")
    .replace(/\s+/g, "");
  // 先頭に現れる最初の数値（符号・小数・指数表記を許す）を採る。
  const m = normalized.match(/-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/);
  if (!m) return undefined;
  const v = Number(m[0]);
  return Number.isFinite(v) ? v : undefined;
}

/**
 * 正解と選んだ答えから誤概念を推定する。
 *
 * 判定できない場合（数値でない・正解が0・比が既知パターンに当てはまらない・
 * そもそも正解と一致している）は undefined を返す。
 *
 * @param correctAnswer 問題の正解（Problem.answer）。
 * @param chosenAnswer  学習者が選んだ/入力した答え。
 */
export function classifyMiss(
  correctAnswer: string,
  chosenAnswer: string,
  patterns: readonly MisconceptionPattern[] = MISCONCEPTION_PATTERNS,
): MisconceptionPattern | undefined {
  const want = parseAnswerValue(correctAnswer);
  const got = parseAnswerValue(chosenAnswer);
  if (want === undefined || got === undefined) return undefined;
  // 0 除算・ゼロ近傍は比が意味を持たない。
  if (want === 0 || got === 0) return undefined;
  const ratio = got / want;
  for (const p of patterns) {
    if (Math.abs(ratio - p.ratio) <= Math.abs(p.ratio) * MISCONCEPTION_REL_TOL) return p;
  }
  return undefined;
}

/** 集計に使う最小の解答ログ（web の WebAnswerLog から必要分だけ受け取る）。 */
export interface MissLog {
  topic: string;
  correct: boolean;
  /** 学習者が選んだ/入力した答え（誤答時のみ記録される）。 */
  chosen?: string;
  /** どの問題への解答か（正解の取得に使う）。 */
  problemId?: string;
}

/** 誤概念パターン1つの集計結果。 */
export interface MisconceptionCount {
  pattern: MisconceptionPattern;
  /** 該当した誤答の件数。 */
  count: number;
  /** 該当した論点（重複なし・初出順。最大数は集計側で制限しない）。 */
  topics: string[];
}

/** 誤概念集計の全体サマリー。 */
export interface MisconceptionSummary {
  /** 件数の多い順（同数なら定義順）。件数0のパターンは含めない。 */
  counts: MisconceptionCount[];
  /** 分類できた誤答の件数。 */
  classified: number;
  /** 分類できなかった誤答の件数（既知パターンに当てはまらなかったもの）。 */
  unclassified: number;
  /** 判定を試みた誤答の件数（chosen と正解の両方が取れたもの）。 */
  analyzed: number;
}

/**
 * 誤答ログを誤概念パターンごとに集計する（純関数・決定論）。
 *
 * @param logs      解答ログ（正解のログ・chosen の無いログは自動的に無視する）。
 * @param answerOf  problemId から正解文字列をひく関数（見つからなければ undefined）。
 */
export function misconceptionStats(
  logs: Iterable<MissLog>,
  answerOf: (problemId: string) => string | undefined,
  patterns: readonly MisconceptionPattern[] = MISCONCEPTION_PATTERNS,
): MisconceptionSummary {
  const byId = new Map<string, { pattern: MisconceptionPattern; count: number; topics: string[] }>();
  let classified = 0;
  let unclassified = 0;
  let analyzed = 0;
  for (const log of logs) {
    if (log.correct) continue;
    if (log.chosen === undefined || log.problemId === undefined) continue;
    const answer = answerOf(log.problemId);
    if (answer === undefined) continue;
    analyzed += 1;
    const pattern = classifyMiss(answer, log.chosen, patterns);
    if (!pattern) {
      unclassified += 1;
      continue;
    }
    classified += 1;
    const cur = byId.get(pattern.id) ?? { pattern, count: 0, topics: [] };
    cur.count += 1;
    if (!cur.topics.includes(log.topic)) cur.topics.push(log.topic);
    byId.set(pattern.id, cur);
  }
  // 件数の多い順 → 同数はパターン定義順（決定論）。
  const orderOf = new Map(patterns.map((p, i) => [p.id, i]));
  const counts = [...byId.values()].sort(
    (a, b) => b.count - a.count || (orderOf.get(a.pattern.id) ?? 0) - (orderOf.get(b.pattern.id) ?? 0),
  );
  return { counts, classified, unclassified, analyzed };
}

/**
 * 集計結果から「確かめ直すとよい係数ファミリ」の ID を多い順に返す。
 * 係数ドリルで扱わない誤り（単位・符号）は familyId を持たないので含まれない。
 * 同じファミリに複数パターンが該当する場合は件数を合算する。
 */
export function recommendedFamilyIds(summary: MisconceptionSummary): string[] {
  const totals = new Map<string, number>();
  const firstSeen = new Map<string, number>();
  summary.counts.forEach((c, i) => {
    const id = c.pattern.familyId;
    if (id === undefined) return;
    totals.set(id, (totals.get(id) ?? 0) + c.count);
    if (!firstSeen.has(id)) firstSeen.set(id, i);
  });
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1] || (firstSeen.get(a[0]) ?? 0) - (firstSeen.get(b[0]) ?? 0))
    .map(([id]) => id);
}
