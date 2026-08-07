/**
 * テンプレート: B種接地工事の接地抵抗（法規・numeric）。
 *   電技解釈 第17条: 高低圧混触時の低圧側電位上昇を抑えるため、
 *   接地抵抗の上限 R = V / Ig 〔Ω〕
 *     V = 150（原則） / 300（1秒を超え2秒以内に自動遮断） / 600（1秒以内に自動遮断）
 *     Ig = 変圧器の高圧側電路の1線地絡電流〔A〕
 */
import { formatClean, isCleanAnswer } from "../clean.js";
import { defineTemplate, pick } from "./helpers.js";

/** 遮断条件 → 分子の電圧（電技解釈第17条）。 */
const CASES: ReadonlyArray<readonly [number, string]> = [
  [150, "混触時に自動的に遮断する装置を施設していない（原則）"],
  [300, "混触時に1秒を超え2秒以内に自動的に高圧電路を遮断する装置を施設している"],
  [600, "混触時に1秒以内に自動的に高圧電路を遮断する装置を施設している"],
];
const IG_SET: ReadonlyArray<number> = [2, 3, 4, 5, 6, 10, 12, 15, 20, 25, 30, 1, 8, 16, 24];

type Params = {
  base_voltage: number;
  ground_fault_current: number;
};

export const bTypeGrounding = defineTemplate<Params>({
  topic: "B種接地工事の接地抵抗",
  subject: "法規",
  exam: "denken2_primary",
  difficulty: 3,
  pastExam: { area: "接地工事", frequency: "high", years: [2007, 2012, 2017, 2022] },
  paramSpecs: {
    base_voltage: { unit: "V", realistic_range: [150, 600] },
    ground_fault_current: { unit: "A", realistic_range: [1, 50] },
  },
  paramOrder: ["base_voltage", "ground_fault_current"],
  draw(rng) {
    const [base] = pick(CASES, rng);
    const ig = pick(IG_SET, rng);
    return { base_voltage: base, ground_fault_current: ig };
  },
  buildFrom({ base_voltage: base, ground_fault_current: ig }) {
    const found = CASES.find(([v]) => v === base);
    if (!found || ig <= 0) return null;
    const r = base / ig;
    if (!isCleanAnswer(r)) return null;
    const answerText = formatClean(r);
    return {
      format: "numeric",
      params: {
        base_voltage: { value: base, unit: "V", realistic_range: [150, 600] },
        ground_fault_current: { value: ig, unit: "A", realistic_range: [1, 50] },
      },
      answerValue: r,
      answerUnit: "Ω",
      answerText,
      facts: { base, ig, r },
      defaultStatement:
        `高圧電路と低圧電路を結合する変圧器に B種接地工事を施す。高圧側電路の1線地絡電流は ${ig}A であり、` +
        `${found[1]}。このとき B種接地工事の接地抵抗の上限値〔Ω〕は?`,
      defaultSolution: [
        `B種接地抵抗の上限 R=V/Ig（電技解釈第17条。V は遮断時間により 150/300/600V）`,
        `本問の条件では V=${base}V`,
        `R=${base}/${ig}=${answerText}Ω`,
      ],
      physicallyValid: true,
    };
  },
});
