/**
 * curriculum/coefficients.ts — 係数リーズニング（coefficient reasoning）の純ロジック。
 *
 * 目的: 三種合格者が二種でつまずく最大の断層は「√3・1/2・√2・2・3 などの係数を
 *   おまじないとして暗記していること」。三種は公式当てはめで通っても、二種は
 *   記述式で導出を書かされ、単位法では√3が消え、対称座標法では 1/3 と 3 が現れる。
 *   「この状況でこの係数は要るのか・要らないのか」を判断できる理解が要る。
 *
 * 方針:
 *   - 係数を「ファミリ」（√3・1/2・√2・2・対称座標・単位法）にまとめ、
 *     由来（origin）・要る場面・要らない場面・二種でどう化けるかを持つ。
 *   - ドリルは最小対比ペア（同じ量でも状況が変わると係数が変わる）を軸にした
 *     客観採点の選択問題。正誤がそのまま FSRS の評価（good/again）に写る。
 *   - 出題は why-check と同じ定石: 既習で期限到来を最優先 → 未着手を定義順で。
 *   - コンテンツはコード所有・決定論（LLM には生成させない。リポジトリ不変条件）。
 *
 * 不変条件:
 *   - 各アイテムの area は curriculum/graph.ts の CONCEPT_EDGES に登場するノード名
 *     （前提の根っこ診断・原理カードへの導線に使う。テストで保証）。
 *   - ID は `${familyId}#${index}` の安定 ID。記憶状態（web/src/coeff-store.ts の
 *     `denken:coeffCards`）はこの ID をキーに保存されるため、既存アイテムの
 *     途中挿入・並べ替え・削除をしないこと。追加は必ず各ファミリの末尾に行う。
 *
 * DOM 非依存・状態なし。
 */
import type { Rating } from "../scheduler/types.js";

/** 係数ファミリ（同じ由来を持つ係数のまとまり）。 */
export interface CoefficientFamily {
  /** 安定 ID（ドリル ID の前半に使う。変更しないこと）。 */
  id: string;
  /** 表示名（例: "√3 — 三相の線間↔相"）。 */
  name: string;
  /** どこから来る係数か（一言の由来）。 */
  origin: string;
  /** どういう場合に必要か。 */
  whenNeeded: string;
  /** どういう場合に不要か（ここが暗記学習の盲点）。 */
  whenNot: string;
  /** 二種でこの係数の理解がどう効くか。 */
  denken2Note: string;
}

/** 係数判断ドリル1問（客観採点の選択問題）。 */
export interface CoefficientDrillItem {
  /** 安定 ID（`${familyId}#${index}`）。永続化キーとして使う。 */
  id: string;
  /** 所属ファミリの ID。 */
  familyId: string;
  /** 状況文（この状況で係数はどうなるか、を問う）。 */
  scenario: string;
  /** 選択肢（係数の候補）。 */
  options: string[];
  /** 正解の選択肢 index。 */
  correctIndex: number;
  /** なぜその係数になるか（正解後に見せる理解の核）。 */
  why: string;
  /** 最小対比: どの状況なら別の係数になるか（判断力を作る対）。 */
  contrast: string;
  /** 関連する概念領域（CONCEPT_EDGES のノード名。原理カードへの導線）。 */
  area: string;
  /** 定義順の通し番号（出題のタイブレークに使う）。 */
  order: number;
}

/** ドリル定義（ID・order を付与する前の生データ）。 */
interface DrillSeed {
  scenario: string;
  options: string[];
  correctIndex: number;
  why: string;
  contrast: string;
  area: string;
}

