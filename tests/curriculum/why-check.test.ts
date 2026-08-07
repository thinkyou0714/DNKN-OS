/**
 * tests/curriculum/why-check.test.ts — 納得チェックの間隔反復ロジックの検証。
 * アイテム展開（体系順・安定ID・網羅）、出題順（既習の期限到来優先→未着手を基礎順）、
 * 進捗集計、決定論を確認する。
 */
import { describe, expect, it } from "vitest";
import { topologicalOrder } from "../../lib/curriculum/graph.js";
import { PRINCIPLE_CARDS } from "../../lib/curriculum/principles.js";
import {
  dueWhyChecks,
  getWhyCheckItem,
  WHY_CHECK_ITEMS,
  WHY_CHECK_SESSION_SIZE,
  type WhyCheckItem,
  type WhyCheckState,
  whyCheckId,
  whyCheckStats,
  whyChecksForArea,
} from "../../lib/curriculum/why-check.js";

const NOW = Date.UTC(2026, 7, 1);
const DAY = 86_400_000;

/**
 * ID → 質問の対応を固定するゴールデン表。
 *
 * 保存済みの記憶状態（denken:whyCards）はこの ID をキーにするため、既存 ID が別の質問を
 * 指すようになると、ユーザーの復習履歴が黙って別の問題に付け替わる。
 * カード内 checks の途中挿入・並べ替え・削除をしたときにこのテストが落ちるようにしておく
 * （質問の追加は末尾のみ安全＝新しい ID が増えるだけなので、下の表に追記すれば通る）。
 */
const GOLDEN_ID_QUESTIONS: ReadonlyArray<readonly [string, string]> = [
  ["静電気#0", "静電エネルギー W = CV²/2 の 1/2 はなぜ付くのか？"],
  ["直流回路#0", "なぜ並列接続では各抵抗にかかる電圧が等しいのか？"],
  ["直流回路#1", "KVL（閉路の電圧の和が0）が成り立つ物理的根拠は？"],
  ["電子理論#0", "逆バイアスのダイオードに電流がほぼ流れないのはなぜか？"],
  ["単相交流回路#0", "なぜコイルの電流は電圧より90°遅れるのか？"],
  ["単相交流回路#1", "共振とは回路で何が起きている状態か？"],
  ["電子回路#0", "仮想短絡（v+ ≈ v−）が成り立つ根拠は？"],
  ["電磁気#0", "なぜインダクタンスは巻数の2乗に比例するのか？"],
  ["パワーエレクトロニクス#0", "チョッパの出力電圧式はどんな条件から導くのか？"],
  ["三相交流回路#0", "三相電力の式の √3 はどこから来るか？"],
  ["三相交流回路#1", "三相が送電で有利な理由を2つ挙げると？"],
  ["自動制御理論#0", "積分動作があるとステップ入力の定常偏差が0になるのはなぜか？"],
  ["直流機#0", "界磁を弱めると回転数が上がるのはなぜか？"],
  ["変圧器#0", "なぜインピーダンスは巻数比の2乗で換算されるのか？"],
  ["変圧器#1", "鉄損と銅損は負荷にどう依存するか？"],
  ["送電・線路計算#0", "なぜ高電圧で送ると損失が減るのか？"],
  ["送電・線路計算#1", "電圧降下近似式の Xsinθ 項は何を表すか？"],
  ["短絡・％インピーダンス#0", "%Z = 5% の変圧器の短絡電流は定格の何倍か。なぜか？"],
  ["誘導機#0", "なぜ誘導電動機は同期速度では回れないのか？"],
  ["誘導機#1", "二次抵抗を増やすと始動トルクが増えるのはなぜか？"],
  ["送電・系統安定度#0", "直列コンデンサが安定度を上げる理由は？"],
  ["短絡・故障計算#0", "%Z を合成する前に必ずやることは？なぜ？"],
  ["同期機#0", "負荷角 δ とは何と何の角度か？"],
  ["回転機の制御#0", "インバータ駆動で周波数だけ下げてはいけないのはなぜか？"],
];

/** dueMs だけの状態マップを組む小道具。 */
function states(entries: Array<[string, number]>): Map<string, WhyCheckState> {
  return new Map(entries.map(([id, dueMs]) => [id, { dueMs }]));
}

