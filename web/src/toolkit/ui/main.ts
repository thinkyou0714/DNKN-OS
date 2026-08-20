/**
 * toolkit/ui/main.ts — 電気設計計算ツールキット（web/toolkit.html）のエントリ。
 *
 * lib/toolkit のモジュール定義（フィールド仕様＋純関数 compute＋根拠解説）を汎用レンダリング
 * する DOM グルー。数値の正しさは lib 側のテストで担保し、ここでは描画・保存・印刷・
 * ライセンス解錠の配線だけを行う（vitest カバレッジ対象外: vitest.config.ts 参照）。
 *
 * 絶対制約（docs/strategy/toolkit-product.md）:
 *  - 完全クライアントサイド処理。外部送信なし（fetch を書かない）。
 *  - 全計算結果に免責を表示。データ非送信の明示は toolkit.html 側に常設。
 */

import { TOOLKIT_MODULES } from "../../../../lib/toolkit/index.js";
import type { FieldSpec, ModuleResult, ToolkitModule, Verdict } from "../../../../lib/toolkit/types.js";
import { formatSig, isFieldVisible, TOOLKIT_DISCLAIMER } from "../../../../lib/toolkit/types.js";
import { $req, h } from "../../ui/dom.js";
import { TOOLKIT_MONETIZATION, toolkitMonetizationConfigured } from "../toolkit-config.js";
import {
  applyToolkitLicenseKey,
  clearToolkitLicense,
  exportToolkitStateJson,
  importToolkitStateJson,
  initToolkitEntitlements,
  loadToolkitState,
  saveToolkitState,
  toolkitInfo,
  toolkitLocked,
  toolkitTierAvailable,
  toolkitUnlocked,
} from "../toolkit-store.js";

const storage = window.localStorage;
const state = loadToolkitState(storage);
let activeModuleId = TOOLKIT_MODULES[0]?.id ?? "";
/** モジュール内タブ（計算/根拠解説）の選択状態。 */
const moduleTab = new Map<string, "calc" | "explain">();

const VERDICT_LABEL: Record<Verdict, string> = { ok: "合格", warn: "合格（余裕小）", ng: "不適" };

function toast(message: string): void {
  const el = $req(document, "#tk-toast");
  el.textContent = message;
  el.classList.add("show");
  window.setTimeout(() => el.classList.remove("show"), 2600);
}

function persist(): void {
  if (!saveToolkitState(storage, state)) toast("保存に失敗しました（容量不足の可能性）");
}

// ---- 値の取り出し（保存値 → 既定値）----

function currentValues(mod: ToolkitModule): Record<string, number | string> {
  const saved = state.values[mod.id] ?? {};
  const merged: Record<string, number | string> = {};
  for (const f of mod.fields) merged[f.key] = saved[f.key] ?? f.defaultValue;
  return merged;
}

function setValue(mod: ToolkitModule, key: string, value: number | string): void {
  let bucket = state.values[mod.id];
  if (bucket === undefined) {
    bucket = {};
    state.values[mod.id] = bucket;
  }
  bucket[key] = value;
  persist();
}

// ---- フォーム描画 ----

function renderField(mod: ToolkitModule, spec: FieldSpec, values: Record<string, number | string>): HTMLElement {
  const id = `tk-${mod.id}-${spec.key}`;
  const wrap = h("div", { class: "field", "data-key": spec.key });
  const label = h("label", { for: id }, spec.label);
  if (spec.unit !== undefined) label.append(h("span", { class: "unit" }, `[${spec.unit}]`));
  wrap.append(label);

  if (spec.kind === "select") {
    const select = h("select", {
      id,
      onchange: (e: Event) => {
        setValue(mod, spec.key, (e.target as HTMLSelectElement).value);
        renderActiveModule();
      },
    }) as HTMLSelectElement;
    for (const opt of spec.options ?? []) select.append(h("option", { value: opt.value }, opt.label));
    select.value = String(values[spec.key] ?? spec.defaultValue);
    wrap.append(select);
  } else {
    const raw = values[spec.key];
    const input = h("input", {
      id,
      type: "number",
      step: "any",
      inputmode: "decimal",
      value: typeof raw === "number" && Number.isFinite(raw) ? String(raw) : "",
      oninput: (e: Event) => {
        const text = (e.target as HTMLInputElement).value.trim();
        setValue(mod, spec.key, text === "" ? Number.NaN : Number(text));
        updateResult(mod);
      },
    });
    wrap.append(input);
  }
  if (spec.help !== undefined) wrap.append(h("div", { class: "help" }, spec.help));
  return wrap;
}

