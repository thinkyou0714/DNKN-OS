/**
 * テンプレート: 二電力計法による三相電力（理論・numeric）。
 *
 * 閉形式（コードが算出する唯一の真値）:
 *   平衡三相回路の有効電力は2台の電力計の指示の代数和で求まる:
 *     P = W1 + W2   〔W〕
 *   （参考: 力率 tanφ = √3·(W1−W2)/(W1+W2)。本問は P を問う。）
 *
 * 物理の根拠: ブロンデルの定理（n線式はn−1台の電力計で総電力を測れる）。
 *   三相3線式では2台の単相電力計で三相有効電力の合計が得られる。
 *   W1, W2 は個々には相電力ではなく、和が三相有効電力に等しい。
 *
 * 誤答（すべて「成立する典型ミス」）:
 *   ① 差をとる   |W1−W2|（力率算出の分子と混同）
 *   ② √3倍する   √3·(W1+W2)（線間↔相の√3を誤って電力に掛ける）
 *   ③ 平均をとる  (W1+W2)/2（2台だから2で割ると誤解）
 */
import { formatClean, isCleanAnswer } from "../clean.js";
import { defineTemplate, pick } from "./helpers.js";

// W1, W2〔W〕の母集合。和も差も綺麗、W1>W2（力率<1の通常域）になる組を採る。
const W_PAIRS: ReadonlyArray<readonly [number, number]> = [
  [800, 400],
  [1200, 600],
  [1500, 500],
  [2000, 1000],
  [2400, 1200],
  [3000, 1500],
  [3500, 2500],
  [4000, 2000],
  [5000, 3000],
  [6000, 2000],
  [1000, 200],
  [2500, 1500],
  [600, 200],
  [900, 300],
  [1000, 500],
  [1200, 800],
  [1400, 600],
  [1500, 1000],
  [1600, 400],
  [1800, 600],
  [1800, 1200],
  [2000, 500],
  [2000, 1500],
  [2200, 800],
  [2500, 500],
  [2500, 1000],
  [2800, 1200],
  [3000, 1000],
  [3000, 2000],
  [3200, 800],
  [3500, 1500],
  [3600, 2400],
  [4000, 1000],
  [4000, 3000],
  [4200, 1800],
  [4500, 1500],
  [4500, 2500],
  [4800, 3200],
  [5000, 1000],
  [5000, 2000],
  [5400, 3600],
  [5500, 2500],
  [6000, 3000],
  [6000, 4000],
];

type Params = {
  wattmeter1: number;
  wattmeter2: number;
};

export const twoWattmeterPower = defineTemplate<Params>({
  topic: "二電力計法による三相電力",
  subject: "理論",
  exam: "denken2_primary",
  difficulty: 3,
  pastExam: { area: "三相交流回路", frequency: "mid", years: [2008, 2013, 2018, 2023] },
  paramSpecs: {
    wattmeter1: { unit: "W", realistic_range: [100, 6000] },
    wattmeter2: { unit: "W", realistic_range: [100, 6000] },
  },
  paramOrder: ["wattmeter1", "wattmeter2"],
  draw(rng) {
    const [w1, w2] = pick(W_PAIRS, rng);
    return { wattmeter1: w1, wattmeter2: w2 };
  },
  buildFrom({ wattmeter1: w1, wattmeter2: w2 }) {
    if (w1 <= 0 || w2 <= 0) return null;
    const P = w1 + w2; // 正解(W)
    if (!isCleanAnswer(P)) return null;
    // 参考: 力率 tanφ=√3(W1−W2)/(W1+W2)（解説の補足に使う）。
    const tanPhi = (Math.sqrt(3) * (w1 - w2)) / (w1 + w2);
    const cosPhi = 1 / Math.sqrt(1 + tanPhi * tanPhi);
    const answerText = formatClean(P);
    return {
      format: "numeric",
      params: {
        wattmeter1: { value: w1, unit: "W", realistic_range: [100, 6000] },
        wattmeter2: { value: w2, unit: "W", realistic_range: [100, 6000] },
      },
      answerValue: P,
      answerUnit: "W",
      answerText,
      facts: {
        w1,
        w2,
        P,
        tanPhi: Number(tanPhi.toFixed(4)),
        cosPhi: Number(cosPhi.toFixed(4)),
      },
      defaultStatement:
        `平衡三相3線式回路の電力を二電力計法で測定したところ、2台の電力計の指示が ` +
        `W1=${w1}W、W2=${w2}W であった。三相負荷の有効電力 P〔W〕は?`,
      defaultSolution: [
        `二電力計法（ブロンデルの定理）: 三相有効電力は2台の指示の和 P=W1+W2`,
        `P=${w1}+${w2}`,
        `P=${answerText}W`,
        `（補足: 力率は tanφ=√3(W1−W2)/(W1+W2)=√3×(${w1}−${w2})/(${w1}+${w2})≈${Number(tanPhi.toFixed(3))} より cosφ≈${Number(cosPhi.toFixed(3))}）`,
      ],
      physicallyValid: true,
    };
  },
});
