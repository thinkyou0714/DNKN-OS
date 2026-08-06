/** topic 名 → Template のレジストリ。 */

import { acBridgeBalance } from "./ac-bridge-balance.js";
import { allDayEfficiency } from "./all-day-efficiency.js";
import { allowableTension } from "./allowable-tension.js";
import { bTypeGrounding } from "./b-type-grounding.js";
import { balancerCurrent } from "./balancer-current.js";
import { batteryCapacity } from "./battery-capacity.js";
import { blockDiagramGain } from "./block-diagram-gain.js";
import { boostChopper } from "./boost-chopper.js";
import { buckBoostChopper } from "./buck-boost-chopper.js";
import { buckChopper } from "./buck-chopper.js";
import { capacitorEnergy } from "./capacitor-energy.js";
import { capacitorVoltageRise } from "./capacitor-voltage-rise.js";
import { capacityFactor } from "./capacity-factor.js";
import { chargeRedistribution } from "./charge-redistribution.js";
import { chopperCurrentRipple } from "./chopper-current-ripple.js";
import { closedLoopTimeConstant } from "./closed-loop-time-constant.js";
import { combinedCycleEfficiency } from "./combined-cycle-efficiency.js";
import { condenserCoolingWater } from "./condenser-cooling-water.js";
import { conductorActualLength } from "./conductor-actual-length.js";
import { conductorLength } from "./conductor-length.js";
import { coulombForce } from "./coulomb-force.js";
import { coupledInductorConnection } from "./coupled-inductor-connection.js";
import { currentLimitingReactor } from "./current-limiting-reactor.js";
import { currentTransformerRelay } from "./current-transformer-relay.js";
import { dailyLoadFactor } from "./daily-load-factor.js";
import { dcGeneratorEmf } from "./dc-generator-emf.js";
import { dcMotorEmf } from "./dc-motor-emf.js";
import { dcMotorFieldWeakening } from "./dc-motor-field-weakening.js";
import { dcMotorSpeedResistance } from "./dc-motor-speed-resistance.js";
import { deltaWyePowerRatio } from "./delta-wye-power-ratio.js";
import { deltaWyeResistance } from "./delta-wye-resistance.js";
import { demandFactor } from "./demand-factor.js";
import { disturbanceSteadyState } from "./disturbance-steady-state.js";
import { diversityFactor } from "./diversity-factor.js";
import { electricEnergy } from "./electric-energy.js";
import { electricHeating } from "./electric-heating.js";
import { elevatorCounterweightPower } from "./elevator-counterweight-power.js";
import { firstOrderControl } from "./first-order-control.js";
import { rotorAcceleration } from "./flywheel-acceleration.js";
import { fullWaveRectifier } from "./full-wave-rectifier.js";
import { governorLoadSharing } from "./governor-load-sharing.js";
import { groundFaultNeutralResistance } from "./ground-fault-neutral-resistance.js";
import { groundFaultPotentialRise } from "./ground-fault-potential-rise.js";
import { groundFaultSymmetrical } from "./ground-fault-symmetrical.js";
import { groundingResistance } from "./grounding-resistance.js";
import { groundingTypes } from "./grounding-types.js";
import { guyWireSafety } from "./guy-wire-safety.js";
import { halfWaveRectifier } from "./half-wave-rectifier.js";
import { heatPumpCop } from "./heat-pump-cop.js";
import { hoistMotorOutput } from "./hoist-motor-output.js";
import { hvInsulationTestVoltage } from "./hv-insulation-test-voltage.js";
import { hydroPowerOutput } from "./hydro-power-output.js";
import { indoorVoltageLimit } from "./indoor-voltage-limit.js";
import { inducedEmf } from "./induced-emf.js";
import { inductionMotorEfficiency } from "./induction-motor-efficiency.js";
import { inductionMotorSpeed } from "./induction-motor-speed.js";
import { inductionPowerBalance } from "./induction-power-balance.js";
import { inductionProportionalShift } from "./induction-proportional-shift.js";
import { inductionSecondaryCopperLoss } from "./induction-secondary-copper-loss.js";
import { inductorEnergy } from "./inductor-energy.js";
import { insulationResistance } from "./insulation-resistance.js";
import { insulationTestVoltage } from "./insulation-test-voltage.js";
import { inverseSquareIlluminance } from "./inverse-square-illuminance.js";
import { ironLossFrequency } from "./iron-loss-frequency.js";
import { kirchhoffTwoMesh } from "./kirchhoff-two-mesh.js";
import { leakageCurrent } from "./leakage-current.js";
import { lightingDesign } from "./lighting-design.js";
import { loadFactor } from "./load-factor.js";
import { loopDistributionCurrent } from "./loop-distribution-current.js";
import { lossFactor } from "./loss-factor.js";
import { lossReductionPf } from "./loss-reduction-pf.js";
import { magneticCircuit } from "./magnetic-circuit.js";
import { massDefectEnergy } from "./mass-defect-energy.js";
import { maxDemandComposite } from "./max-demand-composite.js";
import { maxEfficiencyLoad } from "./max-efficiency-load.js";
import { maxPowerTransfer } from "./max-power-transfer.js";
import { maxTorqueStartResistance } from "./max-torque-start-resistance.js";
import { multiplierResistor } from "./multiplier-resistor.js";
import { mutualInductance } from "./mutual-inductance.js";
import { nuclearPowerOutput } from "./nuclear-power-output.js";
import { opAmpInvertingGain } from "./op-amp-inverting-gain.js";
import { opAmpNoninvertingGain } from "./op-amp-noninverting-gain.js";
import { overheadClearance } from "./overhead-clearance.js";
import { parallelConductorForce } from "./parallel-conductor-force.js";
import { parallelImpedanceMagnitude } from "./parallel-impedance-magnitude.js";
import { parallelPercentImpedance } from "./parallel-percent-impedance.js";
import { parallelPlateField } from "./parallel-plate-field.js";
import { partialDielectricCapacitor } from "./partial-dielectric-capacitor.js";
import { percentImpedanceConversion } from "./percent-impedance-conversion.js";
import { percentImpedanceShortCircuit } from "./percent-impedance-short-circuit.js";
import { pfImprovementCapacity } from "./pf-improvement-capacity.js";
import { pointChargePotential } from "./point-charge-potential.js";
import { poleEmbedmentDepth } from "./pole-embedment-depth.js";
import { powerFactorCorrection } from "./power-factor-correction.js";
import { pqVoltageDrop } from "./pq-voltage-drop.js";
import { pumpMotorInput } from "./pump-motor-input.js";
import { pumpedStorageEfficiency } from "./pumped-storage-efficiency.js";
import { pumpedStorageGenerationTime } from "./pumped-storage-generation-time.js";
import { pumpingRequiredPower } from "./pumping-required-power.js";
import { pwmInverterVoltage } from "./pwm-inverter-voltage.js";
import { rcTimeConstant } from "./rc-time-constant.js";
import { reactivePowerCompensation } from "./reactive-power-compensation.js";
import { requiredCompensationCapacity } from "./required-compensation-capacity.js";
import { reserveMargin } from "./reserve-margin.js";
import { resistanceTemperature } from "./resistance-temperature.js";
import { resistorNetwork } from "./resistor-network.js";
import { rlTimeConstant } from "./rl-time-constant.js";
import { rlcResonance } from "./rlc-resonance.js";
import { rotationalPower } from "./rotational-power.js";
import { routhStabilityLimit } from "./routh-stability-limit.js";
import { sagTension } from "./sag-tension.js";
import { secondOrderResponse } from "./second-order-response.js";
import { seriesCapacitance } from "./series-capacitance.js";
import { seriesPercentImpedanceFault } from "./series-percent-impedance-fault.js";
import { seriesRlCurrent } from "./series-rl-current.js";
import { shortCircuitCapacity } from "./short-circuit-capacity.js";
import { shortCircuitOhm } from "./short-circuit-ohm.js";
import { shortCircuitRatio } from "./short-circuit-ratio.js";
import { shuntResistor } from "./shunt-resistor.js";
import { singlePhaseVoltageDrop } from "./single-phase-voltage-drop.js";
import { smallScaleElectricalFacility } from "./small-scale-electrical-facility.js";
import { solenoidMagneticField } from "./solenoid-magnetic-field.js";
import { specificSpeed } from "./specific-speed.js";
import { speedRegulation } from "./speed-regulation.js";
import { starDeltaStarting } from "./star-delta-starting.js";
import { stationServiceEfficiency } from "./station-service-efficiency.js";
import { steadyStateError } from "./steady-state-error.js";
import { supplyVoltageLimit } from "./supply-voltage-limit.js";
import { switchingLoss } from "./switching-loss.js";
import { synchronizingCurrent } from "./synchronizing-current.js";
import { synchronousGeneratorOutput } from "./synchronous-generator-output.js";
import { synchronousSpeed } from "./synchronous-speed.js";
import { synchronousVoltageRegulation } from "./synchronous-voltage-regulation.js";
import { systemFrequencyConstant } from "./system-frequency-constant.js";
import { thermalEfficiency } from "./thermal-efficiency.js";
import { thermalFuelConsumption } from "./thermal-fuel-consumption.js";
import { thermalPlantEfficiency } from "./thermal-plant-efficiency.js";
import { theveninLoadCurrent } from "./thevenin-load-current.js";
import { threePhasePower } from "./three-phase-power.js";
import { threePhaseRectifier } from "./three-phase-rectifier.js";
import { transformerCapacitySelection } from "./transformer-capacity-selection.js";
import { transformerEfficiency } from "./transformer-efficiency.js";
import { transformerExcitingCurrent } from "./transformer-exciting-current.js";
import { transformerParallelLoad } from "./transformer-parallel-load.js";
import { transformerTap } from "./transformer-tap.js";
import { transformerTurnsRatio } from "./transformer-turns-ratio.js";
import { transformerVoltageRegulation } from "./transformer-voltage-regulation.js";
import { transistorCurrentGain } from "./transistor-current-gain.js";
import { transmissionEfficiency } from "./transmission-efficiency.js";
import { transmissionLoss } from "./transmission-loss.js";
import { transmissionPowerStability } from "./transmission-power-stability.js";
import { twoWattmeterPower } from "./two-wattmeter-power.js";
import type { Template } from "./types.js";
import { vConnectionTransformer } from "./v-connection-transformer.js";
import { vfControlSpeed } from "./vf-control-speed.js";
import { voltageClassification } from "./voltage-classification.js";
import { voltageDropRate } from "./voltage-drop-rate.js";
import { wheatstoneBridge } from "./wheatstone-bridge.js";
import { windLoad } from "./wind-load.js";