// ---- 結果描画 ----

function renderResult(result: ModuleResult): HTMLElement {
  const box = h("div", { class: "result-box", "data-role": "result" });
  if (!result.ok) {
    box.append(h("h3", {}, "入力を確認してください"));
    const ul = h("ul", { class: "err-list" });
    for (const err of result.errors ?? []) ul.append(h("li", {}, err.message));
    box.append(ul);
    return box;
  }
  const verdict = result.verdict ?? "ok";
  box.append(h("div", {}, h("span", { class: `verdict ${verdict}` }, `判定: ${VERDICT_LABEL[verdict]}`)));
  const ul = h("ul", { class: "result-items" });
  for (const item of result.items ?? []) {
    ul.append(
      h(
        "li",
        {},
        h("span", {}, item.label),
        h("span", { class: "val" }, `${formatSig(item.value, item.digits ?? 3)}${item.unit ? ` ${item.unit}` : ""}`),
      ),
    );
  }
  box.append(ul);
  if (result.notes !== undefined && result.notes.length > 0) {
    const notes = h("ul", { class: "note-list" });
    for (const n of result.notes) notes.append(h("li", {}, n));
    box.append(notes);
  }
  return box;
}

function updateResult(mod: ToolkitModule): void {
  const host = document.querySelector(`[data-module="${mod.id}"]`);
  if (!host) return;
  const old = host.querySelector('[data-role="result"]');
  const fresh = renderResult(mod.compute(currentValues(mod)));
  if (old) old.replaceWith(fresh);
  else host.append(fresh);
  // showIf の表示状態も入力に追従させる（select 変更は再描画するのでここは number 起点のみ）。
  const values = currentValues(mod);
  for (const f of mod.fields) {
    const fieldEl = host.querySelector(`[data-key="${f.key}"]`);
    if (fieldEl instanceof HTMLElement) fieldEl.hidden = !isFieldVisible(f, values);
  }
}

// ---- 根拠解説 ----

function renderExplanation(mod: ToolkitModule): HTMLElement {
  const doc = mod.explanation;
  const wrap = h("div", { class: "expl" });
  const section = (title: string, body: string[], mono = false): void => {
    wrap.append(h("h3", {}, title));
    if (mono) {
      for (const line of body) wrap.append(h("div", { class: "formula-block" }, line));
    } else {
      const ul = h("ul", {});
      for (const line of body) ul.append(h("li", {}, line));
      wrap.append(ul);
    }
  };
  section("結論", doc.conclusion);
  section("式", doc.formula, true);
  section("各項の意味", doc.terms);
  section("よくある誤解", doc.pitfalls);
  section("参照すべき一次情報", doc.primarySources);
  wrap.append(
    h(
      "p",
      { class: "help" },
      "※ 解説は一般的な設計慣行に基づくドラフトです。規格・データシートの原文を必ず確認してください。",
    ),
  );
  return wrap;
}

// ---- ロック中ティーザー ----

function renderLockedTeaser(mod: ToolkitModule): HTMLElement {
  const card = h("div", { class: "card locked-teaser", "data-module": mod.id });
  card.append(h("h2", {}, mod.title, h("span", { class: "locked-badge" }, "有料版")));
  card.append(h("p", { class: "mod-desc" }, mod.description));
  const lead = mod.explanation.conclusion[0];
  if (lead !== undefined) card.append(h("p", { class: "lead" }, lead));
  card.append(
    h(
      "p",
      { class: "mod-desc" },
      "このモジュールと計算書出力は有料版で利用できます。根拠解説（式の導出・係数の意味・よくある誤解・一次情報の読み方）も全文収録。",
    ),
  );
  const row = h("div", { class: "btn-row" });
  if (TOOLKIT_MONETIZATION.purchaseUrl !== "") {
    row.append(
      h(
        "a",
        { class: "btn primary", href: TOOLKIT_MONETIZATION.purchaseUrl, target: "_blank", rel: "noopener noreferrer" },
        "有料版を購入する",
      ),
    );
  }
  row.append(
    h(
      "button",
      {
        class: "btn",
        onclick: () => $req(document, "#tk-license").scrollIntoView({ behavior: "smooth" }),
      },
      "ライセンスキーをお持ちの方",
    ),
  );
  card.append(row);
  return card;
}

