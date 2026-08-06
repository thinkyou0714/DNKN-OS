/**
 * pastexam-denken2-fill-templates.test.ts — 二種の手薄分野補填で追加した
 * 7テンプレ（電力管理2・理論2・機械2・電力1）の閉形式検算とプロパティ検証。
 *
 * 各テンプレについて:
 *   - generateFrom(代表入力) の answerText / answerUnit / format が固定値どおり
 *   - 不成立条件（物理的前提を破る入力）が null で棄却される
 *   - generate(seededRng) を回した非null draw すべてで answerText が綺麗な有限数
 * （横断的な物理成立・レンジ・解説整合は tests/engine/template-invariants.test.ts が担保）
 */
import { describe, expect, it } from "vitest";
import { isCleanAnswer } from "../../lib/engine/clean.js";
import { capacitorVoltageRise } from "../../lib/engine/templates/capacitor-voltage-rise.js";
import { deltaWyePowerRatio } from "../../lib/engine/templates/delta-wye-power-ratio.js";
import { halfWaveRectifier } from "../../lib/engine/templates/half-wave-rectifier.js";
import { getTemplate } from "../../lib/engine/templates/index.js";
import { opAmpInvertingGain } from "../../lib/engine/templates/op-amp-inverting-gain.js";
import { requiredCompensationCapacity } from "../../lib/engine/templates/required-compensation-capacity.js";
import { synchronousVoltageRegulation } from "../../lib/engine/templates/synchronous-voltage-regulation.js";
import { thermalPlantEfficiency } from "../../lib/engine/templates/thermal-plant-efficiency.js";
import type { Template } from "../../lib/engine/templates/types.js";
import { seededRng } from "../helpers/rng.js";

const NEW_TEMPLATES: Template[] = [
  capacitorVoltageRise,
  requiredCompensationCapacity,
  opAmpInvertingGain,
  deltaWyePowerRatio,
  synchronousVoltageRegulation,
  thermalPlantEfficiency,
  halfWaveRectifier,
];

/** generate() を回数分回し、返った非nullの answerText がすべて綺麗な有限数であることを検証する。 */
function expectCleanGeneration(t: Template, seed: number, runs = 40): void {
  const rng = seededRng(seed);
  let drawn = 0;
  for (let i = 0; i < runs * 4 && drawn < runs; i++) {
    const g = t.generate(rng);
    if (!g) continue;
    drawn += 1;
    const n = Number(g.answerText);
    expect(Number.isFinite(n), `${t.topic}: answerText=${g.answerText} は有限数であるべき`).toBe(true);
    expect(isCleanAnswer(n), `${t.topic}: answerText=${g.answerText} は綺麗な値であるべき`).toBe(true);
  }
  expect(drawn, `${t.topic}: 有効な draw が得られない`).toBeGreaterThan(0);
}

describe("補填テンプレのレジストリ登録", () => {
  it("7テンプレすべてが topic で解決できる", () => {
    for (const t of NEW_TEMPLATES) {
      expect(getTemplate(t.topic), `${t.topic} が登録済み`).toBe(t);
    }
  });
});

describe("電力管理・変電・調相（descriptive）の閉形式検算", () => {
  it("電力用コンデンサによる母線電圧上昇（66kV, 6.6Ω, 20Mvar → 2kV）", () => {
    const g = capacitorVoltageRise.generateFrom({
      system_voltage: 66,
      system_reactance: 6.6,
      capacitor_capacity: 20,
    });
    expect(g).not.toBeNull();
    expect(g?.answerText).toBe("2");
    expect(g?.answerUnit).toBe("kV");
    expect(g?.format).toBe("descriptive");
    expect(g?.choices).toBeUndefined();
  });

  it("電力用コンデンサによる母線電圧上昇（110kV, 16.5Ω, 40Mvar → 6kV）", () => {
    const g = capacitorVoltageRise.generateFrom({
      system_voltage: 110,
      system_reactance: 16.5,
      capacitor_capacity: 40,
    });
    expect(g?.answerText).toBe("6");
  });

  it("電圧上昇が母線電圧の10%を超える draw は棄却する", () => {
    const g = capacitorVoltageRise.generateFrom({
      system_voltage: 66,
      system_reactance: 9.9,
      capacitor_capacity: 50,
    });
    expect(g).toBeNull();
  });

  it("電圧維持に必要な調相容量（110kV, ΔVt=3.3kV, 60MW, 2.2Ω, 5.5Ω, Q1=80 → 38Mvar）", () => {
    const g = requiredCompensationCapacity.generateFrom({
      receiving_voltage: 110,
      target_voltage_drop: 3.3,
      active_power: 60,
      line_resistance: 2.2,
      line_reactance: 5.5,
      reactive_power_before: 80,
    });
    expect(g).not.toBeNull();
    expect(g?.answerText).toBe("38");
    expect(g?.answerUnit).toBe("Mvar");
    expect(g?.format).toBe("descriptive");
  });

  it("電圧維持に必要な調相容量（110kV, ΔVt=2.2kV, 40MW, 1.1Ω, 11Ω, Q1=60 → 42Mvar）", () => {
    const g = requiredCompensationCapacity.generateFrom({
      receiving_voltage: 110,
      target_voltage_drop: 2.2,
      active_power: 40,
      line_resistance: 1.1,
      line_reactance: 11,
      reactive_power_before: 60,
    });
    expect(g?.answerText).toBe("42");
  });

  it("既に目標電圧降下を満たしている（調相不要の）draw は棄却する", () => {
    const g = requiredCompensationCapacity.generateFrom({
      receiving_voltage: 110,
      target_voltage_drop: 4.4,
      active_power: 40,
      line_resistance: 1.1,
      line_reactance: 5.5,
      reactive_power_before: 30,
    });
    expect(g).toBeNull();
  });
});

