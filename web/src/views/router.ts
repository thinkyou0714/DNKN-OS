/**
 * views/router.ts — TABS定義・ヘッダ・ナビ・ルーティング・エラーバウンダリ。
 */

import { BACKUP_KEYS } from "../backup.js";
import { featureLocked } from "../entitlements.js";
import { recoveryView } from "../errors.js";
import { coveredDays, streakBreakdown, studiedDays } from "../freeze.js";
import { buildStudyPlan } from "../plan.js";
import { MISTAKE_REVIEW_CAP } from "../problem-cards.js";
import { dayIndexOf } from "../quests.js";
import { offlineLabel } from "../retention.js";
import { EXAM_FILTER_LABEL, getDailyGoal, getExamDate, getExamFilter, getReviewCap } from "../settings.js";
import { problems, progress, setView, storage, view, visibleProblemIdSet, visibleTopicSet } from "../state/app.js";
import { exam as examInProgress } from "../state/exam.js";
import { estimateStorageKb, STORAGE_WARN_KB } from "../store.js";
import { $, h } from "../ui/dom.js";
import { showToast } from "../ui/toast.js";
import { renderChat } from "./chat.js";
import { renderDashboard } from "./dashboard.js";
import { clearExamTimer, renderExam } from "./exam.js";
import { renderFormulas } from "./formulas.js";
import { currentLevel, freezeInfo, renderPractice } from "./practice.js";
import { renderReview } from "./review.js";
import { renderSettings } from "./settings.js";

/** lastPersistErrorを通知済みかどうか（セッション内1回だけ）。II-166 */
let _persistErrNotified = false;

export const TABS: ReadonlyArray<readonly [string, string, string]> = [
  ["practice", "学習", "✏️"],
  ["review", "復習", "🔁"],
  ["exam", "模試", "📝"],
  ["chat", "質問", "💬"],
  ["dashboard", "進捗", "📊"],
  ["formulas", "資料", "📐"],
  ["settings", "設定", "⚙️"],
];

export function renderHeader(): void {
  const lv = currentLevel();
  $("xp").textContent = `Lv.${lv.level} ⚡${lv.totalXp.toLocaleString("ja-JP")}`;
  $("xp").setAttribute("title", `${lv.title} ・ 次のレベルまで ${lv.xpNeed - lv.xpInto} XP`);
  const fi = freezeInfo();
  // ストリークの内訳（学習日 vs お守り/おやすみで肩代わりした日）を区別して見せる（#62）。
  const bd = streakBreakdown(studiedDays(progress.logs()), coveredDays(fi.state), dayIndexOf(Date.now()));
  $("streak").textContent =
    `🔥 ${fi.streak}日${bd.coveredDays > 0 ? `（学習${bd.studiedDays}）` : ""}` +
    `${fi.state.count > 0 ? ` 🧊×${fi.state.count}` : ""}`;
  const breakdownText = bd.coveredDays > 0 ? `（うち学習${bd.studiedDays}日・お守り/おやすみ${bd.coveredDays}日）` : "";
  $("streak").setAttribute(
    "title",
    fi.state.count > 0
      ? `連続${fi.streak}日${breakdownText} ・ お守り${fi.state.count}個（欠席日を自動カバー）`
      : `連続${fi.streak}日${breakdownText}`,
  );
  const days = buildStudyPlan({
    examDateIso: getExamDate(storage),
    totalProblems: problems.length,
    todayCount: 0,
    dailyGoal: getDailyGoal(storage),
  }).daysLeft;
  $("countdown").textContent = `試験まで ${days} 日`;
  // 出題を絞っているときだけ、今どの区分を学習中かを常時見えるようにする。
  const ef = getExamFilter(storage);
  const efEl = document.getElementById("examfilter");
  if (efEl) {
    efEl.textContent = EXAM_FILTER_LABEL[ef];
    efEl.hidden = ef === "all";
  }
  updateNetStatus();
}

/** オフライン表示の更新（オンライン時は隠す）。完全オフライン動作なので障害ではなく状態通知。 */
export function updateNetStatus(): void {
  const el = document.getElementById("netstatus");
  if (!el) return;
  const label = offlineLabel(navigator.onLine);
  el.textContent = label;
  el.hidden = label === "";
}

