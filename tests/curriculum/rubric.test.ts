/**
 * tests/curriculum/rubric.test.ts — 二次記述の配点重み付きルーブリックの検証。
 *  - 役割分類（補足の除外・結論の特定・公式/代入の判別）
 *  - 配点重みと達成率・FSRS評価への写像
 *  - キーワード/単位の抽出と答案照合（自己採点の補助）
 *  - 実データ（web/problems.json の全記述問題）で「全項目チェック＝満点」が成立すること
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildRubric,
  classifyStep,
  extractKeywords,
  extractUnits,
  KEYWORD_SUGGEST_THRESHOLD,
  matchRubricKeywords,
  missingUnits,
  ROLE_WEIGHTS,
  ratingForScore,
  scoreRubric,
  suggestedCheckedIndices,
} from "../../lib/curriculum/rubric.js";

/** 実際の問題データに現れる典型的な模範解答（同期発電機の出力）。 */
const SOLUTION = [
  "着眼点: 端子電圧Vと誘導起電力Eの位相差δ（負荷角）が出力を決める。",
  "1相あたり P1=V·E·sinδ/Xs",
  "3相出力 P=3·V·E·sinδ/Xs=3×220×600×0.5/5",
  "P=39600W=39.6kW",
  "ポイント: 図のベクトルでjIXsがVとEを結ぶ。δ=90°で最大、安定限界の指標。",
];

describe("classifyStep — 役割の推定", () => {
  it("「ポイント:」「（補足…）」で始まる行は採点対象外（note）", () => {
    expect(classifyStep("ポイント: 図のベクトルで…", 4, 3)).toBe("note");
    expect(classifyStep("（補足: 厳密式もあるが本問は一次近似）", 3, 2)).toBe("note");
    expect(classifyStep("（t=T=1s で最終値の約63.2%に達する）", 3, 2)).toBe("note");
    expect(classifyStep("注意: 単位に気をつける", 2, 1)).toBe("note");
  });

  it("「着眼点:」で始まる行は方針（approach）", () => {
    expect(classifyStep("着眼点: 位相差δが出力を決める。", 0, 3)).toBe("approach");
    expect(classifyStep("方針: まず1相分に直す", 0, 3)).toBe("approach");
  });

  it("採点対象の最後の等式は結論（conclusion）", () => {
    expect(classifyStep("P=39600W=39.6kW", 3, 3)).toBe("conclusion");
  });

  it("数値リテラルを含む等式は代入、記号だけの等式は公式", () => {
    expect(classifyStep("P=3·V·E·sinδ/Xs=3×220×600×0.5/5", 2, 3)).toBe("substitution");
    expect(classifyStep("降圧チョッパの出力平均電圧 Vo=D·Vi", 0, 2)).toBe("formula");
  });

  it("添字の数字は数値リテラルとみなさない（r2/s1 は公式のまま）", () => {
    expect(classifyStep("比例推移: r2/s1=(r2+R)/s2", 1, 3)).toBe("formula");
    expect(classifyStep("1相あたり P1=V·E·sinδ/Xs", 1, 3)).toBe("substitution"); // 「1相」の1はリテラル
  });

  it("等号を含まない行は計算（calculation）", () => {
    expect(classifyStep("両辺を2乗して整理する", 1, 3)).toBe("calculation");
  });
});