describe("WHY_CHECK_ITEMS", () => {
  it("全原理カードの納得チェックを取りこぼさず展開する", () => {
    const expected = PRINCIPLE_CARDS.reduce((n, c) => n + c.checks.length, 0);
    expect(WHY_CHECK_ITEMS.length).toBe(expected);
  });

  it("ID は安定（area#index）で一意", () => {
    const ids = new Set(WHY_CHECK_ITEMS.map((i) => i.id));
    expect(ids.size).toBe(WHY_CHECK_ITEMS.length);
    const first = WHY_CHECK_ITEMS[0] as WhyCheckItem;
    expect(first.id).toBe(whyCheckId(first.area, 0));
  });

  it("order は 0 から連番で、領域の初出順は体系順（基礎から）に一致する", () => {
    WHY_CHECK_ITEMS.forEach((item, i) => {
      expect(item.order).toBe(i);
    });
    const firstSeen: string[] = [];
    for (const item of WHY_CHECK_ITEMS) {
      if (!firstSeen.includes(item.area)) firstSeen.push(item.area);
    }
    const cardAreas = new Set(PRINCIPLE_CARDS.map((c) => c.area));
    expect(firstSeen).toEqual(topologicalOrder().filter((a) => cardAreas.has(a)));
  });

  it("同一領域のチェックはカード内の順序を保つ", () => {
    const area = "三相交流回路";
    const card = PRINCIPLE_CARDS.find((c) => c.area === area);
    const items = whyChecksForArea(area);
    expect(items.map((i) => i.question)).toEqual(card?.checks.map((c) => c.question));
  });

  it("既存 ID が指す質問は変わらない（保存済みの復習履歴が別の問題に付け替わらない）", () => {
    const actual = WHY_CHECK_ITEMS.map((i) => [i.id, i.question] as const);
    // 既存分は完全一致。新しい質問は末尾追加のみ許す（前方一致で比較する）。
    expect(actual.slice(0, GOLDEN_ID_QUESTIONS.length)).toEqual(GOLDEN_ID_QUESTIONS);
  });

  it("getWhyCheckItem は ID でひけて、未知の ID は undefined", () => {
    const target = WHY_CHECK_ITEMS[3] as WhyCheckItem;
    expect(getWhyCheckItem(target.id)).toEqual(target);
    expect(getWhyCheckItem("存在しない領域#0")).toBeUndefined();
  });
});

describe("whyCheckStats", () => {
  it("未着手のみなら fresh が全件", () => {
    const s = whyCheckStats(new Map(), NOW);
    expect(s.total).toBe(WHY_CHECK_ITEMS.length);
    expect(s.started).toBe(0);
    expect(s.due).toBe(0);
    expect(s.fresh).toBe(WHY_CHECK_ITEMS.length);
  });

  it("期限前の既習は started に入るが due には入らない", () => {
    const a = (WHY_CHECK_ITEMS[0] as WhyCheckItem).id;
    const b = (WHY_CHECK_ITEMS[1] as WhyCheckItem).id;
    const s = whyCheckStats(
      states([
        [a, NOW + DAY],
        [b, NOW - DAY],
      ]),
      NOW,
    );
    expect(s.started).toBe(2);
    expect(s.due).toBe(1);
    expect(s.fresh).toBe(WHY_CHECK_ITEMS.length - 2);
  });
});

describe("dueWhyChecks", () => {
  it("未着手のみなら体系順の先頭から limit 件返す", () => {
    const got = dueWhyChecks(new Map(), NOW, 3);
    expect(got.map((i) => i.order)).toEqual([0, 1, 2]);
  });

  it("既習の期限到来を未着手より先に出す（保持を優先）", () => {
    // order の大きい（＝応用側の）チェックが期限到来している状況。
    const late = WHY_CHECK_ITEMS[WHY_CHECK_ITEMS.length - 1] as WhyCheckItem;
    const got = dueWhyChecks(states([[late.id, NOW - DAY]]), NOW, 2);
    expect(got[0]?.id).toBe(late.id);
    expect(got[1]?.order).toBe(0); // 続きは未着手の体系順先頭
  });

  it("期限到来が複数あるときは期限の古い順", () => {
    const a = WHY_CHECK_ITEMS[0] as WhyCheckItem;
    const b = WHY_CHECK_ITEMS[1] as WhyCheckItem;
    const got = dueWhyChecks(
      states([
        [a.id, NOW - DAY],
        [b.id, NOW - 5 * DAY],
      ]),
      NOW,
      2,
    );
    expect(got.map((i) => i.id)).toEqual([b.id, a.id]);
  });

  it("期限前の既習は出さない", () => {
    const a = WHY_CHECK_ITEMS[0] as WhyCheckItem;
    const got = dueWhyChecks(states([[a.id, NOW + DAY]]), NOW, 1);
    expect(got[0]?.id).not.toBe(a.id);
  });

  it("全件が期限前なら空、limit=0 でも空", () => {
    const all = states(WHY_CHECK_ITEMS.map((i) => [i.id, NOW + DAY] as [string, number]));
    expect(dueWhyChecks(all, NOW, 10)).toEqual([]);
    expect(dueWhyChecks(new Map(), NOW, 0)).toEqual([]);
  });

  it("既定の件数上限で切り、決定論的に同じ結果を返す", () => {
    const a = dueWhyChecks(new Map(), NOW);
    const b = dueWhyChecks(new Map(), NOW);
    expect(a).toEqual(b);
    expect(a.length).toBe(WHY_CHECK_SESSION_SIZE);
  });
});
