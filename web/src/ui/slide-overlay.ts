/**
 * ui/slide-overlay.ts — 解法スライドのモーダル表示（解く流れを1枚ずつ再生する）。
 *
 * 純ロジック（デッキの組み立て）は lib/curriculum/solution-slides.ts が担当し、
 * ここは描画とキー操作だけを持つ薄い層。widgets.solutionNode から開くため、
 * 解説が表示されるすべての場所（学習・模試の結果）で同じ体験になる。
 *
 * キー操作はモーダルの定石に従う:
 *   - keydown は document の capture 段で受け、背後のグローバルショートカット
 *     （app.ts の onKeydown: 数字で解答・Enterで次の問題）がモーダル中に発火しないようにする。
 *   - ←/→ でスライド移動、Esc で閉じる、Tab はモーダル内で循環（フォーカストラップ）。
 *   - 閉じたら開いたボタンへフォーカスを返す。
 *
 * 自動再生（▶）は AUTOPLAY_PACES の間隔でスライドを送り、最後の1枚で自動停止する
 * （勝手に閉じない）。タイマーは close() で必ず破棄する（タイマーリーク防止 II-156 と同じ規律）。
 */

import { ROLE_LABELS } from "../../../lib/curriculum/rubric.js";
import {
  AUTOPLAY_PACES,
  type AutoplayPace,
  buildSolutionSlides,
  clampSlideIndex,
  nextAutoplayIndex,
  type SolutionSlide,
} from "../../../lib/curriculum/solution-slides.js";
import type { Problem } from "../../../lib/engine/schema.js";
import { formatMath } from "../mathfmt.js";
import { h, safeHtml } from "./dom.js";
import { printSlides } from "./slide-print.js";

/** スライド位置ドットを描画する上限枚数（それ以上はカウンタ表示だけで十分）。 */
const MAX_DOTS = 12;

/** スライド1枚ぶんの役割チップ（cover/answer は固定、step は rubric の役割バッジと同じ配色）。 */
function roleChip(slide: SolutionSlide): HTMLElement {
  if (slide.kind === "cover") return h("span", { class: "rubric-role" }, "まず読む");
  if (slide.kind === "answer") return h("span", { class: "rubric-role role-conclusion" }, "結論");
  const role = slide.role ?? "calculation";
  return h("span", { class: `rubric-role role-${role}` }, ROLE_LABELS[role]);
}