export const COEFFICIENT_FAMILIES: readonly CoefficientFamily[] = [
  {
    id: "sqrt3",
    name: "√3 — 三相の線間↔相",
    origin: "120°位相差の等大ベクトル2つの差は 2cos30° = √3 倍になる（線間電圧＝相電圧のベクトル差）。",
    whenNeeded: "Y結線の線間電圧・Δ結線の線電流・線間量で書いた三相電力 P=√3·Vl·Il·cosθ。",
    whenNot: "Δ結線の線間電圧・Y結線の線電流・1相分に直した計算・単位法（p.u.）の中。",
    denken2Note:
      "二種二次は「1相分に直して解く」が基本作法。√3を機械的に掛けると1相分計算と混ざって崩れ、" +
      "単位法では√3自体が基準に吸収されて消える。いまどの表示系にいるかを宣言する癖が部分点を守る。",
  },
  {
    id: "half",
    name: "1/2 — エネルギーの積分",
    origin: "0から比例して積み上がる量の総和は ∫x dx = x²/2。「平均すると半分」の現れ。",
    whenNeeded: "蓄積エネルギー CV²/2・LI²/2・Jω²/2、振幅（最大値）表記の平均電力 VmIm/2·cosθ。",
    whenNot: "実効値表記の電力 P=VI·cosθ（1/2 は √2 換算に吸収済み）・瞬時値そのものの計算。",
    denken2Note:
      "二種の過渡現象・エネルギー収支の記述では「この 1/2 は積分から出た」と導出ごと書かされる。" +
      "実効値の式に 1/2 を二重に掛ける・振幅の式で 1/2 を落とす、が典型の失点。",
  },
  {
    id: "sqrt2",
    name: "√2 — 波高値↔実効値",
    origin: "正弦波の2乗平均の平方根（実効値）が最大値の 1/√2 になる（sin² の平均が 1/2 だから）。",
    whenNeeded: "正弦波の最大値↔実効値の換算・整流平滑後の充電電圧（波高値）・絶縁の耐圧検討。",
    whenNot: "直流（実効値＝その値）・方形波（実効値＝振幅）など正弦波以外・実効値どうしの計算。",
    denken2Note:
      "二種一次の理論はひずみ波（非正弦波）の実効値を問う。√2 が「正弦波専用」の係数だと" +
      "分かっていれば、各調波の実効値の2乗和という定義に迷わず戻れる。",
  },
  {
    id: "two",
    name: "2 — 往復・線の本数",
    origin: "電流は行って帰る。電圧降下・損失は「電流が通る導体の本数」ぶん積み上がる。",
    whenNeeded: "単相2線式の電圧降下 2I(Rcosθ+Xsinθ)・損失 2I²R（R は片道1線分）。",
    whenNot: "三相3線式（線間は √3×1線分・損失は 3I²R）・単相3線式の平衡運転（中性線電流0）。",
    denken2Note:
      "配電方式の比較（銅量・損失比）は二種でも頻出。2 と √3 と 3 を「本数の2」「幾何の√3」" +
      "「相数の3」と由来で区別できれば、方式が変わっても式を組み立て直せる。",
  },
  {
    id: "sym",
    name: "3・1/3 — 対称座標法",
    origin: "三相を零相・正相・逆相へ分解する変換。零相は3相の平均（1/3）、地絡点にはその3倍が現れる。",
    whenNeeded: "零相電流 I0=(Ia+Ib+Ic)/3・一線地絡の故障点電流 3I0・零相回路の計算。",
    whenNot: "平衡した正常運転（3相の和が0＝零相なし。中性線に電流が流れない理由そのもの）。",
    denken2Note:
      "対称座標法は二種二次・電力管理の故障計算の主役。3I0 と I0 の取り違いは即失点。" +
      "「1/3 は平均、3 は和」という由来で覚えれば混ざらない。",
  },
  {
    id: "perunit",
    name: "単位法 — 係数を消す道具",
    origin: "量を基準値で割って比率にすると、√3・巻数比などの構造係数が基準側に吸収されて消える。",
    whenNeeded: "系統計算（%Z・p.u.）で電圧階級・結線をまたぐとき。基準容量の統一換算。",
    whenNot: "実量（V・A・Ω）に戻すとき — 消えていた √3 や巻数比² が復活する。",
    denken2Note:
      "二種の系統計算は単位法が前提。「どの係数がなぜ消えるか」を分かって使えば、" +
      "実量に戻す場面で √3 を付け忘れず、逆に p.u. の中で二重に掛けることもない。",
  },
  // ---- 以降は追加ファミリ（末尾追加。既存ファミリの間に挿入しないこと） ----
  {
    id: "omega",
    name: "ω=2πf — 角速度と周波数",
    origin: "1周期は 2π ラジアン。それが毎秒 f 回起きるので、角度の進む速さは ω = 2πf [rad/s]。",
    whenNeeded: "リアクタンス X_L=ωL・X_C=1/(ωC)、共振 ω0=1/√(LC)、s=jω 置換、位相の時間発展。",
    whenNot: "回転機の同期速度 Ns=120f/p のように「毎分回転数」を周波数から出す式（f のまま使う）。",
    denken2Note:
      "二種は伝達関数・過渡現象で s=jω 置換が常用され、ω と f の取り違えは約6.28倍のずれになる。" +
      "「rad/s なら ω、Hz なら f」と単位で見分ける癖が要る。",
  },
  {
    id: "waveform",
    name: "波形率・波高率 — 波形ごとの指標",
    origin: "実効値/平均値 = 波形率、最大値/実効値 = 波高率。どちらも波形の「形」だけで決まる比。",
    whenNeeded: "整流回路の平均値、可動コイル形計器の目盛（正弦波なら平均値×1.11）、ひずみ波の評価。",
    whenNot: "正弦波以外に 1.11 や √2 を流用するとき（方形波なら波形率も波高率も 1.00）。",
    denken2Note:
      "二種一次はひずみ波と整流回路で平均値・実効値を区別して問う。計器の種類（可動コイル形=平均値応答、" +
      "可動鉄片形=実効値応答）と結びつけると、どの係数が要るかが自動的に決まる。",
  },
  {
    id: "base",
    name: "三相/単相の基準 — 単位法の土台",
    origin: "単位法の基準を「三相容量＋線間電圧」で取るか「1相容量＋相電圧」で取るかで、基準電流の式が変わる。",
    whenNeeded: "%Z・p.u. の基準を自分で決めるとき、単相機器を三相系統に組み込むとき、実量へ戻すとき。",
    whenNot: "全機器が同じ基準系で与えられているとき（換算不要。基準が揃っていることの確認だけでよい）。",
    denken2Note:
      "二種の系統計算は三相基準（Sb=三相容量・Vb=線間電圧）が既定。1相基準の式と混ぜると √3 や 3 のずれが出る。" +
      "「その %Z は何の容量に対する比率か」を毎回確認するのが事故を防ぐ唯一の方法。",
  },
];

