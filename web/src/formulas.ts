/**
 * formulas.ts — 公式集（科目別の重要公式リファレンス・純データ）。
 * 「いつでも引ける公式集」を端末内に持たせ、出題テンプレートと対応づける。
 * 暗記だけに頼らず、導出の足がかりとして使う（電験二種は導出も問われる）。
 */
import type { Subject } from "../../lib/engine/schema.js";

export interface FormulaItem {
  name: string;
  formula: string; // mathfmt で整形して表示（_ 下付き / ^ 上付き）
  note?: string;
}

export interface FormulaGroup {
  subject: Subject;
  items: FormulaItem[];
}

export const FORMULAS: FormulaGroup[] = [
  {
    subject: "理論",
    items: [
      { name: "三相電力", formula: "P = √3·V_l·I_l·cosθ = 3·I^2·R", note: "Y結線: V_p=V_l/√3" },
      { name: "合成抵抗(並列)", formula: "1/R = 1/R_1 + 1/R_2", note: "直列は和" },
      { name: "コンデンサ静電エネルギー", formula: "W = (1/2)·C·V^2", note: "" },
      { name: "最大電力伝送", formula: "P_max = E^2/(4R)", note: "負荷=内部抵抗で整合" },
      { name: "RC時定数", formula: "τ = R·C", note: "t=τ で63.2%" },
      { name: "RLC直列インピーダンス", formula: "Z = √(R^2 + (ωL − 1/(ωC))^2)", note: "ω=2πf" },
      { name: "直列共振周波数", formula: "f_0 = 1/(2π·√(L·C))", note: "ωL=1/(ωC) で虚部0" },
      { name: "ブリッジ平衡", formula: "R_1·R_x = R_2·R_3", note: "対辺の積が等しい" },
      { name: "オームの法則/合成", formula: "V = I·R, P = V·I = I^2·R", note: "" },
    ],
  },
  {
    subject: "電力",
    items: [
      { name: "需要率", formula: "需要率 = 最大需要電力/設備容量 ×100", note: "%" },
      { name: "力率改善容量", formula: "Q_c = P·(tanθ_1 − tanθ_2)", note: "kvar" },
      { name: "％Zと短絡電流", formula: "I_s = I_n·100/%Z", note: "" },
      { name: "短絡容量", formula: "P_s = P_base·100/%Z", note: "MVA" },
      { name: "三相送電損失", formula: "P_loss = 3·I^2·R", note: "" },
      { name: "単相2線電圧降下", formula: "v = 2·I·(R·cosθ + X·sinθ)", note: "三相は√3係数" },
    ],
  },
  {
    subject: "機械",
    items: [
      { name: "同期速度", formula: "N_s = 120·f/p", note: "min^-1" },
      { name: "すべり/回転速度", formula: "N = N_s·(1 − s)", note: "" },
      { name: "変圧器効率", formula: "η = P_out/(P_out + P_i + P_c) ×100", note: "" },
      { name: "直流機 逆起電力", formula: "E = V − I_a·R_a", note: "" },
      { name: "短絡比", formula: "K_s = 100/%Z_s", note: "" },
      { name: "誘導機 電力分配", formula: "P_2 : P_c2 : P_m = 1 : s : (1−s)", note: "" },
      { name: "変圧器 巻数比", formula: "a = N_1/N_2 = V_1/V_2 = I_2/I_1", note: "" },
    ],
  },
  {
    subject: "法規",
    items: [
      { name: "B種接地抵抗", formula: "R = 150/I_g", note: "Ω（係数は条件で変動）" },
      { name: "電線のたるみ", formula: "D = w·S^2/(8·T)", note: "" },
      { name: "絶縁耐力試験電圧", formula: "試験 = 最大使用電圧×1.5", note: "最大使用=公称×1.15/1.1" },
      { name: "電線実長", formula: "L ≈ S + 8·D^2/(3·S)", note: "たるみによる増分" },
    ],
  },
  {
    subject: "電力管理",
    items: [
      { name: "調相設備容量", formula: "Q_c = P·(tanθ_1 − tanθ_2)", note: "kvar" },
      { name: "三相短絡容量", formula: "P_s = P_base·100/%Z", note: "MVA" },
      { name: "水力発電出力", formula: "P = 9.8·Q·H·η", note: "kW" },
      { name: "汽力発電熱効率", formula: "η = 3600/q ×100", note: "q=熱消費率 kJ/kWh" },
      { name: "送電電力(安定度)", formula: "P = V_s·V_r/X·sinδ", note: "δ=相差角" },
    ],
  },
  {
    subject: "機械制御",
    items: [
      { name: "変圧器電圧変動率", formula: "ε ≈ p·cosθ + q·sinθ", note: "%" },
      { name: "同期発電機出力", formula: "P = 3·V·E·sinδ/X_s", note: "δ=90°で最大" },
      { name: "降圧チョッパ", formula: "V_o = D·V_i", note: "昇圧は V_i/(1−D)" },
      { name: "一次遅れ系 定常値", formula: "y(∞) = K·A", note: "G=K/(1+Ts)" },
      { name: "誘導機 比例推移", formula: "r_2/s_1 = (r_2+R)/s_2", note: "" },
    ],
  },
];

/** 検索向け正規化（NFKC・小文字化・空白除去）。公式56件を目視スキャンさせない。 */
function norm(s: string): string {
  return s.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
}

/**
 * 公式集をクエリで絞り込む。名前・式・補足のいずれかに部分一致した項目だけを残し、
 * 空になったグループは落とす。空クエリは全件を返す。
 */
export function filterFormulas(groups: FormulaGroup[], query: string): FormulaGroup[] {
  const q = norm(query);
  if (q.length === 0) return groups;
  return groups
    .map((g) => ({
      subject: g.subject,
      items: g.items.filter((i) => norm(`${i.name}${i.formula}${i.note ?? ""}`).includes(q)),
    }))
    .filter((g) => g.items.length > 0);
}
