/**
 * views/settings.ts — 設定タブの描画。
 */

import { CHAT_MODELS } from "../../../lib/chat/prompt.js";
import { exportBackup, importBackup } from "../backup.js";
import { affiliateActive } from "../bridge-config.js";
import { applyLicenseKey, clearLicense, initEntitlements, proInfo, proUnlocked } from "../entitlements.js";
import { canReserveRest, loadFreezeState, saveFreezeState, studiedDays, toggleRestReservation } from "../freeze.js";
import { playTone } from "../fx.js";
import { MONETIZATION, monetizationConfigured } from "../monetization-config.js";
import { dayIndexOf } from "../quests.js";
import {
  getApiKey,
  getChatModel,
  getDailyGoal,
  getExamDate,
  getMascotEnabled,
  getReviewCap,
  getSoundLevel,
  getTheme,
  type SoundLevel,
  setApiKey,
  setChatModel,
  setDailyGoal,
  setExamDate,
  setMascotEnabled,
  setReviewCap,
  setSoundLevel,
  setTheme,
  type ThemePref,
} from "../settings.js";
import {
  applyTheme,
  coeffDrills,
  installPrompt,
  progress,
  setInstallPrompt,
  storage,
  whyChecks,
} from "../state/app.js";
import { SEEN_LEVEL_KEY, SEEN_STREAK_MILESTONE_KEY } from "../storage-keys.js";
import { h } from "../ui/dom.js";
import { showToast } from "../ui/toast.js";
import { WHY_CARD_KEY } from "../why-store.js";
import {
  creatorContentCard,
  inviteCard,
  ledgerExportCard,
  legalCard,
  nudgeOptOutCard,
  supportCard,
} from "./bridge-cards.js";
import { purchaseButton } from "./paywall.js";
import { renderHeader, renderNav, switchView } from "./router.js";

