/**
 * テンプレート: 漏えい電流（法規・numeric）。
 *   低圧電路の絶縁抵抗 R に対地電圧（使用電圧）V が加わるときの漏えい電流:
 *     I = V / R    （R は絶縁抵抗）
 *   R を MΩ（=R×10⁶Ω）で与え I を mA で求めると:
 *     I[mA] = V/(R×10⁶) × 10³ = V/(R×10³)
 *   電技省令第58条の絶縁性能（漏えい電流の許容値 1mA 以下）に関連する計算。
 *
 * 典型ミス（解説で言及）:
 *   ・MΩ→Ω 換算（×10⁶）を忘れる
 *   ・A と mA の換算（×10³）を忘れる
 */
import { formatClean, isCleanAnswer } from "../clean.js";
import { defineTemplate, pick } from "./helpers.js";

const VOLTAGE_SET: ReadonlyArray<number> = [100, 105, 110, 200, 210]; // 〔V〕
const RESISTANCE_SET: ReadonlyArray<number> = [0.1, 0.2, 0.5, 1, 2, 2.5, 5]; // 〔MΩ〕

type Params = {
  voltage: number;
  insulation_resistance: number;
};

export const leakageCurrent = defineTemplate<Params>({
  topic: "漏えい電流",
  subject: "法規",
  exam: "denken2_primary",
  difficulty: 2,
  pastExam: {
    area: "絶縁・絶縁耐力",
    frequency: "mid",
    years: [2012, 2017, 2022],
    note: "低圧電路の漏えい電流 I=V/R（絶縁抵抗R）。電技省令58条の絶縁性能",
  },
  paramSpecs: {
    voltage: { unit: "V", realistic_range: [100, 210] },
    insulation_resistance: { unit: "Mohm", realistic_range: [0.1, 5] },
  },
  paramOrder: ["voltage", "insulation_resistance"],
  draw(rng) {
    return {
      voltage: pick(VOLTAGE_SET, rng),
      insulation_resistance: pick(RESISTANCE_SET, rng),
    };
  },
  buildFrom({ voltage, insulation_resistance: r }) {
    if (voltage <= 0 || r <= 0) return null;
    const iMa = voltage / (r * 1000); // 漏えい電流〔mA〕（R[MΩ]=R×10⁶Ω, I[A]=V/R, ×10³でmA）
    if (!isCleanAnswer(iMa)) return null;
    const answerText = formatClean(iMa);
    return {
      format: "numeric",
      params: {
        voltage: { value: voltage, unit: "V", realistic_range: [100, 210] },
        insulation_resistance: { value: r, unit: "Mohm", realistic_range: [0.1, 5] },
      },
      answerValue: iMa,
      answerUnit: "mA",
      answerText,
      facts: { voltage, r, iMa },
      defaultStatement:
        `低圧電路において、対地電圧 V=${formatClean(voltage)}V、絶縁抵抗 R=${formatClean(r)}MΩ であるとき、` +
        `この電路に流れる漏えい電流〔mA〕は?`,
      defaultSolution: [
        `漏えい電流 I=V/R=V/(R×10⁶)〔A〕（R[MΩ]=R×10⁶Ω）`,
        `I=${formatClean(voltage)}/(${formatClean(r)}×10⁶)〔A〕を mA に換算（×10³）`,
        `I=${formatClean(voltage)}/(${formatClean(r)}×10³)=${answerText}mA`,
      ],
      physicallyValid: true,
    };
  },
});