// ---- モジュール描画 ----

function renderModule(mod: ToolkitModule): HTMLElement {
  if (!toolkitTierAvailable(mod.tier)) return renderLockedTeaser(mod);

  const card = h("div", { class: "card", "data-module": mod.id });
  card.append(h("h2", {}, mod.title));
  card.append(h("p", { class: "mod-desc" }, mod.description));

  const tab = moduleTab.get(mod.id) ?? "calc";
  const tabRow = h("div", { class: "tab-row", role: "tablist" });
  const mkTab = (key: "calc" | "explain", label: string): HTMLElement =>
    h(
      "button",
      {
        role: "tab",
        "aria-selected": String(tab === key),
        onclick: () => {
          moduleTab.set(mod.id, key);
          renderActiveModule();
        },
      },
      label,
    );
  tabRow.append(mkTab("calc", "計算"), mkTab("explain", "根拠解説"));
  card.append(tabRow);

  if (tab === "explain") {
    card.append(renderExplanation(mod));
    return card;
  }

  const values = currentValues(mod);
  const grid = h("div", { class: "field-grid" });
  for (const f of mod.fields) {
    const el = renderField(mod, f, values);
    el.hidden = !isFieldVisible(f, values);
    grid.append(el);
  }
  card.append(grid);
  card.append(renderResult(mod.compute(values)));

  // 計算メモ
  const memoWrap = h("div", { class: "memo" });
  memoWrap.append(h("h3", {}, "計算メモ"));
  const memo = h("textarea", {
    placeholder: "前提条件・部品品番・判断理由などを記録（計算書にも印刷されます）",
    oninput: (e: Event) => {
      state.memos[mod.id] = (e.target as HTMLTextAreaElement).value;
      persist();
    },
  }) as HTMLTextAreaElement;
  memo.value = state.memos[mod.id] ?? "";
  memoWrap.append(memo);
  card.append(memoWrap);

  // 計算書印刷（有料版機能。ゲート非作動時は開放）
  const printRow = h("div", { class: "btn-row" });
  const printLocked = toolkitLocked();
  const printBtn = h(
    "button",
    { class: "btn primary", onclick: () => printSheet(mod) },
    "🖨 計算書を印刷（PDF保存）",
  ) as HTMLButtonElement;
  printBtn.disabled = printLocked;
  printRow.append(printBtn);
  if (printLocked) printRow.append(h("span", { class: "status-line" }, "計算書出力は有料版の機能です"));
  card.append(printRow);

  return card;
}

function renderActiveModule(): void {
  const main = $req(document, "#tk-main");
  main.replaceChildren();
  const mod = TOOLKIT_MODULES.find((m) => m.id === activeModuleId) ?? TOOLKIT_MODULES[0];
  if (mod === undefined) return;
  main.append(renderModule(mod));
  renderNav();
}

function renderNav(): void {
  const nav = $req(document, "#tk-nav");
  nav.replaceChildren();
  for (const mod of TOOLKIT_MODULES) {
    const locked = !toolkitTierAvailable(mod.tier);
    nav.append(
      h(
        "button",
        {
          role: "tab",
          "aria-selected": String(mod.id === activeModuleId),
          onclick: () => {
            activeModuleId = mod.id;
            renderActiveModule();
          },
        },
        `${locked ? "🔒 " : ""}${mod.shortTitle}`,
      ),
    );
  }
}

// ---- 計算書（印刷）----

