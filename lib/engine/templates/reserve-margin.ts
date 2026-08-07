/**
 * テンプレート: 供給力の積み上げと供給予備率（二種二次・電力管理・descriptive）。
 *   供給力 S = 火力 + 水力 + 他社受電、予備率 = (S − 最大需要)/最大需要 × 100〔%〕
 *   過去問頻出の「電力需給」を、供給力の積み上げから予備率算定までの文章問題にひねった改作。
 */
import { formatClean, isCleanAnswer } from "../clean.js";
import { defineTemplate, pick } from "./helpers.js";

const THERMAL_SET: ReadonlyArray<number> = [1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 6000];
const HYDRO_SET: ReadonlyArray<number> = [500, 750, 1000, 1250, 1500, 1750, 2000, 2250, 2500, 3000];
const PURCHASE_SET: ReadonlyArray<number> = [200, 400, 500, 600, 800, 1000, 1200, 1500, 2000];
const DEMAND_SET: ReadonlyArray<number> = [3000, 3500, 4000, 4500, 5000, 6000, 7000, 8000, 9000, 10000];

type Params = {
  thermal_capacity: number;
  hydro_capacity: number;
  purchased_power: number;
  peak_demand: number;
};

export const reserveMargin = defineTemplate<Params>({
  topic: "供給力と供給予備率",
  subject: "電力管理",
  exam: "denken2_secondary",
  difficulty: 4,
  pastExam: { area: "配電・需要損失", frequency: "mid", years: [2010, 2016, 2021] },
  paramSpecs: {
    thermal_capacity: { unit: "MW", realistic_range: [1000, 6000] },
    hydro_capacity: { unit: "MW", realistic_range: [500, 3000] },
    purchased_power: { unit: "MW", realistic_range: [200, 2000] },
    peak_demand: { unit: "MW", realistic_range: [3000, 10000] },
  },
  paramOrder: ["thermal_capacity", "hydro_capacity", "purchased_power", "peak_demand"],
  draw(rng) {
    return {
      thermal_capacity: pick(THERMAL_SET, rng),
      hydro_capacity: pick(HYDRO_SET, rng),
      purchased_power: pick(PURCHASE_SET, rng),
      peak_demand: pick(DEMAND_SET, rng),
    };
  },
  buildFrom({ thermal_capacity: th, hydro_capacity: hy, purchased_power: pu, peak_demand: d }) {
    if (th <= 0 || hy <= 0 || pu <= 0 || d <= 0) return null;
    const supply = th + hy + pu;
    const margin = ((supply - d) / d) * 100;
    // 予備率は正で、現実的な範囲（〜30%程度）の綺麗な値のみ採用。
    if (margin <= 0 || margin > 30 || !isCleanAnswer(margin)) return null;
    const answerText = formatClean(margin);
    const s = formatClean(supply);
    return {
      format: "descriptive",
      params: {
        thermal_capacity: { value: th, unit: "MW", realistic_range: [1000, 6000] },
        hydro_capacity: { value: hy, unit: "MW", realistic_range: [500, 3000] },
        purchased_power: { value: pu, unit: "MW", realistic_range: [200, 2000] },
        peak_demand: { value: d, unit: "MW", realistic_range: [3000, 10000] },
      },
      answerValue: margin,
      answerUnit: "%",
      answerText,
      facts: { th, hy, pu, d, supply, margin },
      defaultStatement:
        `ある電力系統の供給力は、火力 ${th}MW、水力 ${hy}MW、他社受電 ${pu}MW である。` +
        `想定最大需要が ${d}MW のとき、供給予備率〔%〕を求めよ。`,
      defaultSolution: [
        `着眼点: まず供給力を積み上げ、最大需要に対する余裕を%で表す。`,
        `供給力: S=${th}+${hy}+${pu}=${s}MW`,
        `予備率=(S−D)/D×100=(${s}−${d})/${d}×100=${answerText}%`,
        `ポイント: 分母は供給力ではなく最大需要。分母の取り違えが典型ミス。`,
      ],
      physicallyValid: true,
    };
  },
});
