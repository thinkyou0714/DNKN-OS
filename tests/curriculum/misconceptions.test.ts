/**
 * tests/curriculum/misconceptions.test.ts — 誤答比からの誤概念同定の検証。
 *  - 主要パターン（√3・1/2・2π・1000倍・符号…）の判定
 *  - 丸めの粗さを誤概念と誤診断しないこと（許容誤差の狭さ）
 *  - 集計（件数順・論点の重複排除）と係数ファミリへの推奨
 *  - パターンの familyId が実在する係数ファミリを指すこと
 */
import { describe, expect, it } from "vitest";
import { COEFFICIENT_FAMILIES, coefficientDrillsForFamily } from "../../lib/curriculum/coefficients.js";
import {
  classifyMiss,
  getMisconceptionPattern,
  MISCONCEPTION_PATTERNS,
  type MissLog,
  misconceptionStats,
  parseAnswerValue,
  recommendedFamilyIds,
} from "../../lib/curriculum/misconceptions.js";

const SQRT3 = Math.sqrt(3);

describe("parseAnswerValue — 解答文字列の数値化", () => {
  it("素の数値・単位つき・％を読める", () => {
    expect(parseAnswerValue("39.6")).toBe(39.6);
    expect(parseAnswerValue("1.5Ω")).toBe(1.5);
    expect(parseAnswerValue("2%")).toBe(2);
    expect(parseAnswerValue("120V")).toBe(120);
  });

  it("全角数字・桁区切り・全角マイナスを吸収する", () => {
    expect(parseAnswerValue("３９．６")).toBe(39.6);
    expect(parseAnswerValue("1,200")).toBe(1200);
    expect(parseAnswerValue("−5")).toBe(-5);
  });

  it("数値が無ければ undefined", () => {
    expect(parseAnswerValue("わからない")).toBeUndefined();
    expect(parseAnswerValue("")).toBeUndefined();
  });
});

describe("classifyMiss — 誤答比から誤概念を推定", () => {
  it("√3 倍・1/√3 倍を見分ける", () => {
    expect(classifyMiss("100", String(100 * SQRT3))?.id).toBe("sqrt3-extra");
    expect(classifyMiss("100", String(100 / SQRT3))?.id).toBe("sqrt3-missing");
  });

  it("3倍・1/3 は √3 との取り違えとして拾う", () => {
    expect(classifyMiss("100", "300")?.id).toBe("three-for-sqrt3");
    expect(classifyMiss("300", "100")?.id).toBe("third");
  });

  it("√2・2倍・1/2 を見分ける", () => {
    expect(classifyMiss("100", String(100 * Math.SQRT2))?.id).toBe("sqrt2-extra");
    expect(classifyMiss("100", "200")?.id).toBe("double");
    expect(classifyMiss("100", "50")?.id).toBe("halved");
  });

  it("2π・π（角速度と周波数の取り違え）を拾う", () => {
    expect(classifyMiss("50", String(50 * 2 * Math.PI))?.id).toBe("twopi-extra");
    expect(classifyMiss("314", String(314 / (2 * Math.PI)))?.id).toBe("twopi-missing");
    expect(classifyMiss("100", String(100 * Math.PI))?.id).toBe("pi-extra");
  });

  it("波形率 1.11 の取り違えを拾う", () => {
    const formFactor = Math.PI / (2 * Math.SQRT2);
    expect(classifyMiss("100", String(100 * formFactor))?.id).toBe("form-factor-extra");
    expect(classifyMiss("100", String(100 / formFactor))?.id).toBe("form-factor-missing");
  });

  it("単位接頭辞（1000倍）と％（100倍）を区別する", () => {
    expect(classifyMiss("39.6", "39600")?.id).toBe("kilo-extra");
    expect(classifyMiss("39600", "39.6")?.id).toBe("kilo-missing");
    expect(classifyMiss("0.05", "5")?.id).toBe("percent-extra");
    expect(classifyMiss("5", "0.05")?.id).toBe("percent-missing");
  });

  it("符号違いを拾う", () => {
    expect(classifyMiss("12.5", "-12.5")?.id).toBe("sign");
  });

  it("√3 を 1.7 で概算しただけの誤差は誤概念と判定しない（誤診断を避ける）", () => {
    // 1.7/1.732 ≒ 0.981。採点は不正解でも「係数を取り違えた」わけではない。
    expect(classifyMiss("173.2", "170")).toBeUndefined();
  });

  it("どのパターンにも当てはまらない誤答は undefined", () => {
    expect(classifyMiss("100", "137")).toBeUndefined();
  });

  it("正解と一致する場合・0 が絡む場合・数値でない場合は undefined", () => {
    expect(classifyMiss("100", "100")).toBeUndefined();
    expect(classifyMiss("0", "5")).toBeUndefined();
    expect(classifyMiss("5", "0")).toBeUndefined();
    expect(classifyMiss("100", "選択肢ア")).toBeUndefined();
  });
});

