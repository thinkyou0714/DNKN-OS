/**
 * テンプレート: 単相3線式のバランサ電流（二種二次・電力管理・descriptive）。
 *   100V側の負荷電流が Ia・Ib（Ia>Ib）で不平衡な単相3線式線路の末端にバランサを
 *   設置すると、両外線の電流は平均値 (Ia+Ib)/2 にそろい、バランサには
 *     I_bal = (Ia−Ib)/2 〔A〕
 *   が流れる（中性線電流は 0 になる）。
 *   過去問頻出の「単相3線式」を、バランサ設置後の電流分布にひねった改作。
 */
import { formatClean, isCleanAnswer } from "../clean.js";
import { defineTemplate, pick } from "./helpers.js";

const IA_SET: ReadonlyArray<number> = [20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150];
const IB_SET: ReadonlyArray<number> = [5, 10, 15, 20, 25, 30, 35, 40, 50, 60, 70, 80];

type Params = {
  load_current_a: number;
  load_current_b: number;
};

export const balancerCurrent = defineTemplate<Params>({
  topic: "単相3線式のバランサ電流",
  subject: "電力管理",
  exam: "denken2_secondary",
  difficulty: 4,
  pastExam: { area: "配電・需要損失", frequency: "mid", years: [2007, 2012, 2017, 2023] },
  paramSpecs: {
    load_current_a: { unit: "A", realistic_range: [10, 150] },
    load_current_b: { unit: "A", realistic_range: [5, 100] },
  },
  paramOrder: ["load_current_a", "load_current_b"],
  draw(rng) {
    return {
      load_current_a: pick(IA_SET, rng),
      load_current_b: pick(IB_SET, rng),
    };
  },
  buildFrom({ load_current_a: ia, load_current_b: ib }) {
    if (ia <= 0 || ib <= 0) return null;
    if (ib >= ia) return null; // 不平衡（Ia>Ib）の場合のみ出題
    const balancer = (ia - ib) / 2;
    const lineCurrent = (ia + ib) / 2;
    const neutralBefore = ia - ib;
    if (!isCleanAnswer(balancer) || !isCleanAnswer(lineCurrent)) return null;
    const answerText = formatClean(balancer);
    const line = formatClean(lineCurrent);
    const neutral = formatClean(neutralBefore);
    return {
      format: "descriptive",
      params: {
        load_current_a: { value: ia, unit: "A", realistic_range: [10, 150] },
        load_current_b: { value: ib, unit: "A", realistic_range: [5, 100] },
      },
      answerValue: balancer,
      answerUnit: "A",
      answerText,
      facts: { ia, ib, balancer, lineCurrent, neutralBefore },
      defaultStatement:
        `単相3線式配電線路の100V側負荷が、電圧線aと中性線間で ${ia}A、電圧線bと中性線間で ${ib}A` +
        `（いずれも抵抗負荷）と不平衡になっている。線路末端にバランサを設置したとき、` +
        `バランサに流れる電流〔A〕を求めよ。`,
      defaultSolution: [
        `着眼点: バランサは両外線の電流を平均値にそろえ、不平衡分を巻線間で融通する。`,
        `設置前の中性線電流: Ia−Ib=${ia}−${ib}=${neutral}A`,
        `設置後の外線電流: (Ia+Ib)/2=${line}A（中性線電流は0になる）`,
        `バランサ電流=(Ia−Ib)/2=(${ia}−${ib})/2=${answerText}A`,
        `ポイント: バランサが融通するのは不平衡分の半分。中性線電流そのものではない。`,
      ],
      physicallyValid: true,
    };
  },
});