function printSheet(mod: ToolkitModule): void {
  const result = mod.compute(currentValues(mod));
  const print = $req(document, "#tk-print");
  // 前回の afterprint が来なかった場合の残骸をまず掃除する（冪等な開始。slide-print.ts と同じ方針）。
  document.body.classList.remove("printing-sheet");
  print.replaceChildren();

  print.append(h("h1", {}, `設計計算書 — ${mod.title}`));
  const meta = h("table", {});
  const metaRow = (label: string, value: string): HTMLElement => h("tr", {}, h("th", {}, label), h("td", {}, value));
  meta.append(
    metaRow("品名", state.sheet.productName),
    metaRow("設計者", state.sheet.designer),
    metaRow("日付", state.sheet.date),
    metaRow("改訂", state.sheet.revision),
  );
  print.append(meta);

  print.append(h("h1", {}, "計算条件"));
  const inTable = h("table", {});
  const values = currentValues(mod);
  for (const f of mod.fields) {
    if (!isFieldVisible(f, values)) continue;
    const raw = values[f.key];
    let display: string;
    if (f.kind === "select") {
      display = (f.options ?? []).find((o) => o.value === raw)?.label ?? String(raw);
    } else {
      display = `${typeof raw === "number" && Number.isFinite(raw) ? String(raw) : "—"}${f.unit ? ` ${f.unit}` : ""}`;
    }
    inTable.append(h("tr", {}, h("th", {}, f.label), h("td", {}, display)));
  }
  print.append(inTable);

  print.append(h("h1", {}, "計算結果"));
  if (result.ok) {
    const outTable = h("table", {});
    for (const item of result.items ?? []) {
      outTable.append(
        h(
          "tr",
          {},
          h("th", {}, item.label),
          h("td", {}, `${formatSig(item.value, item.digits ?? 3)}${item.unit ? ` ${item.unit}` : ""}`),
        ),
      );
    }
    const verdict = result.verdict ?? "ok";
    outTable.append(h("tr", {}, h("th", {}, "判定"), h("td", {}, VERDICT_LABEL[verdict])));
    print.append(outTable);
    if (result.notes !== undefined && result.notes.length > 0) {
      const notes = h("ul", { class: "print-notes" });
      for (const n of result.notes) notes.append(h("li", {}, n));
      print.append(notes);
    }
  } else {
    print.append(h("p", {}, "（入力エラーのため計算結果なし）"));
  }

  const memo = state.memos[mod.id] ?? "";
  if (memo !== "") {
    print.append(h("h1", {}, "計算メモ"));
    print.append(h("p", { class: "print-notes" }, memo));
  }
  print.append(h("p", { class: "print-disclaimer" }, TOOLKIT_DISCLAIMER));
  // printing-sheet クラスが付いた印刷時だけ #tk-print が紙面になる（素の Ctrl+P は通常画面を印刷）。
  // print() が非ブロッキングな環境（iOS 等）があるため、後片付けは afterprint で行う。
  const cleanup = (): void => {
    document.body.classList.remove("printing-sheet");
    window.removeEventListener("afterprint", cleanup);
    // 古い計算書が次回の素の印刷に紛れ込まないよう空にする。
    print.replaceChildren();
  };
  document.body.classList.add("printing-sheet");
  window.addEventListener("afterprint", cleanup);
  window.print();
}

// ---- 計算書ヘッダ・データ管理 ----

function renderSheetSection(): void {
  const grid = $req(document, "#tk-sheet-grid");
  grid.replaceChildren();
  const fields: Array<{ key: keyof typeof state.sheet; label: string; placeholder: string }> = [
    { key: "productName", label: "品名", placeholder: "例: PSU-01 電源基板" },
    { key: "designer", label: "設計者", placeholder: "氏名" },
    { key: "date", label: "日付", placeholder: "2026-08-19" },
    { key: "revision", label: "改訂記号", placeholder: "A" },
  ];
  for (const f of fields) {
    const wrap = h("div", { class: "field" });
    wrap.append(h("label", { for: `tk-sheet-${f.key}` }, f.label));
    const input = h("input", {
      id: `tk-sheet-${f.key}`,
      type: "text",
      placeholder: f.placeholder,
      value: state.sheet[f.key],
      oninput: (e: Event) => {
        state.sheet[f.key] = (e.target as HTMLInputElement).value;
        persist();
      },
    });
    wrap.append(input);
    grid.append(wrap);
  }

  const row = $req(document, "#tk-data-row");
  row.replaceChildren();
  row.append(
    h(
      "button",
      {
        class: "btn",
        onclick: () => {
          const a = document.createElement("a");
          a.href = URL.createObjectURL(new Blob([exportToolkitStateJson(state)], { type: "application/json" }));
          a.download = `denken-toolkit-${new Date().toISOString().slice(0, 10)}.json`;
          a.click();
          URL.revokeObjectURL(a.href);
        },
      },
      "計算条件を書き出す（JSON）",
    ),
  );
  const fileInput = h("input", { type: "file", accept: "application/json,.json", hidden: true }) as HTMLInputElement;
  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    void file.text().then((text) => {
      const imported = importToolkitStateJson(text);
      if (imported === null) {
        toast("読み込めませんでした（ファイル形式が不正です）");
        return;
      }
      state.values = imported.values;
      state.memos = imported.memos;
      state.sheet = imported.sheet;
      persist();
      renderSheetSection();
      renderActiveModule();
      toast("計算条件を読み込みました");
    });
    fileInput.value = "";
  });
  row.append(fileInput, h("button", { class: "btn", onclick: () => fileInput.click() }, "計算条件を読み込む（JSON）"));
}

