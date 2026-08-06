/**
 * テンプレート: 電圧維持に必要な調相容量（二種二次・電力管理・descriptive・難易度5）。
 *   送電線（抵抗 R, リアクタンス X）の受電端電圧降下の近似式:
 *     ΔV = (P·R + Q·X) / V   〔kV〕（P:MW, Q:Mvar, V:kV）
 *   受電端に電力用コンデンサ Qc を設置すると無効電力は Q1−Qc に減り ΔV が縮む。
 *   目標降下 ΔVt 以下にするための必要容量:
 *     許容無効電力 Q2 = (V·ΔVt − P·R) / X
 *     Qc = Q1 − Q2
 *   逆算型の多段導出を要する、二次「変電・調相」の定番構成。
 */
import { formatClean, isCleanAnswer } from "../clean.js";
import { defineTemplate, pick } from "./helpers.js";

// 全量を 11 の倍数系で構成 → Q2=(V·ΔVt−P·R)/X が必ず整数になる。
const V_FIXED = 110; // 〔kV〕
const DVT_SET: ReadonlyArray<number> = [2.2, 3.3, 4.4];
const P_SET: ReadonlyArray<number> = [40, 60, 80];
const R_SET: ReadonlyArray<number> = [1.1, 2.2];
const X_SET: ReadonlyArray<number> = [5.5, 11];
const Q1_SET: ReadonlyArray<number> = [30, 40, 50, 60, 80];

type Params = {
  receiving_voltage: number;
  target_voltage_drop: number;
  active_power: number;
  line_resistance: number;
  line_reactance: number;
  reactive_power_before: number;
};

export const requiredCompensationCapacity = defineTemplate<Params>({
  topic: "電圧維持に必要な調相容量",
  subject: "電力管理",
  exam: "denken2_secondary",
  difficulty: 5,
  pastExam: { area: "変電・調相", frequency: "mid", years: [2008, 2013, 2019, 2024] },
  paramSpecs: {
    receiving_voltage: { unit: "kV", realistic_range: [60, 170] },
    target_voltage_drop: { unit: "kV", realistic_range: [1, 10] },
    active_power: { unit: "MW", realistic_range: [20, 120] },
    line_resistance: { unit: "Ω", realistic_range: [0.5, 5] },
    line_reactance: { unit: "Ω", realistic_range: [2, 20] },
    reactive_power_before: { unit: "Mvar", realistic_range: [10, 100] },
  },
  paramOrder: [
    "receiving_voltage",
    "target_voltage_drop",
    "active_power",
    "line_resistance",
    "line_reactance",
    "reactive_power_before",
  ],
  draw(rng) {
    return {
      receiving_voltage: V_FIXED,
      target_voltage_drop: pick(DVT_SET, rng),
      active_power: pick(P_SET, rng),
      line_resistance: pick(R_SET, rng),
      line_reactance: pick(X_SET, rng),
      reactive_power_before: pick(Q1_SET, rng),
    };
  },
  buildFrom({
    receiving_voltage: V,
    target_voltage_drop: dVt,
    active_power: P,
    line_resistance: R,
    line_reactance: X,
    reactive_power_before: Q1,
  }) {
    if (V <= 0 || dVt <= 0 || P <= 0 || R <= 0 || X <= 0 || Q1 <= 0) return null;
    const dvBefore = (P * R + Q1 * X) / V; // 調相前の電圧降下〔kV〕
    // 調相が必要になる（現状が目標を超過している）ケースに限定する。
    if (dvBefore <= dVt) return null;
    const q2 = (V * dVt - P * R) / X; // 目標達成時に許容される無効電力〔Mvar〕
    if (q2 < 0) return null;
    const qc = Q1 - q2; // 必要な調相容量〔Mvar〕
    if (qc <= 0 || qc > Q1) return null;
    if (![dvBefore, q2, qc].every((x2) => isCleanAnswer(x2))) return null;
    const answerText = formatClean(qc);
    return {
      format: "descriptive",
      params: {
        receiving_voltage: { value: V, unit: "kV", realistic_range: [60, 170] },
        target_voltage_drop: { value: dVt, unit: "kV", realistic_range: [1, 10] },
        active_power: { value: P, unit: "MW", realistic_range: [20, 120] },
        line_resistance: { value: R, unit: "Ω", realistic_range: [0.5, 5] },
        line_reactance: { value: X, unit: "Ω", realistic_range: [2, 20] },
        reactive_power_before: { value: Q1, unit: "Mvar", realistic_range: [10, 100] },
      },
      answerValue: qc,
      answerUnit: "Mvar",
      answerText,
      facts: { V, dVt, P, R, X, Q1, dvBefore, q2, qc },
      defaultStatement:
        `受電端電圧 V=${formatClean(V)}kV の送電線（抵抗 R=${formatClean(R)}Ω、リアクタンス X=${formatClean(X)}Ω）で、` +
        `受電端の負荷は有効電力 P=${formatClean(P)}MW、無効電力 Q1=${formatClean(Q1)}Mvar（遅れ）である。` +
        `電圧降下の近似式 ΔV=(P·R+Q·X)/V を用い、電圧降下を ΔVt=${formatClean(dVt)}kV 以下に抑えるために` +
        `受電端へ設置すべき電力用コンデンサ（調相設備）容量 Qc〔Mvar〕を導出過程とともに求めよ。`,
      defaultSolution: [
        `着眼点: コンデンサ設置後の無効電力は Q1−Qc に減るので、目標の ΔVt から許容できる無効電力を逆算する。`,
        `現状の電圧降下 ΔV=(P·R+Q1·X)/V=(${formatClean(P)}×${formatClean(R)}+${formatClean(Q1)}×${formatClean(X)})/${formatClean(V)}=${formatClean(dvBefore)}kV（>ΔVt で対策要）`,
        `目標達成時の許容無効電力 Q2: ΔVt=(P·R+Q2·X)/V より Q2=(V·ΔVt−P·R)/X`,
        `Q2=(${formatClean(V)}×${formatClean(dVt)}−${formatClean(P)}×${formatClean(R)})/${formatClean(X)}=${formatClean(q2)}Mvar`,
        `必要容量 Qc=Q1−Q2=${formatClean(Q1)}−${formatClean(q2)}`,
        `Qc=${answerText}Mvar`,
        `ポイント: 有効電力 P は調相では変わらない。X が大きい系統ほど無効電力削減の電圧改善効果が大きい。`,
      ],
      physicallyValid: true,
    };
  },
});
