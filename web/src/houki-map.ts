/**
 * houki-map.ts — 電験三種「法規」の全体像データ（表示ロジックを持たない純データ）。
 *
 * 出典と根拠:
 *  - 配点・時間・形式: 電気技術者試験センターの試験実施要領に基づく一般的な構成。
 *  - A問題の出題枠 / B問題の頻出順: 直近6回（R5上期〜R7下期）の公表問題の出題分野を集計した傾向。
 *    ※ 問題文・数値の逐語引用は一切含まない（docs/automation/04-pastexam-ingest §1）。
 *  - 法令数値: 電気事業法・電気設備技術基準・同解釈・電気関係報告規則ほか。
 *    改正で変動しうる値（電気用品の品目数、主任技術者外部委託の対象規模など）は意図的に載せない。
 */

/** 出題頻度の区分。色だけに頼らず記号を併記するため symbol を持つ。 */
export type Frequency = "every" | "often" | "rare";

export const FREQUENCY_LABEL: Record<Frequency, { symbol: string; text: string }> = {
  every: { symbol: "◎", text: "ほぼ毎年" },
  often: { symbol: "○", text: "数年に1回" },
  rare: { symbol: "△", text: "まれ" },
};

// ---------------------------------------------------------------------------
// 1. 法令体系
// ---------------------------------------------------------------------------

export interface StatuteNode {
  name: string;
  /** 階層（0=法律, 1=政令/省令, 2=解釈）。 */
  level: number;
  note: string;
  /** 電技解釈のように「法令そのものではない」ものは破線で区別する。 */
  isInterpretation?: boolean;
}

/** 電気事業法を頂点とする縦の階層（上位ほど強い）。 */
export const STATUTE_HIERARCHY: readonly StatuteNode[] = [
  { name: "電気事業法", level: 0, note: "法律。目的・電気工作物の区分・保安規程・主任技術者" },
  { name: "施行令 / 施行規則", level: 1, note: "法律の委任を受けた細目。届出・手続の具体" },
  { name: "電気設備技術基準（省令）", level: 1, note: "「〜しなければならない」の要求事項。約80条" },
  {
    name: "電技解釈",
    level: 2,
    note: "省令を満たす具体的な手段を示したもの。法令そのものではないが、数値の大半はここ",
    isInterpretation: true,
  },
];

/** 電気事業法と並ぶ周辺法令（横の広がり）。 */
export const RELATED_STATUTES: readonly { name: string; target: string; note: string; freq: Frequency }[] = [
  { name: "電気関係報告規則", target: "報告", note: "事故報告（速報24時間・詳報30日）", freq: "every" },
  { name: "電気工事士法", target: "人", note: "資格と従事できる作業の範囲", freq: "often" },
  { name: "電気工事業法", target: "業者", note: "登録電気工事業者（登録の有効期間5年）", freq: "rare" },
  { name: "電気用品安全法", target: "製品", note: "特定電気用品（ひし形PSE）／それ以外（丸形PSE）", freq: "often" },
];

// ---------------------------------------------------------------------------
// 2. 配点構造
// ---------------------------------------------------------------------------

export interface ScoreRow {
  section: string;
  detail: string;
  points: number;
}

export const SCORE_TABLE: readonly ScoreRow[] = [
  { section: "A問題", detail: "問1〜問10（6点×10問）", points: 60 },
  { section: "B問題 問11", detail: "(a) 6点 ＋ (b) 7点", points: 13 },
  { section: "B問題 問12", detail: "(a) 6点 ＋ (b) 7点", points: 13 },
  { section: "B問題 問13", detail: "(a) 7点 ＋ (b) 7点", points: 14 },
];

export const EXAM_META = {
  totalPoints: 100,
  passPoints: 60,
  minutes: 65,
  format: "全問マークシート五肢択一",
  note: "合格は60点。ただし平均点により53〜55点程度へ調整される年もある。",
} as const;

/** 合格ラインの作り方（積み上げの見せ方に使う）。 */
export const SCORE_PLANS: readonly { label: string; parts: { name: string; points: number }[]; note: string }[] = [
  {
    label: "B問題を取り切る戦略（推奨）",
    parts: [
      { name: "B問題 6小問すべて", points: 40 },
      { name: "A問題 4問", points: 24 },
    ],
    note: "計64点。B問題はパターンが狭く、最も伸ばしやすい",
  },
  {
    label: "A問題だけで到達する戦略",
    parts: [{ name: "A問題 10問すべて", points: 60 }],
    note: "計60点ちょうど。1問でも落とすと届かないため現実的でない",
  },
  {
    label: "バランス型",
    parts: [
      { name: "B問題 4小問", points: 27 },
      { name: "A問題 6問", points: 36 },
    ],
    note: "計63点。B問題の(a)だけでも拾えば届く",
  },
];