/**
 * ファミリごとのドリル定義。
 *
 * 【不変条件】既存要素の順序を変えないこと。追加は必ず各ファミリ配列の末尾に行う。
 * 記憶状態は `${familyId}#${index}` をキーに保存されるため、途中挿入・並べ替え・削除を
 * すると学習者の復習履歴が黙って別の問題に付け替わる。
 * `tests/curriculum/coefficients.test.ts` のゴールデン表がこの不変条件を守っている。
 */
const DRILL_SEEDS: Readonly<Record<string, readonly DrillSeed[]>> = {
  sqrt3: [
    {
      scenario: "Y結線の三相電源。相電圧 E に対して、線間電圧は E の何倍か？",
      options: ["×1（そのまま）", "×√3", "×2", "×3"],
      correctIndex: 1,
      why: "線間電圧は2つの相電圧のベクトル差。120°差・等大の2ベクトルの差は 2cos30° = √3 倍になる。",
      contrast: "Δ結線なら相巻線がそのまま線間につながるので、線間電圧＝相電圧（×1）。",
      area: "三相交流回路",
    },
    {
      scenario: "Δ結線の三相電源。相電圧 E に対して、線間電圧は E の何倍か？",
      options: ["×√3", "×1（そのまま）", "×1/√3", "×2"],
      correctIndex: 1,
      why: "Δでは相巻線の両端がそのまま線間端子。ベクトル差を取る場面がないので係数は付かない。",
      contrast: "Y結線では線間＝相電圧のベクトル差になるので √3 倍。√3 は「Yの電圧・Δの電流」側に付く。",
      area: "三相交流回路",
    },
    {
      scenario: "Δ結線の負荷。相電流 I に対して、線電流は I の何倍か？",
      options: ["×1（そのまま）", "×2", "×√3", "×3"],
      correctIndex: 2,
      why: "線電流は節点で合流する2つの相電流のベクトル差。電圧のときと同じ幾何で √3 倍になる。",
      contrast: "Y結線では線と相が直列なので線電流＝相電流（×1）。√3 が付く側が Y と Δ で入れ替わる。",
      area: "三相交流回路",
    },
    {
      scenario: "三相電力を「線間電圧 Vl・線電流 Il」で表すとき、Vl·Il·cosθ に掛ける係数は？",
      options: ["×3", "×√3", "×1（そのまま）", "×3/2"],
      correctIndex: 1,
      why: "1相分 P=Vp·Ip·cosθ の3倍が全体。Y結線なら Vp=Vl/√3・Ip=Il を代入して 3/√3 = √3 が残る。",
      contrast: "「相電圧・相電流」で書くなら素直に3倍（×3）。√3 は線間量へ換算した名残にすぎない。",
      area: "三相交流回路",
    },
    {
      scenario: "三相電力を「相電圧 Vp・相電流 Ip」で表すとき、Vp·Ip·cosθ に掛ける係数は？",
      options: ["×√3", "×2", "×3", "×1（そのまま）"],
      correctIndex: 2,
      why: "対称三相は同じ1相が3つ。1相分の電力を3倍するだけで、幾何の√3はどこにも出てこない。",
      contrast: "線間量 Vl・Il へ置き換えた瞬間に √3·Vl·Il·cosθ になる。3 と √3 の使い分けは「どの量で書いたか」。",
      area: "三相交流回路",
    },
  ],
  half: [
    {
      scenario: "静電容量 C を電圧 V まで充電したとき、蓄積エネルギーは C·V² の何倍か？",
      options: ["×1（そのまま）", "×1/2", "×2", "×1/√2"],
      correctIndex: 1,
      why: "電荷を0からQまで運ぶ間、電圧は0からVへ比例して上がる。平均電圧 V/2 で運ぶので QV/2 = CV²/2。",
      contrast: "一定電圧源 V が送り出した電気量 Q のエネルギーは QV そのもの（残り半分は充電抵抗で熱になる）。",
      area: "静電気",
    },
    {
      scenario: "インダクタンス L に電流 I を流したとき、磁気エネルギーは L·I² の何倍か？",
      options: ["×1/2", "×1（そのまま）", "×2", "×1/3"],
      correctIndex: 0,
      why: "電流を0からIへ立ち上げる間の ∫L·i di = LI²/2。コンデンサの CV²/2 と同じ「比例積み上げの平均」。",
      contrast: "定常状態の瞬時の電圧・電流の関係（v=L·di/dt）には 1/2 は現れない。1/2 は蓄積量だけの係数。",
      area: "電磁気",
    },
    {
      scenario: "慣性モーメント J のはずみ車が角速度 ω で回るとき、運動エネルギーは J·ω² の何倍か？",
      options: ["×2", "×1（そのまま）", "×1/2", "×1/4"],
      correctIndex: 2,
      why: "∫J·ω dω = Jω²/2。電気の CV²/2・LI²/2 と完全に同型で、「2乗の蓄積量には 1/2」が通底する。",
      contrast: "トルクと出力の関係 P=ω·T は瞬時の積なので 1/2 は不要。蓄積（積分）か瞬時（積）かで見分ける。",
      area: "回転機の制御",
    },
    {
      scenario: "実効値 V・I と力率 cosθ で単相交流電力を書くとき、V·I·cosθ に 1/2 は要るか？",
      options: ["×1/2 が要る", "×1（不要）", "×1/√2 が要る", "×2 が要る"],
      correctIndex: 1,
      why: "瞬時電力の平均に出る 1/2 は、実効値＝最大値/√2 の換算（1/√2 × 1/√2 = 1/2）に既に吸収されている。",
      contrast: "最大値（振幅）Vm・Im で書くなら (1/2)·Vm·Im·cosθ。1/2 を二重に掛ける・落とすのが典型ミス。",
      area: "単相交流回路",
    },
    {
      scenario: "最大値（振幅）Vm・Im と位相差 θ で単相交流の平均電力を書くとき、Vm·Im·cosθ に掛ける係数は？",
      options: ["×1/2", "×1（そのまま）", "×√2", "×1/√2"],
      correctIndex: 0,
      why: "瞬時電力 p = Vm·Im·cosωt·cos(ωt−θ) の時間平均が (1/2)·Vm·Im·cosθ になる（cos積の平均は 1/2）。",
      contrast: "実効値 V=Vm/√2・I=Im/√2 で書き直すと 1/2 が消えて P=VI·cosθ。同じ物理を別の記法で見ているだけ。",
      area: "単相交流回路",
    },
  ],
  sqrt2: [
    {
      scenario: "実効値 100 V の正弦波電圧。最大値（波高値）は実効値の何倍か？",
      options: ["×√2", "×2", "×√3", "×1（同じ）"],
      correctIndex: 0,
      why: "正弦波では実効値＝最大値/√2（sin² の平均が 1/2 だから）。逆に最大値は実効値の √2 倍。",
      contrast: "平均値（全波整流平均）は 2Vm/π ≈ 0.9×実効値。√2（波高）と 0.9（平均）を混同しない。",
      area: "単相交流回路",
    },
    {
      scenario: "最大値 Vm の正弦波の実効値を求めたい。Vm に掛ける係数は？",
      options: ["×√2", "×1/2", "×1/√2", "×2/π"],
      correctIndex: 2,
      why: "実効値の定義（2乗平均平方根）を正弦波に適用すると Vm/√2。発熱が等しい直流に換算した値。",
      contrast: "2/π（≈0.637）は「平均値」への換算。実効値と平均値は別物で、波形率 1.11 がその比。",
      area: "単相交流回路",
    },
    {
      scenario: "直流 100 V の実効値を求めたい。√2 の換算は要るか？",
      options: ["÷√2 が要る", "×√2 が要る", "×1（そのまま100 V）", "×1/2 が要る"],
      correctIndex: 2,
      why: "実効値の定義は2乗平均平方根。一定値の直流はそのまま 100 V。√2 は正弦波の形から出た係数にすぎない。",
      contrast: "正弦波なら ÷√2、方形波なら振幅そのまま。波形が変われば係数も変わる — 定義に戻れば迷わない。",
      area: "単相交流回路",
    },
    {
      scenario: "交流実効値 V をダイオード整流＋コンデンサ平滑した無負荷時の直流出力電圧は V の約何倍か？",
      options: ["×1（同じ）", "×√2", "×2/π", "×1/√2"],
      correctIndex: 1,
      why: "無負荷ではコンデンサが波高値（最大値）まで充電されて保持するので、出力 ≈ √2·V。",
      contrast: "平滑コンデンサなしの全波整流の平均値は (2√2/π)·V ≈ 0.9V。平滑の有無で係数が変わる。",
      area: "パワーエレクトロニクス",
    },
    {
      scenario: "変圧器の誘導起電力 E = 4.44·f·N·Φm。係数 4.44 の正体は？",
      options: [
        "2π/√2（角周波数 2πf を実効値へ √2 換算した残り）",
        "経験的に決めた定数（由来はない）",
        "√3 × √2 × 1.81",
        "π + √2 を丸めた近似値",
      ],
      correctIndex: 0,
      why: "e = N·dΦ/dt の最大値が 2πf·N·Φm。実効値へ直すため √2 で割ると (2π/√2)·f·N·Φm = 4.44·f·N·Φm。",
      contrast: "平均値で定義すると 4·f·N·Φm（矩形換算）。4.44/4 = 1.11 が波形率という関係まで一本につながる。",
      area: "変圧器",
    },
  ],
  two: [
    {
      scenario: "単相2線式。片道1線分の抵抗 R・リアクタンス X、電流 I のとき、電圧降下 I(Rcosθ+Xsinθ) に掛ける係数は？",
      options: ["×1（そのまま）", "×√3", "×2", "×3"],
      correctIndex: 2,
      why: "電流は行きの線と帰りの線の両方で降下を起こす。1線分の降下 × 2本 = 2I(Rcosθ+Xsinθ)。",
      contrast: "三相3線式の線間降下は √3×1線分。帰り道を他の相と共有するので「×2」にはならない。",
      area: "送電・線路計算",
    },
    {
      scenario: "三相3線式。1線分の電圧降下 I(Rcosθ+Xsinθ) に対して、線間電圧の降下は何倍か？",
      options: ["×2", "×3", "×1（そのまま）", "×√3"],
      correctIndex: 3,
      why: "1線分（相あたり・中性点基準）の降下を線間量に直すときの換算が √3。往復の「2」とは由来が違う。",
      contrast: "単相2線式は同じ電流が2本を往復するので ×2。「本数の2」と「線間換算の√3」を混ぜない。",
      area: "送電・線路計算",
    },
    {
      scenario: "単相3線式で両側の負荷が平衡しているとき、中性線での電圧降下は外線1線分の何倍か？",
      options: ["×0（降下なし）", "×1（同じだけ降下）", "×2", "×1/2"],
      correctIndex: 0,
      why: "平衡時は両外線の電流が中性線で打ち消し合って中性線電流が0。流れない線には降下も損失もない。",
      contrast: "不平衡になると差の電流が中性線に流れて降下が現れ、電圧の不平衡（片側上昇）まで起きる。",
      area: "送電・線路計算",
    },
    {
      scenario: "単相2線式の線路損失。片道1線分の抵抗 R・電流 I のとき、損失は I²R の何倍か？",
      options: ["×1（そのまま）", "×2", "×√3", "×4"],
      correctIndex: 1,
      why: "損失は電流が通る導体の本数分。2線に同じ I が流れるので 2I²R。",
      contrast: "三相3線式は 3I²R（3本に線電流）。損失の係数は常に「本数」— 電圧降下の √3 と混ぜないこと。",
      area: "送電・線路計算",
    },
  ],
  sym: [
    {
      scenario: "対称座標法で零相電流 I0 を求める。(Ia + Ib + Ic) に掛ける係数は？",
      options: ["×3", "×1（そのまま）", "×1/3", "×1/√3"],
      correctIndex: 2,
      why: "零相は「3相に共通に含まれる成分」＝3相の平均。だから和を3で割る。",
      contrast: "逆に、地絡点へ流れ出す電流は3相の和そのもの＝3I0。「1/3 は平均、3 は和」で対になっている。",
      area: "短絡・故障計算",
    },
    {
      scenario: "一線地絡故障。故障点に流れる地絡電流は零相電流 I0 の何倍か？",
      options: ["×1（I0 がそのまま流れる）", "×√3", "×3", "×1/3"],
      correctIndex: 2,
      why: "一線地絡では I0=I1=I2 となり、故障相の電流 Ia = I0+I1+I2 = 3I0。地絡電流は零相の3倍。",
      contrast: "零相電流そのもの（I0）は各相に均等に分かれた成分。3I0 と I0 の取り違いが故障計算の典型失点。",
      area: "短絡・故障計算",
    },
    {
      scenario: "平衡した三相電流（各実効値 I・120°ずつずれ）のベクトル和の大きさは I の何倍か？",
      options: ["×3", "×√3", "×1（そのまま）", "×0（打ち消して零）"],
      correctIndex: 3,
      why: "120°ずつずれた等大の3ベクトルの和は0。これが「平衡時は中性線に電流が流れない」「零相なし」の正体。",
      contrast: "地絡・不平衡で和が0でなくなると、その和が 3I0 として零相回路（大地帰路）に現れる。",
      area: "三相交流回路",
    },
  ],
  perunit: [
    {
      scenario: "単位法（p.u.）で三相電力を P = V×I と計算するとき、√3 は要るか？",
      options: ["×√3 が要る", "×1（不要）", "×3 が要る", "÷√3 が要る"],
      correctIndex: 1,
      why: "基準容量 Sb=√3·Vb·Ib に √3 が織り込み済み。比率（p.u.）どうしの掛け算では構造係数が消える。",
      contrast: "実量（V・A・W）へ戻した瞬間に √3 が復活する。「どちらの世界で計算しているか」を常に意識する。",
      area: "短絡・％インピーダンス",
    },
    {
      scenario: "%Z = 8%（基準 10 MVA）の機器を基準 100 MVA に換算する。%Z に掛ける係数は？",
      options: ["×10", "×√10", "×1/10", "×100"],
      correctIndex: 0,
      why: "%Z は基準容量に対する比率なので基準容量に比例する。10 MVA → 100 MVA なら10倍の 80%。",
      contrast: "電圧階級の換算は単位法では不要（基準電圧に吸収済み）。実量Ωに戻すときだけ (V²/S) が効く。",
      area: "短絡・％インピーダンス",
    },
    {
      scenario: "巻数比 a の変圧器。二次側インピーダンス Z を一次側の実量[Ω]へ換算するときの係数は？",
      options: ["×a", "×a²", "×1/a²", "×1（そのまま）"],
      correctIndex: 1,
      why: "一次から見ると電圧 a 倍・電流 1/a 倍に見えるので Z=V/I は a² 倍。実量計算では必ず付く。",
      contrast: "単位法なら両側の基準電圧を巻数比どおりに選ぶため換算不要（×1）— これが系統計算で p.u. を使う理由。",
      area: "変圧器",
    },
    {
      scenario: "単位法で、基準電圧を巻数比どおりに選んだ系統の変圧器をまたぐインピーダンス換算は？",
      options: ["×a² が要る", "×a が要る", "×1（換算不要）", "×1/a が要る"],
      correctIndex: 2,
      why: "巻数比 a² の換算が基準インピーダンス（Vb²/Sb）の比にちょうど吸収され、p.u. 値は両側で同じになる。",
      contrast: "実量[Ω]の世界では a² が必ず要る。単位法は「係数を消す」代わりに基準の選び方に責任を移した道具。",
      area: "変圧器",
    },
  ],
  omega: [
    {
      scenario: "周波数 f [Hz] が与えられたコイル L の誘導性リアクタンス X_L は？",
      options: ["X=2πfL", "X=fL", "X=πfL", "X=fL/(2π)"],
      correctIndex: 0,
      why: "リアクタンスの定義は X_L=ωL。ω は角速度なので、周波数から使うには ω=2πf を代入する。",
      contrast: "問題文が角周波数 ω [rad/s] で与えていれば X=ωL でそのまま。2π は「Hz→rad/s」の換算にだけ付く。",
      area: "単相交流回路",
    },
    {
      scenario: "50 Hz の系統の角周波数 ω はおよそいくつか？",
      options: ["50 rad/s", "100 rad/s", "157 rad/s", "314 rad/s"],
      correctIndex: 3,
      why: "ω = 2πf = 2π×50 ≒ 314 rad/s。60 Hz なら約 377 rad/s（どちらも暗記推奨）。",
      contrast: "f と ω を混同すると常に約6.28倍ずれる。単位が Hz か rad/s かで必ず見分ける。",
      area: "単相交流回路",
    },
    {
      scenario: "同期速度 Ns = 120f/p を計算するとき、f を ω=2πf に置き換える必要はあるか？",
      options: ["ω=2πf に置き換える", "f をそのまま使う（置き換え不要）", "ω/2 を使う", "2πf² を使う"],
      correctIndex: 1,
      why: "Ns=120f/p は毎分回転数[min⁻¹]を周波数から直接出す式で、120 の中に 60秒×2 が入っている。ω は登場しない。",
      contrast: "機械角速度 ωm [rad/s] が要るときは ωm = 2π·Ns/60 と別に換算する。求める量の単位で使う式が決まる。",
      area: "誘導機",
    },
    {
      scenario: "直列共振の角周波数は ω0 = 1/√(LC)。これを共振「周波数」f0 [Hz] に直すと？",
      options: ["f0 = 1/√(LC)", "f0 = 2π/√(LC)", "f0 = 1/(2π√(LC))", "f0 = √(LC)/(2π)"],
      correctIndex: 2,
      why: "ω=2πf より f=ω/(2π)。角周波数の式を 2π で割ると周波数の式になる。",
      contrast: "rad/s のままでよいなら ω0=1/√(LC) で完了。単位を Hz にした瞬間に 1/(2π) が現れる。",
      area: "単相交流回路",
    },
  ],
  waveform: [
    {
      scenario: "正弦波を全波整流したときの平均値は、最大値 Vm の何倍か？",
      options: ["×1/2", "×2/π（≒0.637）", "×1/√2（≒0.707）", "×π/2"],
      correctIndex: 1,
      why: "半周期の平均 (1/π)∫₀^π Vm·sinθ dθ = 2Vm/π。面積を時間で割った「ならし」の値。",
      contrast: "実効値は Vm/√2 ≒ 0.707Vm。0.637（平均値）と 0.707（実効値）は別物で、混同が典型の失点。",
      area: "パワーエレクトロニクス",
    },
    {
      scenario: "正弦波の波形率（実効値 ÷ 平均値）はいくつか？",
      options: ["1.11", "1.41", "0.9", "1.73"],
      correctIndex: 0,
      why: "(Vm/√2) ÷ (2Vm/π) = π/(2√2) ≒ 1.11。分子が実効値・分母が平均値。",
      contrast: "波高率（最大値 ÷ 実効値）は √2 ≒ 1.41。どちらも「率」だが分子分母が違う。",
      area: "単相交流回路",
    },
    {
      scenario: "可動コイル形計器で整流形交流電圧計を作るとき、目盛はどう作られているか？",
      options: [
        "平均値をそのまま指示する",
        "平均値に波形率 1.11 を掛けて実効値を指示する",
        "実効値に 1.11 を掛けて指示する",
        "最大値を指示する",
      ],
      correctIndex: 1,
      why: "可動コイル形は平均値に応答する。正弦波の実効値を読ませたいので、平均値×1.11 の目盛を刻んである。",
      contrast:
        "ひずみ波を測ると「正弦波である」前提が崩れて誤差が出る。実効値形（可動鉄片形など）なら波形によらない。",
      area: "単相交流回路",
    },
    {
      scenario: "振幅 Vm の対称方形波（±Vm を半周期ずつ）の波形率はいくつか？",
      options: ["1.11", "1.41", "1.00", "0.9"],
      correctIndex: 2,
      why: "方形波は常に大きさ Vm なので実効値も平均値（絶対値平均）も Vm。比は 1.00 になる。",
      contrast: "正弦波の 1.11 を波形によらず使うのが典型ミス。波形率は波形ごとに決まる指標。",
      area: "単相交流回路",
    },
  ],
  base: [
    {
      scenario: "三相基準（基準容量 Sb=三相容量・基準電圧 Vb=線間電圧）での基準電流 Ib は？",
      options: ["Ib = Sb/Vb", "Ib = Sb/(√3·Vb)", "Ib = √3·Sb/Vb", "Ib = Sb/(3·Vb)"],
      correctIndex: 1,
      why: "三相容量の定義 Sb = √3·Vb·Ib を Ib について解くだけ。√3 は「線間電圧で表した」代償。",
      contrast: "1相基準（1相容量・相電圧）なら Ib = Sb1/Vp とそのまま割る。基準の取り方で式が変わる。",
      area: "短絡・％インピーダンス",
    },
    {
      scenario: "三相基準での基準インピーダンス Zb は？",
      options: ["Zb = Vb/Sb", "Zb = √3·Vb²/Sb", "Zb = Vb²/Sb", "Zb = Vb²/(3·Sb)"],
      correctIndex: 2,
      why: "Zb = 相電圧/基準電流 = (Vb/√3)/(Sb/(√3·Vb)) = Vb²/Sb。分子分母の √3 が約分されて消える。",
      contrast: "√3 が2回現れて打ち消すため、結果だけ見ると単相と同じ形になる。約分の過程を知らないと暗記になる。",
      area: "短絡・％インピーダンス",
    },
    {
      scenario: "1相分の容量で %Z が表示された単相変圧器を、3台で三相を組んで三相基準の系統に入れる。%Z の扱いは？",
      options: ["そのまま使える", "基準容量を3倍（三相容量）とみなして換算する", "√3 倍する", "1/3 にする"],
      correctIndex: 1,
      why: "%Z は「表示された基準容量に対する比率」。単相3台の三相容量は1相容量の3倍なので、その基準へ換算する。",
      contrast: "最初から三相容量で %Z が表示された機器は換算不要。まず「何の容量に対する%か」を読む。",
      area: "変圧器",
    },
    {
      scenario: "三相短絡電流を p.u. で求めた。実量[A]に戻すために掛ける値は？",
      options: ["×Vb", "×Sb/Vb", "×√3·Vb", "×Ib = Sb/(√3·Vb)"],
      correctIndex: 3,
      why: "p.u. 値 × その量の基準値 = 実量。電流なら基準電流 Ib を掛ける（三相基準なら Sb/(√3·Vb)）。",
      contrast: "電力に戻すなら ×Sb、電圧なら ×Vb。「どの量の基準か」を取り違えると √3 のずれが出る。",
      area: "短絡・故障計算",
    },
  ],
};

