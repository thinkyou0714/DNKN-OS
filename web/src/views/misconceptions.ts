/**
 * views/misconceptions.ts — 誤答パターン（誤概念）の可視化と、係数ドリルへの橋渡し。
 *
 * 「不正解でした」で終わらせず、誤答値と正解値の比から推定した誤概念
 * （√3 を余分に掛けた・単位接頭辞 k を落とした…）を件数つきで示し、
 * そのまま対応する係数ファミリのドリルへ送る。
 * 純ロジックは lib/curriculum/misconceptions.ts。ここは薄い DOM グルー。
 *
 * 推定であることを必ず明示する（比が偶然一致することもあるため断定しない）。
 */
import { coefficientDrillsForFamily, getCoefficientFamily } from "../../../lib/curriculum/coefficients.js";
import { misconceptionStats, recommendedFamilyIds } from "../../../lib/curriculum/misconceptions.js";
import { problems, type progress } from "../state/app.js";
import { h } from "../ui/dom.js";
import { startCoeffDrillSession } from "./coeff-drill.js";

/** 一度に見せる誤概念の最大数（多すぎると読まれない）。 */
const MAX_SHOWN = 4;

/**
 * 誤概念セクション。誤答の記録（chosen）が十分に貯まるまでは何も描画しない
 * （件数が少ないうちに断定的な指摘を出すと誤診断の害の方が大きい）。
 */
export function misconceptionSection(root: HTMLElement, logs: ReturnType<typeof progress.logs>): void {
  // problemId → 正解。誤答比の判定に使う。
  const answerOf = new Map(problems.map((p) => [p.id, p.answer]));
  const summary = misconceptionStats(logs, (id) => answerOf.get(id));
  if (summary.classified === 0) return;

  const host = h("div", {});
  const card = h(
    "div",
    { class: "card" },
    h("strong", {}, "🧩 誤答パターン（何を取り違えているか）"),
    h(
      "div",
      { class: "muted" },
      `誤答 ${summary.analyzed} 件のうち ${summary.classified} 件は、正解との比が特徴的な値でした。` +
        "計算力ではなく係数や単位の取り違えが原因かもしれません（推定です）。",
    ),
  );

  const list = h("div", { class: "miscon-list" });
  for (const c of summary.counts.slice(0, MAX_SHOWN)) {
    const topics = c.topics.slice(0, 3).join("・");
    list.append(
      h(
        "div",
        { class: "miscon-item" },
        h("span", { class: "miscon-count" }, `${c.count}回`),
        h("strong", {}, c.pattern.label),
        h("div", { class: "muted small" }, c.pattern.detail),
        topics.length > 0
          ? h("div", { class: "muted small" }, `出た論点: ${topics}${c.topics.length > 3 ? " ほか" : ""}`)
          : "",
      ),
    );
  }
  card.append(list);
  if (summary.unclassified > 0) {
    card.append(
      h(
        "div",
        { class: "muted small" },
        `※ 残り ${summary.unclassified} 件は既知のパターンに当てはまりませんでした（解法そのものの取り違えの可能性）。`,
      ),
    );
  }

  // 関連推奨: 誤概念に対応する係数ファミリのドリルへ直接送る。
  const familyIds = recommendedFamilyIds(summary).slice(0, 2);
  if (familyIds.length > 0) {
    const actions = h("div", { class: "drill-actions" });
    for (const id of familyIds) {
      const family = getCoefficientFamily(id);
      if (!family) continue;
      actions.append(
        h(
          "button",
          {
            class: "chip",
            type: "button",
            title: family.origin,
            onclick: () => startCoeffDrillSession(host, coefficientDrillsForFamily(id), family.name),
          },
          `⚖️ 「${family.name}」で確かめ直す`,
        ),
      );
    }
    if (actions.childElementCount > 0) {
      card.append(h("div", { class: "muted small" }, "この取り違えは、係数の使い分けドリルで直接つぶせます:"), actions);
    }
  }
  root.append(card, host);
}