describe("理論（電子回路・三相交流回路）の閉形式検算", () => {
  it("オペアンプ反転増幅（Rf=100kΩ, Ri=20kΩ, Vi=0.5V → |Vo|=2.5V）", () => {
    const g = opAmpInvertingGain.generateFrom({
      feedback_resistance: 100,
      input_resistance: 20,
      input_voltage: 0.5,
    });
    expect(g).not.toBeNull();
    expect(g?.answerText).toBe("2.5");
    expect(g?.answerUnit).toBe("V");
    expect(g?.format).toBe("numeric");
    expect(g?.choices).toBeUndefined();
  });

  it("利得が1以下（減衰）や飽和域の draw は棄却する", () => {
    expect(
      opAmpInvertingGain.generateFrom({ feedback_resistance: 10, input_resistance: 20, input_voltage: 0.5 }),
    ).toBeNull();
    expect(
      opAmpInvertingGain.generateFrom({ feedback_resistance: 200, input_resistance: 2, input_voltage: 1 }),
    ).toBeNull();
  });

  it("Δ結線とY結線の消費電力（200V, 10Ω → P_Δ=12kW）", () => {
    const g = deltaWyePowerRatio.generateFrom({ line_voltage: 200, resistance: 10 });
    expect(g).not.toBeNull();
    expect(g?.answerText).toBe("12");
    expect(g?.answerUnit).toBe("kW");
    expect(g?.format).toBe("numeric");
  });

  it("Δ結線とY結線の消費電力（400V, 32Ω → P_Δ=15kW）", () => {
    const g = deltaWyePowerRatio.generateFrom({ line_voltage: 400, resistance: 32 });
    expect(g?.answerText).toBe("15");
  });

  it("綺麗な値にならない組合せは棄却する", () => {
    expect(deltaWyePowerRatio.generateFrom({ line_voltage: 100, resistance: 3 })).toBeNull();
  });
});

describe("機械・電力（同期機・火力・パワエレ）の閉形式検算", () => {
  it("同期発電機の電圧変動率（零力率）（xs=0.8p.u., I=0.5p.u. → 40%）", () => {
    const g = synchronousVoltageRegulation.generateFrom({ synchronous_reactance: 0.8, load_current: 0.5 });
    expect(g).not.toBeNull();
    expect(g?.answerText).toBe("40");
    expect(g?.answerUnit).toBe("%");
    expect(g?.format).toBe("numeric");
  });

  it("同期発電機の電圧変動率（零力率）（xs=1.25p.u., I=0.8p.u. → 100%）", () => {
    const g = synchronousVoltageRegulation.generateFrom({ synchronous_reactance: 1.25, load_current: 0.8 });
    expect(g?.answerText).toBe("100");
  });

  it("過負荷（I>1p.u.）の draw は棄却する", () => {
    expect(synchronousVoltageRegulation.generateFrom({ synchronous_reactance: 0.8, load_current: 1.2 })).toBeNull();
  });

  it("汽力発電の発電端効率（0.9×0.45×0.98 → 39.69%）", () => {
    const g = thermalPlantEfficiency.generateFrom({
      boiler_efficiency: 0.9,
      turbine_efficiency: 0.45,
      generator_efficiency: 0.98,
    });
    expect(g).not.toBeNull();
    expect(g?.answerText).toBe("39.69");
    expect(g?.answerUnit).toBe("%");
  });

  it("汽力発電の発電端効率（0.85×0.4×0.95 → 32.3%）", () => {
    const g = thermalPlantEfficiency.generateFrom({
      boiler_efficiency: 0.85,
      turbine_efficiency: 0.4,
      generator_efficiency: 0.95,
    });
    expect(g?.answerText).toBe("32.3");
  });

  it("綺麗な値にならない効率の組合せ・効率>1 は棄却する", () => {
    expect(
      thermalPlantEfficiency.generateFrom({
        boiler_efficiency: 0.88,
        turbine_efficiency: 0.42,
        generator_efficiency: 0.96,
      }),
    ).toBeNull();
    expect(
      thermalPlantEfficiency.generateFrom({
        boiler_efficiency: 1.1,
        turbine_efficiency: 0.45,
        generator_efficiency: 0.98,
      }),
    ).toBeNull();
  });

  it("単相半波整流の直流電圧（200V → 90V / 110V → 49.5V）", () => {
    const g1 = halfWaveRectifier.generateFrom({ ac_voltage: 200 });
    expect(g1?.answerText).toBe("90");
    expect(g1?.answerUnit).toBe("V");
    const g2 = halfWaveRectifier.generateFrom({ ac_voltage: 110 });
    expect(g2?.answerText).toBe("49.5");
  });

  it("非物理的な入力（V≤0）は棄却する", () => {
    expect(halfWaveRectifier.generateFrom({ ac_voltage: 0 })).toBeNull();
  });
});

describe("補填テンプレのプロパティ検証（多数 seed で綺麗な値のみ生成）", () => {
  for (const [i, t] of NEW_TEMPLATES.entries()) {
    it(`${t.topic}: 生成される答えがすべて綺麗な有限数`, () => {
      expectCleanGeneration(t, 1000 + i * 7);
    });
  }
});