/** 1セッションで出す既定の問題数（why-check と同じく、多すぎず・進む量）。 */
export const COEFF_DRILL_SESSION_SIZE = 6;

/** 係数判断ドリルの安定 ID を作る。 */
export function coefficientDrillId(familyId: string, index: number): string {
  return `${familyId}#${index}`;
}

/**
 * ファミリ定義順にドリルを展開する（ID・order を付与）。
 * ファミリに seeds が無い場合も黙って落とさず0件として扱う（テストで1件以上を保証）。
 */
function buildItems(): CoefficientDrillItem[] {
  const items: CoefficientDrillItem[] = [];
  for (const family of COEFFICIENT_FAMILIES) {
    const seeds = DRILL_SEEDS[family.id] ?? [];
    seeds.forEach((seed, index) => {
      items.push({
        id: coefficientDrillId(family.id, index),
        familyId: family.id,
        scenario: seed.scenario,
        options: [...seed.options],
        correctIndex: seed.correctIndex,
        why: seed.why,
        contrast: seed.contrast,
        area: seed.area,
        order: items.length,
      });
    });
  }
  return items;
}

/** 全係数判断ドリル（ファミリ定義順）。 */
export const COEFFICIENT_DRILL_ITEMS: readonly CoefficientDrillItem[] = buildItems();

