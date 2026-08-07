/**
 * auto-distractors.ts — 数値解答テンプレートを本試同様の五肢択一へ自動変換する。
 *
 * ## なぜ必要か
 * 電験の一次試験（理論・電力・機械・法規）は**全問マークシートの五肢択一**だが、
 * 生成器の数値テンプレートは 114 本中 88 本が `format: "numeric"`（自由入力）のまま。
 * 五択で「近い値から選ぶ」体験と、自由入力で「答えを出す」体験は難易度も戦略も別物で、
 * 本番の練習にならない。
 *
 * テンプレート 88 本を個別に書き換えるのは規模が大きく回帰リスクも高いため、
 * **生成パイプラインの一段として**誤答を自動生成する。テンプレート側は無改修。
 *
 * ## 誤答の作り方
 * 「電験受験者が実際にやるミス」の類型から作る。無意味な乱数ではないので、
 * 選択肢を見て正解を逆算しにくく、間違えたときに原因が言語化できる。
 *
 * 個別テンプレートが `distractors` を自前で持っている場合はそちらを優先し、
 * ここは何もしない（手書きの誤答のほうが分野固有で質が高い）。
 */
import { formatClean, isCleanAnswer } from "./clean.js";

/** 自動生成する誤答の候補（倍率と、その倍率が生じる典型ミス）。 */
interface Candidate {
  value: number;
  reason: string;
}

/**
 * 値と単位から、ありがちな誤答の候補を作る。
 * 係数・単位換算・逆数・平方根まわりは分野を問わず起きるミスなので横断的に使える。
 */
function candidatesFor(answer: number, unit: string): Candidate[] {
  const out: Candidate[] = [];
  const push = (value: number, reason: string): void => {
    if (Number.isFinite(value) && value > 0 && Math.abs(value - answer) > 1e-9) out.push({ value, reason });
  };

  // 誤答は「同じ倍率の等比数列」にしない。等間隔に並ぶと真ん中が正解だと推測できてしまい、
  // 計算せずに当てられる五択になる。倍率の種類を混ぜ、順序も分野に応じて変える。
  const SQRT3 = Math.sqrt(3);
  const hasElectricUnit = /V|A|W|VA|var|Ω/.test(unit);

  // √3 まわり（三相回路で最頻・電験で最も多い取り違え）。単位が電気量のときは最優先。
  if (hasElectricUnit) {
    push(answer * SQRT3, "√3 を余分に掛けた（単相と三相の取り違え）");
    push(answer / SQRT3, "√3 で割ってしまった（三相の換算ミス）");
  }

  // 係数2・1/2（エネルギーの ½、全波/半波、極数など）。
  push(answer * 2, "係数 2 を余分に掛けた（½ を落とした）");
  push(answer / 2, "係数 ½ を余分に掛けた（2 倍を落とした）");

  // 3倍（三相電力の 3 と √3 の混同）。
  if (hasElectricUnit) push(answer * 3, "√3 の代わりに 3 を掛けた（三相電力の係数の混同）");

  // 平方根（インピーダンスの二乗和・実効値）。1以下だと逆に大きくなり不自然なので除く。
  if (answer > 1) push(Math.sqrt(answer), "平方根を余分に取った（2乗を忘れた）");

  // 桁ミスは最後（他の候補で埋まらないときの補充）。等比に見えるのを避けるため優先度を下げる。
  push(answer * 10, "桁を1つ大きく取り違えた（単位換算のミス）");
  push(answer / 10, "桁を1つ小さく取り違えた（単位換算のミス）");

  return out;
}

/** 表示が一意で綺麗な5択に整える。作れなければ null（＝numeric のまま出す）。 */
export interface AutoMcResult {
  choices: string[];
  distractors: { text: string; reason: string }[];
  answerText: string;
  likelyWrongChoice: string;
}

/**
 * 数値の正解から五肢択一を組む。
 *
 * 安全ゲート:
 *  1. 表示が相互に一意（重複した選択肢は成立しない）
 *  2. 正解が選択肢に含まれる
 *  3. 負・ゼロの選択肢を作らない（見ただけで捨てられる＝五択にならない）
 *  4. 正解と桁が離れすぎた候補は使わない（選択肢の桁が揃っている本試の見た目に寄せる）
 */
export function buildAutoMc(answer: number, answerText: string, unit: string): AutoMcResult | null {
  if (!Number.isFinite(answer) || answer <= 0) return null;
  if (!Number.isFinite(Number(answerText))) return null;

  const seen = new Set<string>([answerText]);
  const picked: { text: string; reason: string }[] = [];
  for (const c of candidatesFor(answer, unit)) {
    if (picked.length >= 4) break;
    // 正解の 1/100 〜 100 倍に収める（極端な外れ値は選択肢として不自然）。
    const ratio = c.value / answer;
    if (ratio < 0.01 || ratio > 100) continue;
    const text = formatClean(c.value);
    if (seen.has(text)) continue;
    if (!Number.isFinite(Number(text)) || Number(text) <= 0) continue;
    seen.add(text);
    picked.push({ text, reason: c.reason });
  }
  if (picked.length < 4) return null;

  const choices = [...seen].sort((a, b) => Number(a) - Number(b));
  if (choices.length !== 5) return null;
  return {
    choices,
    distractors: picked,
    answerText,
    likelyWrongChoice: picked[0]?.text ?? answerText,
  };
}

/** 割り切れる答えだけを五択化する（本試の選択肢は手計算で追える値になっている）。 */
export function shouldAutoConvert(answer: number, answerText: string): boolean {
  return Number.isFinite(answer) && answer > 0 && isCleanAnswer(Number(answerText));
}
