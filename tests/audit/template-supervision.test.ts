/**
 * tests/audit/template-supervision.test.ts — テンプレ単位の監修管理の検証。
 *
 * 最重要の不変条件は「監修後にテンプレの振る舞いが変わったら、その監修は必ず無効になる」こと。
 * これが壊れると、編集済みのテンプレが監修済みを主張し続ける（＝嘘の記録が残る）。
 *  - フィンガープリント: 決定論・振る舞いの変化を検知・メタ情報の変化も検知
 *  - 台帳: 寛容なパース・upsert の純粋性と安定した並び
 *  - 判定とレポート: stale の検出、レバレッジ順のキュー、科目別集計
 *  - 実レジストリ（151テンプレ）に対する健全性
 */
import { describe, expect, it } from "vitest";
import {
  emptyLedger,
  formatTemplateSupervisionReport,
  LEDGER_VERSION,
  ledgerIndex,
  parseLedger,
  stableHash,
  type TemplateSupervisionEntry,
  templateFingerprint,
  templateSupervisionReport,
  templateSupervisionStage,
  upsertLedgerEntry,
} from "../../lib/audit/template-supervision.js";
import { getTemplate, listTopics } from "../../lib/engine/templates/index.js";
import type { GenerationResult, Template } from "../../lib/engine/templates/types.js";

/** テスト用の最小テンプレ。係数 k を変えると振る舞いが変わる。 */
function fakeTemplate(overrides: Partial<Template> = {}, k = 2): Template {
  const build = (v: number): GenerationResult => ({
    params: { x: { value: v, unit: "V" } },
    answerValue: v * k,
    answerUnit: "W",
    answerText: String(v * k),
    choices: [String(v * k), String(v * k + 1)],
    facts: { x: v },
    defaultStatement: `x=${v} のとき答えは?`,
    defaultSolution: [`P=${k}x`, `P=${v * k}W`],
    physicallyValid: true,
  });
  return {
    topic: "テスト論点",
    subject: "理論",
    exam: "denken3",
    difficulty: 2,
    paramSpecs: { x: { unit: "V", realistic_range: [1, 10] } },
    generate: (rng) => build(Math.floor(rng() * 10) + 1),
    generateFrom: (params) => build(params.x ?? 1),
    ...overrides,
  };
}

describe("stableHash", () => {
  it("同じ入力には同じ値、違う入力には違う値を返す", () => {
    expect(stableHash("abc")).toBe(stableHash("abc"));
    expect(stableHash("abc")).not.toBe(stableHash("abd"));
    expect(stableHash("")).toBe(stableHash(""));
  });

  it("16桁の16進文字列を返す", () => {
    expect(stableHash("テンプレ")).toMatch(/^[0-9a-f]{16}$/);
  });

  it("1文字の違い・順序の違いを取りこぼさない", () => {
    expect(stableHash("ab")).not.toBe(stableHash("ba"));
    expect(stableHash("a")).not.toBe(stableHash("aa"));
  });
});

describe("templateFingerprint — 変更検知の核", () => {
  it("同じテンプレなら何度計算しても同じ（決定論）", () => {
    const t = fakeTemplate();
    expect(templateFingerprint(t)).toBe(templateFingerprint(t));
    expect(templateFingerprint(fakeTemplate())).toBe(templateFingerprint(fakeTemplate()));
  });

  it("計算式が変わると変わる（監修の前提が崩れたことを検知する）", () => {
    expect(templateFingerprint(fakeTemplate({}, 2))).not.toBe(templateFingerprint(fakeTemplate({}, 3)));
  });

  it("パラメータの現実的レンジが変わると変わる（レンジは監修の主要な確認事項）", () => {
    const a = fakeTemplate();
    const b = fakeTemplate({ paramSpecs: { x: { unit: "V", realistic_range: [1, 20] } } });
    expect(templateFingerprint(a)).not.toBe(templateFingerprint(b));
  });

  it("難易度・科目・出題分野メタが変わると変わる", () => {
    const base = fakeTemplate();
    expect(templateFingerprint(fakeTemplate({ difficulty: 5 }))).not.toBe(templateFingerprint(base));
    expect(templateFingerprint(fakeTemplate({ subject: "電力" }))).not.toBe(templateFingerprint(base));
    expect(templateFingerprint(fakeTemplate({ pastExam: { area: "直流回路", frequency: "high" } }))).not.toBe(
      templateFingerprint(base),
    );
  });

  it("生成が常に失敗するテンプレでも例外を投げず安定した値を返す", () => {
    const broken = fakeTemplate({ generate: () => null });
    expect(() => templateFingerprint(broken)).not.toThrow();
    expect(templateFingerprint(broken)).toBe(templateFingerprint(fakeTemplate({ generate: () => null })));
  });

  it("生成が例外を投げるテンプレでも指紋計算は止まらない", () => {
    const throwing = fakeTemplate({
      generate: () => {
        throw new Error("boom");
      },
    });
    expect(() => templateFingerprint(throwing)).not.toThrow();
  });
});

