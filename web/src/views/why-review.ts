/**
 * views/why-review.ts — 原理の納得チェック（間隔反復）の描画。
 *
 * 復習タブに「なぜそうなるのか」を思い出すセッションを置く。演習の復習キューが
 * 「解けるか」を回すのに対し、こちらは「自分の言葉で説明できるか」を回す。
 *
 * フロー: 質問を見る → 自分の言葉で答える（頭の中で）→ 答え合わせ → 4段階の自己採点。
 * 自己採点は FSRS の Rating にそのまま対応し、次回出題日が決まる。
 * 純ロジックは lib/curriculum/why-check.ts、永続化は web/src/why-store.ts。ここは薄い DOM グルー。
 */
import { getPrincipleCard } from "../../../lib/curriculum/principles.js";
import {
  dueWhyChecks,
  WHY_CHECK_SESSION_SIZE,
  type WhyCheckItem,
  whyCheckStats,
} from "../../../lib/curriculum/why-check.js";
import type { Rating } from "../../../lib/scheduler/index.js";
import { whyChecks } from "../state/app.js";
import { h } from "../ui/dom.js";

/** 自己採点の選択肢（FSRS の Rating に対応）。左から厳しい順に並べる。 */
const RATINGS: ReadonlyArray<{ rating: Rating; label: string; hint: string }> = [
  { rating: "again", label: "😵 言えなかった", hint: "すぐにもう一度出します" },
  { rating: "hard", label: "🤔 あいまい", hint: "短い間隔で出します" },
  { rating: "good", label: "🙂 言えた", hint: "標準の間隔で出します" },
  { rating: "easy", label: "😎 スラスラ言えた", hint: "長い間隔で出します" },
];

/**
 * 復習タブの「原理の納得チェック」セクション。
 * 期限到来・未着手の件数を示し、セッションを開始できる。
 */
export function whyCheckSection(root: HTMLElement): void {
  const nowMs = Date.now();
  const states = whyChecks.states();
  const stats = whyCheckStats(states, nowMs);
  const queue = dueWhyChecks(states, nowMs, WHY_CHECK_SESSION_SIZE);

  root.append(h("h2", {}, "原理の納得チェック"));
  const host = h("div", {});
  if (queue.length === 0) {
    root.append(
      h(
        "div",
        { class: "card" },
        h("strong", {}, "✅ 今日の納得チェックは完了"),
        h(
          "div",
          { class: "muted" },
          `${stats.started} / ${stats.total} 件に取り組み済み。期限が来たものからまた出題します。`,
        ),
      ),
    );
    return;
  }
  root.append(
    h(
      "div",
      { class: "card" },
      h("strong", {}, "🧠 「なぜそうなるのか」を思い出す"),
      h(
        "div",
        { class: "muted" },
        "公式を当てはめられるだけでは試験本番の応用が効きません。" +
          "自分の言葉で説明できるかを、忘れかけた頃に問い直します。",
      ),
      h(
        "div",
        { class: "muted small" },
        `復習の期限が来た ${stats.due} 件 ・ 未着手 ${stats.fresh} 件（全 ${stats.total} 件中 ${stats.started} 件に着手済み）`,
      ),
      h(
        "div",
        { class: "drill-actions" },
        h(
          "button",
          { class: "primary", type: "button", onclick: () => renderWhyCheckSession(host, queue) },
          `▶ 納得チェックを始める（${queue.length}問）`,
        ),
      ),
    ),
    host,
  );
}

/**
 * 納得チェックのセッションを host に描画する（1問ずつ・自己採点で次へ）。
 * 採点結果は即座に保存されるため、途中でタブを離れてもそこまでの分は残る。
 */
export function renderWhyCheckSession(host: HTMLElement, queue: readonly WhyCheckItem[]): void {
  if (queue.length === 0) return;
  let index = 0;
  const graded: Rating[] = [];

  const showAnswer = (item: WhyCheckItem, body: HTMLElement): void => {
    body.innerHTML = "";
    const card = getPrincipleCard(item.area);
    body.append(
      h("div", { class: "muted small" }, "模範解答:"),
      h("p", {}, item.answer),
      card ? h("div", { class: "muted small" }, `💡 この領域の要点: ${card.coreIdea}`) : "",
      h("div", { class: "muted small" }, "自分の説明と比べて、どのくらい言えましたか？"),
      h(
        "div",
        { class: "drill-actions" },
        ...RATINGS.map((r) =>
          h(
            "button",
            {
              class: "chip",
              type: "button",
              title: r.hint,
              onclick: () => {
                whyChecks.record(item.id, r.rating);
                graded.push(r.rating);
                index += 1;
                render();
              },
            },
            r.label,
          ),
        ),
      ),
    );
  };

  const render = (): void => {
    host.innerHTML = "";
    if (index >= queue.length) {
      const recalled = graded.filter((r) => r !== "again").length;
      host.append(
        h(
          "div",
          { class: "card" },
          h("strong", {}, "🎉 納得チェック終了"),
          h("div", { class: "muted" }, `${queue.length} 問中 ${recalled} 問を説明できました。`),
          h(
            "div",
            { class: "muted small" },
            "「言えなかった」ものは近いうちにまた出ます。原理カード（進捗タブの体系学習ロードマップ）で" +
              "導出をたどり直すと定着が早くなります。",
          ),
        ),
      );
      return;
    }
    const item = queue[index] as WhyCheckItem; // index < queue.length のため在中
    const body = h("div", {});
    body.append(
      h(
        "div",
        { class: "drill-actions" },
        h("button", { class: "primary", type: "button", onclick: () => showAnswer(item, body) }, "答え合わせをする"),
      ),
    );
    host.append(
      h(
        "div",
        { class: "card" },
        h("div", { class: "muted small" }, `${index + 1} / ${queue.length} ・ ${item.area}`),
        h("strong", {}, `Q. ${item.question}`),
        h(
          "div",
          { class: "muted small" },
          "まず自分の言葉で答えてから開いてください（思い出す負荷が定着を作ります）。",
        ),
        body,
      ),
    );
  };

  render();
  host.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