/** 解法スライドのモーダルを開く。 */
export function openSlideOverlay(p: Problem): void {
  const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const deck = buildSolutionSlides(p);
  const n = deck.slides.length;
  let idx = 0;

  const counter = h("span", { class: "slides-count", "aria-live": "polite" });
  const title = h("div", { class: "slides-title" });
  const body = h("div", { class: "slides-body" });
  const thought = h("div", { class: "slides-thought" });
  const dots = h("div", { class: "slides-dots", "aria-hidden": "true" });
  const prev = h(
    "button",
    { class: "chip", type: "button", onclick: () => go(idx - 1) },
    "◀ 前へ",
  ) as HTMLButtonElement;
  const next = h(
    "button",
    { class: "chip", type: "button", onclick: () => go(idx + 1) },
    "次へ ▶",
  ) as HTMLButtonElement;

  // ---- 自動再生（動画のように流す再生モード） ----
  let paceIdx = 1; // 既定は「ふつう」
  let timer: number | null = null;
  const pace = (): AutoplayPace => AUTOPLAY_PACES[paceIdx % AUTOPLAY_PACES.length] as AutoplayPace;
  const playBtn = h(
    "button",
    { class: "chip", type: "button", "aria-pressed": "false", onclick: () => toggleAutoplay() },
    "▶ 自動再生",
  ) as HTMLButtonElement;
  const paceBtn = h(
    "button",
    { class: "chip", type: "button", title: "1枚あたりの表示時間を切り替え", onclick: () => cyclePace() },
    `ペース: ${pace().label}`,
  ) as HTMLButtonElement;

  function stopAutoplay(): void {
    if (timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
    playBtn.textContent = "▶ 自動再生";
    playBtn.setAttribute("aria-pressed", "false");
  }

  function startAutoplay(): void {
    stopAutoplay();
    timer = window.setInterval(() => {
      const nx = nextAutoplayIndex(idx, n);
      if (nx === null) {
        // 最後まで来たら止まって待つ（勝手に閉じない）。
        stopAutoplay();
        return;
      }
      idx = nx;
      renderSlide();
    }, pace().ms);
    playBtn.textContent = "⏸ 一時停止";
    playBtn.setAttribute("aria-pressed", "true");
  }

  function toggleAutoplay(): void {
    if (timer !== null) {
      stopAutoplay();
      return;
    }
    // 最後のスライドで▶を押したら最初からもう一周（解き直しの導線）。
    if (idx >= n - 1) {
      idx = 0;
      renderSlide();
    }
    startAutoplay();
  }

  function cyclePace(): void {
    paceIdx = (paceIdx + 1) % AUTOPLAY_PACES.length;
    paceBtn.textContent = `ペース: ${pace().label}`;
    // 再生中なら新しい間隔で仕切り直す。
    if (timer !== null) startAutoplay();
  }

  const overlay = h(
    "div",
    {
      class: "slides-overlay",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": "解法スライド",
      tabindex: "-1",
      onclick: (e: Event) => {
        // 背景（カードの外）クリックで閉じる。カード内クリックは無視。
        if (e.target === overlay) close();
      },
    },
    h(
      "div",
      { class: "slides-card" },
      h(
        "div",
        { class: "slides-head" },
        h("span", { class: "slides-label" }, "解法スライド"),
        counter,
        h(
          "button",
          { class: "chip slides-close", type: "button", "aria-label": "閉じる", onclick: () => close() },
          "✕",
        ),
      ),
      title,
      body,
      thought,
      h("div", { class: "slides-nav" }, prev, dots, next),
      h(
        "div",
        { class: "slides-tools" },
        playBtn,
        paceBtn,
        h(
          "button",
          {
            class: "chip",
            type: "button",
            title: "1スライド=1ページ（A4横）で印刷ダイアログを開き、PDFとして保存できます",
            onclick: () => {
              stopAutoplay();
              printSlides(p);
            },
          },
          "🖨 印刷 / PDF保存",
        ),
      ),
    ),
  );

  function renderSlide(): void {
    const slide = deck.slides[idx];
    if (!slide) return;
    counter.textContent = `${idx + 1} / ${n}`;
    title.replaceChildren(roleChip(slide), h("strong", {}, slide.title));
    body.replaceChildren(h("div", { html: safeHtml(formatMath(slide.body)) }));
    thought.textContent = `🧠 実戦の思考: ${slide.thought}`;
    dots.replaceChildren();
    if (n <= MAX_DOTS) {
      for (let i = 0; i < n; i++) dots.append(h("i", { class: i === idx ? "on" : "" }));
    }
    prev.disabled = idx === 0;
    // 最終スライドでは「次へ」が「閉じる」になり、矢印キーだけで一周を終えられる。
    next.textContent = idx === n - 1 ? "✔ 閉じる" : "次へ ▶";
  }

  function go(to: number): void {
    if (to >= n) {
      close();
      return;
    }
    idx = clampSlideIndex(to, n);
    renderSlide();
    // 手動で送ったら、そのスライドをフルの間隔で見られるようタイマーを仕切り直す。
    if (timer !== null) startAutoplay();
  }

  function close(): void {
    stopAutoplay();
    document.removeEventListener("keydown", onKey, true);
    overlay.remove();
    opener?.focus();
  }

  function onKey(e: KeyboardEvent): void {
    if (!document.body.contains(overlay)) {
      // 何らかの理由で overlay だけが消えていたらリスナも掃除する（保険）。
      document.removeEventListener("keydown", onKey, true);
      return;
    }
    // モーダル中は背後のグローバルショートカットを止める（数字解答・Enter次へ等の誤発火防止）。
    e.stopPropagation();
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      go(idx + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(idx - 1);
    } else if (e.key === "Tab") {
      // フォーカストラップ: モーダル内のボタンだけを循環させる（背後のページへ抜けない）。
      const items = Array.from(overlay.querySelectorAll<HTMLButtonElement>("button")).filter((b) => !b.disabled);
      if (items.length === 0) return;
      e.preventDefault();
      const cur = items.indexOf(document.activeElement as HTMLButtonElement);
      const nextIdx = e.shiftKey
        ? cur <= 0
          ? items.length - 1
          : cur - 1
        : cur === -1 || cur === items.length - 1
          ? 0
          : cur + 1;
      items[nextIdx]?.focus();
    }
  }

  renderSlide();
  document.body.append(overlay);
  document.addEventListener("keydown", onKey, true);
  overlay.focus();
}
