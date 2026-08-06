/**
 * テンプレート: 変圧器の励磁電流（機械・numeric）。
 *   無負荷試験: 鉄損電流 Iw = Pi/V, 磁化電流 Iμ = √(I0² − Iw²)
 *   (Iw, Iμ, I0) がピタゴラス数になる組に限定して綺麗な値を担保。
 */
import { formatClean, isCleanAnswer } from "../clean.js";
import { defineTemplate, pick } from "./helpers.js";

/** (V, Pi, I0) — Iw=Pi/V と I0 がピタゴラス組（Iμ が綺麗）。 */
const TRIPLES: ReadonlyArray<readonly [number, number, number]> = [
  [200, 600, 5], // Iw=3, Iμ=4
  [200, 800, 5], // Iw=4, Iμ=3
  [100, 300, 5], // Iw=3, Iμ=4
  [200, 1200, 10], // Iw=6, Iμ=8
  [400, 2400, 10], // Iw=6, Iμ=8
  [200, 1000, 13], // Iw=5, Iμ=12
  [100, 900, 15], // Iw=9, Iμ=12
  [400, 3200, 17], // Iw=8, Iμ=15
  [100, 400, 5], // Iw=4, Iμ=3
  [100, 500, 13], // Iw=5, Iμ=12
  [100, 600, 10], // Iw=6, Iμ=8
  [100, 700, 25], // Iw=7, Iμ=24
  [100, 800, 10], // Iw=8, Iμ=6
  [100, 1000, 26], // Iw=10, Iμ=24
  [100, 1200, 13], // Iw=12, Iμ=5
  [100, 1200, 15], // Iw=12, Iμ=9
  [100, 1200, 20], // Iw=12, Iμ=16
  [100, 1500, 17], // Iw=15, Iμ=8
  [100, 1500, 25], // Iw=15, Iμ=20
  [100, 1600, 20], // Iw=16, Iμ=12
  [100, 1800, 30], // Iw=18, Iμ=24
  [100, 2000, 25], // Iw=20, Iμ=15
  [100, 2000, 29], // Iw=20, Iμ=21
  [100, 2100, 29], // Iw=21, Iμ=20
  [100, 2400, 25], // Iw=24, Iμ=7
  [100, 2400, 26], // Iw=24, Iμ=10
  [100, 2400, 30], // Iw=24, Iμ=18
  [200, 1400, 25], // Iw=7, Iμ=24
  [200, 1600, 10], // Iw=8, Iμ=6
  [200, 1600, 17], // Iw=8, Iμ=15
  [200, 1800, 15], // Iw=9, Iμ=12
  [200, 2000, 26], // Iw=10, Iμ=24
  [200, 2400, 13], // Iw=12, Iμ=5
  [200, 2400, 15], // Iw=12, Iμ=9
  [200, 2400, 20], // Iw=12, Iμ=16
  [200, 3000, 17], // Iw=15, Iμ=8
  [200, 3000, 25], // Iw=15, Iμ=20
  [200, 3200, 20], // Iw=16, Iμ=12
  [200, 3600, 30], // Iw=18, Iμ=24
  [200, 4000, 25], // Iw=20, Iμ=15
  [200, 4800, 26], // Iw=24, Iμ=10
  [400, 1200, 5], // Iw=3, Iμ=4
  [400, 1600, 5], // Iw=4, Iμ=3
  [400, 2000, 13], // Iw=5, Iμ=12
  [400, 2800, 25], // Iw=7, Iμ=24
  [400, 3200, 10], // Iw=8, Iμ=6
  [400, 3600, 15], // Iw=9, Iμ=12
  [400, 4000, 26], // Iw=10, Iμ=24
  [400, 4800, 13], // Iw=12, Iμ=5
  [400, 4800, 15], // Iw=12, Iμ=9
  [400, 4800, 20], // Iw=12, Iμ=16
  [600, 1800, 5], // Iw=3, Iμ=4
  [600, 2400, 5], // Iw=4, Iμ=3
  [600, 3000, 13], // Iw=5, Iμ=12
  [600, 3600, 10], // Iw=6, Iμ=8
];

type Params = {
  voltage: number;
  iron_loss: number;
  no_load_current: number;
};

export const transformerExcitingCurrent = defineTemplate<Params>({
  topic: "変圧器の励磁電流",
  subject: "機械",
  exam: "denken2_primary",
  difficulty: 3,
  pastExam: { area: "変圧器", frequency: "mid", years: [2011, 2017, 2023] },
  paramSpecs: {
    voltage: { unit: "V", realistic_range: [100, 600] },
    iron_loss: { unit: "W", realistic_range: [100, 5000] },
    no_load_current: { unit: "A", realistic_range: [1, 30] },
  },
  paramOrder: ["voltage", "iron_loss", "no_load_current"],
  draw(rng) {
    const [v, pi, i0] = pick(TRIPLES, rng);
    return { voltage: v, iron_loss: pi, no_load_current: i0 };
  },
  buildFrom({ voltage: v, iron_loss: pi, no_load_current: i0 }) {
    if (v <= 0 || pi <= 0 || i0 <= 0) return null;
    const iw = pi / v;
    if (iw >= i0) return null;
    const imu = Math.sqrt(i0 * i0 - iw * iw);
    if (!isCleanAnswer(iw) || !isCleanAnswer(imu)) return null;
    const answerText = formatClean(imu);
    return {
      format: "numeric",
      params: {
        voltage: { value: v, unit: "V", realistic_range: [100, 600] },
        iron_loss: { value: pi, unit: "W", realistic_range: [100, 5000] },
        no_load_current: { value: i0, unit: "A", realistic_range: [1, 30] },
      },
      answerValue: imu,
      answerUnit: "A",
      answerText,
      facts: { v, pi, i0, iw, imu },
      defaultStatement:
        `変圧器の無負荷試験で、電圧 ${formatClean(v)}V を加えたところ無負荷電流 ${formatClean(i0)}A、` +
        `鉄損 ${formatClean(pi)}W であった。磁化電流〔A〕は?`,
      defaultSolution: [
        `鉄損電流 Iw=Pi/V=${formatClean(pi)}/${formatClean(v)}=${formatClean(iw)}A`,
        `磁化電流は無負荷電流の直角成分: Iμ=√(I0²−Iw²)=√(${formatClean(i0 * i0)}−${formatClean(iw * iw)})`,
        `=${answerText}A`,
      ],
      physicallyValid: true,
    };
  },
});