const templates: Template[] = [
  // 理論
  threePhasePower,
  resistorNetwork,
  capacitorEnergy,
  maxPowerTransfer,
  rcTimeConstant,
  wheatstoneBridge,
  shuntResistor,
  multiplierResistor,
  parallelPlateField,
  inductorEnergy,
  electricEnergy,
  rlcResonance,
  inducedEmf,
  coulombForce,
  rlTimeConstant,
  seriesCapacitance,
  resistanceTemperature,
  seriesRlCurrent,
  magneticCircuit,
  opAmpNoninvertingGain,
  solenoidMagneticField,
  parallelConductorForce,
  mutualInductance,
  deltaWyeResistance,
  pointChargePotential,
  theveninLoadCurrent,
  transistorCurrentGain,
  twoWattmeterPower,
  kirchhoffTwoMesh,
  parallelImpedanceMagnitude,
  partialDielectricCapacitor,
  acBridgeBalance,
  coupledInductorConnection,
  chargeRedistribution,
  opAmpInvertingGain,
  deltaWyePowerRatio,
  // 電力
  demandFactor,
  powerFactorCorrection,
  percentImpedanceShortCircuit,
  transmissionLoss,
  singlePhaseVoltageDrop,
  percentImpedanceConversion,
  voltageDropRate,
  loadFactor,
  diversityFactor,
  transmissionEfficiency,
  combinedCycleEfficiency,
  thermalFuelConsumption,
  capacityFactor,
  specificSpeed,
  speedRegulation,
  conductorLength,
  pqVoltageDrop,
  transformerTap,
  pumpedStorageEfficiency,
  nuclearPowerOutput,
  currentTransformerRelay,
  pfImprovementCapacity,
  massDefectEnergy,
  thermalPlantEfficiency,
  // 機械
  inductionMotorSpeed,
  transformerEfficiency,
  dcMotorEmf,
  shortCircuitRatio,
  inductionPowerBalance,
  transformerTurnsRatio,
  pumpMotorInput,
  lightingDesign,
  dcGeneratorEmf,
  maxEfficiencyLoad,
  hoistMotorOutput,
  fullWaveRectifier,
  electricHeating,
  transformerParallelLoad,
  rotationalPower,
  batteryCapacity,
  transformerExcitingCurrent,
  rotorAcceleration,
  inverseSquareIlluminance,
  synchronousSpeed,
  inductionSecondaryCopperLoss,
  vConnectionTransformer,
  pwmInverterVoltage,
  allDayEfficiency,
  heatPumpCop,
  inductionMotorEfficiency,
  elevatorCounterweightPower,
  ironLossFrequency,
  synchronousVoltageRegulation,
  halfWaveRectifier,
  // 法規
  groundingResistance,
  sagTension,
  insulationTestVoltage,
  windLoad,
  allowableTension,
  bTypeGrounding,
  insulationResistance,
  voltageClassification,
  overheadClearance,
  groundingTypes,
  guyWireSafety,
  indoorVoltageLimit,
  supplyVoltageLimit,
  leakageCurrent,
  conductorActualLength,
  poleEmbedmentDepth,
  transformerCapacitySelection,
  hvInsulationTestVoltage,
  smallScaleElectricalFacility,
  groundFaultPotentialRise,
  // 機械制御（二次）
  transformerVoltageRegulation,
  synchronousGeneratorOutput,
  buckChopper,
  firstOrderControl,
  inductionProportionalShift,
  boostChopper,
  steadyStateError,
  secondOrderResponse,
  blockDiagramGain,
  threePhaseRectifier,
  starDeltaStarting,
  dcMotorSpeedResistance,
  routhStabilityLimit,
  buckBoostChopper,
  vfControlSpeed,
  maxTorqueStartResistance,
  dcMotorFieldWeakening,
  chopperCurrentRipple,
  disturbanceSteadyState,
  synchronizingCurrent,
  switchingLoss,
  closedLoopTimeConstant,
  // 電力管理（二次）
  reactivePowerCompensation,
  hydroPowerOutput,
  thermalEfficiency,
  shortCircuitCapacity,
  transmissionPowerStability,
  shortCircuitOhm,
  groundFaultSymmetrical,
  groundFaultNeutralResistance,
  parallelPercentImpedance,
  lossFactor,
  maxDemandComposite,
  dailyLoadFactor,
  condenserCoolingWater,
  loopDistributionCurrent,
  governorLoadSharing,
  seriesPercentImpedanceFault,
  pumpingRequiredPower,
  stationServiceEfficiency,
  balancerCurrent,
  systemFrequencyConstant,
  lossReductionPf,
  reserveMargin,
  currentLimitingReactor,
  pumpedStorageGenerationTime,
  capacitorVoltageRise,
  requiredCompensationCapacity,
];

