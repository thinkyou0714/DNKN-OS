/**
 * tests/curriculum/coefficients.test.ts — 係数リーズニングのコンテンツ不変条件と出題ロジックの検証。
 *  - ファミリとドリルの網羅性（各ファミリに対比が成立する2問以上）
 *  - 安定ID（family#index）・定義順・ゴールデン表（途中挿入・並べ替えの検出）
 *  - area がグラフのノード名に実在（原理カード・根っこ診断への導線を壊さない）
 *  - 出題順（期限到来優先→未着手を定義順）・採点・FSRS評価への写像・ファミリ進捗
 */
import { describe, expect, it } from "vitest";
import {
  COEFF_DRILL_SESSION_SIZE,
  COEFFICIENT_DRILL_ITEMS,
  COEFFICIENT_FAMILIES,
  type CoefficientDrillItem,
  type CoefficientDrillState,
  coefficientDrillId,
  coefficientDrillStats,
  coefficientDrillsForFamily,
  coefficientFamilyProgress,
  dueCoefficientDrills,
  getCoefficientDrillItem,
  getCoefficientFamily,
  gradeCoefficientDrill,
  ratingForCoefficientAnswer,
  weakestCoefficientFamily,
} from "../../lib/curriculum/coefficients.js";
import { CONCEPT_EDGES } from "../../lib/curriculum/graph.js";

const NOW = Date.UTC(2026, 7, 1);
const DAY = 86_400_000;

const nodeNames = new Set(CONCEPT_EDGES.flatMap((e) => [e.from, e.to]));

/**
 * ID → 状況文の対応を固定するゴールデン表。
 *
 * 保存済みの記憶状態（denken:coeffCards）はこの ID をキーにするため、既存 ID が別の問題を
 * 指すようになると、ユーザーの復習履歴が黙って別の問題に付け替わる。
 * ドリルの途中挿入・並べ替え・削除をしたときにこのテストが落ちるようにしておく
 * （追加は各ファミリの末尾のみ安全＝新しい ID が増えるだけなので、下の表に追記すれば通る）。
 */
const GOLDEN_ID_SCENARIOS: ReadonlyArray<readonly [string, string]> = [
  ["sqrt3#0", "Y結線の三相電源。相電圧 E に対して、線間電圧は E の何倍か？"],
  ["sqrt3#1", "Δ結線の三相電源。相電圧 E に対して、線間電圧は E の何倍か？"],
  ["sqrt3#2", "Δ結線の負荷。相電流 I に対して、線電流は I の何倍か？"],
  ["sqrt3#3", "三相電力を「線間電圧 Vl・線電流 Il」で表すとき、Vl·Il·cosθ に掛ける係数は？"],
  ["sqrt3#4", "三相電力を「相電圧 Vp・相電流 Ip」で表すとき、Vp·Ip·cosθ に掛ける係数は？"],
  ["half#0", "静電容量 C を電圧 V まで充電したとき、蓄積エネルギーは C·V² の何倍か？"],
  ["half#1", "インダクタンス L に電流 I を流したとき、磁気エネルギーは L·I² の何倍か？"],
  ["half#2", "慣性モーメント J のはずみ車が角速度 ω で回るとき、運動エネルギーは J·ω² の何倍か？"],
  ["half#3", "実効値 V・I と力率 cosθ で単相交流電力を書くとき、V·I·cosθ に 1/2 は要るか？"],
  ["half#4", "最大値（振幅）Vm・Im と位相差 θ で単相交流の平均電力を書くとき、Vm·Im·cosθ に掛ける係数は？"],
  ["sqrt2#0", "実効値 100 V の正弦波電圧。最大値（波高値）は実効値の何倍か？"],
  ["sqrt2#1", "最大値 Vm の正弦波の実効値を求めたい。Vm に掛ける係数は？"],
  ["sqrt2#2", "直流 100 V の実効値を求めたい。√2 の換算は要るか？"],
  ["sqrt2#3", "交流実効値 V をダイオード整流＋コンデンサ平滑した無負荷時の直流出力電圧は V の約何倍か？"],
  ["sqrt2#4", "変圧器の誘導起電力 E = 4.44·f·N·Φm。係数 4.44 の正体は？"],
  ["two#0", "単相2線式。片道1線分の抵抗 R・リアクタンス X、電流 I のとき、電圧降下 I(Rcosθ+Xsinθ) に掛ける係数は？"],
  ["two#1", "三相3線式。1線分の電圧降下 I(Rcosθ+Xsinθ) に対して、線間電圧の降下は何倍か？"],
  ["two#2", "単相3線式で両側の負荷が平衡しているとき、中性線での電圧降下は外線1線分の何倍か？"],
  ["two#3", "単相2線式の線路損失。片道1線分の抵抗 R・電流 I のとき、損失は I²R の何倍か？"],
  ["sym#0", "対称座標法で零相電流 I0 を求める。(Ia + Ib + Ic) に掛ける係数は？"],
  ["sym#1", "一線地絡故障。故障点に流れる地絡電流は零相電流 I0 の何倍か？"],
  ["sym#2", "平衡した三相電流（各実効値 I・120°ずつずれ）のベクトル和の大きさは I の何倍か？"],
  ["perunit#0", "単位法（p.u.）で三相電力を P = V×I と計算するとき、√3 は要るか？"],
  ["perunit#1", "%Z = 8%（基準 10 MVA）の機器を基準 100 MVA に換算する。%Z に掛ける係数は？"],
  ["perunit#2", "巻数比 a の変圧器。二次側インピーダンス Z を一次側の実量[Ω]へ換算するときの係数は？"],
  ["perunit#3", "単位法で、基準電圧を巻数比どおりに選んだ系統の変圧器をまたぐインピーダンス換算は？"],
];

