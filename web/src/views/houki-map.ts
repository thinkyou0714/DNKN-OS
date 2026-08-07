/**
 * views/houki-map.ts — 「法規マップ」の描画。
 *
 * 法規は条文・数値・計算が散らばっていて全体像を掴みにくい。この画面は
 * 「どこから手を付ければ何点になるか」を上から順に読めば分かる構成にする:
 *   得点設計 → 法令体系 → A問題の出題枠 → B問題の頻出 → 重要数値 → 学習順路
 *
 * 頻度は色だけでなく記号（◎○△）を必ず併記する（色覚多様性への配慮）。
 * 表は最大3列に抑え、狭い画面でも横スクロールなしで読めるようにする。
 */
import {
  A_SLOTS,
  B_PATTERNS,
  EXAM_META,
  FREQUENCY_LABEL,
  type Frequency,
  KEY_NUMBERS,
  RELATED_STATUTES,
  SCORE_PLANS,
  SCORE_TABLE,
  STATUTE_HIERARCHY,
  STUDY_STEPS,
} from "../houki-map.js";
import { h } from "../ui/dom.js";

/** 頻度チップ（記号＋文言。色は補助にとどめる）。 */
function freqChip(f: Frequency): HTMLElement {
  const { symbol, text } = FREQUENCY_LABEL[f];
  return h("span", { class: `chip hk-freq hk-freq-${f}`, title: text }, `${symbol} ${text}`);
}

/** 見出し付きのセクション枠。 */
function section(title: string, lead: string, ...body: (Node | string)[]): HTMLElement {
  return h("section", { class: "hk-sec" }, h("h2", {}, title), h("p", { class: "muted" }, lead), ...body);
}

/**
 * 得点の積み上げバー（100点を横幅いっぱいとする）。
 * 合格ライン(60点)の縦線を重ねて、届いているかを数字を読まずに判断できるようにする。
 */
function scoreBar(parts: readonly { name: string; points: number }[]): HTMLElement {
  const total = parts.reduce((s, p) => s + p.points, 0);
  const track = h("div", { class: "hk-stack" });
  for (const [i, p] of parts.entries()) {
    track.append(
      h(
        "div",
        { class: `hk-fill hk-fill-${i}`, style: `width:${p.points}%`, title: `${p.name} ${p.points}点` },
        `${p.points}`,
      ),
    );
  }
  if (total < 100) track.append(h("div", { class: "hk-fill hk-fill-rest", style: `width:${100 - total}%` }, ""));
  // 合格ラインのマーカー（60%位置）。
  track.append(h("div", { class: "hk-passline", "aria-hidden": "true" }));
  return h(
    "div",
    {
      class: "hk-stack-wrap",
      role: "img",
      "aria-label": `${parts.map((p) => `${p.name}${p.points}点`).join("と")}で合計${total}点。合格ラインは${EXAM_META.passPoints}点`,
    },
    track,
  );
}

function renderScoreDesign(): HTMLElement {
  const rows = h("table", { class: "fx hk-tbl" });
  for (const r of SCORE_TABLE) {
    rows.append(
      h("tr", {}, h("td", {}, r.section), h("td", { class: "muted" }, r.detail), h("td", {}, `${r.points}点`)),
    );
  }
  const plans = h("div", {});
  for (const p of SCORE_PLANS) {
    const total = p.parts.reduce((s, x) => s + x.points, 0);
    const pass = total >= EXAM_META.passPoints;
    plans.append(
      h(
        "div",
        { class: "hk-plan" },
        h(
          "div",
          { class: "hk-plan-head" },
          h("strong", {}, p.label),
          h("span", { class: `chip ${pass ? "hk-pass" : "hk-fail"}` }, `${total}点`),
        ),
        scoreBar(p.parts),
        h("div", { class: "muted" }, `${p.parts.map((x) => `${x.name} ${x.points}点`).join(" ＋ ")} … ${p.note}`),
      ),
    );
  }
  return section(
    "① 何点をどこで取るか",
    `${EXAM_META.totalPoints}点満点・合格${EXAM_META.passPoints}点・${EXAM_META.minutes}分・${EXAM_META.format}。${EXAM_META.note}`,
    rows,
    h("h3", {}, "合格ラインの作り方"),
    plans,
  );
}

