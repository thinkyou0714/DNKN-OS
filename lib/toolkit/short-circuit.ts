/**
 * short-circuit.ts — 三相短絡電流と遮断器の遮断容量チェック（純ロジック）。
 *
 * モデル: %インピーダンス法（電力系統計算の標準手法）。
 *   短絡容量 Ps = Pn × 100 / %Z　／　三相短絡電流 Is = Ps / (√3 · V)
 * 変圧器の二次側短絡だけを見る場合は、基準容量に変圧器容量を取れば
 * Ps = P_tr × 100 / %Z_tr で直接出る（電源側インピーダンスを無視した安全側でない近似）。
 *
 * 遮断器は「切れる電流の上限」で選ぶため、この値が定格遮断電流を超えると
 * 事故時に遮断器そのものが破壊される。設計上の最重要チェックのひとつ。
 *
 * 根拠解説の技術内容はドラフト。販売前に販売者（実務者）の最終監修を受けること。
 */

import type { ExplanationDoc, FieldSpec, ModuleResult, ToolkitModule } from "./types.js";
import { judgeUsage, num, validateFields } from "./types.js";

export const SHORT_CIRCUIT_FIELDS: FieldSpec[] = [
  {
    key: "mode",
    label: "入力方式",
    kind: "select",
    defaultValue: "percentZ",
    options: [
      { value: "percentZ", label: "基準容量＋合成%Z" },
      { value: "transformer", label: "変圧器のみ（容量＋%Z）" },
    ],
    help: "電源側を含めた合成%Z が分かるなら前者。変圧器二次側の概算だけなら後者",
  },
  {
    key: "baseCapacity",
    label: "基準容量 Pn",
    unit: "MVA",
    kind: "number",
    defaultValue: 10,
    min: 0,
    minExclusive: true,
    max: 100000,
    help: "%Z を換算した基準容量（10MVA を基準にすることが多い）",
    showIf: { key: "mode", equals: "percentZ" },
  },
  {
    key: "percentZ",
    label: "合成%インピーダンス %Z",
    unit: "%",
    kind: "number",
    defaultValue: 5,
    min: 0,
    minExclusive: true,
    max: 1000,
    help: "基準容量に換算した、電源から故障点までの合成値",
    showIf: { key: "mode", equals: "percentZ" },
  },
  {
    key: "transformerCapacity",
    label: "変圧器容量",
    unit: "kVA",
    kind: "number",
    defaultValue: 500,
    min: 0,
    minExclusive: true,
    max: 10000000,
    showIf: { key: "mode", equals: "transformer" },
  },
  {
    key: "transformerPercentZ",
    label: "変圧器の%Z",
    unit: "%",
    kind: "number",
    defaultValue: 4,
    min: 0,
    minExclusive: true,
    max: 100,
    help: "銘板の%インピーダンス（低圧変圧器は 2〜6% が典型）",
    showIf: { key: "mode", equals: "transformer" },
  },
  {
    key: "voltage",
    label: "故障点の線間電圧",
    unit: "kV",
    kind: "number",
    defaultValue: 6.6,
    min: 0,
    minExclusive: true,
    max: 1000,
    help: "6.6kV／0.42kV（低圧側は 0.42 のように kV で入力）",
  },
  {
    key: "breakingCurrent",
    label: "遮断器の定格遮断電流",
    unit: "kA",
    kind: "number",
    defaultValue: 12.5,
    min: 0,
    minExclusive: true,
    max: 1000,
    help: "遮断器の銘板値（高圧 8/12.5/20kA、低圧 MCCB は kA 表記の遮断容量）",
  },
  {
    key: "threshold",
    label: "判定閾値（定格遮断電流に対する比）",
    unit: "%",
    kind: "number",
    defaultValue: 80,
    min: 0,
    minExclusive: true,
    max: 100,
    help: "系統増強の余地を残すため 80% 程度で見るのが実務的",
  },
];

