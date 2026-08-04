/**
 * curriculum/graph.ts — 前提コンセプトグラフ（prerequisite concept graph）の純ロジック。
 *
 * 目的: 電験の主要分野には「これを理解してから次へ」という自然な前提関係がある
 *   （例: 直流回路 → 単相交流 → 三相交流）。前提が満たされていない分野を先に潰すと
 *   学習効率が上がる。前提グラフ（DAG）から「次に学ぶのにおすすめの分野」と
 *   「まだ前提不足でブロック中の分野」を返す。
 *
 * 方針:
 *   - エッジは「prereq → topic（prereq を前提とする topic）」の有向辺の集合。
 *   - 循環は持たない（DAG）。hasCycle() で検証でき、テストで保証する。
 *   - 「習得済み(mastered)集合」を入力に、前提がすべて mastered な未習得分野を
 *     recommended、前提が1つでも未習得な分野を blocked として返す。
 *   - 分野名は pastexam-areas / problems の topic と完全一致させる必要はない
 *     （上位の概念ノードとして扱い、UIヒントは概念名で出す）。
 *
 * 体系学習パイプラインの単一情報源として lib 層に置く（旧 web/src/concept-graph.ts から移設。
 * web 側は再エクスポートで互換維持）。curriculum/path.ts のロードマップ生成、
 * curriculum/principles.ts の原理カードはこのグラフのノード名を共通言語にする。
 *
 * DOM 非依存・状態なし。
 */

/** 前提エッジ: from を前提として to を学ぶ（from → to）。 */
export interface PrereqEdge {
  from: string;
  to: string;
}

/**
 * 主要概念の前提グラフ（DAG）。理論を土台に電力/機械/二次へ広がる依存を最小限で表現する。
 * ここに無い分野は「前提なし＝いつでも着手可」として扱う。
 */
export const CONCEPT_EDGES: readonly PrereqEdge[] = [
  // 理論の基礎連鎖
  { from: "直流回路", to: "単相交流回路" },
  { from: "単相交流回路", to: "三相交流回路" },
  { from: "静電気", to: "電磁気" },
  { from: "電子理論", to: "電子回路" },
  // 理論 → 電力・機械への橋渡し
  { from: "三相交流回路", to: "送電・線路計算" },
  { from: "三相交流回路", to: "短絡・％インピーダンス" },
  { from: "電磁気", to: "変圧器" },
  { from: "変圧器", to: "誘導機" },
  { from: "電磁気", to: "直流機" },
  { from: "誘導機", to: "同期機" },
  { from: "電子回路", to: "パワーエレクトロニクス" },
  // 電力 → 二次（電力管理）
  { from: "短絡・％インピーダンス", to: "短絡・故障計算" },
  { from: "送電・線路計算", to: "送電・系統安定度" },
  // 機械 → 二次（機械制御）
  { from: "パワーエレクトロニクス", to: "回転機の制御" },
  { from: "同期機", to: "回転機の制御" },
  { from: "単相交流回路", to: "自動制御理論" },
];

/**
 * 概念ノード → 実データの granular な topic 名に現れるキーワード群。
 * 問題側は "RLC直列回路の共振" のように細かい topic 名を持ち、概念ノード名("単相交流回路")
 * とは一致しない。学習者がどの概念領域に到達したかを推定するため、topic 名へのキーワード
 * 部分一致でマッピングする（純粋・テスト可能）。
 */