describe("台帳（ledger）", () => {
  const entry: TemplateSupervisionEntry = {
    topic: "テスト論点",
    fingerprint: "abc123",
    supervisor: "監修者A",
    at: "2026-08-06",
  };

  it("空台帳はバージョンつきで項目が空", () => {
    expect(emptyLedger()).toEqual({ version: LEDGER_VERSION, entries: [] });
  });

  it("壊れた JSON・想定外の形は空台帳として扱う（例外を投げない）", () => {
    expect(parseLedger("{壊れた").entries).toEqual([]);
    expect(parseLedger("[1,2,3]").entries).toEqual([]);
    expect(parseLedger('"文字列"').entries).toEqual([]);
    expect(parseLedger("{}").entries).toEqual([]);
  });

  it("必須フィールドが欠けた項目は落とす（不完全な監修主張を受け入れない）", () => {
    const json = JSON.stringify({
      version: 1,
      entries: [
        entry,
        { topic: "欠落", fingerprint: "x", supervisor: "A" }, // at なし
        { topic: "欠落2", fingerprint: "x", at: "2026-08-06" }, // supervisor なし
        { fingerprint: "x", supervisor: "A", at: "2026-08-06" }, // topic なし
      ],
    });
    const ledger = parseLedger(json);
    expect(ledger.entries).toHaveLength(1);
    expect(ledger.entries[0]?.topic).toBe("テスト論点");
  });

  it("note は任意（あれば保持し、無ければ持たない）", () => {
    const withNote = parseLedger(JSON.stringify({ entries: [{ ...entry, note: "条件付き" }] }));
    expect(withNote.entries[0]?.note).toBe("条件付き");
    expect(parseLedger(JSON.stringify({ entries: [entry] })).entries[0]?.note).toBeUndefined();
  });

  it("upsert は元の台帳を変更せず、topic 順に安定して並べる", () => {
    const base = emptyLedger();
    const a = upsertLedgerEntry(base, { ...entry, topic: "力率改善" });
    const b = upsertLedgerEntry(a, { ...entry, topic: "オームの法則" });
    expect(base.entries).toHaveLength(0); // 純関数（元は不変）
    expect(b.entries.map((e) => e.topic)).toEqual(["オームの法則", "力率改善"]);
  });

  it("同じ topic の再監修は上書きになる（重複を作らない）", () => {
    const a = upsertLedgerEntry(emptyLedger(), entry);
    const b = upsertLedgerEntry(a, { ...entry, fingerprint: "new", at: "2026-09-01" });
    expect(b.entries).toHaveLength(1);
    expect(b.entries[0]?.fingerprint).toBe("new");
    expect(b.entries[0]?.at).toBe("2026-09-01");
  });

  it("索引は topic → 項目（重複があれば後勝ち）", () => {
    const ledger = { version: 1, entries: [entry, { ...entry, supervisor: "監修者B" }] };
    expect(ledgerIndex(ledger).get("テスト論点")?.supervisor).toBe("監修者B");
  });
});

describe("templateSupervisionStage", () => {
  const entry: TemplateSupervisionEntry = {
    topic: "t",
    fingerprint: "fp1",
    supervisor: "A",
    at: "2026-08-06",
  };

  it("記録が無ければ未監修", () => {
    expect(templateSupervisionStage("fp1", undefined)).toBe("unsupervised");
  });

  it("フィンガープリントが一致すれば監修済み", () => {
    expect(templateSupervisionStage("fp1", entry)).toBe("supervised");
  });

  it("フィンガープリントが違えば要再監修（記録は残るが監修済みにはしない）", () => {
    expect(templateSupervisionStage("fp2", entry)).toBe("stale");
  });
});