// ---------------------------------------------------------------------------
// 3. A問題の出題枠マップ（直近6回で安定している並び）
// ---------------------------------------------------------------------------

export interface SlotRow {
  slot: string;
  theme: string;
  freq: Frequency;
  /** 対応する出題テンプレの topic（学習タブへの導線に使う）。 */
  topics: readonly string[];
}

export const A_SLOTS: readonly SlotRow[] = [
  {
    slot: "問1",
    theme: "電気事業法（目的・工作物の区分・保安規程・主任技術者）",
    freq: "every",
    topics: ["法令条文の空欄補充"],
  },
  {
    slot: "問2",
    theme: "電気関係報告規則（事故の定義・報告の要否と期限）",
    freq: "every",
    topics: ["法令数値の横断ドリル"],
  },
  {
    slot: "問3",
    theme: "電気設備技術基準（省令）本文（電路の絶縁・保安原則）",
    freq: "every",
    topics: ["法令条文の空欄補充"],
  },
  { slot: "問4〜6", theme: "接地工事の種類と数値", freq: "every", topics: ["接地工事の種類と抵抗値", "B種接地抵抗"] },
  {
    slot: "問4〜6",
    theme: "分散型電源の系統連系（単独運転・逆潮流・解列）",
    freq: "often",
    topics: ["法令条文の空欄補充"],
  },
  {
    slot: "問5〜7",
    theme: "架空電線路の施設基準（高さ・離隔・支持物）",
    freq: "every",
    topics: ["高圧架空電線の高さ", "支持物の根入れ深さ"],
  },
  {
    slot: "問7〜8",
    theme: "絶縁・絶縁耐力（絶縁抵抗・漏えい電流）",
    freq: "every",
    topics: ["低圧電路の絶縁抵抗", "漏えい電流"],
  },
  {
    slot: "問9",
    theme: "低圧・引込・屋内配線（対地電圧制限・配線器具）",
    freq: "often",
    topics: ["屋内電路の対地電圧制限"],
  },
  {
    slot: "問10",
    theme: "小計算 または 変流器・SOG付PASの知識",
    freq: "often",
    topics: ["需要率・不等率・負荷率の複合"],
  },
];

// ---------------------------------------------------------------------------
// 4. B問題の頻出パターン
// ---------------------------------------------------------------------------

export interface PatternRow {
  name: string;
  /** 直近6回での出題回数。 */
  hits: number;
  formula: string;
  topic: string;
}

export const B_PATTERNS: readonly PatternRow[] = [
  { name: "接地抵抗の計算", hits: 4, formula: "R = 150 / Ig（緩和 300/Ig・600/Ig）", topic: "B種接地抵抗" },
  { name: "進相コンデンサ・力率改善", hits: 3, formula: "Qc = P(tanθ₁ − tanθ₂)", topic: "力率改善コンデンサ容量" },
  {
    name: "絶縁耐力試験（充電電流・容量）",
    hits: 2,
    formula: "Ic = 2πfCV, S = V·Ic",
    topic: "絶縁耐力試験の充電電流と試験装置容量",
  },
  { name: "水力発電（流況曲線）", hits: 2, formula: "P = 9.8·Q·H·η", topic: "" },
  { name: "需要率・負荷率", hits: 1, formula: "合成最大 = ΣPi ÷ 不等率", topic: "需要率・不等率・負荷率の複合" },
  { name: "風圧荷重", hits: 1, formula: "P = q · d · L", topic: "風圧荷重" },
  { name: "支線の計算", hits: 1, formula: "T = P / sinθ、安全率2.5", topic: "支線の張力と所要素線条数" },
  { name: "地絡電流の分流", hits: 1, formula: "V = E · R / (RB + RD)", topic: "漏電時の機器の対地電圧" },
];

// ---------------------------------------------------------------------------
// 5. 重要数値（カテゴリ別に小さく分割して読ませる）
// ---------------------------------------------------------------------------

