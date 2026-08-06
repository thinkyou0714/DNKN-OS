/**
 * views/coeff-drill.ts — 係数判断ドリル（係数リーズニング）の描画。
 *
 * 「この状況で √3 は要るのか・要らないのか」を選択式で判断させ、正誤を即座に
 * FSRS へ写して間隔反復に載せる。納得チェック（why-review.ts）が「自分の言葉で
 * 説明できるか」を回すのに対し、こちらは「係数の使い分けを判断できるか」を回す。
 * 純ロジックは lib/curriculum/coefficients.ts、永続化は web/src/coeff-store.ts。
 * ここは薄い DOM グルー。
 *
 * 出題キューは「開始する瞬間」に毎回作り直す（why-review.ts と同じ理由:
 * 古いキューの使い回しで採点済みの問題を再採点させない）。
 */
import {
  COEFF_DRILL_SESSION_SIZE,
  type CoefficientDrillItem,
  coefficientDrillStats,
  coefficientDrillsForFamily,
  coefficientFamilyProgress,
  dueCoefficientDrills,
  getCoefficientFamily,
  gradeCoefficientDrill,
  ratingForCoefficientAnswer,
  weakestCoefficientFamily,
} from "../../../lib/curriculum/coefficients.js";
import { coeffDrills } from "../state/app.js";
import { h } from "../ui/dom.js";

/** 出題できるものが無いときのカード。 */
function allDoneCard(scopeLabel: string): HTMLElement {
  const stats = coefficientDrillStats(coeffDrills.states());
  return h(
    "div",
    { class: "card" },
    h("strong", {}, `✅ ${scopeLabel}の係数判断ドリルは完了`),
    h(
      "div",
      { class: "muted" },
      `${stats.started} / ${stats.total} 問に取り組み済み。期限が来たものからまた出題します。`,
    ),
  );
}

/**
 * 係数判断ドリルのセッションを host に開始する（出題キューはここで作り直す）。
 *
 * @param host 描画先。中身は毎回置き換えられる。
 * @param pool 出題母集団。省略時は全ドリル。特定ファミリだけ確かめたいときは
 *   `coefficientDrillsForFamily(familyId)` を渡す（ダッシュボードの苦手係数導線がこれを使う）。
 * @param scopeLabel 完了時の文言に使う範囲名（既定は「今日」）。
 */
export function startCoeffDrillSession(
  host: HTMLElement,
  pool?: readonly CoefficientDrillItem[],
  scopeLabel = "今日",
): void {
  const queue = dueCoefficientDrills(coeffDrills.states(), Date.now(), COEFF_DRILL_SESSION_SIZE, pool);
  host.innerHTML = "";
  if (queue.length === 0) {
    host.append(allDoneCard(scopeLabel));
    return;
  }
  renderCoeffDrillSession(host, queue, () => startCoeffDrillSession(host, pool, scopeLabel));
}

/**
 * 復習タブの「係数の使い分けドリル」セクション。
 * 期限到来・未着手の件数を示し、セッションを開始できる。
 */
export function coeffDrillSection(root: HTMLElement): void {
  const nowMs = Date.now();
  const states = coeffDrills.states();
  const stats = coefficientDrillStats(states, nowMs);
  const queue = dueCoefficientDrills(states, nowMs, COEFF_DRILL_SESSION_SIZE);

  root.append(h("h2", {}, "係数の使い分けドリル"));
  if (queue.length === 0) {
    root.append(allDoneCard("今日"));
    return;
  }
  const host = h("div", {});
  const intro = h(
    "div",
    { class: "card" },
    h("strong", {}, "⚖️ この状況で √3 は要る？要らない？"),
    h(
      "div",
      { class: "muted" },
      "√3・1/2・√2・2 を「おまじない」で掛けていると、二種の記述・単位法・対称座標法で崩れます。" +
        "同じ量でも状況で係数が変わる対比を、判断問題で問い直します。",
    ),
    h(
      "div",
      { class: "muted small" },
      `復習の期限が来た ${stats.due} 問 ・ 未着手 ${stats.fresh} 問（全 ${stats.total} 問中 ${stats.started} 問に着手済み）`,
    ),
    h(
      "div",
      { class: "drill-actions" },
      h(
        "button",
        {
          class: "primary",
          type: "button",
          onclick: () => {
            // 件数表示ごとイントロを畳む（古い件数の再クリックで二重採点しないため）。
            intro.remove();
            startCoeffDrillSession(host);
          },
        },
        `▶ 係数判断ドリルを始める（${queue.length}問）`,
      ),
    ),
  );
  root.append(intro, host);
}

/**
 * 係数判断ドリルのセッションを1問ずつ描画する（選択→即採点→解説→次へ）。
 * 採点結果は即座に保存されるため、途中でタブを離れてもそこまでの分は残る。
 *
 * @param onContinue 全問終えたあとに「続けて挑戦する」で呼ばれる継続処理。
 */