/** ID からドリルをひく（未知の ID は undefined）。 */
export function getCoefficientDrillItem(
  id: string,
  items: readonly CoefficientDrillItem[] = COEFFICIENT_DRILL_ITEMS,
): CoefficientDrillItem | undefined {
  return items.find((i) => i.id === id);
}

/** ファミリ ID からファミリをひく（未知は undefined）。 */
export function getCoefficientFamily(
  familyId: string,
  families: readonly CoefficientFamily[] = COEFFICIENT_FAMILIES,
): CoefficientFamily | undefined {
  return families.find((f) => f.id === familyId);
}

/** 指定ファミリのドリル（定義順を保つ）。 */
export function coefficientDrillsForFamily(
  familyId: string,
  items: readonly CoefficientDrillItem[] = COEFFICIENT_DRILL_ITEMS,
): CoefficientDrillItem[] {
  return items.filter((i) => i.familyId === familyId);
}

/** 1ドリルのスケジューラ状態（web の FSRS ビューから供給される最小情報）。 */
export interface CoefficientDrillState {
  /** 次回出題予定（epoch ms）。 */
  dueMs: number;
  /** 忘却回数（FSRS の lapses。苦手ファミリの推定に使う。省略可）。 */
  lapses?: number;
}

/** 係数判断ドリル全体の進捗サマリー。 */
export interface CoefficientDrillStats {
  /** 全ドリル数。 */
  total: number;
  /** 一度でも回答したドリル数。 */
  started: number;
  /** 既習のうち期限が来ている数。 */
  due: number;
  /** 未着手の数。 */
  fresh: number;
}

