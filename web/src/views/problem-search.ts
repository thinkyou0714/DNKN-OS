/**
 * views/problem-search.ts — 問題をさがす画面。
 *
 * 「科目でしか絞れない」状態を解消し、分野・難易度・出題頻度・キーワードで
 * 目的の問題に辿り着けるようにする。ヒットした問題はその場でドリルとして解ける。
 */
import type { Problem } from "../../../lib/engine/schema.js";
import { formatMath } from "../mathfmt.js";
import {
  buildSearchIndex,
  isEmptyFilter,
  type SearchFilters,
  type SearchIndex,
  searchProblems,
} from "../problem-search.js";
import { frequencyOf, problems } from "../state/app.js";
import { h, safeHtml } from "../ui/dom.js";
import { difficultyStars, emptyState, pastExamBadge } from "../ui/widgets.js";

/** タブ滞在中は条件を保持する（公式集の検索と同じ流儀）。 */
const filters: SearchFilters = {};
let index: SearchIndex | null = null;
let indexSrc: readonly Problem[] | null = null;

/** 表示件数の上限。これ以上は条件を絞ってもらう（描画コスト対策）。 */
const LIMIT = 100;

function ensureIndex(): SearchIndex {
  if (indexSrc !== problems || index === null) {
    index = buildSearchIndex(problems);
    indexSrc = problems;
  }
  return index;
}

function select(
  label: string,
  options: ReadonlyArray<readonly [string, string]>,
  current: string,
  onPick: (v: string) => void,
): HTMLElement {
  const sel = h("select", {}) as HTMLSelectElement;
  for (const [value, text] of options) {
    sel.append(h("option", { value, ...(current === value ? { selected: true } : {}) }, text));
  }
  sel.addEventListener("change", () => onPick(sel.value));
  return h("label", { class: "ps-field" }, h("span", { class: "muted" }, label), sel);
}

export function renderProblemSearch(root: HTMLElement, startDrill: (pool: Problem[]) => void): void {
  root.append(
    h("h2", {}, "問題をさがす"),
    h("p", { class: "muted" }, "分野・難易度・頻出度・キーワードで絞り込めます。結果はそのまま演習できます。"),
  );

  const results = h("div", { id: "ps-results" });

  const rerender = (): void => {
    results.innerHTML = "";
    if (isEmptyFilter(filters)) {
      results.append(
        emptyState("🔎", "条件を指定してください", "キーワードを入れるか、上の絞り込みを1つ選ぶと結果が出ます。"),
      );
      return;
    }
    const hits = searchProblems(ensureIndex(), filters, frequencyOf, LIMIT);
    if (hits.length === 0) {
      results.append(emptyState("🔍", "該当する問題がありません", "条件をゆるめてお試しください。"));
      return;
    }
    results.append(
      h(
        "div",
        { class: "ps-summary" },
        h("strong", {}, `${hits.length}${hits.length >= LIMIT ? "+" : ""} 問`),
        " ",
        h("button", { class: "primary", type: "button", onclick: () => startDrill(hits) }, "▶ この条件で演習する"),
      ),
    );
    const list = h("div", {});
    for (const p of hits.slice(0, 30)) {
      list.append(
        h(
          "div",
          { class: "card" },
          h("div", { html: safeHtml(formatMath(p.statement)) }),
          h(
            "div",
            { class: "muted" },
            `${p.subject}・${p.topic}・難易度${difficultyStars(p.difficulty)}`,
            frequencyOf(p.topic) === "high" ? h("span", { class: "chip hk-freq-every" }, "◎ 頻出") : "",
            pastExamBadge(p) ?? "",
          ),
        ),
      );
    }
    if (hits.length > 30) {
      list.append(h("p", { class: "muted" }, `ほか ${hits.length - 30} 問（演習ボタンで全件出題されます）`));
    }
    results.append(list);
  };

  const kw = h("input", {
    type: "search",
    class: "num",
    placeholder: "キーワードで検索（例: 接地 / たるみ / 力率）",
    "aria-label": "問題をキーワードで検索",
    value: filters.keyword ?? "",
  }) as HTMLInputElement;
  kw.addEventListener("input", () => {
    filters.keyword = kw.value;
    rerender();
  });

  const subjects = [...new Set(problems.map((p) => p.subject))].sort();
  const fields = h(
    "div",
    { class: "ps-fields" },
    select("科目", [["", "すべて"], ...subjects.map((s) => [s, s] as const)], filters.subject ?? "", (v) => {
      if (v) filters.subject = v;
      else filters.subject = undefined;
      rerender();
    }),
    select(
      "頻出度",
      [
        ["", "すべて"],
        ["high", "◎ ほぼ毎年"],
        ["mid", "○ 数年に1回"],
        ["low", "△ まれ"],
      ],
      filters.frequency ?? "",
      (v) => {
        filters.frequency = v || undefined;
        rerender();
      },
    ),
    select(
      "難易度",
      [
        ["", "すべて"],
        ["1", "★のみ"],
        ["2", "★★以上"],
        ["3", "★★★以上"],
        ["4", "★★★★以上"],
      ],
      filters.minDifficulty ? String(filters.minDifficulty) : "",
      (v) => {
        filters.minDifficulty = v ? Number(v) : undefined;
        rerender();
      },
    ),
    select(
      "出典",
      [
        ["", "すべて"],
        ["past_exam_quoted", "過去問（そのまま）"],
        ["past_exam_modified", "過去問の改題"],
        ["original", "オリジナル生成"],
      ],
      filters.sourceType ?? "",
      (v) => {
        filters.sourceType = v || undefined;
        rerender();
      },
    ),
    select(
      "形式",
      [
        ["", "すべて"],
        ["multiple_choice", "五肢択一"],
        ["numeric", "数値入力"],
        ["descriptive", "記述"],
      ],
      filters.format ?? "",
      (v) => {
        filters.format = v || undefined;
        rerender();
      },
    ),
  );

  root.append(kw, fields, results);
  rerender();
}