/** dueMs だけの状態マップを組む小道具。 */
function states(entries: Array<[string, number, number?]>): Map<string, CoefficientDrillState> {
  return new Map(entries.map(([id, dueMs, lapses]) => [id, lapses === undefined ? { dueMs } : { dueMs, lapses }]));
}

describe("COEFFICIENT_FAMILIES — コンテンツ不変条件", () => {
  it("ファミリ ID は一意で、説明フィールドが空でない", () => {
    const seen = new Set<string>();
    for (const f of COEFFICIENT_FAMILIES) {
      expect(seen.has(f.id), `ファミリ ID 重複: ${f.id}`).toBe(false);
      seen.add(f.id);
      expect(f.name.trim().length, f.id).toBeGreaterThan(0);
      expect(f.origin.trim().length, f.id).toBeGreaterThan(0);
      expect(f.whenNeeded.trim().length, f.id).toBeGreaterThan(0);
      expect(f.whenNot.trim().length, f.id).toBeGreaterThan(0);
      expect(f.denken2Note.trim().length, f.id).toBeGreaterThan(0);
    }
  });

  it("全ファミリに対比が成立する2問以上のドリルがある", () => {
    for (const f of COEFFICIENT_FAMILIES) {
      expect(coefficientDrillsForFamily(f.id).length, `ファミリ ${f.id} は対比ペアに満たない`).toBeGreaterThanOrEqual(
        2,
      );
    }
  });
});