export function renderNav(): void {
  const nav = $("nav");
  nav.innerHTML = "";
  // 復習バッジは「今日出す分」（上限でバッチ化）の件数に合わせ、過大表示で圧迫しない。
  // 完了した復習は FSRS が due から外すため、ここでは上限キャップのみ適用する。
  // II-6: dueCountCached で全 FSRS カードの revive を毎描画で繰り返さない（メモ化）。
  // バッジは件数のみ必要なので、due 件数（メモ化）を上限でクランプして算出する
  //   （dailyReviewBatch(topics, cap).batch.length と一致: alreadyDoneToday=0 のため min(count, cap)）。
  const cap = Math.max(1, Math.floor(getReviewCap(storage)));
  // バッジも復習キューと同じ基準にする（区分外 topic を数えない）。
  const visible = visibleTopicSet();
  const topicDue = Math.min(progress.dueTopics().filter((t) => visible.has(t)).length, cap);
  // 解き直し（問題単位カード）は topic とは別枠なので加算する。
  // これを入れないと「バッジ0なのに開くと解き直しがある」というズレが出る。
  const visibleIds = visibleProblemIdSet();
  const mistakeDue = Math.min(progress.dueProblemIds().filter((id) => visibleIds.has(id)).length, MISTAKE_REVIEW_CAP);
  const dueCount = topicDue + mistakeDue;
  for (const [id, label, icon] of TABS) {
    const due = id === "review" ? dueCount : 0;
    const selected = id === view;
    const btn = h(
      "button",
      {
        type: "button",
        role: "tab",
        id: `tab-${id}`,
        "aria-label": label,
        "aria-selected": selected ? "true" : "false",
        tabindex: selected ? "0" : "-1",
        onclick: () => switchView(id),
      },
      h("span", { class: "ti", "aria-hidden": "true" }, icon),
      h("span", { class: "tl" }, label),
    );
    if (due > 0) btn.append(h("span", { class: "tb" }, String(due)));
    if (selected) btn.setAttribute("aria-current", "true");
    nav.appendChild(btn);
  }
}

/** 既知のタブ ID か（不明な hash は practice へフォールバックする）。 */
function isKnownView(id: string): boolean {
  return TABS.some(([tabId]) => tabId === id);
}

/**
 * タブを切り替える。
 * @param id 遷移先タブ ID
 * @param opts.fromHistory popstate/hashchange 起点のとき true（その場合は history を書き換えない）
 */
export function switchView(id: string, opts: { fromHistory?: boolean } = {}): void {
  // タイマーリーク解消（II-156）: view離脱時に必ずclearInterval。clearExamTimerで一元管理。
  clearExamTimer();
  setView(id);
  // II-5: アクティブ view を location.hash に同期し、ハードウェア戻るで前のタブへ戻れるようにする。
  //   履歴起点（popstate/hashchange）のときは二重 push を避けるため書き換えない。
  if (!opts.fromHistory) {
    try {
      const target = `#${id}`;
      if (location.hash !== target) history.pushState({ view: id }, "", target);
    } catch {
      // file:// 等で history API が使えなくても遷移自体は続行する。
    }
  }
  renderNav();
  // II-2: タブ切替時はスクロール位置を先頭へ戻す（前タブの途中位置を引き継がない）。
  try {
    window.scrollTo(0, 0);
  } catch {
    // 環境によって未実装でも無害。
  }
  // II-1: ユーザー操作起点のタブ切替では新しい view の見出し（or #view）へフォーカスを移す。
  render({ focus: true });
}

