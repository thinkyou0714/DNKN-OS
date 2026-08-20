/**
 * ui/widgets.ts — 再利用可能なUIウィジェット群。
 * 複数の views から参照される共通部品。
 */
import type { Problem } from "../../../lib/engine/schema.js";
import { formatMath } from "../mathfmt.js";
import { isUnsupervised } from "../problem-meta.js";
import { sanitizeSvg } from "../sanitize.js";
import { h, safeHtml } from "./dom.js";
import { openSlideOverlay } from "./slide-overlay.js";

/** 難易度を星で表示。 */
export function difficultyStars(n: number): string {
  return "★".repeat(Math.max(1, Math.min(5, n)));
}

/**
 * 未監修（draft / 自動生成）バッジ（#63）。
 * 人手で検証されていない可能性がある問題を学習者に明示する（透明性）。監修済みなら null。
 */
export function draftBadge(p: Problem): HTMLElement | null {
  if (!isUnsupervised(p)) return null;
  return h("span", { class: "chip draft", title: "自動生成・未監修の問題です（内容は確認中）" }, "未監修");
}

/** 問題の出典テキスト。 */
export function sourceText(p: Problem): string {
  return p.source.type === "original"
    ? `出典: ${p.source.citation ?? "DENKEN-OS オリジナル問題"}`
    : `出典: ${p.source.citation}`;
}

/** 解説ノード（ステップ付き）。解説が出る場所すべてに「スライドで解き直す」を添える。 */
export function solutionNode(p: Problem, label: string): HTMLElement {
  return h(
    "div",
    { class: "solution" },
    h("strong", {}, label),
    h("ol", {}, ...p.solution.map((s) => h("li", { html: safeHtml(formatMath(s)) }))),
    h("p", { class: "src" }, sourceText(p)),
    // noprint: 問題＋解説を印刷したときに操作ボタンが紙面へ出ないようにする
    // （印刷除外は .chips 単位で効くため、単独の .chip には明示が要る）。
    h(
      "button",
      { class: "chip noprint", type: "button", onclick: () => openSlideOverlay(p) },
      "🎞 スライドで解き直す（解く流れを1枚ずつ）",
    ),
  );
}

/**
 * SVG 文字列を innerHTML に流す唯一の経路（多層防御）。
 * すべての SVG→innerHTML は必ず sanitizeSvg を通す（mascotSvg も figure と同様に経由させる）。
 * 現状の SVG はビルド時固定で安全だが、将来の動的化に備えて一元化しておく。
 * @param tag ラップする要素タグ（既定 div）
 * @param attrs 追加属性（class/style など。html は内部で設定するため不可）
 */
export function svgNode(svgStr: string, tag = "div", attrs: Record<string, string> = {}): HTMLElement {
  const safe = sanitizeSvg(svgStr);
  return h(tag, { ...attrs, html: safeHtml(safe) });
}

/** 図（インライン SVG）を表示するノード。sanitizeSvg でサニタイズ済み（I-037）。 */
export function figureNode(svgStr: string): HTMLElement {
  return svgNode(svgStr, "figure", { class: "figure" });
}

/** 空状態（履歴なし等）の上質な表示。 */
export function emptyState(emoji: string, title: string, msg: string): HTMLElement {
  return h(
    "div",
    { class: "empty" },
    h("span", { class: "emoji" }, emoji),
    h("div", { class: "et" }, title),
    h("div", {}, msg),
  );
}

/** 0..1 の系列からスパークライン SVG を作る（2点以上のとき）。 */
export function sparklineNode(values: number[]): HTMLElement | null {
  if (values.length < 2) return null;
  const w = 320;
  const hh = 40;
  const pad = 3;
  const n = values.length;
  const x = (i: number) => pad + (i * (w - 2 * pad)) / (n - 1);
  const y = (v: number) => pad + (1 - Math.max(0, Math.min(1, v))) * (hh - 2 * pad);
  const line = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${x(n - 1).toFixed(1)} ${hh - pad} L${x(0).toFixed(1)} ${hh - pad} Z`;
  const svg =
    `<svg class="spark" viewBox="0 0 ${w} ${hh}" preserveAspectRatio="none" role="img" aria-label="正答率の推移">` +
    `<path class="area" d="${area}"/><path class="line" d="${line}"/></svg>`;
  return h("div", { html: safeHtml(svg) });
}

/** 達成率のリングプログレス（日次目標など）。 */
export function ringNode(value: number, max: number): HTMLElement {
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  const r = 24;
  const c = 2 * Math.PI * r;
  const off = c * (1 - pct);
  const svg =
    `<svg width="58" height="58" viewBox="0 0 58 58" role="img" aria-label="今日の達成率 ${Math.round(pct * 100)}%">` +
    `<circle cx="29" cy="29" r="${r}" fill="none" stroke="var(--surface-2)" stroke-width="6"/>` +
    `<circle cx="29" cy="29" r="${r}" fill="none" stroke="var(--accent)" stroke-width="6" stroke-linecap="round" ` +
    `stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 29 29)"/>` +
    `<text x="29" y="34" text-anchor="middle" fill="currentColor" font-size="14" font-weight="700">${Math.round(pct * 100)}%</text></svg>`;
  return h("div", { html: safeHtml(svg), style: "flex:none" });
}

/** 進捗バー。label を渡すと支援技術に進捗として伝わる（role=progressbar）。 */
export function bar(pct: number, label?: string): HTMLElement {
  const clamped = Math.max(0, Math.min(100, pct));
  const attrs: Record<string, string> = { class: "bar" };
  if (label) {
    attrs.role = "progressbar";
    attrs["aria-label"] = label;
    attrs["aria-valuenow"] = String(Math.round(clamped));
    attrs["aria-valuemin"] = "0";
    attrs["aria-valuemax"] = "100";
  }
  return h("div", attrs, h("span", { style: `width:${clamped}%` }));
}

/** 習得度チップ。 */
export function masteryChip(level: string): HTMLElement {
  const cls = level === "習得" ? "m3" : level === "習得中" ? "m2" : level === "要復習" ? "m1" : "m0";
  return h("span", { class: `chip ${cls}` }, level);
}