export interface NumberGroup {
  category: string;
  rows: readonly { item: string; value: string }[];
}

export const KEY_NUMBERS: readonly NumberGroup[] = [
  {
    category: "電圧の区分",
    rows: [
      { item: "低圧（交流 / 直流）", value: "600V以下 / 750V以下" },
      { item: "高圧", value: "低圧を超え 7000V以下" },
      { item: "特別高圧", value: "7000V超" },
    ],
  },
  {
    category: "接地工事",
    rows: [
      { item: "A種（高圧・特別高圧機器の鉄台）", value: "10Ω以下" },
      { item: "B種（変圧器の中性点）", value: "150 / Ig（1〜2秒遮断 300、1秒以内 600）" },
      { item: "C種（300V超の低圧）", value: "10Ω以下（0.5秒以内遮断で500Ω）" },
      { item: "D種（300V以下の低圧）", value: "100Ω以下（0.5秒以内遮断で500Ω）" },
    ],
  },
  {
    category: "絶縁",
    rows: [
      { item: "絶縁抵抗（対地電圧150V以下）", value: "0.1MΩ以上" },
      { item: "絶縁抵抗（150V超300V以下）", value: "0.2MΩ以上" },
      { item: "絶縁抵抗（300V超）", value: "0.4MΩ以上" },
      { item: "漏えい電流の上限", value: "1mA以下" },
      { item: "絶縁耐力試験（高圧）", value: "最大使用電圧×1.5・連続10分（6600V→10350V）" },
    ],
  },
  {
    category: "架空電線路",
    rows: [
      { item: "電線の高さ（道路横断 / 鉄道 / その他）", value: "6m / 5.5m / 5m" },
      { item: "支持物の根入れ（全長15m以下 / 15m超）", value: "全長の1/6以上 / 2.5m以上" },
      { item: "支線", value: "安全率2.5以上・素線3条以上・引張荷重10.7kN以上" },
      { item: "たるみ / 実長", value: "D = WS²/(8T) / L = S + 8D²/(3S)" },
      { item: "風圧（甲種 / 丙種）", value: "980Pa / 490Pa" },
    ],
  },
  {
    category: "手続・資格",
    rows: [
      { item: "事故報告（速報 / 詳報）", value: "24時間以内 / 30日以内" },
      { item: "工事計画の届出", value: "受理から30日経過後に着工" },
      { item: "主任技術者免状（三種 / 二種）", value: "5万V未満 / 17万V未満" },
      { item: "一般用電気工作物の定期調査", value: "4年に1回以上" },
      { item: "第一種電気工事士の定期講習", value: "5年以内ごと" },
      { item: "小規模事業用（太陽光 / 風力）", value: "10kW以上50kW未満 / 20kW未満" },
    ],
  },
  {
    category: "供給・受電",
    rows: [
      { item: "標準電圧100V の維持範囲", value: "101 ± 6V" },
      { item: "標準電圧200V の維持範囲", value: "202 ± 20V" },
      { item: "一般用電気工作物の受電電圧", value: "600V以下" },
    ],
  },
];

// ---------------------------------------------------------------------------
// 6. 学習の順路
// ---------------------------------------------------------------------------

export const STUDY_STEPS: readonly { order: number; title: string; detail: string; topics: readonly string[] }[] = [
  {
    order: 1,
    title: "B問題の頻出3パターンを固める",
    detail: "配点40点。パターンが狭く最も伸びる。まずここ",
    topics: ["B種接地抵抗", "力率改善コンデンサ容量", "絶縁耐力試験の充電電流と試験装置容量"],
  },
  {
    order: 2,
    title: "A問題の確定枠（問1〜問3）を取りにいく",
    detail: "電気事業法・報告規則・電技省令。直近6回すべてで同じ枠から出ている",
    topics: ["法令条文の空欄補充", "法令数値の横断ドリル"],
  },
  {
    order: 3,
    title: "数値を category ごとに詰める",
    detail: "接地・絶縁・架空電線路の3つが最頻。表を category 単位で覚える",
    topics: ["接地工事の種類と抵抗値", "低圧電路の絶縁抵抗", "高圧架空電線の高さ"],
  },
  {
    order: 4,
    title: "本試形式の模試で通しで解く",
    detail: "65分・A10問＋B3問。時間配分（A20分／B35分）を体に入れる",
    topics: [],
  },
];
