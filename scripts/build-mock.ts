/**
 * build-mock.ts — 電験三種の本試形式で科目別の模試を組む。
 *
 * 本試の紙面構成に合わせる:
 *   A問題 問1〜問10  各6点（計60点）  … 条文の空欄補充を主体に、法令数値・小計算を混ぜる
 *   B問題 問11〜問13 各(a)(b)の2小問（計40点）… (a)(b) は同一パラメータから出す連問
 *   合計100点 / 試験時間65分 / 全問マークシート五肢択一
 *
 * B問題の連問は、テンプレの `variant` パラメータ（0=(a), 1=(b)）を同一 params で
 * 振り分けることで再現する（スキーマは1問1答のまま。連問構造は出題側で組む）。
 *
 * 使い方:
 *   npx tsx scripts/build-mock.ts --subject 法規 --seed 42 --out out/mock.md
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { buildAutoMc, shouldAutoConvert } from "../lib/engine/auto-distractors.js";
import { getTemplate, listTopics } from "../lib/engine/templates/index.js";
import type { GenerationResult, Template } from "../lib/engine/templates/types.js";

/**
 * 科目ごとの本試構成。
 * 一次試験は理論/電力/機械が A14問(5点)+B3問(10点)・90分、法規が A10問(6点)+B3問・65分。
 * A問題は「その科目の頻出topicから重複なく」、B問題は variant を持つtopicから連問で構成する。
 */
interface ExamSpec {
  subject: string;
  aCount: number;
  aPoints: number;
  minutes: number;
  /** B問題に使う topic（variant で (a)(b) を出し分けられるもの）。 */
  bTopics: readonly string[];
  /** A問題で優先的に使う topic（残りは頻出topicから自動補充）。 */
  aPreferred?: readonly string[];
}

const SPECS: readonly ExamSpec[] = [
  {
    subject: "法規",
    aCount: 10,
    aPoints: 6,
    minutes: 65,
    aPreferred: ["法令条文の空欄補充", "法令数値の横断ドリル", "電圧の区分", "接地工事の種類と抵抗値"],
    bTopics: ["需要率・不等率・負荷率の複合", "力率改善コンデンサ容量", "絶縁耐力試験の充電電流と試験装置容量"],
  },
  { subject: "理論", aCount: 14, aPoints: 5, minutes: 90, bTopics: ["テブナンの定理と最大電力"] },
  { subject: "電力", aCount: 14, aPoints: 5, minutes: 90, bTopics: ["送電線の電圧降下と電力損失"] },
  { subject: "機械", aCount: 14, aPoints: 5, minutes: 90, bTopics: ["誘導電動機のすべりとトルク"] },
];

/** mulberry32（cli.ts と同じ決定論 RNG）。 */
function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function paramValues(g: GenerationResult): Record<string, number> {
  return Object.fromEntries(Object.entries(g.params).map(([k, v]) => [k, v.value]));
}

/** 重複しない draw を1件得る（statement をキーに既出を避ける）。 */
function drawUnique(tpl: Template, rng: () => number, seen: Set<string>): GenerationResult | null {
  for (let i = 0; i < 400; i++) {
    const g = tpl.generate(rng);
    if (g && !seen.has(g.defaultStatement)) {
      seen.add(g.defaultStatement);
      return g;
    }
  }
  return null;
}

/** variant を持つテンプレから (a)(b) の連問を得る。 */
function drawPair(tpl: Template, rng: () => number, seen: Set<string>): [GenerationResult, GenerationResult] | null {
  for (let i = 0; i < 400; i++) {
    const base = tpl.generate(rng);
    if (!base) continue;
    const pv = paramValues(base);
    if (!("variant" in pv)) return null;
    const a = tpl.generateFrom({ ...pv, variant: 0 });
    const b = tpl.generateFrom({ ...pv, variant: 1 });
    if (!a || !b) continue;
    if (seen.has(a.defaultStatement) || seen.has(b.defaultStatement)) continue;
    seen.add(a.defaultStatement);
    seen.add(b.defaultStatement);
    return [a, b];
  }
  return null;
}

/**
 * 選択肢を得る。
 *
 * このスクリプトは template.generate() を直接呼ぶため、生成パイプライン（generate.ts）の
 * 五肢択一化を通らない。本試は全問マークシートなので、ここでも同じ変換を掛ける。
 */
function choicesOf(g: GenerationResult): {
  choices: readonly string[];
  distractors: { text: string; reason: string }[];
} {
  if (g.choices && g.choices.length > 0) return { choices: g.choices, distractors: g.distractors ?? [] };
  if (shouldAutoConvert(g.answerValue, g.answerText)) {
    const mc = buildAutoMc(g.answerValue, g.answerText, g.answerUnit);
    if (mc) return { choices: mc.choices, distractors: mc.distractors };
  }
  return { choices: [], distractors: [] };
}

function renderChoices(choices: readonly string[]): string {
  if (choices.length === 0) return "";
  return choices.map((c, i) => `　(${i + 1}) ${c}`).join("\n");
}