describe("MISCONCEPTION_PATTERNS — 表の不変条件", () => {
  it("ID は一意で、ラベル・説明が空でない", () => {
    const seen = new Set<string>();
    for (const p of MISCONCEPTION_PATTERNS) {
      expect(seen.has(p.id), `ID 重複: ${p.id}`).toBe(false);
      seen.add(p.id);
      expect(p.label.trim().length, p.id).toBeGreaterThan(0);
      expect(p.detail.trim().length, p.id).toBeGreaterThan(0);
      expect(Number.isFinite(p.ratio), p.id).toBe(true);
      expect(p.ratio, p.id).not.toBe(0);
      expect(p.ratio, p.id).not.toBe(1);
    }
  });

  it("familyId は実在する係数ファミリを指し、そのファミリにドリルがある", () => {
    const ids = new Set(COEFFICIENT_FAMILIES.map((f) => f.id));
    for (const p of MISCONCEPTION_PATTERNS) {
      if (p.familyId === undefined) continue;
      expect(ids.has(p.familyId), `未知のファミリ: ${p.familyId}（${p.id}）`).toBe(true);
      expect(coefficientDrillsForFamily(p.familyId).length, p.familyId).toBeGreaterThan(0);
    }
  });

  it("パターンの比は互いに十分離れている（許容誤差1%で衝突しない）", () => {
    const ratios = MISCONCEPTION_PATTERNS.map((p) => p.ratio);
    for (let i = 0; i < ratios.length; i++) {
      for (let j = i + 1; j < ratios.length; j++) {
        const a = ratios[i] as number;
        const b = ratios[j] as number;
        // 同符号どうしのみ比較（符号違いは -1 パターンで別扱い）。
        if (a * b <= 0) continue;
        expect(Math.abs(a - b) > Math.abs(a) * 0.02, `比が近すぎる: ${a} と ${b}`).toBe(true);
      }
    }
  });

  it("getMisconceptionPattern で ID からひける", () => {
    expect(getMisconceptionPattern("sqrt3-extra")?.familyId).toBe("sqrt3");
    expect(getMisconceptionPattern("存在しない")).toBeUndefined();
  });
});

describe("misconceptionStats — 集計", () => {
  const answers: Record<string, string> = { P1: "100", P2: "50", P3: "39.6" };
  const answerOf = (id: string): string | undefined => answers[id];

  it("誤答だけを、パターンごとに件数と論点で集計する", () => {
    const logs: MissLog[] = [
      { topic: "三相電力", correct: false, chosen: String(100 * SQRT3), problemId: "P1" },
      { topic: "送電損失", correct: false, chosen: String(50 * SQRT3), problemId: "P2" },
      { topic: "三相電力", correct: false, chosen: "200", problemId: "P1" },
      { topic: "三相電力", correct: true, chosen: "100", problemId: "P1" }, // 正解は無視
    ];
    const s = misconceptionStats(logs, answerOf);
    expect(s.analyzed).toBe(3);
    expect(s.classified).toBe(3);
    expect(s.unclassified).toBe(0);
    expect(s.counts[0]?.pattern.id).toBe("sqrt3-extra");
    expect(s.counts[0]?.count).toBe(2);
    expect(s.counts[0]?.topics).toEqual(["三相電力", "送電損失"]);
    expect(s.counts[1]?.pattern.id).toBe("double");
  });

  it("同じ論点が重複して数えられない", () => {
    const logs: MissLog[] = [
      { topic: "三相電力", correct: false, chosen: "300", problemId: "P1" },
      { topic: "三相電力", correct: false, chosen: "300", problemId: "P1" },
    ];
    const s = misconceptionStats(logs, answerOf);
    expect(s.counts[0]?.count).toBe(2);
    expect(s.counts[0]?.topics).toEqual(["三相電力"]);
  });

  it("chosen が無いログ・正解が引けないログは判定対象にしない", () => {
    const logs: MissLog[] = [
      { topic: "A", correct: false, problemId: "P1" }, // chosen なし（旧ログ）
      { topic: "B", correct: false, chosen: "999", problemId: "未知" }, // 正解が引けない
      { topic: "C", correct: false, chosen: "137" }, // problemId なし
    ];
    const s = misconceptionStats(logs, answerOf);
    expect(s.analyzed).toBe(0);
    expect(s.counts).toEqual([]);
  });

  it("既知パターンに当てはまらない誤答は unclassified に数える", () => {
    const logs: MissLog[] = [{ topic: "A", correct: false, chosen: "137", problemId: "P1" }];
    const s = misconceptionStats(logs, answerOf);
    expect(s.analyzed).toBe(1);
    expect(s.classified).toBe(0);
    expect(s.unclassified).toBe(1);
  });

  it("空入力でも落ちない", () => {
    const s = misconceptionStats([], answerOf);
    expect(s).toMatchObject({ counts: [], classified: 0, unclassified: 0, analyzed: 0 });
  });
});

describe("recommendedFamilyIds — 係数ドリルへの橋渡し", () => {
  const answers: Record<string, string> = { P1: "100" };
  const answerOf = (id: string): string | undefined => answers[id];

  it("件数の多いファミリから順に返す（同一ファミリの複数パターンは合算）", () => {
    const logs: MissLog[] = [
      // sqrt3 ファミリ: √3倍 ×1 ＋ 3倍 ×1 = 2件
      { topic: "A", correct: false, chosen: String(100 * SQRT3), problemId: "P1" },
      { topic: "A", correct: false, chosen: "300", problemId: "P1" },
      // half ファミリ: 1件
      { topic: "B", correct: false, chosen: "50", problemId: "P1" },
    ];
    expect(recommendedFamilyIds(misconceptionStats(logs, answerOf))).toEqual(["sqrt3", "half"]);
  });

  it("係数ドリルの対象外（単位・符号）はファミリを推奨しない", () => {
    const logs: MissLog[] = [
      { topic: "A", correct: false, chosen: "100000", problemId: "P1" }, // 1000倍
      { topic: "B", correct: false, chosen: "-100", problemId: "P1" }, // 符号
    ];
    const s = misconceptionStats(logs, answerOf);
    expect(s.classified).toBe(2);
    expect(recommendedFamilyIds(s)).toEqual([]);
  });
});