// ---- ライセンス ----

function renderLicenseSection(): void {
  const section = $req(document, "#tk-license");
  section.replaceChildren();
  section.append(h("h2", {}, "ライセンス"));

  // ロック判定（toolkitLocked）と同じ述語を使う: 公開鍵が不正形状のときは fail-open で
  // 全機能無料のため、購入導線やキー入力欄を出すと「解錠済みなのに検証失敗」の矛盾が起きる。
  if (!toolkitMonetizationConfigured(TOOLKIT_MONETIZATION)) {
    section.append(
      h(
        "p",
        { class: "mod-desc" },
        "現在は全モジュールを無料公開中です（正式販売の開始後、一部モジュールと計算書出力は有料版になります）。",
      ),
    );
    return;
  }

  if (toolkitUnlocked()) {
    const info = toolkitInfo();
    section.append(h("p", {}, "✅ 有料版ライセンス有効"));
    section.append(
      h(
        "p",
        { class: "status-line" },
        `期限: ${info?.exp ?? "無期限（買い切り）"}${info?.sub !== undefined ? ` ／ 登録: ${info.sub}` : ""}`,
      ),
    );
    section.append(
      h(
        "div",
        { class: "btn-row" },
        h(
          "button",
          {
            class: "btn",
            onclick: () => {
              clearToolkitLicense(storage);
              renderAll();
              toast("ライセンスを解除しました");
            },
          },
          "この端末のライセンスを解除",
        ),
      ),
    );
    return;
  }

  section.append(
    h(
      "p",
      { class: "mod-desc" },
      "購入時に届いたライセンスキー（DENKEN1.…）を貼り付けると、有料モジュールと計算書出力が使えるようになります。",
    ),
  );
  const input = h("input", {
    type: "text",
    placeholder: "DENKEN1.xxxx.yyyy",
    "aria-label": "ライセンスキー",
  }) as HTMLInputElement;
  const applyBtn = h(
    "button",
    {
      class: "btn primary",
      onclick: () => {
        void applyToolkitLicenseKey(storage, input.value).then((res) => {
          if (res.ok) {
            renderAll();
            toast("ライセンスを有効化しました");
          } else {
            toast(res.reason);
          }
        });
      },
    },
    "キーを適用",
  );
  section.append(h("div", { class: "license-row" }, input, applyBtn));
  if (TOOLKIT_MONETIZATION.purchaseUrl !== "") {
    section.append(
      h(
        "p",
        { class: "status-line" },
        h(
          "a",
          { href: TOOLKIT_MONETIZATION.purchaseUrl, target: "_blank", rel: "noopener noreferrer" },
          "有料版の購入はこちら",
        ),
      ),
    );
  }
}

// ---- 起動 ----

function renderAll(): void {
  renderNav();
  renderActiveModule();
  renderSheetSection();
  renderLicenseSection();
}

async function init(): Promise<void> {
  $req(document, "#tk-disclaimer").textContent = TOOLKIT_DISCLAIMER;
  await initToolkitEntitlements(storage);
  renderAll();
  // オフライン対応: 学習アプリと同じ SW を登録（同一スコープ・冪等）。
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // 登録失敗（プライベートモード等）はオンライン動作のみになるだけなので黙って続行。
    });
  }
}

void init();