function renderHierarchy(): HTMLElement {
  const tree = h("div", { class: "hk-tree" });
  for (const [i, n] of STATUTE_HIERARCHY.entries()) {
    if (i > 0) tree.append(h("div", { class: "hk-arrow", "aria-hidden": "true" }, "▼"));
    tree.append(
      h(
        "div",
        { class: `hk-node hk-lv${n.level}${n.isInterpretation ? " hk-node-dashed" : ""}` },
        h("div", { class: "hk-node-name" }, n.name),
        h("div", { class: "muted" }, n.note),
      ),
    );
  }
  const side = h("div", { class: "hk-side" });
  for (const s of RELATED_STATUTES) {
    side.append(
      h(
        "div",
        { class: "hk-node hk-node-side" },
        h("div", { class: "hk-node-name" }, s.name, h("span", { class: "chip hk-target" }, s.target)),
        h("div", { class: "muted" }, s.note),
        freqChip(s.freq),
      ),
    );
  }
  return section(
    "② 法令の体系",
    "上ほど強い（上位法）。▼は「細目を下位に委ねる」の意味。破線は法令そのものではないもの。数値の大半はいちばん下の電技解釈にある。",
    h("div", { class: "hk-hier" }, tree, h("div", {}, h("h3", {}, "周辺の法令"), side)),
  );
}

function renderASlots(): HTMLElement {
  const t = h("table", { class: "fx hk-tbl" });
  for (const r of A_SLOTS) {
    t.append(
      h(
        "tr",
        {},
        h("td", { class: "hk-slot" }, r.slot),
        h("td", {}, r.theme, r.topics.length > 0 ? h("div", { class: "muted" }, `→ ${r.topics.join(" / ")}`) : ""),
        h("td", {}, freqChip(r.freq)),
      ),
    );
  }
  return section("③ A問題はどこから出るか", "直近6回、問1〜問3は同じ枠から出続けている。ここは狙い撃ちできる。", t);
}

function renderBPatterns(): HTMLElement {
  const max = Math.max(...B_PATTERNS.map((p) => p.hits));
  const t = h("table", { class: "fx hk-tbl" });
  for (const p of B_PATTERNS) {
    t.append(
      h(
        "tr",
        {},
        h("td", {}, h("div", {}, p.name), h("code", { class: "hk-formula" }, p.formula)),
        h(
          "td",
          { class: "hk-hits" },
          h(
            "div",
            { class: "bar hk-bar" },
            h("div", { class: "hk-bar-fill", style: `width:${(p.hits / max) * 100}%` }),
          ),
          h("span", { class: "muted" }, `6回中${p.hits}回`),
        ),
      ),
    );
  }
  return section("④ B問題の頻出パターン", "配点40点。出るパターンは意外と狭い。接地抵抗が最頻。", t);
}

function renderNumbers(): HTMLElement {
  const wrap = h("div", { class: "hk-nums" });
  for (const g of KEY_NUMBERS) {
    const t = h("table", { class: "fx hk-tbl" });
    for (const r of g.rows) t.append(h("tr", {}, h("td", {}, r.item), h("td", { class: "hk-val" }, r.value)));
    wrap.append(h("div", { class: "card hk-numcard" }, h("h3", {}, g.category), t));
  }
  return section("⑤ 覚える数値", "カテゴリ単位で覚える。バラバラに暗記しない。", wrap);
}

function renderSteps(): HTMLElement {
  const ol = h("ol", { class: "hk-steps" });
  for (const s of STUDY_STEPS) {
    ol.append(
      h(
        "li",
        {},
        h("strong", {}, s.title),
        h("div", { class: "muted" }, s.detail),
        s.topics.length > 0
          ? h("div", { class: "hk-topics" }, ...s.topics.map((t) => h("span", { class: "chip" }, t)))
          : "",
      ),
    );
  }
  return section("⑥ どの順に進めるか", "上から順に。①だけで40点分に手が届く。", ol);
}

export function renderHoukiMap(root: HTMLElement): void {
  root.append(
    h("h2", {}, "法規マップ"),
    h("p", { class: "muted" }, "法規の全体像を1画面に。上から順に読めば「どこで何点取るか」が分かる。"),
    renderScoreDesign(),
    renderHierarchy(),
    renderASlots(),
    renderBPatterns(),
    renderNumbers(),
    renderSteps(),
  );
}