describe("COEFFICIENT_DRILL_ITEMS — コンテンツ不変条件", () => {
  it("ID は安定（family#index）で一意、order は 0 から連番", () => {
    const ids = new Set<string>();
    COEFFICIENT_DRILL_ITEMS.forEach((item, i) => {
      expect(ids.has(item.id), `ID 重複: ${item.id}`).toBe(false);
      ids.add(item.id);
      expect(item.order).toBe(i);
    });
    const first = COEFFICIENT_DRILL_ITEMS[0] as CoefficientDrillItem;
    expect(first.id).toBe(coefficientDrillId(first.familyId, 0));
  });

  it("familyId は実在するファミリを指す", () => {
    for (const item of COEFFICIENT_DRILL_ITEMS) {
      expect(getCoefficientFamily(item.familyId), `未知のファミリ: ${item.familyId}`).toBeDefined();
    }
  });

  it("area は前提グラフのノード名に実在する（原理カード・根っこ診断への導線）", () => {
    for (const item of COEFFICIENT_DRILL_ITEMS) {
      expect(nodeNames.has(item.area), `グラフ外の area: ${item.area}（${item.id}）`).toBe(true);
    }
  });

  it("選択肢は2つ以上・重複なし・correctIndex は範囲内", () => {
    for (const item of COEFFICIENT_DRILL_ITEMS) {
      expect(item.options.length, item.id).toBeGreaterThanOrEqual(2);
      expect(new Set(item.options).size, `選択肢重複: ${item.id}`).toBe(item.options.length);
      expect(Number.isInteger(item.correctIndex), item.id).toBe(true);
      expect(item.correctIndex, item.id).toBeGreaterThanOrEqual(0);
      expect(item.correctIndex, item.id).toBeLessThan(item.options.length);
      for (const opt of item.options) expect(opt.trim().length, item.id).toBeGreaterThan(0);
    }
  });

  it("正解の位置が偏らない（位置のパターン暗記で解けてしまわない）", () => {
    const positions = new Set(COEFFICIENT_DRILL_ITEMS.map((i) => i.correctIndex));
    expect(positions.size).toBeGreaterThanOrEqual(3);
  });

  it("why と contrast（最小対比）が空でない — 対比こそこのドリルの核", () => {
    for (const item of COEFFICIENT_DRILL_ITEMS) {
      expect(item.why.trim().length, item.id).toBeGreaterThan(0);
      expect(item.contrast.trim().length, item.id).toBeGreaterThan(0);
      expect(item.scenario.trim().length, item.id).toBeGreaterThan(0);
    }
  });

  it("ゴールデン表: ID → 状況文の対応が固定されている（途中挿入・並べ替え・削除の検出）", () => {
    expect(COEFFICIENT_DRILL_ITEMS.length).toBe(GOLDEN_ID_SCENARIOS.length);
    for (const [id, scenario] of GOLDEN_ID_SCENARIOS) {
      expect(getCoefficientDrillItem(id)?.scenario, id).toBe(scenario);
    }
  });
});

describe("dueCoefficientDrills — 出題順", () => {
  it("既習で期限到来のものを期限が古い順に最優先し、残り枠を未着手（定義順）で埋める", () => {
    const first = COEFFICIENT_DRILL_ITEMS[0] as CoefficientDrillItem;
    const second = COEFFICIENT_DRILL_ITEMS[1] as CoefficientDrillItem;
    const third = COEFFICIENT_DRILL_ITEMS[2] as CoefficientDrillItem;
    const queue = dueCoefficientDrills(
      states([
        [second.id, NOW - DAY], // 期限到来（古い）
        [first.id, NOW - DAY / 2], // 期限到来（新しい）
        [third.id, NOW + DAY], // 期限未来 → 出さない
      ]),
      NOW,
      4,
    );
    expect(queue.map((q) => q.id).slice(0, 2)).toEqual([second.id, first.id]);
    // 残り枠は未着手を定義順で（third は期限が未来なので現れない）。
    const fourth = COEFFICIENT_DRILL_ITEMS[3] as CoefficientDrillItem;
    const fifth = COEFFICIENT_DRILL_ITEMS[4] as CoefficientDrillItem;
    expect(queue.map((q) => q.id).slice(2)).toEqual([fourth.id, fifth.id]);
  });

  it("未着手のみなら定義順に既定数まで返す（決定論）", () => {
    const a = dueCoefficientDrills(states([]), NOW);
    const b = dueCoefficientDrills(states([]), NOW);
    expect(a.map((i) => i.id)).toEqual(b.map((i) => i.id));
    expect(a.length).toBe(COEFF_DRILL_SESSION_SIZE);
    expect(a.map((i) => i.id)).toEqual(COEFFICIENT_DRILL_ITEMS.slice(0, COEFF_DRILL_SESSION_SIZE).map((i) => i.id));
  });

  it("limit 0 以下は空を返す", () => {
    expect(dueCoefficientDrills(states([]), NOW, 0)).toEqual([]);
    expect(dueCoefficientDrills(states([]), NOW, -1)).toEqual([]);
  });

  it("母集団（pool）を渡すとその中だけから出題する", () => {
    const pool = coefficientDrillsForFamily("sym");
    const queue = dueCoefficientDrills(states([]), NOW, 10, pool);
    expect(queue.length).toBe(pool.length);
    for (const item of queue) expect(item.familyId).toBe("sym");
  });
});