export function renderSettings(root: HTMLElement): void {
  root.append(h("h2", {}, "設定"));
  const examInput = h("input", { type: "date", value: getExamDate(storage) }) as HTMLInputElement;
  examInput.addEventListener("change", () => {
    setExamDate(storage, examInput.value);
    // 試験日が変わると試験日逆算スケジューリング（実効保持率・最大間隔・直前モード）が変わる（#34/#35）。
    progress.setExamDate(getExamDate(storage));
    renderHeader();
    renderNav();
  });
  const goalInput = h("input", {
    type: "number",
    min: "1",
    max: "200",
    value: String(getDailyGoal(storage)),
  }) as HTMLInputElement;
  goalInput.addEventListener("change", () => {
    setDailyGoal(storage, Number(goalInput.value));
    // クランプ後の実保存値を入力欄へ反映する（capInput と同じ挙動。範囲外入力時のみ作用）。
    goalInput.value = String(getDailyGoal(storage));
  });
  const capInput = h("input", {
    type: "number",
    min: "5",
    max: "200",
    value: String(getReviewCap(storage)),
  }) as HTMLInputElement;
  capInput.addEventListener("change", () => {
    setReviewCap(storage, Number(capInput.value));
    capInput.value = String(getReviewCap(storage));
    renderNav();
  });
  const retSel = h("select", {}) as HTMLSelectElement;
  for (const r of [0.8, 0.85, 0.9, 0.95]) retSel.append(h("option", { value: r }, `${Math.round(r * 100)}%`));
  retSel.value = String(progress.desiredRetention());
  retSel.addEventListener("change", () => {
    const value = Number(retSel.value);
    progress.setDesiredRetention(value);
    // 納得チェック・係数判断ドリルも同じ目標保持率で回す（演習だけ設定が効く非対称を作らない）。
    whyChecks.setDesiredRetention(progress.desiredRetention());
    coeffDrills.setDesiredRetention(progress.desiredRetention());
  });

  const themeSel = h("select", {}) as HTMLSelectElement;
  for (const [v, label] of [
    ["system", "システムに合わせる"],
    ["light", "ライト"],
    ["dark", "ダーク"],
  ] as const) {
    themeSel.append(h("option", { value: v }, label));
  }
  themeSel.value = getTheme(storage);
  themeSel.addEventListener("change", () => {
    setTheme(storage, themeSel.value as ThemePref);
    applyTheme();
  });

  const soundSel = h("select", {}) as HTMLSelectElement;
  for (const [v, label] of [
    ["off", "オフ"],
    ["low", "小"],
    ["mid", "中"],
    ["high", "大"],
  ] as const) {
    soundSel.append(h("option", { value: v }, label));
  }
  soundSel.value = getSoundLevel(storage);
  soundSel.addEventListener("change", () => {
    setSoundLevel(storage, soundSel.value as SoundLevel);
    playTone("correct", getSoundLevel(storage)); // 選んだ音量をその場で試聴できる
  });

  const mascotSel = h("select", {}) as HTMLSelectElement;
  mascotSel.append(h("option", { value: "1" }, "表示する"), h("option", { value: "0" }, "表示しない"));
  mascotSel.value = getMascotEnabled(storage) ? "1" : "0";
  mascotSel.addEventListener("change", () => setMascotEnabled(storage, mascotSel.value === "1"));

  // AIチャット（BYOK）: キーは端末内 localStorage のみ・送信先は Anthropic のみ。
  const keyInput = h("input", {
    type: "password",
    placeholder: "sk-ant-...",
    autocomplete: "off",
    value: getApiKey(storage),
    "aria-label": "Anthropic API キー",
  }) as HTMLInputElement;
  keyInput.addEventListener("change", () => setApiKey(storage, keyInput.value));
  const modelSel = h("select", {}) as HTMLSelectElement;
  for (const m of CHAT_MODELS) modelSel.append(h("option", { value: m.id }, m.label));
  modelSel.value = getChatModel(storage);
  modelSel.addEventListener("change", () => setChatModel(storage, modelSel.value));

  root.append(
    h("div", { class: "card" }, h("label", {}, "テーマ "), themeSel),
    h(
      "div",
      { class: "card" },
      h("label", {}, "効果音 "),
      soundSel,
      h("div", { class: "muted" }, "正解音・レベルアップなどの演出音（端末のマナーモードにも従います）。"),
    ),
    h(
      "div",
      { class: "card" },
      h("label", {}, "マスコット（シンクウ） "),
      mascotSel,
      h("div", { class: "muted" }, "学習タブ・復習タブのキャラクター表示。シンプルに使いたい方はオフに。"),
    ),
    h("div", { class: "card" }, h("label", {}, "試験日 "), examInput),
    h("div", { class: "card" }, h("label", {}, "1日の目標問題数 "), goalInput),
    h(
      "div",
      { class: "card" },
      h("label", {}, "1日の復習上限 "),
      capInput,
      h("div", { class: "muted" }, "復習が多すぎると挫折しやすいため、1日に出す復習件数の上限です（既定30）。"),
    ),
    h(
      "div",
      { class: "card" },
      h("label", {}, "FSRS 目標保持率 "),
      retSel,
      h("div", { class: "muted" }, "高いほど復習間隔が短く、定着重視になります（既定90%）。"),
    ),
    restDayCard(),
    h("h2", {}, "AIチャット（質問タブ）"),
    h(
      "div",
      { class: "card" },
      h("label", {}, "Anthropic API キー（任意） "),
      keyInput,
      h(
        "div",
        { class: "muted" },
        "未設定でも内蔵ナレッジで動作します。キーはこの端末の localStorage にのみ保存され、" +
          "送信先は api.anthropic.com のみです。共有端末では設定しないでください。",
      ),
      h(
        "button",
        {
          class: "chip",
          type: "button",
          onclick: () => {
            setApiKey(storage, "");
            keyInput.value = "";
          },
        },
        "キーを削除",
      ),
    ),
    h("div", { class: "card" }, h("label", {}, "回答モデル "), modelSel),
    // Pro ライセンス（収益化が設定済みのときだけ表示。既定=未設定では何も出ない）。
    ...(monetizationConfigured() ? [h("h2", {}, "Pro ライセンス"), proLicenseCard()] : []),
    // 応援・読みもの（橋渡し収益 17-B17/C11/C18/D3）。未設定の項目は各カードが null を返す。
    ...bridgeSection(),
    h("h2", {}, "データ"),
    backupCard(),
    ...(installPrompt
      ? [
          h(
            "div",
            { class: "card" },
            h("label", {}, "アプリとして使う "),
            h(
              "button",
              {
                class: "choice",
                type: "button",
                onclick: () => {
                  // prompt() は1回しか使えない。使用後は null 化して再プロンプトを防ぐ。
                  void installPrompt?.prompt();
                  setInstallPrompt(null);
                },
              },
              "📲 ホーム画面に追加（1タップで起動）",
            ),
          ),
        ]
      : []),
    h(
      "div",
      { class: "card" },
      h("label", {}, "チュートリアル "),
      h(
        "button",
        {
          class: "choice",
          type: "button",
          onclick: () => {
            // 初回オンボーディングを再表示できるようにする（学習タブで再表示される）。
            storage.setItem("denken:onboarded", "");
            switchView("practice");
          },
        },
        "🔄 チュートリアルをもう一度見る",
      ),
      h("div", { class: "muted" }, "初回の目標設定ガイドを学習タブで再表示します（学習記録は消えません）。"),
    ),
    h(
      "button",
      { class: "choice", type: "button", style: "border-color:var(--ng);color:var(--ng)", onclick: resetData },
      "学習記録をリセット",
    ),
  );
}