describe("templateSupervisionReport", () => {
  const t1 = fakeTemplate({ topic: "A論点", subject: "理論" });
  const t2 = fakeTemplate({ topic: "B論点", subject: "電力" });
  const t3 = fakeTemplate({ topic: "C論点", subject: "理論" });
  const templates = [t1, t2, t3];
  const counts = new Map([
    ["A論点", 100],
    ["B論点", 300],
    ["C論点", 50],
  ]);

  it("未監修のみなら カバレッジ 0 で全件がキューに入る", () => {
    const r = templateSupervisionReport({ templates, ledger: emptyLedger(), problemCountByTopic: counts });
    expect(r.total).toBe(3);
    expect(r.unsupervised).toBe(3);
    expect(r.coverage).toBe(0);
    expect(r.problemsTotal).toBe(450);
    expect(r.problemsSupervised).toBe(0);
    expect(r.queue).toHaveLength(3);
  });

  it("監修済みは担保する問題数として集計される（テンプレ監修のレバレッジ）", () => {
    const ledger = upsertLedgerEntry(emptyLedger(), {
      topic: "B論点",
      fingerprint: templateFingerprint(t2),
      supervisor: "A",
      at: "2026-08-06",
    });
    const r = templateSupervisionReport({ templates, ledger, problemCountByTopic: counts });
    expect(r.supervised).toBe(1);
    expect(r.coverage).toBeCloseTo(1 / 3);
    // テンプレは3件中1件でも、問題数では 300/450 を担保している。
    expect(r.problemsSupervised).toBe(300);
    expect(r.problemCoverage).toBeCloseTo(300 / 450);
  });

  it("キューは「要再監修 → 担保問題数の多い順」に並ぶ", () => {
    // C論点は監修済みだが指紋が古い（=要再監修）。担保問題数は最少だが先頭に来る。
    const ledger = upsertLedgerEntry(emptyLedger(), {
      topic: "C論点",
      fingerprint: "古い指紋",
      supervisor: "A",
      at: "2026-08-06",
    });
    const r = templateSupervisionReport({ templates, ledger, problemCountByTopic: counts });
    expect(r.stale).toBe(1);
    expect(r.queue.map((q) => q.topic)).toEqual(["C論点", "B論点", "A論点"]);
    expect(r.queue[0]?.stage).toBe("stale");
    // 要再監修でも台帳の記録は保持し、誰がいつ監修したかを追える。
    expect(r.queue[0]?.entry?.supervisor).toBe("A");
  });

  it("科目別に集計する（科目名の辞書順）", () => {
    const r = templateSupervisionReport({ templates, ledger: emptyLedger(), problemCountByTopic: counts });
    expect(r.bySubject.map((s) => s.subject)).toEqual(["電力", "理論"]);
    const rironTotal = r.bySubject.find((s) => s.subject === "理論");
    expect(rironTotal?.total).toBe(2);
    expect(rironTotal?.problemsTotal).toBe(150);
  });

  it("問題数が未知でも動く（レバレッジ表示が0になるだけ）", () => {
    const r = templateSupervisionReport({ templates, ledger: emptyLedger() });
    expect(r.problemsTotal).toBe(0);
    expect(r.problemCoverage).toBe(0);
    expect(r.total).toBe(3);
  });

  it("テンプレが空でも 0 除算しない", () => {
    const r = templateSupervisionReport({ templates: [], ledger: emptyLedger() });
    expect(r.coverage).toBe(0);
    expect(r.problemCoverage).toBe(0);
    expect(r.queue).toEqual([]);
  });

  it("同じ入力なら常に同じレポート（決定論）", () => {
    const a = templateSupervisionReport({ templates, ledger: emptyLedger(), problemCountByTopic: counts });
    const b = templateSupervisionReport({ templates, ledger: emptyLedger(), problemCountByTopic: counts });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe("formatTemplateSupervisionReport", () => {
  it("要再監修があるときは警告行を出す（見落とさせない）", () => {
    const t = fakeTemplate();
    const ledger = upsertLedgerEntry(emptyLedger(), {
      topic: t.topic,
      fingerprint: "古い指紋",
      supervisor: "A",
      at: "2026-08-06",
    });
    const text = formatTemplateSupervisionReport(templateSupervisionReport({ templates: [t], ledger }));
    expect(text).toContain("要再監修");
    expect(text).toContain("⚠️");
    expect(text).toContain("🔁要再監修");
  });

  it("全件監修済みならキューなしと表示する", () => {
    const t = fakeTemplate();
    const ledger = upsertLedgerEntry(emptyLedger(), {
      topic: t.topic,
      fingerprint: templateFingerprint(t),
      supervisor: "A",
      at: "2026-08-06",
    });
    const text = formatTemplateSupervisionReport(templateSupervisionReport({ templates: [t], ledger }));
    expect(text).toContain("全テンプレ監修済み");
  });
});

describe("実テンプレレジストリでの健全性", () => {
  const templates = listTopics()
    .map((topic) => getTemplate(topic))
    .filter((t): t is Template => t !== undefined);

  it("全テンプレのフィンガープリントを計算でき、一意である", () => {
    expect(templates.length).toBeGreaterThan(100);
    const seen = new Map<string, string>();
    for (const t of templates) {
      const fp = templateFingerprint(t);
      expect(fp, t.topic).toMatch(/^[0-9a-f]{16}$/);
      const dup = seen.get(fp);
      expect(dup, `フィンガープリント衝突: ${t.topic} と ${dup}`).toBeUndefined();
      seen.set(fp, t.topic);
    }
  });

  it("フィンガープリントは再計算しても変わらない（出荷物と同じ数列を使う決定論）", () => {
    for (const t of templates.slice(0, 20)) {
      expect(templateFingerprint(t), t.topic).toBe(templateFingerprint(t));
    }
  });

  it("台帳が空の初期状態では全テンプレが未監修として並ぶ", () => {
    const r = templateSupervisionReport({ templates, ledger: emptyLedger() });
    expect(r.supervised).toBe(0);
    expect(r.stale).toBe(0);
    expect(r.unsupervised).toBe(templates.length);
    expect(r.queue).toHaveLength(templates.length);
  });
});