export const CONCEPT_KEYWORDS: Readonly<Record<string, readonly string[]>> = {
  直流回路: ["直流回路", "合成抵抗", "キルヒホッフ", "テブナン", "ブリッジ", "分流器", "倍率器", "抵抗の温度"],
  単相交流回路: ["単相", "RLC", "RC回路", "RL回路", "共振", "時定数", "力率"],
  三相交流回路: ["三相", "Δ-Y", "Y結線", "二電力計", "対称座標"],
  静電気: ["静電", "コンデンサ", "クーロン", "電界", "誘電", "コンデンサの"],
  電磁気: ["磁界", "電磁力", "磁気エネルギー", "ソレノイド", "平行導体", "インダクタンス"],
  電子理論: ["半導体", "ダイオード", "トランジスタ", "電子"],
  電子回路: ["オペアンプ", "増幅", "発振", "整流回路", "電子回路"],
  "送電・線路計算": ["送電", "電圧降下", "線路", "送電効率"],
  "短絡・％インピーダンス": ["短絡", "％インピーダンス", "%インピーダンス", "パーセントインピーダンス"],
  変圧器: ["変圧器"],
  誘導機: ["誘導機", "すべり", "比例推移", "同期速度"],
  直流機: ["直流機", "電機子", "逆起電力"],
  同期機: ["同期発電機", "同期機", "短絡比", "同期速度"],
  パワーエレクトロニクス: ["インバータ", "チョッパ", "整流", "PWM", "パワーエレクトロニクス"],
  "短絡・故障計算": ["短絡容量", "地絡", "故障"],
  "送電・系統安定度": ["系統安定度", "安定度"],
  回転機の制御: ["回転機", "トルク", "回転体"],
  自動制御理論: ["制御", "伝達関数", "定常偏差", "ステップ応答", "固有角"],
};

/**
 * 習得済みの granular な topic 名集合から、到達した概念ノード(area)集合を推定する。
 * いずれかの topic 名が概念のキーワードを含めば、その概念は到達済みとみなす。
 *
 * @param masteredTopics 習得済みの topic 名（dashboard の masteredTopics など）。
 */
export function masteredConceptAreas(masteredTopics: Iterable<string>): Set<string> {
  const topics = [...masteredTopics];
  const areas = new Set<string>();
  for (const [concept, keywords] of Object.entries(CONCEPT_KEYWORDS)) {
    if (topics.some((t) => keywords.some((k) => t.includes(k)))) areas.add(concept);
  }
  return areas;
}

/** グラフの隣接表現（prereq -> それを前提とする後続たち）。 */
function buildAdjacency(edges: readonly PrereqEdge[]): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    const arr = adj.get(e.from) ?? [];
    arr.push(e.to);
    adj.set(e.from, arr);
  }
  return adj;
}

/** グラフに登場する全ノード集合。 */
function collectNodes(edges: readonly PrereqEdge[]): Set<string> {
  const nodes = new Set<string>();
  for (const e of edges) {
    nodes.add(e.from);
    nodes.add(e.to);
  }
  return nodes;
}

/**
 * topic -> その直接の前提集合。ロードマップ生成（curriculum/path.ts）でも使うため公開する。
 */
export function directPrereqs(edges: readonly PrereqEdge[] = CONCEPT_EDGES): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const e of edges) {
    const arr = m.get(e.to) ?? [];
    arr.push(e.from);
    m.set(e.to, arr);
  }
  return m;
}

/**
 * グラフに循環があるか（DFS の3色塗り）。DAG であることをテストで保証するために公開する。
 */
export function hasCycle(edges: readonly PrereqEdge[] = CONCEPT_EDGES): boolean {
  const adj = buildAdjacency(edges);
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  const nodes = collectNodes(edges);
  const dfs = (node: string): boolean => {
    color.set(node, GRAY);
    for (const next of adj.get(node) ?? []) {
      const c = color.get(next) ?? WHITE;
      if (c === GRAY) return true; // 後退辺 → 循環
      if (c === WHITE && dfs(next)) return true;
    }
    color.set(node, BLACK);
    return false;
  };
  for (const node of nodes) {
    if ((color.get(node) ?? WHITE) === WHITE && dfs(node)) return true;
  }
  return false;
}

/**
 * 各ノードの「体系深さ」＝最長前提連鎖の長さ（前提なし=0）を返す（Kahn 法の反復実装）。
 * 深さは学習段階（基礎→応用）のグルーピングに使う。エッジに沿って深さは必ず増えるので、
 * (深さ, 名前) の順で並べればトポロジカル順になる。
 *
 * 循環に巻き込まれたノードは深さを確定できないため結果に含めない
 * （CONCEPT_EDGES が DAG であることは hasCycle のテストで保証する。防御的挙動）。
 */
