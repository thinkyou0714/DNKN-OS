/**
 * views/drills.ts — 追加ドリルUI（公式導出ドリル / 電卓速算ドリル）。
 *
 * いずれも学習タブ内のサブモードとして描画する（#q ホストを使い回す）。
 * 純ロジックは derivation.ts / calc-drill.ts。ここは薄いDOMグルーに徹する。
 *
 * 速算ドリルの所要時間・正誤は FSRS（topic 単位）の記憶状態を汚さないため、
 * progress.record を呼ばない（速算は topic に紐づかない汎用スキル）。
 */

import { hashSeed } from "../../../lib/shared/rng.js";
import { buildCalcDrill, type CalcDrillProblem, gradeCalcDrill, summarizeCalcDrill } from "../calc-drill.js";
import { buildDerivationDrill, type DerivationDrill, isDerivationCorrect } from "../derivation.js";
import { formatMath } from "../mathfmt.js";
import { problems } from "../state/app.js";
import { practice } from "../state/practice.js";
import { h, safeHtml } from "../ui/dom.js";
import { emptyState } from "../ui/widgets.js";
import { startCoeffDrillSession } from "./coeff-drill.js";

/** 速算ドリルの既定問題数。 */
const CALC_DRILL_COUNT = 10;

/**
 * 公式導出ドリルを #q ホストに描画する（現在の practice.current を題材にする）。
 * solution が3手未満なら成立しないので案内を出す。
 */
export function renderDerivationDrill(host: HTMLElement): void {
  host.innerHTML = "";
  const p = practice.current;
  if (!p) {
    host.append(emptyState("🔍", "題材の問題がありません", "先に学習で問題を表示してからお試しください。"));
    return;
  }
  // seed は問題IDから決定論的に作る（同じ問題なら毎回同じ提示順）。
  const drill = buildDerivationDrill(p.solution, hashSeed(p.id));
  if (!drill) {
    host.append(
      emptyState("🧩", "この問題は手順が短く並べ替えできません", "解答ステップが3つ以上ある問題でお試しください。"),
    );
    return;
  }

  host.append(h("div", { id: "meta" }, `公式導出ドリル ・ ${p.subject}・${p.topic}`));
  const body = h("div", {});
  host.append(body);
  renderOrderingDrillBody(body, drill);
}

/**
 * 並べ替えドリルの本体（リスト・確認ボタン・結果表示）を host へ描画する共通部。
 * 題材は問題の solution でも原理カードの導出（lib/curriculum/principles.ts）でもよい。
 * 見出しは呼び出し側が描く（practice は #meta、ダッシュボードは原理カード内見出し。
 * id を持たないので同一画面に複数配置できる）。
 */
export function renderOrderingDrillBody(host: HTMLElement, drill: DerivationDrill): void {
  host.innerHTML = "";
  host.append(h("p", { class: "muted small" }, "手順を正しい順に並べ替えましょう。↑↓ボタンで入れ替えできます。"));

  // 現在の並び（drill.shuffledOrder のコピー）。各要素は元 step の index。
  const order = [...drill.shuffledOrder];
  const listEl = h("ol", { class: "derivation-drill" });

  const render = (): void => {
    listEl.innerHTML = "";
    order.forEach((stepIdx, pos) => {
      const li = h(
        "li",
        { class: "deriv-step" },
        h("span", { class: "deriv-text", html: safeHtml(formatMath(drill.steps[stepIdx] ?? "")) }),
        h(
          "span",
          { class: "deriv-moves" },
          h(
            "button",
            {
              class: "chip",
              type: "button",
              "aria-label": "上へ移動",
              disabled: pos === 0,
              onclick: () => {
                if (pos === 0) return;
                const a = order[pos - 1] as number;
                order[pos - 1] = order[pos] as number;
                order[pos] = a;
                render();
              },
            },
            "↑",
          ),
          h(
            "button",
            {
              class: "chip",
              type: "button",
              "aria-label": "下へ移動",
              disabled: pos === order.length - 1,
              onclick: () => {
                if (pos === order.length - 1) return;
                const a = order[pos + 1] as number;
                order[pos + 1] = order[pos] as number;
                order[pos] = a;
                render();
              },
            },
            "↓",
          ),
        ),
      );
      listEl.append(li);
    });
  };
  render();

  const result = h("div", { class: "deriv-result" });
  const submit = h(
    "button",
    {
      class: "primary",
      type: "button",
      onclick: () => {
        const ok = isDerivationCorrect(order, drill.correctOrder);
        result.innerHTML = "";
        // 正解順を必ず提示する（学びの回収）。
        const correctList = h("ol", { class: "derivation-answer" });
        for (const idx of drill.correctOrder) {
          correctList.append(h("li", { html: safeHtml(formatMath(drill.steps[idx] ?? "")) }));
        }
        result.append(
          h(
            "div",
            { class: `card ${ok ? "deriv-ok" : "deriv-ng"}` },
            h("strong", {}, ok ? "⭕ 正解！手順が完璧です" : "❌ 順番が違います。正しい手順はこちら:"),
          ),
          correctList,
        );
        result.scrollIntoView({ behavior: "smooth", block: "nearest" });
      },
    },
    "✅ 並び順を確認",
  );

  host.append(listEl, submit, result);
}