export function renderCoeffDrillSession(
  host: HTMLElement,
  queue: readonly CoefficientDrillItem[],
  onContinue?: () => void,
): void {
  if (queue.length === 0) return;
  let index = 0;
  const results: boolean[] = [];

  const showFeedback = (item: CoefficientDrillItem, chosenIndex: number, body: HTMLElement): void => {
    const ok = gradeCoefficientDrill(item, chosenIndex);
    coeffDrills.record(item.id, ratingForCoefficientAnswer(ok));
    results.push(ok);
    const family = getCoefficientFamily(item.familyId);
    body.innerHTML = "";
    body.append(
      h(
        "div",
        { class: `card ${ok ? "deriv-ok" : "deriv-ng"}` },
        h("strong", {}, ok ? "⭕ 正解！" : `❌ 正解は「${item.options[item.correctIndex] ?? ""}」`),
      ),
      h("p", {}, `💡 ${item.why}`),
      h("p", { class: "muted" }, `🔁 対比: ${item.contrast}`),
      family ? h("div", { class: "muted small" }, `📐 ${family.name} の由来: ${family.origin}`) : "",
      h(
        "div",
        { class: "drill-actions" },
        h(
          "button",
          {
            class: "primary",
            type: "button",
            onclick: () => {
              index += 1;
              render();
            },
          },
          index + 1 >= queue.length ? "結果を見る →" : "次の問題 →",
        ),
      ),
    );
  };

  const render = (): void => {
    host.innerHTML = "";
    if (index >= queue.length) {
      const correct = results.filter(Boolean).length;
      const summary = h(
        "div",
        { class: "card" },
        h("strong", {}, "🎉 係数判断ドリル終了"),
        h("div", { class: "muted" }, `${queue.length} 問中 ${correct} 問正解。`),
        h(
          "div",
          { class: "muted small" },
          "間違えた係数はすぐにまた出ます。「由来」で覚え直すと、二種の初見問題でも自分で式を組み立てられます。",
        ),
      );
      if (onContinue) {
        summary.append(
          h(
            "div",
            { class: "drill-actions" },
            h("button", { class: "chip", type: "button", onclick: onContinue }, "▶ 続けて挑戦する"),
          ),
        );
      }
      host.append(summary);
      return;
    }
    const item = queue[index] as CoefficientDrillItem; // index < queue.length のため在中
    const family = getCoefficientFamily(item.familyId);
    const body = h("div", {});
    body.append(
      h(
        "div",
        { class: "drill-actions" },
        ...item.options.map((opt, i) =>
          h(
            "button",
            {
              class: "chip",
              type: "button",
              onclick: () => showFeedback(item, i, body),
            },
            opt,
          ),
        ),
      ),
    );
    host.append(
      h(
        "div",
        { class: "card" },
        h("div", { class: "muted small" }, `${index + 1} / ${queue.length} ・ ${family?.name ?? item.familyId}`),
        h("strong", {}, `Q. ${item.scenario}`),
        h("div", { class: "muted small" }, "「なぜその係数か」まで言えるかを意識して選んでください。"),
        body,
      ),
    );
  };

  render();
  host.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

/**
 * ダッシュボードの「三種→二種ブリッジ」セクション。
 * 係数ファミリごとの取り組み状況を一覧し、いちばん混ざっている係数（lapses 最多）を
 * ファミリ単位で確かめ直せる導線を出す。推定なので断定はしない。
 */
export function coeffBridgeSection(root: HTMLElement): void {
  const nowMs = Date.now();
  const states = coeffDrills.states();
  const progress = coefficientFamilyProgress(states, nowMs);
  if (progress.length === 0) return;
  const host = h("div", {});

  const card = h(
    "div",
    { class: "card" },
    h("strong", {}, "⚡ 三種→二種ブリッジ: 係数の使い分け"),
    h(
      "div",
      { class: "muted" },
      "二種は記述で導出を書かせ、単位法では √3 が消えます。係数を由来から使い分けられるかが" +
        "三種との最大の断層です。ファミリごとの取り組み状況:",
    ),
  );
  const chips = h("div", { class: "concept-chips" });
  for (const p of progress) {
    const done = p.total > 0 && p.started >= p.total && p.due === 0;
    const label = `${done ? "🎓" : p.started > 0 ? "▶" : "・"} ${p.family.name}（${p.started}/${p.total}${p.due > 0 ? `・期限${p.due}` : ""}）`;
    // ロードマップと同じチップ見た目（roadmapChipModel の class 体系）に合わせる。
    chips.append(h("span", { class: done ? "concept-chip" : "concept-chip next", title: p.family.origin }, label));
  }
  card.append(chips);

  const weakest = weakestCoefficientFamily(progress);
  if (weakest) {
    card.append(
      h(
        "div",
        { class: "muted small" },
        `🔍 「${weakest.family.name}」で忘却が ${weakest.lapses} 回。混ざりやすい係数かもしれません。`,
      ),
    );
  }
  const actions = h(
    "div",
    { class: "drill-actions" },
    h(
      "button",
      { class: "chip", type: "button", onclick: () => startCoeffDrillSession(host) },
      "⚖️ 係数判断ドリルをする",
    ),
  );
  if (weakest) {
    actions.append(
      h(
        "button",
        {
          class: "chip",
          type: "button",
          onclick: () =>
            startCoeffDrillSession(host, coefficientDrillsForFamily(weakest.family.id), weakest.family.name),
        },
        `🔁 「${weakest.family.name}」を確かめ直す`,
      ),
    );
  }
  card.append(actions);
  root.append(card, host);
}
