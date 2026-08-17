/**
 * ui/slide-print.ts — 解法スライドの印刷/PDF保存（1スライド=1ページ・A4横）。
 *
 * 「動画で使ったスライドを媒体上に残す」の実装形。ブラウザの印刷ダイアログから
 * PDF保存すれば、収録に使ったのと同じ紙芝居がそのままファイルとして手元に残る。
 *
 * 仕組み: 印刷専用のコンテナ（.slides-print。画面では常に display:none）を body 直下に
 * 追加し、body に printing-slides クラスを付けて @media print で他要素を隠してから
 * window.print() を呼ぶ。後片付けは afterprint で行う。print() が非ブロッキングな環境
 * （iOS 等）があるため復帰時には消さない。afterprint が来なかった場合もコンテナは
 * display:none で無害であり、次回印刷の開始時に必ず掃除する（冪等）。
 *
 * widgets.ts とは相互参照になる（sourceText を借りる）が、router↔paywall と同様に
 * すべて実行時参照のため ESM で解決可能。
 */

import { ROLE_LABELS } from "../../../lib/curriculum/rubric.js";
import { buildSolutionSlides, type SolutionSlide } from "../../../lib/curriculum/solution-slides.js";
import type { Problem } from "../../../lib/engine/schema.js";
import { formatMath } from "../mathfmt.js";
import { h, safeHtml } from "./dom.js";
import { sourceText } from "./widgets.js";

/** ページ見出し（step は役割名を添える）。 */
function pageTitle(slide: SolutionSlide): string {
  if (slide.kind !== "step") return slide.title;
  const role = slide.role ?? "calculation";
  return `${slide.title}・${ROLE_LABELS[role]}`;
}

/** 1スライド=1ページのノード。 */
function pageNode(p: Problem, slide: SolutionSlide, no: number, total: number): HTMLElement {
  const page = h(
    "div",
    { class: "slides-print-page" },
    h(
      "div",
      { class: "slides-print-head" },
      h("span", {}, `DENKEN-OS 解法スライド ・ ${p.subject}／${p.topic}`),
      h("span", {}, `${no} / ${total}`),
    ),
    h("div", { class: "slides-print-title" }, pageTitle(slide)),
    h("div", { class: "slides-print-body", html: safeHtml(formatMath(slide.body)) }),
    h("div", { class: "slides-print-thought" }, `実戦の思考: ${slide.thought}`),
  );
  // 出典は最終ページにだけ載せる（全ページに刷ると紙面がうるさい）。
  if (no === total) page.append(h("div", { class: "slides-print-src" }, sourceText(p)));
  return page;
}

/** 解法スライドを印刷する（PDF保存はブラウザの印刷ダイアログから）。 */
export function printSlides(p: Problem): void {
  // 前回の afterprint が来なかった場合の残骸をまず掃除する（冪等な開始）。
  for (const stale of Array.from(document.querySelectorAll(".slides-print"))) stale.remove();
  const deck = buildSolutionSlides(p);
  const total = deck.slides.length;
  const container = h(
    "div",
    { class: "slides-print", "aria-hidden": "true" },
    ...deck.slides.map((slide, i) => pageNode(p, slide, i + 1, total)),
  );
  const cleanup = (): void => {
    container.remove();
    document.body.classList.remove("printing-slides");
    window.removeEventListener("afterprint", cleanup);
  };
  document.body.append(container);
  document.body.classList.add("printing-slides");
  window.addEventListener("afterprint", cleanup);
  window.print();
}