export function render(opts: { focus?: boolean } = {}): void {
  const root = $("view");
  // replaceChildren() は innerHTML="" より冪等で、既存ノードのGCが効きやすい（II-157）。
  root.replaceChildren();
  // aria-busy: 描画中をスクリーンリーダーに伝える（II-157）。
  root.setAttribute("aria-busy", "true");
  // lastPersistError 通知（セッション内1回だけ）（II-166）。
  if (!_persistErrNotified && progress.lastPersistError) {
    _persistErrNotified = true;
    showToast("⚠️ 前回の保存に失敗しました。端末の空き容量を確認してください", "OK", () => {});
  }
  // II-14: ヘッダ/お守りブリッジは独立した try/catch に閉じ込める。
  //   ここで例外が出ても view 描画は続行し、1つのヘッダ失敗で全タブが白画面化したり
  //   グローバルエラートーストがループするのを防ぐ。
  try {
    // 開きっぱなしのタブ（visibilitychange が発火しない常時表示）で日をまたいだ場合に備え、
    // 描画のたびに欠席日のお守りカバーを確認する（冪等・通常は何もしない）。
    runFreezeBridge();
  } catch (err) {
    console.error("[render] runFreezeBridge でエラー:", err);
  }
  try {
    renderHeader();
  } catch (err) {
    console.error("[render] renderHeader でエラー:", err);
  }
  try {
    // per-viewエラー境界（II-162）: 各タブの描画例外はそのタブ内でrecovery表示。
    // 親render はルーティングに専念し、1タブの例外が全体を白画面にしない。
    if (view === "practice") renderViewSafe(root, "practice", () => renderPractice(root));
    else if (view === "review") renderViewSafe(root, "review", () => renderReview(root));
    else if (view === "exam") renderViewSafe(root, "exam", () => renderExamGated(root));
    else if (view === "chat") renderViewSafe(root, "chat", () => renderChat(root));
    else if (view === "dashboard") renderViewSafe(root, "dashboard", () => renderDashboard(root));
    else if (view === "formulas") renderViewSafe(root, "formulas", () => renderFormulas(root));
    else if (view === "settings") renderViewSafe(root, "settings", () => renderSettings(root));
  } catch (err) {
    // ルーティング自体の例外（ヘッダ等）は全体バウンダリでキャッチ。
    renderErrorBoundary(root, err);
  } finally {
    root.setAttribute("aria-busy", "false");
  }
  // II-1: ユーザー操作起点の切替のみ、新しい view の見出し（or #view）へフォーカスを移す。
  //   初回ロードでは focus を渡さない（強制スクロール/読み上げが煩わしいため無害化）。
  if (opts.focus) focusViewHeading(root);
  // II-7: 容量逼迫の事前警告（スロットル）。export を促す（描画のたびに軽くチェック）。
  maybeWarnStorage();
}