describe("coefficientDrillStats — 進捗集計", () => {
  it("未着手のみなら fresh = total", () => {
    const s = coefficientDrillStats(states([]), NOW);
    expect(s.total).toBe(COEFFICIENT_DRILL_ITEMS.length);
    expect(s.fresh).toBe(s.total);
    expect(s.started).toBe(0);
    expect(s.due).toBe(0);
  });

  it("着手済み・期限到来を正しく数える", () => {
    const first = COEFFICIENT_DRILL_ITEMS[0] as CoefficientDrillItem;
    const second = COEFFICIENT_DRILL_ITEMS[1] as CoefficientDrillItem;
    const s = coefficientDrillStats(
      states([
        [first.id, NOW - 1], // 期限到来
        [second.id, NOW + DAY], // 学習済み・期限は未来
      ]),
      NOW,
    );
    expect(s.started).toBe(2);
    expect(s.due).toBe(1);
    expect(s.fresh).toBe(s.total - 2);
  });
});

describe("採点と FSRS 評価への写像", () => {
  it("正解の index だけを正解と判定する（範囲外・非整数は不正解）", () => {
    const item = COEFFICIENT_DRILL_ITEMS[0] as CoefficientDrillItem;
    expect(gradeCoefficientDrill(item, item.correctIndex)).toBe(true);
    expect(gradeCoefficientDrill(item, item.correctIndex + 1)).toBe(false);
    expect(gradeCoefficientDrill(item, -1)).toBe(false);
    expect(gradeCoefficientDrill(item, 0.5)).toBe(false);
    expect(gradeCoefficientDrill(item, Number.NaN)).toBe(false);
  });

  it("正解 → good・不正解 → again に写す（客観採点の2値固定）", () => {
    expect(ratingForCoefficientAnswer(true)).toBe("good");
    expect(ratingForCoefficientAnswer(false)).toBe("again");
  });
});

describe("coefficientFamilyProgress / weakestCoefficientFamily", () => {
  it("ファミリごとの total / started / due / lapses を定義順で集計する", () => {
    const sqrt3 = coefficientDrillsForFamily("sqrt3");
    const a = sqrt3[0] as CoefficientDrillItem;
    const b = sqrt3[1] as CoefficientDrillItem;
    const rows = coefficientFamilyProgress(
      states([
        [a.id, NOW - 1, 2],
        [b.id, NOW + DAY, 1],
      ]),
      NOW,
    );
    expect(rows.map((r) => r.family.id)).toEqual(COEFFICIENT_FAMILIES.map((f) => f.id));
    const row = rows.find((r) => r.family.id === "sqrt3");
    expect(row?.total).toBe(sqrt3.length);
    expect(row?.started).toBe(2);
    expect(row?.due).toBe(1);
    expect(row?.lapses).toBe(3);
    // 未着手ファミリは0。
    const untouched = rows.find((r) => r.family.id === "sym");
    expect(untouched?.started).toBe(0);
    expect(untouched?.lapses).toBe(0);
  });

  it("weakest は着手済みかつ lapses 最多のファミリ。全て lapses 0 なら undefined", () => {
    const sqrt3 = coefficientDrillsForFamily("sqrt3")[0] as CoefficientDrillItem;
    const sym = coefficientDrillsForFamily("sym")[0] as CoefficientDrillItem;
    const rows = coefficientFamilyProgress(
      states([
        [sqrt3.id, NOW, 1],
        [sym.id, NOW, 4],
      ]),
      NOW,
    );
    expect(weakestCoefficientFamily(rows)?.family.id).toBe("sym");
    const clean = coefficientFamilyProgress(states([[sqrt3.id, NOW, 0]]), NOW);
    expect(weakestCoefficientFamily(clean)).toBeUndefined();
  });
});
