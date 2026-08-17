/**
 * tests/curriculum/narration-script.test.ts — 解法動画ナレーション台本の検証。
 *  - セグメントがスライドと1:1対応すること
 *  - 本文（数式・数値）が逐語でナレーションに含まれること（台本側で改変しない）
 *  - 尺の見積もり（下限・合計）と Markdown 整形
 *  - 実データ（web/problems.json 先頭50問）で台本が常に成立すること
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildVideoScript,
  estimateNarrationSeconds,
  formatDuration,
  formatVideoScript,
  MIN_SEGMENT_SEC,
  NARRATION_CHARS_PER_SEC,
  SEGMENT_PAUSE_SEC,
} from "../../lib/curriculum/narration-script.js";
import { buildSolutionSlides } from "../../lib/curriculum/solution-slides.js";

/** solution-slides.test.ts と同じ典型例（同期発電機の出力）。 */
const SOURCE = {
  statement: "三相同期発電機の出力を求めよ。",
  answer: "39.6kW",
  solution: [
    "着眼点: 端子電圧Vと誘導起電力Eの位相差δ（負荷角）が出力を決める。",
    "1相あたり P1=V·E·sinδ/Xs",
    "3相出力 P=3·V·E·sinδ/Xs=3×220×600×0.5/5",
    "P=39600W=39.6kW",
    "ポイント: 図のベクトルでjIXsがVとEを結ぶ。δ=90°で最大、安定限界の指標。",
  ],
};

describe("buildVideoScript — 台本の構造", () => {
  it("セグメントはスライドと1:1対応し、slideNo は1始まりの連番", () => {
    const script = buildVideoScript(SOURCE);
    const deck = buildSolutionSlides(SOURCE);
    expect(script.slideCount).toBe(deck.slides.length);
    expect(script.segments).toHaveLength(deck.slides.length);
    script.segments.forEach((seg, i) => {
      expect(seg.slideNo).toBe(i + 1);
    });
  });

  it("スライド本文が逐語でナレーションに含まれる（数値・数式を改変しない）", () => {
    const script = buildVideoScript(SOURCE);
    const deck = buildSolutionSlides(SOURCE);
    deck.slides.forEach((slide, i) => {
      expect(script.segments[i]?.narration).toContain(slide.body);
      expect(script.segments[i]?.thought).toBe(slide.thought);
    });
  });

  it("答えセグメントは最終解答を含み、締めの言い回しで終わる", () => {
    const script = buildVideoScript(SOURCE);
    const last = script.segments.at(-1);
    expect(last?.narration).toContain(SOURCE.answer);
    expect(last?.narration).toMatch(/です。$/);
  });

  it("尺: 各セグメントは下限以上・合計はセグメントの総和", () => {
    const script = buildVideoScript(SOURCE);
    for (const seg of script.segments) expect(seg.seconds).toBeGreaterThanOrEqual(MIN_SEGMENT_SEC);
    expect(script.totalSeconds).toBe(script.segments.reduce((a, s) => a + s.seconds, 0));
  });

  it("決定論: 同じ入力からは同じ台本が得られる", () => {
    expect(buildVideoScript(SOURCE)).toEqual(buildVideoScript(SOURCE));
  });
});

describe("estimateNarrationSeconds / formatDuration", () => {
  it("文字数から速度・間・下限つきで見積もる", () => {
    expect(estimateNarrationSeconds("")).toBe(MIN_SEGMENT_SEC);
    const text = "あ".repeat(NARRATION_CHARS_PER_SEC * 30); // ちょうど30秒ぶんの文字数
    expect(estimateNarrationSeconds(text)).toBe(30 + SEGMENT_PAUSE_SEC);
  });

  it("60秒未満は秒のみ、以上は分秒で表記する", () => {
    expect(formatDuration(45)).toBe("約45秒");
    expect(formatDuration(60)).toBe("約1分0秒");
    expect(formatDuration(154)).toBe("約2分34秒");
    expect(formatDuration(-3)).toBe("約0秒");
  });
});

describe("formatVideoScript — Markdown 整形", () => {
  it("見出し・メタ・推定尺・逐語注記・全セグメントを含む", () => {
    const script = buildVideoScript(SOURCE);
    const md = formatVideoScript(script, { id: "D-0001", subject: "機械", topic: "同期発電機" });
    expect(md).toContain("# 解法動画 台本 — 機械・同期発電機");
    expect(md).toContain("- 問題ID: D-0001");
    expect(md).toContain(`（スライド${script.slideCount}枚）`);
    expect(md).toContain("逐語転記");
    expect(md).toContain("## 1. 問題");
    for (const seg of script.segments) {
      expect(md).toContain(`## ${seg.slideNo}. ${seg.title}`);
      expect(md).toContain(`ナレーション: ${seg.narration}`);
    }
  });

  it("メタ省略時もヘッダが成立する", () => {
    const md = formatVideoScript(buildVideoScript(SOURCE));
    expect(md.startsWith("# 解法動画 台本\n")).toBe(true);
    expect(md).not.toContain("問題ID:");
  });
});

describe("実データ検証（web/problems.json 先頭50問）", () => {
  interface RawProblem {
    id: string;
    subject: string;
    topic: string;
    statement: string;
    answer: string;
    solution: string[];
  }
  const problems = (
    JSON.parse(readFileSync(new URL("../../web/problems.json", import.meta.url), "utf8")) as RawProblem[]
  ).slice(0, 50);

  it("台本が常に成立し、全 solution 行が逐語で含まれる", () => {
    expect(problems.length).toBeGreaterThan(0);
    for (const p of problems) {
      const md = formatVideoScript(buildVideoScript(p), { id: p.id, subject: p.subject, topic: p.topic });
      expect(md).toContain(p.statement);
      expect(md).toContain(p.answer);
      for (const line of p.solution) expect(md).toContain(line);
    }
  });
});