export function conceptDepths(edges: readonly PrereqEdge[] = CONCEPT_EDGES): Map<string, number> {
  const adj = buildAdjacency(edges);
  const prereqMap = directPrereqs(edges);
  const nodes = collectNodes(edges);
  const remaining = new Map<string, number>(); // 未処理の直接前提数
  const depths = new Map<string, number>();
  const queue: string[] = [];
  for (const n of nodes) {
    const count = (prereqMap.get(n) ?? []).length;
    remaining.set(n, count);
    if (count === 0) {
      depths.set(n, 0);
      queue.push(n);
    }
  }
  for (let i = 0; i < queue.length; i++) {
    const n = queue[i] as string; // i < queue.length のため在中
    const d = depths.get(n) ?? 0;
    for (const next of adj.get(n) ?? []) {
      depths.set(next, Math.max(depths.get(next) ?? 0, d + 1));
      const left = (remaining.get(next) ?? 0) - 1;
      remaining.set(next, left);
      if (left === 0) queue.push(next);
    }
  }
  // 循環に巻き込まれた（前提が処理しきれなかった）ノードは深さ未確定として落とす。
  for (const n of nodes) {
    if ((remaining.get(n) ?? 0) > 0) depths.delete(n);
  }
  return depths;
}

/**
 * 決定論的なトポロジカル順（体系順）。深さ昇順 → 同深さは名前の辞書順（ja）で安定。
 * 循環に巻き込まれたノードは含めない（conceptDepths と同じ防御的挙動）。
 */
export function topologicalOrder(edges: readonly PrereqEdge[] = CONCEPT_EDGES): string[] {
  const depths = conceptDepths(edges);
  return [...depths.keys()].sort((a, b) => (depths.get(a) ?? 0) - (depths.get(b) ?? 0) || a.localeCompare(b, "ja"));
}

/** 学習順のおすすめ結果。 */
export interface ConceptRecommendation {
  /** 前提がすべて習得済みで、本人がまだ習得していない「次に学ぶべき」分野。 */
  recommended: string[];
  /** 前提が1つ以上未習得でまだ手を出しにくい分野（不足前提つき）。 */
  blocked: Array<{ topic: string; missingPrereqs: string[] }>;
}

/**
 * 習得済み集合から「次に学ぶおすすめ」と「前提不足でブロック中」を返す。
 *
 * - recommended: 未習得 かつ 直接前提がすべて mastered な分野（前提ゼロの分野も含む）。
 * - blocked:     未習得 かつ 直接前提に未習得が混じる分野（不足前提を添える）。
 * 既に mastered の分野はどちらにも入れない。
 *
 * @param mastered 習得済みとみなす分野名の集合（dashboard のマスター論点など）。
 * @param edges    前提グラフ（既定は CONCEPT_EDGES）。
 */
export function recommendNextConcepts(
  mastered: Iterable<string>,
  edges: readonly PrereqEdge[] = CONCEPT_EDGES,
): ConceptRecommendation {
  const done = new Set(mastered);
  const prereqMap = directPrereqs(edges);
  const nodes = collectNodes(edges);
  const recommended: string[] = [];
  const blocked: ConceptRecommendation["blocked"] = [];
  for (const topic of nodes) {
    if (done.has(topic)) continue; // 習得済みは対象外
    const prereqs = prereqMap.get(topic) ?? [];
    const missing = prereqs.filter((p) => !done.has(p));
    if (missing.length === 0) recommended.push(topic);
    else blocked.push({ topic, missingPrereqs: missing });
  }
  // 安定した順序（テスト・表示のため辞書順）。
  recommended.sort((a, b) => a.localeCompare(b, "ja"));
  blocked.sort((a, b) => a.topic.localeCompare(b.topic, "ja"));
  return { recommended, blocked };
}
