/**
 * sheet-diff/ui/main.ts — 帳票変更点抽出ツール（web/sheet-diff.html）のエントリ。
 *
 * lib/sheet-diff の純ロジック（パース・突合・レポート）を画面に配線する DOM グルー。
 * 差分の正しさは lib 側のテストで担保し、ここでは読み込み・設定・表示・書き出しだけを扱う
 * （vitest カバレッジ対象外: vitest.config.ts 参照）。
 *
 * 絶対制約（docs/strategy/sheet-diff-product.md）:
 *  - 完全クライアントサイド処理。帳票を外部へ送らない（fetch を書かない）。
 *  - 帳票の中身は localStorage にも保存しない（保存するのは突合設定だけ）。
 */

import { diffSheets, type SheetDiff } from "../../../../lib/sheet-diff/diff.js";
import { decodeSheetBytes, type ParsedTable, parseDelimited } from "../../../../lib/sheet-diff/parse.js";
import { diffRows, formatDiffCsv, summarizeDiff, summaryLine } from "../../../../lib/sheet-diff/report.js";
import { looksLikeZip, readXlsxSheet } from "../../../../lib/sheet-diff/xlsx.js";
import { $req, h } from "../../ui/dom.js";
import { SHEET_DIFF_MONETIZATION } from "../sheet-diff-config.js";
import {
  applySheetDiffLicenseKey,
  clearSheetDiffLicense,
  type DiffPreset,
  defaultPreset,
  findPreset,
  initSheetDiffEntitlements,
  loadSheetDiffState,
  presetToOptions,
  removePreset,
  saveSheetDiffState,
  sheetDiffInfo,
  sheetDiffLocked,
  sheetDiffMonetizationConfigured,
  sheetDiffUnlocked,
  upsertPreset,
} from "../sheet-diff-store.js";

const storage = window.localStorage;
let state = loadSheetDiffState(storage);

interface LoadedSheet {
  table: ParsedTable;
  fileName: string;
  encoding: string;
}

/** 読み込んだ帳票（メモリ上のみ。保存も送信もしない）。 */
const sheets: { old: LoadedSheet | null; new: LoadedSheet | null } = { old: null, new: null };
/** 現在の突合設定（プリセットを読み込むとここへ展開される）。 */
let preset: DiffPreset = defaultPreset("");
let lastDiff: SheetDiff | null = null;

const SIDE_LABEL = { old: "旧版（変更前）", new: "新版（変更後）" } as const;

function toast(message: string): void {
  const el = $req(document, "#sd-toast");
  el.textContent = message;
  el.classList.add("show");
  window.setTimeout(() => el.classList.remove("show"), 2600);
}

function persist(): void {
  if (!saveSheetDiffState(storage, state)) toast("設定の保存に失敗しました（容量不足の可能性）");
}

// ---- 1. 読み込み ----

function setTable(side: "old" | "new", table: ParsedTable, fileName: string, encoding: string): void {
  if (table.header.length === 0) {
    toast("ヘッダ行が読み取れませんでした（1行目を列名にしてください）");
    return;
  }
  sheets[side] = { table, fileName, encoding };
  renderInputs();
  renderSettings();
  renderResult();
}

function setSheet(side: "old" | "new", text: string, fileName: string, encoding: string): void {
  setTable(side, parseDelimited(text), fileName, encoding);
}

/**
 * 読み込んだファイルを xlsx / CSV のどちらとしても扱えるようにする。
 * 現場で「CSV に保存し直す」一手間が最大の離脱要因になるため、Excel をそのまま受ける。
 */
async function loadFile(side: "old" | "new", file: File): Promise<void> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (looksLikeZip(bytes)) {
    const res = await readXlsxSheet(bytes);
    if (!res.ok) {
      toast(res.error);
      return;
    }
    const sheetLabel = res.sheet.sheetNames[res.sheet.sheetIndex] ?? "先頭シート";
    setTable(side, res.sheet.table, `${file.name}［${sheetLabel}］`, "xlsx");
    if (res.sheet.sheetNames.length > 1) {
      toast(`先頭シート「${sheetLabel}」を読み込みました（${res.sheet.sheetNames.length} シート中）`);
    }
    return;
  }
  const { text, encoding } = decodeSheetBytes(bytes);
  setSheet(side, text, file.name, encoding);
}