/** 新しい view の見出し(h2)へフォーカスを移す。h2 が無ければ #view 自体へ。 */
function focusViewHeading(root: HTMLElement): void {
  try {
    const h2 = root.querySelector("h2");
    const target = (h2 as HTMLElement | null) ?? root;
    // h2 はフォーカス不可なので tabindex=-1 を付与してプログラム的にフォーカスする。
    if (target === h2 && !target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
  } catch {
    // フォーカス移動は補助的。失敗しても描画は完了している。
  }
}

/**
 * 模試タブの Pro ゲート（フリーミアム）。収益化が未設定（既定）のうちは常に素通しで、
 * 挙動は従来と完全に同じ。paywall の import は循環回避のため遅延にせず、
 * views/paywall.ts 側が router の switchView を参照する（ESM の相互参照で解決可能）。
 */
function renderExamGated(root: HTMLElement): void {
  // 進行中の模試は必ず再開させる（採点・保存の機会を奪わない）。開始後に
  // ロック状態へ変わっても（設定でライセンス削除→再入力の途中など）、
  // 開始済みセッションの完了は妨げない。
  if (examInProgress !== null) {
    renderExam(root);
    return;
  }
  if (featureLocked()) {
    root.append(
      h("h2", {}, "模試"),
      paywallCard({
        icon: "📝",
        title: "模試（本番再現・年度別）は Pro 機能です",
        description:
          "時間制限つき模試・科目別合格判定・年度別通し模試が解放されます。" +
          "学習タブ・復習・公式集は無料のままずっと使えます。",
      }),
    );
    return;
  }
  renderExam(root);
}

/** per-viewエラー境界（II-162）: 1タブの描画失敗を該当タブ内に閉じ込める。 */
function renderViewSafe(root: HTMLElement, viewId: string, fn: () => void): void {
  try {
    fn();
  } catch (err) {
    root.replaceChildren();
    renderErrorBoundary(root, err);
    console.error(`[render] ${viewId} タブの描画でエラー:`, err);
  }
}

/** 描画例外時の復旧画面。 */
export function renderErrorBoundary(root: HTMLElement, err: unknown): void {
  const rv = recoveryView(err);
  root.innerHTML = "";
  root.append(
    h(
      "div",
      { class: "card errbound", role: "alert" },
      h("strong", {}, `⚠️ ${rv.title}`),
      h("p", {}, rv.reassurance),
      h("button", { class: "primary", type: "button", onclick: () => location.reload() }, "再読み込み"),
      h(
        "details",
        {},
        h("summary", {}, "エラーの詳細"),
        (() => {
          const pre = h("pre", { class: "errdetail" });
          pre.textContent = rv.detail; // textContent で安全に（XSS 回避）
          return pre;
        })(),
      ),
    ),
  );
}

// ---- II-7: 容量逼迫の事前警告（スロットル） ----

/** 直近のチェック時刻（throttle 用）。 */
let _lastQuotaCheckMs = 0;
/** 警告トーストは1セッション1回だけ（しつこくしない）。 */
let _quotaWarned = false;
/** チェック間隔（ms）。描画ごとに毎回 estimate するのは無駄なので間引く。 */
const QUOTA_CHECK_INTERVAL_MS = 60_000;

/**
 * localStorage の推定使用量が閾値を超えていたら、export を促すトーストを1回だけ出す。
 * 描画のたびに呼ばれるが、60秒に1回だけ実測し（throttle）、超過時のみ通知する。
 */
function maybeWarnStorage(): void {
  if (_quotaWarned) return;
  const now = Date.now();
  if (now - _lastQuotaCheckMs < QUOTA_CHECK_INTERVAL_MS) return;
  _lastQuotaCheckMs = now;
  try {
    const kb = estimateStorageKb(storage, BACKUP_KEYS);
    if (kb >= STORAGE_WARN_KB) {
      _quotaWarned = true;
      showToast(
        "⚠️ 保存容量が増えています。設定タブからデータの書き出し（バックアップ）をおすすめします",
        "OK",
        () => {},
        8000,
      );
    }
  } catch {
    // 推定は補助的。失敗しても学習は継続する。
  }
}

// ---- II-5: 履歴/ハッシュルーティング ----

/** 現在の location.hash からタブ ID を取り出す（不明・空は practice）。 */
function viewFromHash(): string {
  const id = location.hash.replace(/^#/, "");
  return isKnownView(id) ? id : "practice";
}

/** スキップリンク（href="#view"）由来の hash は経路ではないので無視する。 */
function isRouteHash(): boolean {
  const id = location.hash.replace(/^#/, "");
  return id !== "view";
}

/**
 * 履歴ルーティングを初期化する。初期 hash を尊重し、戻る/進む（popstate）や
 * hashchange で対応するタブへ切り替える。app.ts の起動時に1回呼ぶ。
 */
export function initRouting(): void {
  // 戻る/進む: 履歴起点なので switchView は history を書き換えない。
  window.addEventListener("popstate", () => {
    if (!isRouteHash()) return; // スキップリンクの #view は無視。
    const id = viewFromHash();
    if (id !== view) switchView(id, { fromHistory: true });
  });
  // 手動の hash 変更（アドレスバー編集等）にも追従する。
  window.addEventListener("hashchange", () => {
    if (!isRouteHash()) return; // スキップリンクの #view は無視。
    const id = viewFromHash();
    if (id !== view) switchView(id, { fromHistory: true });
  });
  // 初期 hash を尊重（共有 URL からの直接起動など）。既定は practice。
  const initial = viewFromHash();
  setView(initial);
  // 初期状態を replaceState で履歴に固定（戻るで空 hash 状態に落ちないように）。
  try {
    history.replaceState({ view: initial }, "", `#${initial}`);
  } catch {
    // history 不可環境でも以降の描画は通常どおり。
  }
}

// runFreezeBridge は practice.ts からインポート
import { paywallCard } from "./paywall.js";
import { runFreezeBridge } from "./practice.js";