/** その科目の topic を頻出度順（high→mid→low）に並べて返す。 */
function topicsForSubject(subject: string): string[] {
  const scored: Array<{ t: string; w: number }> = [];
  for (const t of listTopics()) {
    const tpl = getTemplate(t);
    if (!tpl || tpl.subject !== subject) continue;
    const f = tpl.pastExam?.frequency ?? "mid";
    scored.push({ t, w: f === "high" ? 0 : f === "mid" ? 1 : 2 });
  }
  return scored.sort((a, b) => a.w - b.w || (a.t < b.t ? -1 : 1)).map((x) => x.t);
}

export function buildMock(seed: number, subject = "法規"): { markdown: string; questionCount: number } {
  const spec = SPECS.find((x) => x.subject === subject) ?? SPECS[0];
  if (!spec) throw new Error(`未知の科目: ${subject}`);
  const rng = makeRng(seed);
  const seen = new Set<string>();
  const q: string[] = [];
  const ans: string[] = [];
  let n = 0;

  const bPoints = 100 - spec.aCount * spec.aPoints;
  q.push(`# 電験三種「${spec.subject}」模擬試験
`);
  q.push(
    `
> 本試と同じ構成: A問題${spec.aCount}問（各${spec.aPoints}点）＋B問題（計${bPoints}点）＝100点` +
      `／試験時間${spec.minutes}分／全問マークシート五肢択一。
`,
  );
  q.push(`> 電卓は四則演算のみ使用可。合格基準は60点（年度により調整あり）。

---
`);
  q.push(`
## A問題（問1〜問${spec.aCount}・各${spec.aPoints}点）
`);
  ans.push(`# 解答・解説

## A問題
`);

  // A問題: 指定topicを優先し、残りは頻出度順に補充する（同一topicの重複を避ける）。
  const pool = [...(spec.aPreferred ?? []), ...topicsForSubject(spec.subject).filter((t) => !spec.bTopics.includes(t))];
  const usedTopics = new Set<string>();
  for (const topic of pool) {
    if (n >= spec.aCount) break;
    if (usedTopics.has(topic)) continue;
    const tpl = getTemplate(topic);
    if (!tpl) continue;
    const g = drawUnique(tpl, rng, seen);
    if (!g) continue;
    usedTopics.add(topic);
    n++;
    q.push(`
**問${n}**　${g.defaultStatement}
`);
    const mcA = choicesOf(g);
    const ch = renderChoices(mcA.choices);
    if (ch)
      q.push(`${ch}
`);
    ans.push(`
**問${n}**　答: ${g.answerText}
`);
    for (const st of g.defaultSolution)
      ans.push(`- ${st}
`);
    for (const d of mcA.distractors.slice(0, 2))
      ans.push(`- ✗${d.text}: ${d.reason}
`);
  }

  // B問題: variant を持つ topic から (a)(b) の連問を作る。無い科目は A問題のみで構成する。
  let bno = n;
  if (spec.bTopics.length > 0) {
    q.push(`
---

## B問題（各(a)(b)）
`);
    ans.push(`
## B問題
`);
    for (const topic of spec.bTopics) {
      const tpl = getTemplate(topic);
      if (!tpl) continue;
      const pair = drawPair(tpl, rng, seen);
      if (!pair) continue;
      bno++;
      q.push(`
**問${bno}**　次の問いに答えよ。
`);
      ans.push(`
**問${bno}**
`);
      const labels = ["(a)", "(b)"] as const;
      for (let i = 0; i < 2; i++) {
        const g = pair[i] as GenerationResult;
        q.push(`
${labels[i]} ${g.defaultStatement}
`);
        const mcB = choicesOf(g);
        const ch = renderChoices(mcB.choices);
        if (ch)
          q.push(`${ch}
`);
        ans.push(`
${labels[i]} 答: ${g.answerText}
`);
        for (const st of g.defaultSolution)
          ans.push(`- ${st}
`);
        for (const d of mcB.distractors.slice(0, 2))
          ans.push(`- ✗${d.text}: ${d.reason}
`);
      }
    }
  }

  return {
    markdown: `${q.join("")}

---

${ans.join("")}`,
    questionCount: bno,
  };
}

function main(argv: string[]): void {
  let seed = 1;
  let out = "";
  let subject = "法規";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--seed") seed = Number(argv[++i]);
    else if (argv[i] === "--out") out = argv[++i] ?? "";
    else if (argv[i] === "--subject") subject = argv[++i] ?? "法規";
  }
  const { markdown, questionCount } = buildMock(seed, subject);
  if (out) {
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, markdown, "utf-8");
    console.error(`模試 ${questionCount} 問を ${out} に書き出しました（seed=${seed}）。`);
  } else {
    console.log(markdown);
  }
}

if (process.argv[1]?.endsWith("build-mock.ts")) {
  main(process.argv.slice(2));
}