/**
 * 応援・読みもの・計測・法的情報のセクション（橋渡し収益）。
 * 各カードは config 未設定なら null。1枚もなければ見出しごと出さない（既定=何も変わらない）。
 * 収益化 or アフィリエイトが動いているときはオプトアウト・計測・法的情報も添える。
 */
function bridgeSection(): HTMLElement[] {
  const cards = [supportCard(), creatorContentCard(), inviteCard()].filter((c): c is HTMLElement => c !== null);
  const anyRevenue = monetizationConfigured() || affiliateActive() || cards.length > 0;
  if (!anyRevenue) return [];
  return [h("h2", {}, "応援・読みもの"), ...cards, nudgeOptOutCard(), ledgerExportCard(), legalCard()];
}

/**
 * Pro ライセンスカード: 現在のプラン表示・キー入力・購入導線・解除。
 * 検証は端末内（WebCrypto）で完結し、キーはこの端末の localStorage にのみ保存される
 * （バックアップの書き出しには含まれる: 機種変更で失わないため）。
 */
function proLicenseCard(): HTMLElement {
  const info = proInfo();
  const status = proUnlocked()
    ? `✅ Pro 有効${info?.exp ? `（${info.exp} まで）` : "（買い切り）"}${info?.sub ? ` ・ ${info.sub}` : ""}`
    : `無料プラン（演習 1日${MONETIZATION.freeDailyLimit}問まで。模試・スキルドリルは Pro）`;
  const keyInput = h("input", {
    type: "text",
    placeholder: "DENKEN1.xxxx.xxxx",
    autocomplete: "off",
    spellcheck: "false",
    "aria-label": "Pro ライセンスキー",
  }) as HTMLInputElement;
  const applyBtn = h(
    "button",
    {
      class: "primary",
      type: "button",
      onclick: () => {
        applyBtn.disabled = true;
        void applyLicenseKey(storage, keyInput.value)
          .then((res) => {
            if (res.ok) {
              showToast("✅ Pro を有効化しました。ありがとうございます！", "OK", () => {});
              switchView("settings"); // ステータス表示とゲートを最新化
            } else {
              showToast(`⚠️ ${res.reason}`, "OK", () => {});
            }
          })
          .catch(() => {
            // applyLicenseKey は原則 reject しないが、想定外でも汎用トーストに流さず理由を示す。
            showToast("⚠️ ライセンスの検証に失敗しました。もう一度お試しください", "OK", () => {});
          })
          .finally(() => {
            applyBtn.disabled = false;
          });
      },
    },
    "キーを適用",
  ) as HTMLButtonElement;
  const card = h(
    "div",
    { class: "card" },
    h("label", {}, "プラン "),
    h("div", {}, status),
    h(
      "div",
      { class: "muted" },
      "Pro は開発継続を支える応援プランです。学習記録・復習・公式集はずっと無料で使えます。",
    ),
  );
  if (!proUnlocked()) {
    const buy = purchaseButton("choice", "settings");
    if (buy) card.append(buy);
    card.append(keyInput, applyBtn);
  } else {
    card.append(
      h(
        "button",
        {
          class: "choice",
          type: "button",
          onclick: () => {
            if (!window.confirm("Pro ライセンスをこの端末から削除します。よろしいですか？（キーは再入力できます）"))
              return;
            clearLicense(storage);
            showToast("ライセンスを削除しました", "OK", () => {});
            switchView("settings");
          },
        },
        "ライセンスを削除",
      ),
    );
  }
  return card;
}