export function computeShortCircuit(values: Record<string, number | string>): ModuleResult {
  const v = validateFields(SHORT_CIRCUIT_FIELDS, values);
  if (!v.ok) return { ok: false, errors: v.errors };
  const mode = v.input.sels.mode ?? "percentZ";
  const voltage = num(v.input, "voltage");
  const breakingCurrent = num(v.input, "breakingCurrent");
  const threshold = num(v.input, "threshold");

  const notes: string[] = [];
  let shortCircuitMva: number;
  if (mode === "transformer") {
    // 変圧器容量[kVA] → MVA に直してから %Z で割る。
    const capacityMva = num(v.input, "transformerCapacity") / 1000;
    shortCircuitMva = (capacityMva * 100) / num(v.input, "transformerPercentZ");
    notes.push(
      "電源側インピーダンスを無視した変圧器単独の値です（実際の短絡電流はこれより小さくなります）。上位系統の%Z が分かる場合は合成%Z 方式を使ってください。",
    );
  } else {
    shortCircuitMva = (num(v.input, "baseCapacity") * 100) / num(v.input, "percentZ");
  }

  // Ps[MVA], V[kV] → Is[kA]。単位が揃っているため係数は不要。
  const shortCircuitKa = shortCircuitMva / (Math.sqrt(3) * voltage);
  const usagePercent = (shortCircuitKa / breakingCurrent) * 100;

  notes.push(
    "三相短絡（最も電流が大きい故障）の値です。地絡・短絡の種類によって電流は変わります。",
    "非対称分（直流分）を含む初期のピーク電流はこの値より大きくなります。遮断器の投入電流・機器の電磁力はピーク値で確認してください。",
  );
  if (shortCircuitKa > breakingCurrent) {
    notes.unshift(
      "短絡電流が遮断器の定格遮断電流を超えています。事故時に遮断器が破壊されるおそれがあり、この構成では使用できません。",
    );
  }

  return {
    ok: true,
    items: [
      { label: "短絡容量 Ps", value: shortCircuitMva, unit: "MVA" },
      { label: "三相短絡電流 Is", value: shortCircuitKa, unit: "kA" },
      { label: "定格遮断電流までの余裕", value: breakingCurrent - shortCircuitKa, unit: "kA" },
      { label: "定格遮断電流に対する比", value: usagePercent, unit: "%" },
    ],
    usagePercent,
    verdict: judgeUsage(usagePercent, threshold),
    notes,
  };
}

export const SHORT_CIRCUIT_EXPLANATION: ExplanationDoc = {
  conclusion: [
    "短絡電流は「基準容量を合成%Z で割る」だけで出る。%インピーダンス法が強いのは、変圧比の違う回路をまたいでも同じ基準容量に換算すれば足し算できる点にある。",
    "遮断器は「切れる電流の上限」で選ぶ。短絡電流が定格遮断電流を超えていると、事故時に遮断器自体が壊れて波及事故になる。",
  ],
  formula: [
    "短絡容量 Ps [MVA] = Pn × 100 / %Z",
    "三相短絡電流 Is [kA] = Ps / (√3 · V[kV])",
    "変圧器単独: Ps = P_tr × 100 / %Z_tr",
    "%Z の基準容量換算: %Z_new = %Z_old × (Pn_new / Pn_old)",
  ],
  terms: [
    "%Z: 定格電流を流したときの電圧降下が定格電圧の何%か。基準容量とセットでないと意味を持たない。",
    "Pn: 基準容量。系統内の%Z をすべてこの容量に換算してから足し合わせる。10MVA を取ることが多い。",
    "Ps: 短絡容量 = 故障点に供給されうる皮相電力。%Z が小さい（＝系統が強い）ほど大きい。",
    "定格遮断電流: 遮断器が安全に遮断できる交流分の実効値。銘板の kA 値。",
    "√3: 三相の線間電圧と相電流の関係から出る。単相回路では現れない。",
  ],
  pitfalls: [
    "%Z を基準容量換算せずに足す。異なる容量の機器の%Z をそのまま加算すると答えが数倍ずれる。",
    "変圧器の%Z だけで計算して電源側を無視すると、短絡電流を過大に見積もる（安全側ではあるが遮断器が過剰になる）。逆に電源側だけを見ると過小評価になる。",
    "遮断器の「定格遮断電流」と「定格短時間耐電流」「定格投入電流」を混同する。選定にはそれぞれ別の確認が要る。",
    "低圧 MCCB の遮断容量はカタログ上「AC240V で○kA / AC480V で△kA」のように電圧で変わる。使用電圧の欄を見る。",
    "モータが多い系統では、事故直後にモータが発電機として短絡電流を供給する（寄与分）。大容量モータがある場合は加算を検討する。",
  ],
  primarySources: [
    "電力会社から提示される受電点の短絡容量（または%Z）。設計の出発点になる。",
    "変圧器銘板の%インピーダンスと定格容量。",
    "遮断器メーカーのカタログ（定格遮断電流・使用電圧別の遮断容量・遮断時間）。",
    "JEAC/JEAG 等の系統計算の解説書 — 手法の詳細は原典を確認する。",
  ],
};

export const shortCircuitModule: ToolkitModule = {
  id: "short-circuit",
  title: "短絡電流・遮断容量チェック",
  shortTitle: "短絡電流",
  description: "%インピーダンス法で三相短絡電流を求め、遮断器の定格遮断電流に対する余裕を判定",
  tier: "paid",
  fields: SHORT_CIRCUIT_FIELDS,
  compute: computeShortCircuit,
  explanation: SHORT_CIRCUIT_EXPLANATION,
};
