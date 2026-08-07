/**
 * views/formulas.ts — 公式タブの描画。
 */
import { FORMULAS, filterFormulas } from "../formulas.js";
import { formatMath } from "../mathfmt.js";
import { h, safeHtml } from "../ui/dom.js";
import { emptyState } from "../ui/widgets.js";
import { gearGuideSection } from "./bridge-cards.js";
import { renderHoukiMap } from "./houki-map.js";
import { renderProblemSearch } from "./problem-search.js";
import { startDrill } from "./review.js";

/** 公式タブの検索クエリ（タブ滞在中は保持）。 */
let formulasQuery = "";

function renderFormulaList(host: HTMLElement): void {
  host.innerHTML = "";
  const groups = filterFormulas(FORMULAS, formulasQuery);
  if (groups.length === 0) {
    host.append(emptyState("🔍", "見つかりませんでした", "別のキーワードでお試しください（例: 力率 / %Z / すべり）。"));
    return;
  }
  for (const group of groups) {
    const table = h("table", { class: "fx" });
    for (const item of group.items) {
      table.append(
        h(
          "tr",
          {},
          h("td", {}, item.name),
          h(
            "td",
            {},
            h("span", { html: safeHtml(formatMath(item.formula)) }),
            item.note ? h("div", { class: "muted" }, item.note) : "",
          ),
        ),
      );
    }
    host.append(h("h2", {}, group.subject), table);
  }
}

/** 資料タブ内のサブ画面。タブを増やさずに参照系を束ねる（モバイル下部ナビの限界=7タブ）。 */
type FxSegment = "formulas" | "houki" | "search";
let fxSegment: FxSegment = "formulas";

const SEGMENTS: ReadonlyArray<readonly [FxSegment, string]> = [
  ["formulas", "公式集"],
  ["houki", "法規マップ"],
  ["search", "問題をさがす"],
];

export function renderFormulas(root: HTMLElement): void {
  // セグメント切替（科目マップが増えてもここに足すだけでタブ数は変わらない）。
  const seg = h("div", { class: "hk-seg-nav", role: "tablist", "aria-label": "資料の種類" });
  for (const [id, label] of SEGMENTS) {
    seg.append(
      h(
        "button",
        {
          class: `hk-seg-btn${fxSegment === id ? " is-on" : ""}`,
          role: "tab",
          "aria-selected": fxSegment === id ? "true" : "false",
          onclick: () => {
            fxSegment = id;
            root.innerHTML = "";
            renderFormulas(root);
          },
        },
        label,
      ),
    );
  }
  root.append(seg);

  if (fxSegment === "houki") {
    renderHoukiMap(root);
    return;
  }
  if (fxSegment === "search") {
    renderProblemSearch(root, startDrill);
    return;
  }

  root.append(
    h("h2", {}, "公式集"),
    h("p", { class: "muted" }, "暗記だけでなく導出の足がかりに。出題テンプレートと対応しています。"),
  );
  // 検索: 56件の公式を目視スキャンさせない（部分一致・入力フォーカスを保ったままリストのみ更新）。
  const list = h("div", { id: "fxlist" });
  const search = h("input", {
    type: "search",
    class: "num",
    placeholder: "公式を検索（例: 力率 / %Z / たるみ）",
    "aria-label": "公式を検索",
    value: formulasQuery,
  }) as HTMLInputElement;
  search.addEventListener("input", () => {
    formulasQuery = search.value;
    renderFormulaList(list);
  });
  root.append(search, list);
  renderFormulaList(list);
  // 教材ガイド（17-A5）: 公式集を使い込む層に教材の選び方を提供する（リンクは検索結果形式）。
  root.append(gearGuideSection());
}