describe("buildRubric — 重み付けと構造", () => {
  it("補足は重み0、結論が最大の重みになる", () => {
    const items = buildRubric(SOLUTION);
    expect(items.map((i) => i.role)).toEqual(["approach", "substitution", "substitution", "conclusion", "note"]);
    expect(items.map((i) => i.weight)).toEqual([1, 2, 2, 3, 0]);
    expect(ROLE_WEIGHTS.conclusion).toBeGreaterThan(ROLE_WEIGHTS.formula);
    expect(ROLE_WEIGHTS.formula).toBeGreaterThan(ROLE_WEIGHTS.approach);
    expect(ROLE_WEIGHTS.note).toBe(0);
  });

  it("index は元の solution の並びを保つ（チェック状態のキーになる）", () => {
    const items = buildRubric(SOLUTION);
    items.forEach((item, i) => {
      expect(item.index).toBe(i);
      expect(item.text).toBe(SOLUTION[i]);
    });
  });

  it("結論は採点対象の最後の行に付く（末尾が補足でも取り違えない）", () => {
    const items = buildRubric(["Vo=D·Vi", "Vo=120V", "（補足: 実際は損失がある）"]);
    expect(items[1]?.role).toBe("conclusion");
    expect(items[2]?.role).toBe("note");
  });

  it("全行が補足の異常データでも採点が成立する（防御的挙動）", () => {
    const items = buildRubric(["（補足A）", "ポイント: B"]);
    expect(items.every((i) => i.weight > 0)).toBe(true);
    const s = scoreRubric(items, [0, 1]);
    expect(s.pct).toBe(1);
  });

  it("空の模範解答でも落ちない", () => {
    expect(buildRubric([])).toEqual([]);
    const s = scoreRubric([], []);
    expect(s).toMatchObject({ earned: 0, possible: 0, pct: 0, rating: "again" });
  });
});

describe("scoreRubric — 重み付き部分点", () => {
  const items = buildRubric(SOLUTION);

  it("採点対象を全部チェックすれば満点（補足のチェック有無は影響しない）", () => {
    const full = scoreRubric(items, [0, 1, 2, 3]);
    expect(full.possible).toBe(8); // 1+2+2+3
    expect(full.earned).toBe(8);
    expect(full.pct).toBe(1);
    expect(full.rating).toBe("easy");
    // 補足(index 4)にチェックを付けても点は変わらない。
    expect(scoreRubric(items, [0, 1, 2, 3, 4]).earned).toBe(8);
    // 補足だけチェックしても0点。
    expect(scoreRubric(items, [4]).earned).toBe(0);
  });

  it("結論を落とすと、方針を落とすより大きく減点される（配点の重み付けが効く）", () => {
    const missConclusion = scoreRubric(items, [0, 1, 2]); // 3点を落とす
    const missApproach = scoreRubric(items, [1, 2, 3]); // 1点を落とす
    expect(missConclusion.earned).toBe(5);
    expect(missApproach.earned).toBe(7);
    expect(missConclusion.pct).toBeLessThan(missApproach.pct);
  });

  it("取りこぼしは配点の重い順に並ぶ（最初の1件を指摘に使う）", () => {
    const s = scoreRubric(items, [1]);
    expect(s.missed.map((m) => m.weight)).toEqual([3, 2, 1]);
    expect(s.missed[0]?.role).toBe("conclusion");
  });

  it("採点対象の項目数と、チェックされた項目数を数える", () => {
    const s = scoreRubric(items, [0, 3]);
    expect(s.scoringCount).toBe(4);
    expect(s.checkedCount).toBe(2);
  });

  it("未知の index を渡しても無視する", () => {
    expect(scoreRubric(items, [99]).earned).toBe(0);
  });
});

describe("ratingForScore — 達成率から FSRS 評価", () => {
  it("満点=easy / 2/3以上=good / 1/3以上=hard / それ未満=again", () => {
    expect(ratingForScore(1)).toBe("easy");
    expect(ratingForScore(0.75)).toBe("good");
    expect(ratingForScore(2 / 3)).toBe("good");
    expect(ratingForScore(0.5)).toBe("hard");
    expect(ratingForScore(1 / 3)).toBe("hard");
    expect(ratingForScore(0.2)).toBe("again");
    expect(ratingForScore(0)).toBe("again");
  });
});

describe("キーワード・単位の抽出", () => {
  it("数値＋単位を1語として拾う", () => {
    expect(extractKeywords("P=39600W=39.6kW")).toContain("39.6kW");
    expect(extractKeywords("P=39600W=39.6kW")).toContain("39600W");
    expect(extractKeywords("R=1.5Ω")).toContain("1.5Ω");
  });

  it("kW を W と取り違えない（長い単位を優先して照合する）", () => {
    expect(extractUnits("P=39.6kW")).toEqual(["kW"]);
    expect(extractUnits("P=39600W=39.6kW")).toEqual(["W", "kW"]);
  });

  it("等号左辺の量記号を拾う", () => {
    expect(extractKeywords("降圧チョッパの出力平均電圧 Vo=D·Vi")).toContain("Vo");
    expect(extractKeywords("比例推移: r2/s1=(r2+R)/s2")).toContain("r2/s1");
  });

  it("単位の付かない数値リテラルも拾う（添字は除く）", () => {
    const kw = extractKeywords("Vo=0.2×600");
    expect(kw).toContain("0.2");
    expect(kw).toContain("600");
  });

  it("文章だけの行はキーワードなし（機械判定の対象外にする）", () => {
    expect(extractKeywords("着眼点: 位相差δが出力を決める。")).toEqual([]);
  });
});