/**
 * 電卓速算ドリル（時間計測つき）を #q ホストに描画する。
 * 1問ずつ提示し、各問の所要時間を測って最後に集計を出す。
 */
export function renderCalcDrill(host: HTMLElement): void {
  host.innerHTML = "";
  // seed は日替わり固定（同じ日は同じセット＝再挑戦で比較しやすい）。
  const daySeed = Math.floor(Date.now() / 86_400_000);
  const set = buildCalcDrill(CALC_DRILL_COUNT, daySeed);
  let idx = 0;
  const corrects: boolean[] = [];
  const times: number[] = [];
  let shownAt = Date.now();

  const headEl = h("div", { id: "meta" }, "電卓速算ドリル（時間計測）");
  const promptEl = h("div", { class: "calc-prompt" });
  const inputEl = h("input", {
    class: "num",
    inputmode: "decimal",
    placeholder: "概算でOK",
    "aria-label": "速算の答え",
  }) as HTMLInputElement;
  const hintEl = h("div", { class: "muted small calc-hint" });
  const fbEl = h("div", { id: "calc-fb" });
  host.append(
    headEl,
    h("p", { class: "muted small" }, "頻出の概算（√3・√2・π・%・単位換算）を素早く。誤差は緩めに採点します。"),
    promptEl,
    inputEl,
    fbEl,
  );

  const showProblem = (): void => {
    const p = set[idx] as CalcDrillProblem;
    headEl.textContent = `電卓速算ドリル ・ 第 ${idx + 1} / ${set.length} 問`;
    promptEl.textContent = p.prompt;
    inputEl.value = "";
    fbEl.innerHTML = "";
    shownAt = Date.now();
    inputEl.focus();
  };

  const finish = (): void => {
    const summary = summarizeCalcDrill(set, corrects, times);
    host.innerHTML = "";
    host.append(
      h("div", { id: "meta" }, "電卓速算ドリル 結果"),
      h(
        "div",
        { class: "big", style: `color:${summary.accuracyPct >= 80 ? "var(--ok)" : "var(--accent)"}` },
        `${summary.accuracyPct}点`,
      ),
      h("p", { class: "muted" }, `${summary.correct} / ${summary.total} 問正解 ・ 時間内正解 ${summary.onTime} 問`),
      h(
        "button",
        { class: "primary", type: "button", onclick: () => renderCalcDrill(host) },
        "▶ もう一度（同じ問題で記録更新を狙う）",
      ),
    );
  };

  const grade = (): void => {
    const p = set[idx] as CalcDrillProblem;
    const elapsed = Date.now() - shownAt;
    const ok = gradeCalcDrill(p, inputEl.value);
    corrects.push(ok);
    times.push(elapsed);
    const inTime = elapsed <= p.targetMs;
    fbEl.innerHTML = "";
    fbEl.append(
      h(
        "div",
        { class: `calc-fbline ${ok ? "ok" : "ng"}` },
        ok
          ? `⭕ 正解（${(elapsed / 1000).toFixed(1)}秒${inTime ? "・目標内" : "・少し時間超過"}）`
          : `❌ 正解は ${roundNice(p.answer)}`,
      ),
      p.hint ? h("div", { class: "muted small" }, `💡 ${p.hint}`) : "",
      h(
        "button",
        {
          class: "primary",
          type: "button",
          onclick: () => {
            idx += 1;
            if (idx >= set.length) finish();
            else showProblem();
          },
        },
        idx + 1 >= set.length ? "結果を見る →" : "次の問題 →",
      ),
    );
  };

  inputEl.addEventListener("keydown", (e) => {
    if ((e as KeyboardEvent).key === "Enter" && inputEl.value.trim() !== "") grade();
  });
  host.append(hintEl);
  showProblem();
}

/** 表示用に正解値をほどよく丸める（整数なら整数、そうでなければ小数2桁）。 */
function roundNice(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

/** 学習タブに「公式導出ドリル」「電卓速算ドリル」の起動チップを並べたカードを返す。 */
export function drillLauncherCard(host: HTMLElement): HTMLElement {
  const card = h(
    "div",
    { class: "card drill-launcher" },
    h("strong", {}, "🧠 スキルドリル"),
    h("div", { class: "muted small" }, "手順の理解・計算スピード・係数の使い分けを鍛える追加ドリル。"),
  );
  const row = h("div", { class: "drill-actions" });
  row.append(
    h(
      "button",
      {
        class: "chip",
        type: "button",
        disabled: !practice.current,
        title: practice.current ? "" : "先に問題を表示してください",
        onclick: () => renderDerivationDrill(host),
      },
      "🧩 公式導出ドリル",
    ),
    h(
      "button",
      {
        class: "chip",
        type: "button",
        disabled: problems.length === 0,
        onclick: () => renderCalcDrill(host),
      },
      "⚡ 電卓速算ドリル",
    ),
    h(
      "button",
      {
        class: "chip",
        type: "button",
        onclick: () => startCoeffDrillSession(host),
      },
      "⚖️ 係数判断ドリル",
    ),
  );
  card.append(row);
  return card;
}