function renderInputs(): void {
  const host = $req(document, "#sd-inputs");
  host.replaceChildren();
  for (const side of ["old", "new"] as const) {
    const loaded = sheets[side];
    const box = h("div", { class: `drop${loaded ? " filled" : ""}` });
    box.append(h("h3", {}, SIDE_LABEL[side]));

    const fileInput = h("input", {
      type: "file",
      accept:
        ".xlsx,.csv,.tsv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/tab-separated-values,text/plain",
      hidden: true,
    }) as HTMLInputElement;
    fileInput.addEventListener("change", () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      void loadFile(side, file).catch(() => toast("ファイルを読み込めませんでした"));
      fileInput.value = "";
    });
    box.append(fileInput, h("button", { class: "btn", onclick: () => fileInput.click() }, "ファイルを選ぶ"));

    if (loaded) {
      box.append(
        h(
          "div",
          { class: "file-meta" },
          `${loaded.fileName}（${loaded.encoding} / ${loaded.table.header.length} 列 × ${loaded.table.rows.length} 行`,
          loaded.table.raggedRowCount > 0 ? ` ／ 列数の合わない行 ${loaded.table.raggedRowCount}` : "",
          "）",
        ),
      );
    } else {
      const paste = h("textarea", {
        placeholder: "または、ここに CSV / TSV を貼り付け",
        onchange: (e: Event) => {
          const text = (e.target as HTMLTextAreaElement).value;
          if (text.trim() !== "") setSheet(side, text, "貼り付け", "utf-8");
        },
      });
      box.append(paste);
    }
    host.append(box);
  }
}

// ---- 2. 突合の設定 ----

/** 両方の帳票に現れる正準列名（エイリアス適用後）。 */
function allColumns(): string[] {
  const seen: string[] = [];
  for (const side of ["old", "new"] as const) {
    for (const raw of sheets[side]?.table.header ?? []) {
      const name = (preset.aliases[raw.trim()] ?? raw).trim();
      if (name !== "" && !seen.includes(name)) seen.push(name);
    }
  }
  return seen;
}