describe("答案照合（自己採点の補助）", () => {
  const items = buildRubric(SOLUTION);

  it("答案に数値が書かれていればチェック候補として提案する", () => {
    const answer = "P=3·V·E·sinδ/Xs=3×220×600×0.5/5 より P=39600W=39.6kW";
    const suggested = suggestedCheckedIndices(items, answer);
    expect(suggested).toContain(2); // 代入
    expect(suggested).toContain(3); // 結論
  });

  it("何も書いていなければ何も提案しない", () => {
    expect(suggestedCheckedIndices(items, "")).toEqual([]);
    expect(suggestedCheckedIndices(items, "わかりません")).toEqual([]);
  });

  it("補足（重み0）は提案しない — 点にならない操作を促さない", () => {
    const withNote = buildRubric(["Vo=D·Vi", "Vo=120V", "（補足: 120V が定格）"]);
    expect(suggestedCheckedIndices(withNote, "Vo=120V")).not.toContain(2);
  });

  it("一致率が閾値未満なら提案しない", () => {
    const matches = matchRubricKeywords(items, "39.6kW");
    const substitution = matches.find((m) => m.index === 2);
    // 代入行のキーワードは6語（3,220,600,0.5,5,P）。1語も一致しないので提案されない。
    expect(substitution?.ratio).toBeLessThan(KEYWORD_SUGGEST_THRESHOLD);
    expect(substitution?.suggested).toBe(false);
  });

  it("答案に無い単位を指摘する（単位落としは二次の典型的な減点）", () => {
    expect(missingUnits(items, "P=39600 = 39.6")).toContain("kW");
    expect(missingUnits(items, "P=39600W=39.6kW")).toEqual([]);
  });

  it("単位の指摘は採点対象の行だけを見る（補足の単位は数えない）", () => {
    const withNote = buildRubric(["Vo=D·Vi", "Vo=120V", "（補足: 周期は 20ms）"]);
    expect(missingUnits(withNote, "Vo=120V")).toEqual([]);
  });
});

describe("実データ検証（web/problems.json の全記述問題）", () => {
  interface RawProblem {
    format?: string;
    solution: string[];
  }
  const problems = JSON.parse(
    readFileSync(new URL("../../web/problems.json", import.meta.url), "utf8"),
  ) as RawProblem[];
  const descriptive = problems.filter((p) => p.format === "descriptive");

  it("記述問題が存在する（前提の確認）", () => {
    expect(descriptive.length).toBeGreaterThan(0);
  });

  it("どの問題でも「採点対象を全部チェック＝満点(easy)」になる", () => {
    // 旧実装では補足行が1点として数えられ、完璧な答案でも満点にならなかった。
    const broken: number[] = [];
    descriptive.forEach((p, i) => {
      const items = buildRubric(p.solution);
      const scoring = items.filter((it) => it.weight > 0).map((it) => it.index);
      const s = scoreRubric(items, scoring);
      if (s.pct !== 1 || s.rating !== "easy") broken.push(i);
    });
    expect(broken).toEqual([]);
  });

  it("どの問題にも採点対象の項目が1つ以上ある", () => {
    for (const p of descriptive) {
      const items = buildRubric(p.solution);
      expect(items.some((it) => it.weight > 0)).toBe(true);
    }
  });

  it("結論（最終値）は多くとも1項目（配点の重複を作らない）", () => {
    for (const p of descriptive) {
      const items = buildRubric(p.solution);
      expect(items.filter((it) => it.role === "conclusion").length).toBeLessThanOrEqual(1);
    }
  });
});