/** おやすみ予約: 休む勇気をストリークの罰にしない（健全性）。予約できるのは「今日学習済み」のときの明日だけ。 */
function restDayCard(): HTMLElement {
  const state = loadFreezeState(storage);
  const todayIdx = dayIndexOf(Date.now());
  const reserved = state.restDays.includes(todayIdx + 1);
  const can = canReserveRest(state, studiedDays(progress.logs()), todayIdx);
  const btn = h(
    "button",
    {
      class: "choice",
      type: "button",
      onclick: () => {
        saveFreezeState(storage, toggleRestReservation(loadFreezeState(storage), dayIndexOf(Date.now())));
        renderHeader();
        switchView("settings");
      },
    },
    reserved ? "😴 明日はおやすみ予約済み（タップで取消）" : "😴 明日をおやすみ予約（🔥は維持）",
  ) as HTMLButtonElement;
  if (!reserved && !can) btn.disabled = true;
  return h(
    "div",
    { class: "card" },
    h("label", {}, "おやすみ予約 "),
    btn,
    h(
      "div",
      { class: "muted" },
      "休むのも実力のうち。予約した日は学習しなくてもストリークが続きます。" +
        "予約できるのは「今日すでに学習した日」の明日だけ（連続のおやすみはできません）。",
    ),
  );
}

/** バックアップ: localStorage 単一保存の単一障害点対策（書き出し/読み込み）。 */
function backupCard(): HTMLElement {
  const exportBtn = h(
    "button",
    {
      class: "choice",
      type: "button",
      onclick: () => {
        const json = exportBackup(storage);
        const a = document.createElement("a");
        const date = new Date().toISOString().slice(0, 10);
        a.href = URL.createObjectURL(new Blob([json], { type: "application/json" }));
        a.download = `denken-backup-${date}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
      },
    },
    "⬇ 学習データを書き出す（バックアップ）",
  );
  const fileInput = h("input", { type: "file", accept: "application/json,.json", hidden: true }) as HTMLInputElement;
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    fileInput.value = "";
    if (!file) return;
    if (!window.confirm("バックアップを読み込みます。現在の学習データは上書きされます。よろしいですか？")) return;
    let result: ReturnType<typeof importBackup>;
    try {
      result = importBackup(storage, await file.text());
    } catch {
      // file.text() の失敗等。async change ハンドラ内の未処理 rejection にせず、その場で通知する。
      showToast("⚠️ 復元できませんでした: ファイルを読み取れませんでした", "OK", () => {});
      return;
    }
    if (result.ok) {
      // 復元したライセンスを即時反映する（「再読込」を押さなくても Pro 状態が正しくなる）。
      // 逆方向（ライセンスを含まない/無効なバックアップ）でもキャッシュと保存値の乖離を防ぐ。
      await initEntitlements(storage).catch(() => false);
      showToast(`✅ ${result.restoredKeys.length} 項目を復元しました`, "再読込", () => location.reload());
    } else {
      showToast(`⚠️ 復元できませんでした: ${result.reason}`, "OK", () => {});
    }
  });
  const importBtn = h(
    "button",
    { class: "choice", type: "button", onclick: () => fileInput.click() },
    "⬆ バックアップを読み込む（復元）",
  );
  return h(
    "div",
    { class: "card" },
    h("label", {}, "バックアップ "),
    h(
      "div",
      { class: "muted" },
      "学習記録はこの端末にのみ保存されます。ブラウザのデータ削除や機種変更で消えるため、定期的に書き出してください（APIキーは含まれません）。",
    ),
    exportBtn,
    importBtn,
    fileInput,
  );
}

function resetData(): void {
  if (!window.confirm("学習記録（解答ログ・記憶状態・XP/実績・お守り）を全て削除します。よろしいですか？")) return;
  // XP/レベル/実績はログから導出するため、ログのリセットと整合する付随キーも初期化する。
  // 書き込みが quota/プライベートモードで throw しても半壊リセットにならないよう、
  // 各 setItem を個別の try で保護し、失敗キーを集計してから結果を通知する。
  const entries: ReadonlyArray<readonly [string, string]> = [
    ["denken:cards", "{}"],
    // 納得チェックの記憶状態も演習の cards と対称に消す（バックアップ対象に含めた以上、
    // リセットでも残すと「消したはずの採点結果が復習タブに出続ける」不整合になる）。
    [WHY_CARD_KEY, "{}"],
    ["denken:logs", "[]"],
    ["denken:freeze", ""],
    ["denken:badges", "[]"],
    [SEEN_LEVEL_KEY, "1"],
    [SEEN_STREAK_MILESTONE_KEY, "0"],
    ["denken:onboarded", ""], // オンボーディングを再表示できるようにする（web#31）
  ];
  const failed: string[] = [];
  for (const [key, value] of entries) {
    try {
      storage.setItem(key, value);
    } catch {
      failed.push(key);
    }
  }
  if (failed.length > 0) {
    showToast("⚠️ 一部のデータを削除できませんでした。端末の空き容量を確認してください", "OK", () => {});
  }
  switchView("dashboard");
}