function toggleIn(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function chipRow(selected: string[], onToggle: (col: string) => void): HTMLElement {
  const row = h("div", { class: "col-chips" });
  for (const col of allColumns()) {
    row.append(
      h(
        "button",
        {
          class: "col-chip",
          type: "button",
          "aria-pressed": String(selected.includes(col)),
          onclick: () => onToggle(col),
        },
        col,
      ),
    );
  }
  return row;
}

/** 片側にしかない列（＝対応付けが必要な候補）。 */
function unmatchedColumns(side: "old" | "new"): string[] {
  const other = side === "old" ? "new" : "old";
  const mine = sheets[side]?.table.header ?? [];
  const theirs = (sheets[other]?.table.header ?? []).map((c) => (preset.aliases[c.trim()] ?? c).trim());
  return mine.map((c) => c.trim()).filter((c) => c !== "" && !theirs.includes((preset.aliases[c] ?? c).trim()));
}

function renderSettings(): void {
  const host = $req(document, "#sd-settings");
  host.replaceChildren();
  host.append(h("h2", {}, "2. 突合の設定"));

  if (!sheets.old || !sheets.new) {
    host.append(h("p", { class: "mod-desc" }, "旧版・新版の両方を読み込むと、キー列の選択と列の対応付けができます。"));
    return;
  }

  host.append(h("h3", {}, "キー列（この列の値で行を突き合わせます）"));
  host.append(
    h("p", { class: "help" }, "品番・図番など、行を一意に決める列を選びます（複数選ぶと複合キーになります）。"),
  );
  host.append(
    chipRow(preset.keyColumns, (col) => {
      preset = { ...preset, keyColumns: toggleIn(preset.keyColumns, col) };
      renderSettings();
      renderResult();
    }),
  );

  host.append(h("h3", {}, "比較しない列"));
  host.append(h("p", { class: "help" }, "出力日時・改訂欄など、毎回変わるため差分に出したくない列を選びます。"));
  host.append(
    chipRow(preset.ignoreColumns, (col) => {
      preset = { ...preset, ignoreColumns: toggleIn(preset.ignoreColumns, col) };
      renderSettings();
      renderResult();
    }),
  );

  // 列の対応付け（各社雛形の吸収）。片側にしかない列だけを候補に出す。
  const oldOnly = unmatchedColumns("old");
  const newOnly = unmatchedColumns("new");
  if (oldOnly.length > 0 && newOnly.length > 0) {
    host.append(h("h3", {}, "列の対応付け（列名が違う場合）"));
    host.append(
      h("p", { class: "help" }, "「部品番号」と「Part No.」のように名前だけが違う列を同じ列として扱います。"),
    );
    for (const col of oldOnly) {
      const row = h("div", { class: "map-row" }, h("span", {}, `旧版「${col}」→`));
      const select = h("select", {
        onchange: (e: Event) => {
          const target = (e.target as HTMLSelectElement).value;
          const aliases = { ...preset.aliases };
          if (target === "") delete aliases[col];
          else aliases[col] = target;
          preset = { ...preset, aliases };
          renderSettings();
          renderResult();
        },
      }) as HTMLSelectElement;
      select.append(h("option", { value: "" }, "（対応付けない）"));
      for (const t of newOnly) select.append(h("option", { value: t }, `新版「${t}」`));
      select.value = preset.aliases[col] ?? "";
      row.append(select);
      host.append(row);
    }
  }

  host.append(h("h3", {}, "比較のしかた"));
  const optRow = h("div", { class: "btn-row" });
  const checkbox = (label: string, checked: boolean, onChange: (v: boolean) => void): HTMLElement => {
    const id = `sd-opt-${label}`;
    const input = h("input", {
      type: "checkbox",
      id,
      onchange: (e: Event) => onChange((e.target as HTMLInputElement).checked),
    }) as HTMLInputElement;
    input.checked = checked;
    return h("label", { for: id, class: "help" }, input, ` ${label}`);
  };
  optRow.append(
    checkbox("「1.0」と「1」を同じ値として扱う", preset.numericEquality, (v) => {
      preset = { ...preset, numericEquality: v };
      renderResult();
    }),
    checkbox("英字の大小を無視する", preset.ignoreCase, (v) => {
      preset = { ...preset, ignoreCase: v };
      renderResult();
    }),
  );
  host.append(optRow);
  host.append(renderPresetRow());
}

/** プリセット（各社雛形の設定）の保存・呼び出し。保存は有料機能。 */
function renderPresetRow(): HTMLElement {
  const wrap = h("div", {});
  wrap.append(h("h3", {}, "設定プリセット"));
  const locked = sheetDiffLocked();
  const row = h("div", { class: "btn-row" });

  if (state.presets.length > 0) {
    const select = h("select", {
      onchange: (e: Event) => {
        const name = (e.target as HTMLSelectElement).value;
        const found = findPreset(state, name);
        if (found) {
          preset = { ...found };
          state = { ...state, activePreset: name };
          persist();
          renderSettings();
          renderResult();
        }
      },
    }) as HTMLSelectElement;
    select.append(h("option", { value: "" }, "（プリセットを選ぶ）"));
    for (const p of state.presets) select.append(h("option", { value: p.name }, p.name));
    select.value = state.activePreset;
    row.append(select);
    if (state.activePreset !== "") {
      row.append(
        h(
          "button",
          {
            class: "btn",
            onclick: () => {
              state = removePreset(state, state.activePreset);
              persist();
              renderSettings();
            },
          },
          "削除",
        ),
      );
    }
  }

  const nameInput = h("input", {
    type: "text",
    placeholder: "プリセット名（例: 部品表A社）",
    "aria-label": "プリセット名",
  }) as HTMLInputElement;
  nameInput.value = state.activePreset;
  const saveBtn = h(
    "button",
    {
      class: "btn primary",
      onclick: () => {
        const name = nameInput.value.trim();
        if (name === "") {
          toast("プリセット名を入力してください");
          return;
        }
        state = upsertPreset(state, { ...preset, name });
        preset = { ...preset, name };
        persist();
        renderSettings();
        toast(`プリセット「${name}」を保存しました`);
      },
    },
    "この設定を保存",
  ) as HTMLButtonElement;
  saveBtn.disabled = locked;
  row.append(nameInput, saveBtn);
  wrap.append(row);
  if (locked) wrap.append(h("p", { class: "status-line" }, "プリセットの保存は有料版の機能です。"));
  return wrap;
}

// ---- 3. 変更点 ----

function statTile(n: number, label: string): HTMLElement {
  return h("div", { class: "stat" }, h("div", { class: "n" }, String(n)), h("div", { class: "l" }, label));
}

function renderResult(): void {
  const host = $req(document, "#sd-result");
  host.replaceChildren();
  host.append(h("h2", {}, "3. 変更点"));
  lastDiff = null;

  if (!sheets.old || !sheets.new) {
    host.append(h("p", { class: "mod-desc" }, "2つの帳票を読み込むと、ここに変更点が出ます。"));
    return;
  }

  const result = diffSheets(sheets.old.table, sheets.new.table, presetToOptions(preset));
  if (!result.ok) {
    const ul = h("ul", { class: "err-list" });
    for (const e of result.errors) ul.append(h("li", {}, e));
    host.append(ul);
    return;
  }
  lastDiff = result;

  const ragged = (sheets.old.table.raggedRowCount ?? 0) + (sheets.new.table.raggedRowCount ?? 0);
  const summary = summarizeDiff(result, ragged);
  const stats = h("div", { class: "stat-row" });
  stats.append(
    statTile(summary.changedRows, "変更行"),
    statTile(summary.changedCells, "変更セル"),
    statTile(summary.addedRows, "追加行"),
    statTile(summary.removedRows, "削除行"),
    statTile(summary.unchangedRows, "変更なし"),
  );
  host.append(stats);
  host.append(h("p", { class: "status-line" }, summaryLine(summary)));

  if (result.duplicateKeys.length > 0) {
    host.append(
      h(
        "p",
        { class: "status-line" },
        `⚠ キーが重複している行があります（${result.duplicateKeys.length} 件）。突合は先に現れた行で行っています。`,
      ),
    );
  }
  if (ragged > 0) {
    host.append(h("p", { class: "status-line" }, `⚠ 列数がヘッダと合わない行が ${ragged} 行あります。`));
  }

  const rows = diffRows(result);
  if (rows.length === 1) {
    host.append(h("p", { class: "mod-desc" }, "✅ 変更はありませんでした。"));
  } else {
    host.append(renderDiffTable(rows));
  }
  host.append(renderExportRow(result));
}

/** 変更点一覧（report.diffRows と同じ並び＝画面と CSV が一致する）。 */
function renderDiffTable(rows: string[][]): HTMLElement {
  const scroll = h("div", { class: "table-scroll" });
  const table = h("table", { class: "diff-table" });
  const [header, ...body] = rows as [string[], ...string[][]];
  const thead = h("tr", {});
  for (const cell of header) thead.append(h("th", {}, cell));
  table.append(h("thead", {}, thead));

  const tbody = h("tbody", {});
  for (const row of body) {
    const tr = h("tr", {});
    row.forEach((cell, i) => {
      if (i === 0) {
        const kind = cell === "変更" ? "changed" : cell === "追加" ? "added" : cell === "削除" ? "removed" : "info";
        tr.append(h("td", {}, h("span", { class: `kind ${kind}` }, cell)));
        return;
      }
      // 末尾2列は変更前・変更後（report.diffRows の並び）。色で差を読ませる。
      const isBefore = i === row.length - 2;
      const isAfter = i === row.length - 1;
      const cls = cell === "" ? "" : isBefore ? "before" : isAfter ? "after" : "";
      tr.append(h("td", cls === "" ? {} : { class: cls }, cell));
    });
    tbody.append(tr);
  }
  table.append(tbody);
  scroll.append(table);
  return scroll;
}

function renderExportRow(diff: SheetDiff): HTMLElement {
  const row = h("div", { class: "btn-row" });
  const locked = sheetDiffLocked();

  const csvBtn = h(
    "button",
    {
      class: "btn primary",
      onclick: () => {
        const a = document.createElement("a");
        // BOM を付けて Excel が UTF-8 と認識できるようにする（付けないと日本語が化ける）。
        const blob = new Blob(["﻿", formatDiffCsv(diff)], { type: "text/csv;charset=utf-8" });
        a.href = URL.createObjectURL(blob);
        a.download = `変更点一覧-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
      },
    },
    "⬇ 変更点一覧を CSV で書き出す",
  ) as HTMLButtonElement;
  csvBtn.disabled = locked;

  const printBtn = h("button", { class: "btn", onclick: () => printReport(diff) }, "🖨 レポートを印刷（PDF保存）");
  (printBtn as HTMLButtonElement).disabled = locked;

  row.append(csvBtn, printBtn);
  if (locked) {
    row.append(h("span", { class: "status-line" }, "書き出しと印刷は有料版の機能です（画面での確認は無料）"));
  }
  return row;
}

// ---- 印刷（レポート）----

function printReport(diff: SheetDiff): void {
  const print = $req(document, "#sd-print");
  document.body.classList.remove("printing-sheet");
  print.replaceChildren();

  print.append(h("h1", {}, "帳票 変更点一覧"));
  const meta = h("table", {});
  const metaRow = (label: string, value: string): HTMLElement => h("tr", {}, h("th", {}, label), h("td", {}, value));
  meta.append(
    metaRow("旧版", sheets.old?.fileName ?? "-"),
    metaRow("新版", sheets.new?.fileName ?? "-"),
    metaRow("キー列", diff.keyColumns.join(" / ")),
    metaRow("比較した列", diff.comparedColumns.join(" / ") || "-"),
    metaRow("概要", summaryLine(summarizeDiff(diff))),
  );
  print.append(meta);

  const rows = diffRows(diff);
  const table = h("table", {});
  const [header, ...body] = rows as [string[], ...string[][]];
  const headRow = h("tr", {});
  for (const c of header) headRow.append(h("th", {}, c));
  table.append(headRow);
  for (const row of body) {
    const tr = h("tr", {});
    for (const c of row) tr.append(h("td", {}, c));
    table.append(tr);
  }
  print.append(table);
  print.append(
    h(
      "p",
      { class: "print-disclaimer" },
      "本一覧はツールによる自動抽出です。最終確認は設計者の責任で行ってください。帳票は外部に送信されていません。",
    ),
  );

  const cleanup = (): void => {
    document.body.classList.remove("printing-sheet");
    window.removeEventListener("afterprint", cleanup);
    print.replaceChildren();
  };
  document.body.classList.add("printing-sheet");
  window.addEventListener("afterprint", cleanup);
  window.print();
}

// ---- ライセンス ----

function renderLicense(): void {
  const section = $req(document, "#sd-license");
  section.replaceChildren();
  section.append(h("h2", {}, "ライセンス"));

  if (!sheetDiffMonetizationConfigured()) {
    section.append(
      h(
        "p",
        { class: "mod-desc" },
        "現在は全機能を無料公開中です（正式販売の開始後、書き出し・印刷・プリセット保存が有料版になります）。",
      ),
    );
    return;
  }

  if (sheetDiffUnlocked()) {
    const info = sheetDiffInfo();
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
              clearSheetDiffLicense(storage);
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
      "購入時に届いたライセンスキー（DENKEN1.…）を貼り付けると、書き出し・印刷・プリセット保存が使えるようになります。",
    ),
  );
  const input = h("input", {
    type: "text",
    placeholder: "DENKEN1.xxxx.yyyy",
    "aria-label": "ライセンスキー",
  }) as HTMLInputElement;
  section.append(
    h(
      "div",
      { class: "license-row" },
      input,
      h(
        "button",
        {
          class: "btn primary",
          onclick: () => {
            void applySheetDiffLicenseKey(storage, input.value).then((res) => {
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
      ),
    ),
  );
  if (SHEET_DIFF_MONETIZATION.purchaseUrl !== "") {
    section.append(
      h(
        "p",
        { class: "status-line" },
        h(
          "a",
          { href: SHEET_DIFF_MONETIZATION.purchaseUrl, target: "_blank", rel: "noopener noreferrer" },
          "有料版の購入はこちら",
        ),
      ),
    );
  }
}

// ---- 起動 ----

function renderAll(): void {
  renderInputs();
  renderSettings();
  renderResult();
  renderLicense();
}

async function init(): Promise<void> {
  $req(document, "#sd-disclaimer").textContent =
    "本ツールの抽出結果は参考情報です。最終確認は設計者の責任で行ってください。帳票の内容はブラウザ内でのみ処理され、外部送信も保存もされません。";
  await initSheetDiffEntitlements(storage);
  const active = findPreset(state, state.activePreset);
  if (active) preset = { ...active };
  renderAll();
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // 登録失敗（プライベートモード等）はオンライン動作のみになるだけなので黙って続行。
    });
  }
}

void init();
