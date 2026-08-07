/**
 * app.ts — 電験二種 学習OS（オフライン PWA）のエントリポイント。
 * タブ型 SPA: 学習 / 復習 / 模試 / 質問 / 進捗 / 公式 / 設定。
 * 各画面の実装は web/src/views/** へ分割（G6）。
 */

import { reloadProblems } from "./app-init.js";
import { captureFirstTouch } from "./bridge.js";
import { initEntitlements } from "./entitlements.js";
import { onKeydown } from "./keyboard.js";
import { runMigrations } from "./migrate.js";
import { requestPersistence } from "./persistence.js";
import { getTheme } from "./settings.js";
import type { InstallPromptEvent } from "./state/app.js";
import { applyFontScale, applyTheme, loadFailed, setInstallPrompt, storage } from "./state/app.js";
import { showToast } from "./ui/toast.js";
import { runFreezeBridge } from "./views/practice.js";
import { initRouting, renderHeader, renderNav, updateNetStatus } from "./views/router.js";

/** 読込中のスケルトン（problems.json 取得まで）。 */
function renderSkeleton(): void {
  const view = document.getElementById("view");
  if (view) {
    view.innerHTML =
      '<div class="skel-line skeleton w40"></div><div class="skel-line skeleton big"></div>' +
      '<div class="skel-line skeleton"></div><div class="skel-line skeleton w60"></div>' +
      '<div class="skel-line skeleton"></div><div class="skel-line skeleton"></div>';
  }
}

/** Service Worker 登録＋更新検知（新版があればトーストで再読込を案内）。 */
function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker
    .register("./sw.js")
    .then((reg) => {
      reg.addEventListener("updatefound", () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener("statechange", () => {
          // 既存コントローラがある状態で新版が installed = 更新あり。
          if (sw.state === "installed" && navigator.serviceWorker.controller) {
            showToast("新しいバージョンがあります", "更新", () => location.reload());
          }
        });
      });
    })
    .catch(() => {});
}

async function main(): Promise<void> {
  // localStorage スキーマのマイグレーション（現状 no-op。版の記録＋将来の足場）。
  // 描画前に実行し、以降のコードが新スキーマ前提で動けるようにする。
  runMigrations(storage);
  // 流入ファーストタッチ（17-C12）: 起動 URL の UTM を1回だけ端末内に記録し、
  // 以後の再シェアに混入しないよう URL から UTM を除去する（外部送信はしない）。
  try {
    if (captureFirstTouch(storage, location.href)) {
      const clean = new URL(location.href);
      for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
        clean.searchParams.delete(k);
      }
      history.replaceState(history.state, "", clean.toString());
    }
  } catch {
    // 記録・URL 清掃は補助機能。失敗しても起動は続行する。
  }
  // フリーミアム: 保存済み Pro ライセンスの再検証を先に開始する（収益化未設定なら即 no-op）。
  // スケルトン描画やイベント登録を WebCrypto 検証で待たせないよう、await は
  // 初回 render を行う reloadProblems の直前まで遅らせる（検証失敗でも無料プランで続行）。
  const entitlementsReady = initEntitlements(storage).catch(() => false);
  applyTheme();
  applyFontScale();
  // system 設定時は OS のテーマ変更に追従。
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => {
    if (getTheme(storage) === "system") applyTheme();
  });
  // ストリークお守り: 欠席日があれば自動で肩代わりして連続を守る。
  // 起動時に加え、タブを開きっぱなしで日をまたぐ PWA 利用に備えて再表示時にも確認する。
  runFreezeBridge();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      runFreezeBridge();
      renderHeader();
    }
  });
  // A2HS: ブラウザのインストール提案を横取りして、価値実感後（ストリーク3日）に自分のタイミングで出す。
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    setInstallPrompt(e as InstallPromptEvent);
  });
  window.addEventListener("appinstalled", () => {
    setInstallPrompt(null);
  });
  // 想定外の実行時エラーでも「壊れた」と思わせない（学習記録の安全を伝える。1セッション1回）。
  // グローバルエラートーストは 8 秒で自動消滅（I-060）。
  let errorToastShown = false;
  const onGlobalError = () => {
    if (errorToastShown) return;
    errorToastShown = true;
    showToast("⚠️ 問題が発生しました。学習記録は安全です", "再読込", () => location.reload(), 8000);
  };
  window.addEventListener("error", onGlobalError);
  window.addEventListener("unhandledrejection", onGlobalError);
  // II-5: 履歴/ハッシュルーティングを初期化（初期 hash を尊重し戻る/進むに対応）。
  //   renderNav の前に呼び、初期 view を hash から確定させる。
  initRouting();
  renderNav();
  renderSkeleton();
  // ゲート判定（模試ロック等）が初回描画に正しく効くよう、render 前にプランを確定させる。
  await entitlementsReady;
  // 学習データの自動破棄を防ぐ（科目合格制で最長3年使うため）。
  // 非対応・拒否でも学習は続くので待たない・失敗も無視する。
  void requestPersistence();
  await reloadProblems();
  document.addEventListener("keydown", onKeydown);
  // オフライン状態の変化をヘッダに反映（完全オフライン動作だが状態は明示する）。
  // II-165: オンライン復帰時に自動リトライ（loadFailed のときだけ再取得）。
  window.addEventListener("online", () => {
    updateNetStatus();
    // loadFailed 状態のときだけ自動リトライ（二重ロードフラグはapp-init側で管理）。
    if (loadFailed) void reloadProblems();
  });
  window.addEventListener("offline", updateNetStatus);
  registerServiceWorker();
}

void main();