/** 進捗を集計する（純関数）。 */
export function coefficientDrillStats(
  states: ReadonlyMap<string, CoefficientDrillState>,
  nowMs: number = Date.now(),
  items: readonly CoefficientDrillItem[] = COEFFICIENT_DRILL_ITEMS,
): CoefficientDrillStats {
  let started = 0;
  let due = 0;
  let fresh = 0;
  for (const item of items) {
    const state = states.get(item.id);
    if (!state) {
      fresh += 1;
      continue;
    }
    started += 1;
    if (state.dueMs <= nowMs) due += 1;
  }
  return { total: items.length, started, due, fresh };
}

/**
 * 今回出すべき係数判断ドリルを返す（why-check と同じ定石）。
 *
 * 並び:
 *   1. 既習で期限到来のもの（期限が古い順 → 定義順）— 忘れかけの再固定を最優先。
 *   2. 未着手のもの（定義順）— ファミリの基礎対比から順に開拓する。
 */
export function dueCoefficientDrills(
  states: ReadonlyMap<string, CoefficientDrillState>,
  nowMs: number = Date.now(),
  limit: number = COEFF_DRILL_SESSION_SIZE,
  items: readonly CoefficientDrillItem[] = COEFFICIENT_DRILL_ITEMS,
): CoefficientDrillItem[] {
  const reviewing: Array<{ item: CoefficientDrillItem; dueMs: number }> = [];
  const fresh: CoefficientDrillItem[] = [];
  for (const item of items) {
    const state = states.get(item.id);
    if (!state) {
      fresh.push(item);
    } else if (state.dueMs <= nowMs) {
      reviewing.push({ item, dueMs: state.dueMs });
    }
  }
  reviewing.sort((a, b) => a.dueMs - b.dueMs || a.item.order - b.item.order);
  fresh.sort((a, b) => a.order - b.order);
  return [...reviewing.map((r) => r.item), ...fresh].slice(0, Math.max(0, limit));
}