const registry = new Map<string, Template>(templates.map((t) => [t.topic, t]));

// topic は出題の一意キー。重複すると後勝ちで片方が黙って消えるため、
// モジュール読込時に検出して即座に落とす（テンプレ追加時の事故を早期発見）。
if (registry.size !== templates.length) {
  const seen = new Set<string>();
  const dups: string[] = [];
  for (const t of templates) {
    if (seen.has(t.topic)) dups.push(t.topic);
    else seen.add(t.topic);
  }
  throw new Error(`テンプレートの topic が重複しています: ${[...new Set(dups)].join(", ")}`);
}

export function getTemplate(topic: string): Template | undefined {
  return registry.get(topic);
}

export function listTopics(): string[] {
  return [...registry.keys()];
}

export type { Template };
export {
  acBridgeBalance,
  allDayEfficiency,
  allowableTension,
  balancerCurrent,
  batteryCapacity,
  blockDiagramGain,
  boostChopper,
  bTypeGrounding,
  buckBoostChopper,
  buckChopper,
  capacitorEnergy,
  capacitorVoltageRise,
  capacityFactor,
  chargeRedistribution,
  chopperCurrentRipple,
  closedLoopTimeConstant,
  combinedCycleEfficiency,
  condenserCoolingWater,
  conductorActualLength,
  conductorLength,
  coulombForce,
  coupledInductorConnection,
  currentLimitingReactor,
  currentTransformerRelay,
  dailyLoadFactor,
  dcGeneratorEmf,
  dcMotorEmf,
  dcMotorFieldWeakening,
  dcMotorSpeedResistance,
  deltaWyePowerRatio,
  deltaWyeResistance,
  demandFactor,
  disturbanceSteadyState,
  diversityFactor,
  electricEnergy,
  electricHeating,
  elevatorCounterweightPower,
  firstOrderControl,
  fullWaveRectifier,
  governorLoadSharing,
  groundFaultNeutralResistance,
  groundFaultPotentialRise,
  groundFaultSymmetrical,
  groundingResistance,
  groundingTypes,
  guyWireSafety,
  halfWaveRectifier,
  heatPumpCop,
  hoistMotorOutput,
  hvInsulationTestVoltage,
  hydroPowerOutput,
  indoorVoltageLimit,
  inducedEmf,
  inductionMotorEfficiency,
  inductionMotorSpeed,
  inductionPowerBalance,
  inductionProportionalShift,
  inductionSecondaryCopperLoss,
  inductorEnergy,
  insulationResistance,
  insulationTestVoltage,
  inverseSquareIlluminance,
  ironLossFrequency,
  kirchhoffTwoMesh,
  leakageCurrent,
  lightingDesign,
  loadFactor,
  loopDistributionCurrent,
  lossFactor,
  lossReductionPf,
  magneticCircuit,
  massDefectEnergy,
  maxDemandComposite,
  maxEfficiencyLoad,
  maxPowerTransfer,
  maxTorqueStartResistance,
  multiplierResistor,
  mutualInductance,
  nuclearPowerOutput,
  opAmpInvertingGain,
  opAmpNoninvertingGain,
  overheadClearance,
  parallelConductorForce,
  parallelImpedanceMagnitude,
  parallelPercentImpedance,
  parallelPlateField,
  partialDielectricCapacitor,
  percentImpedanceConversion,
  percentImpedanceShortCircuit,
  pfImprovementCapacity,
  pointChargePotential,
  poleEmbedmentDepth,
  powerFactorCorrection,
  pqVoltageDrop,
  pumpedStorageEfficiency,
  pumpedStorageGenerationTime,
  pumpingRequiredPower,
  pumpMotorInput,
  pwmInverterVoltage,
  rcTimeConstant,
  reactivePowerCompensation,
  requiredCompensationCapacity,
  reserveMargin,
  resistanceTemperature,
  resistorNetwork,
  rlcResonance,
  rlTimeConstant,
  rotationalPower,
  rotorAcceleration,
  routhStabilityLimit,
  sagTension,
  secondOrderResponse,
  seriesCapacitance,
  seriesPercentImpedanceFault,
  seriesRlCurrent,
  shortCircuitCapacity,
  shortCircuitOhm,
  shortCircuitRatio,
  shuntResistor,
  singlePhaseVoltageDrop,
  smallScaleElectricalFacility,
  solenoidMagneticField,
  specificSpeed,
  speedRegulation,
  starDeltaStarting,
  stationServiceEfficiency,
  steadyStateError,
  supplyVoltageLimit,
  switchingLoss,
  synchronizingCurrent,
  synchronousGeneratorOutput,
  synchronousSpeed,
  synchronousVoltageRegulation,
  systemFrequencyConstant,
  thermalEfficiency,
  thermalFuelConsumption,
  thermalPlantEfficiency,
  theveninLoadCurrent,
  threePhasePower,
  threePhaseRectifier,
  transformerCapacitySelection,
  transformerEfficiency,
  transformerExcitingCurrent,
  transformerParallelLoad,
  transformerTap,
  transformerTurnsRatio,
  transformerVoltageRegulation,
  transistorCurrentGain,
  transmissionEfficiency,
  transmissionLoss,
  transmissionPowerStability,
  twoWattmeterPower,
  vConnectionTransformer,
  vfControlSpeed,
  voltageClassification,
  voltageDropRate,
  wheatstoneBridge,
  windLoad,
};