/** 選択肢 index が正解かを判定する（範囲外・非整数は不正解）。 */
export function gradeCoefficientDrill(item: CoefficientDrillItem, chosenIndex: number): boolean {
  return Number.isInteger(chosenIndex) && chosenIndex === item.correctIndex;
}

/**
 * 正誤を FSRS の評価へ写す。客観採点なので自己申告の4段階は使わず、
 * 正解 → good（標準間隔）・不正解 → again（すぐ再出題）の2値に固定する。
 */
export function ratingForCoefficientAnswer(correct: boolean): Rating {
  return correct ? "good" : "again";
}

/** ファミリ1つぶんの進捗（ダッシュボードの「三種→二種ブリッジ」表示用）。 */
export interface CoefficientFamilyProgress {
  family: CoefficientFamily;
  total: number;
  started: number;
  due: number;
  /** ファミリ内の忘却回数の合計（大きいほど「混ざりやすい」係数）。 */
  lapses: number;
}

/**
 * ファミリごとの進捗を集計する（定義順・決定論）。
 * lapses は状態に含まれるときだけ加算する（省略時は0扱い）。
 */
export function coefficientFamilyProgress(
  states: ReadonlyMap<string, CoefficientDrillState>,
  nowMs: number = Date.now(),
  families: readonly CoefficientFamily[] = COEFFICIENT_FAMILIES,
  items: readonly CoefficientDrillItem[] = COEFFICIENT_DRILL_ITEMS,
): CoefficientFamilyProgress[] {
  return families.map((family) => {
    let total = 0;
    let started = 0;
    let due = 0;
    let lapses = 0;
    for (const item of items) {
      if (item.familyId !== family.id) continue;
      total += 1;
      const state = states.get(item.id);
      if (!state) continue;
      started += 1;
      if (state.dueMs <= nowMs) due += 1;
      lapses += state.lapses ?? 0;
    }
    return { family, total, started, due, lapses };
  });
}

/**
 * いちばん「混ざっている」疑いのあるファミリを返す（着手済みで lapses 最多のもの）。
 * 全ファミリ未着手・lapses 0 のときは undefined（指摘することがない）。
 */
export function weakestCoefficientFamily(
  progress: readonly CoefficientFamilyProgress[],
): CoefficientFamilyProgress | undefined {
  const candidates = progress.filter((p) => p.started > 0 && p.lapses > 0);
  if (candidates.length === 0) return undefined;
  return candidates.reduce((worst, p) => (p.lapses > worst.lapses ? p : worst));
}
