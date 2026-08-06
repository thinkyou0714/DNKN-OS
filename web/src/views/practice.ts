/**
 * views/practice.ts — 学習タブの描画・状態ヘルパー・カード群。
 * 採点処理（gradeObjective / revealDescriptive / ratingBar / finalize）は
 * views/practice-grade.ts へ移設。
 * onboardingCard / mascotCard / questsCard / weeklyQuestsCard / sessionSummaryCard /
 * renderPractice / nextQuestion / renderAnswerInputs / refreshPracticeCards
 */
import type { Problem, Subject } from "../../../lib/engine/schema.js";
import { reloadProblems } from "../app-init.js";
import { canShowNudge, markNudgeShown, recordClick, recordShown } from "../bridge.js";
import { BRIDGE } from "../bridge-config.js";
import { featureLocked, proUnlocked, remainingFreeToday } from "../entitlements.js";
import {
  bridgeWithFreezes,
  coveredDays,
  type FreezeState,
  loadFreezeState,
  saveFreezeState,
  streakWithFreezes,
  studiedDays,
} from "../freeze.js";
import { MASCOT_NAME, mascotHome, mascotSvg, mascotTip, tierForLevel } from "../mascot.js";
import { formatMath } from "../mathfmt.js";
import { MONETIZATION, monetizationConfigured } from "../monetization-config.js";
import {
  dailyQuests,
  dayIndexOf,
  logsOfDay,
  logsOfWeek,
  QUEST_CLEAR_BONUS_XP,
  questStatuses,
  WEEKLY_CLEAR_BONUS_XP,
  weekIndexOf,
  weeklyQuestStatuses,
  weeklyQuests,
} from "../quests.js";
import { dailyReviewBatch, effectiveReviewCap, JST_OFFSET_MS, streakStatus } from "../retention.js";
import { missedProblemIds, pickNextProblem } from "../select.js";
import {
  getDailyGoal,
  getExamDate,
  getMascotEnabled,
  getReviewCap,
  isOnboarded,
  setDailyGoal,
  setExamDate,
  setOnboarded,
} from "../settings.js";
import { loadFailed, problems, progress, storage, view } from "../state/app.js";
import { practice, pushRecentTopic, takeDueRequeue, todayCount, weakTopics } from "../state/practice.js";
import { SEEN_LEVEL_KEY, SEEN_STREAK_MILESTONE_KEY } from "../storage-keys.js";
import { $, h, safeHtml } from "../ui/dom.js";
import { showToast } from "../ui/toast.js";
import { bar, difficultyStars, draftBadge, emptyState, figureNode, svgNode } from "../ui/widgets.js";
import { levelInfo, QUEST_BOOST_MULT, totalXp, xpByDay } from "../xp.js";
import { drillLauncherCard } from "./drills.js";
import { paywallCard } from "./paywall.js";
import { renderHeader } from "./router.js";

// re-export todayCount for other views
export { todayCount } from "../state/practice.js";
export type { FreezeState };

/** 現在のレベル情報（XPは解答ログから完全導出＝保存キー不要）。 */
export function currentLevel() {
  return levelInfo(totalXp(progress.logs()));
}

/** お守り・おやすみ予約込みの実効ストリークと手持ち状態。 */
export function freezeInfo(): { state: FreezeState; streak: number } {
  const state = loadFreezeState(storage);
  const streak = streakWithFreezes(studiedDays(progress.logs()), coveredDays(state), dayIndexOf(Date.now()));
  return { state, streak };
}

/** 学習日扱いにする日の集合（お守り消費日＋おやすみ予約日。streakStatus に渡す）。 */
export function usedFreezeDays(): Set<number> {
  return new Set(coveredDays(loadFreezeState(storage)));
}

/** 欠席日をお守りで自動カバーする（冪等。カバーが発生したときだけ通知）。 */
export function runFreezeBridge(): void {
  const fz = loadFreezeState(storage);
  const bridged = bridgeWithFreezes(fz, studiedDays(progress.logs()), dayIndexOf(Date.now()));
  if (bridged.bridgedDays.length > 0) {
    saveFreezeState(storage, bridged.state);
    showToast(`🧊 お守りが欠席 ${bridged.bridgedDays.length} 日分をカバー！ストリーク継続中`, "OK", () => {});
  }
}

/** 祝賀済みのレベル（模試中のレベルアップも取りこぼさないため保存で管理）。 */
export function seenLevel(): number {
  const n = Number(storage.getItem(SEEN_LEVEL_KEY));
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

/** 祝賛済みのストリーク大台（30/50/100…のスペシャル演出を1回だけにする）。 */
export function seenStreakMilestone(): number {
  const n = Number(storage.getItem(SEEN_STREAK_MILESTONE_KEY));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** まめ知識の表示位置（セッション内で順繰り。日替わりの開始位置で毎日違う話から始まる）。 */
let tipIndex = -1;

/** 今日のクエストカード（3つの小目標＋全達成ボーナス表示）。 */
export function questsCard(): HTMLElement {
  const todayIdx = dayIndexOf(Date.now());
  const statuses = questStatuses(dailyQuests(todayIdx), logsOfDay(progress.logs(), todayIdx));
  const allDone = statuses.every((s) => s.done);
  const card = h(
    "div",
    { class: "card quests" },
    h(
      "div",
      { class: "qhead" },
      h("strong", {}, "📋 今日のクエスト"),
      h(
        "span",
        { class: allDone ? "qbonus done" : "qbonus" },
        allDone
          ? `✅ 全達成 +${QUEST_CLEAR_BONUS_XP} XP ・ 正解XP×${QUEST_BOOST_MULT}中`
          : `全達成で +${QUEST_CLEAR_BONUS_XP} XP＆正解XP×${QUEST_BOOST_MULT}`,
      ),
    ),
  );
  for (const s of statuses) {
    const pct = Math.min(100, Math.round((s.value / s.quest.target) * 100));
    card.append(
      h(
        "div",
        { class: s.done ? "quest done" : "quest" },
        h("span", { class: "qi", "aria-hidden": "true" }, s.quest.icon),
        h("span", { class: "ql" }, s.quest.label),
        bar(pct, `${s.quest.label} の進捗`),
        h("span", { class: "qv" }, s.done ? "✅" : `${Math.min(s.value, s.quest.target)}/${s.quest.target}`),
      ),
    );
  }
  return card;
}

/** 今週のクエストカード（進捗タブ用。日次より大きな積み上げ目標）。 */
export function weeklyQuestsCard(): HTMLElement {
  const weekIdx = weekIndexOf(Date.now());
  // 週次クエストは「その週の全ログ」で進捗判定する。
  // 旧実装は logsOfDay(週番号) を渡しており、週番号は日番号と一致しないため常に空 → 0% 表示だった。
  const statuses = weeklyQuestStatuses(weeklyQuests(weekIdx), logsOfWeek(progress.logs(), weekIdx));
  const allDone = statuses.every((s) => s.done);
  const card = h(
    "div",
    { class: "card quests" },
    h(
      "div",
      { class: "qhead" },
      h("strong", {}, "🗓️ 今週のクエスト"),
      h(
        "span",
        { class: allDone ? "qbonus done" : "qbonus" },
        allDone ? `✅ 全達成 +${WEEKLY_CLEAR_BONUS_XP} XP` : `全達成で +${WEEKLY_CLEAR_BONUS_XP} XP`,
      ),
    ),
  );
  for (const s of statuses) {
    const pct = Math.min(100, Math.round((s.value / s.quest.target) * 100));
    card.append(
      h(
        "div",
        { class: s.done ? "quest done" : "quest" },
        h("span", { class: "qi", "aria-hidden": "true" }, s.quest.icon),
        h("span", { class: "ql" }, s.quest.label),
        bar(pct, `${s.quest.label} の進捗`),
        h("span", { class: "qv" }, s.done ? "✅" : `${Math.min(s.value, s.quest.target)}/${s.quest.target}`),
      ),
    );
  }
  return card;
}

/** 初回オンボーディング＝目標設定ウィザード（学習記録ゼロのときだけ。30秒で完了）。 */
function onboardingCard(root: HTMLElement): HTMLElement {
  const dateInput = h("input", { type: "date", value: getExamDate(storage) }) as HTMLInputElement;
  const goalSel = h("select", {}) as HTMLSelectElement;
  for (const [v, label] of [
    ["5", "ゆるく 5問/日"],
    ["10", "標準 10問/日"],
    ["20", "本気 20問/日"],
  ] as const) {
    goalSel.append(h("option", { value: v }, label));
  }
  goalSel.value = String(getDailyGoal(storage));
  if (goalSel.selectedIndex < 0) goalSel.value = "10";
  return h(
    "div",
    { class: "card onboard" },
    h(
      "div",
      { class: "obhead" },
      svgNode(mascotSvg("happy", 52), "span", { class: "mface" }),
      h("strong", {}, `👋 はじめまして！${MASCOT_NAME}だ。30秒だけ目標を決めよう`),
    ),
    h("div", { class: "wizrow" }, h("label", {}, "試験日"), dateInput),
    h("div", { class: "wizrow" }, h("label", {}, "1日の目標"), goalSel),
    h(
      "ol",
      {},
      h("li", {}, "問題を解く（選択肢はキーボード 1〜9 でも答えられます）"),
      h("li", {}, "正解したら「むずかしい/できた/余裕」で自己評価 → 復習間隔が自動調整"),
      h("li", {}, "毎日続けると 🔥ストリーク と ⚡XP が育ちます（7日ごとにお守りも）"),
    ),
    h(
      "button",
      {
        class: "primary",
        type: "button",
        onclick: (e) => {
          setExamDate(storage, dateInput.value);
          // 試験日逆算スケジューリングを新しい試験日で再構築（#34/#35）。
          progress.setExamDate(getExamDate(storage));
          setDailyGoal(storage, Number(goalSel.value));
          setOnboarded(storage);
          ((e.target as HTMLElement).closest(".onboard") as HTMLElement | null)?.remove();
          renderHeader();
          refreshPracticeCards();
          showToast("⚡ 目標を設定しました。さっそく1問いってみよう！", "OK", () => {});
          root.focus?.();
        },
      },
      "⚡ この目標ではじめる",
    ),
  );
}

/** マスコット「シンクウ」のカード（状況に応じた表情と一言で導線をつくる）。 */
function mascotCard(): HTMLElement {
  const fi = freezeInfo();
  const ss = streakStatus(progress.logs(), Date.now(), JST_OFFSET_MS, usedFreezeDays());
  const mv = mascotHome({
    streakState: ss.state,
    streakDays: fi.streak,
    todayCount: todayCount(),
    dailyGoal: getDailyGoal(storage),
    dueCount: dailyReviewBatch(progress.dueTopics(), effectiveReviewCap(getReviewCap(storage), progress.cramMode()))
      .batch.length,
    dayIndex: dayIndexOf(Date.now()),
  });
  // レベルが上がるとシンクウの装備も育つ（Lv10+ 認定バッジ / Lv20+ 安全ヘルメット / Lv40+ 主任技術者章）。
  const tier = tierForLevel(currentLevel().level);
  const bubble = h("div", { class: "mbubble" }, mv.message);
  const tipBtn = h(
    "button",
    {
      class: "chip tipbtn",
      type: "button",
      onclick: () => {
        tipIndex = tipIndex < 0 ? dayIndexOf(Date.now()) : tipIndex + 1;
        bubble.textContent = `💡 ${mascotTip(tipIndex)}`;
      },
    },
    "💡 まめ知識",
  );
  return h(
    "div",
    { class: "card mascot" },
    svgNode(mascotSvg(mv.mood, 64, tier), "div", { class: "mface" }),
    h("div", { class: "mcol" }, bubble, tipBtn),
  );
}

/** 日次目標を達成した瞬間に出す「今日のまとめ」。やり切った感＋明日への予告で締める。 */
export function sessionSummaryCard(): HTMLElement {
  const todayIdx = dayIndexOf(Date.now());
  const todayLogs = logsOfDay(progress.logs(), todayIdx);
  const correct = todayLogs.filter((l) => l.correct).length;
  const accuracy = todayLogs.length > 0 ? Math.round((correct / todayLogs.length) * 100) : 0;
  const xpToday = xpByDay(progress.logs(), 1, Date.now())[0] ?? 0;
  const fi = freezeInfo();
  // クエストは日番号から決定論で引けるため「明日の予告」が出せる（翌日の再訪フック）。
  const tomorrow = dailyQuests(todayIdx + 1);
  return h(
    "div",
    { class: "card summary" },
    h("strong", {}, "🎉 今日の目標達成！おつかれさま"),
    h(
      "div",
      { class: "mystats sumgrid" },
      ...(
        [
          [`${xpToday}`, "獲得XP"],
          [String(todayLogs.length), "解答"],
          [`${accuracy}%`, "正答率"],
          [`${fi.streak}日`, "連続"],
        ] as const
      ).map(([num, label]) =>
        h("div", { class: "stat" }, h("div", { class: "sn" }, num), h("div", { class: "sl" }, label)),
      ),
    ),
    h(
      "div",
      { class: "muted small" },
      `明日のクエスト予告: ${tomorrow.map((q) => `${q.icon}${q.label}`).join(" ／ ")}`,
    ),
    h("div", { class: "muted small" }, "このあと続けてもOK。でも、休むのも実力のうち！"),
    // 応援の1行（未設定・予算外・オプトアウト時は空文字＝何も出ない）。
    summarySupportLine() ?? "",
  );
}

/**
 * 目標達成まとめの応援1行（17-C4/B20）。感情ピーク×学習終端の1箇所だけ・
 * アプリ全体で1日1件の予算内・7日クールダウン・オプトアウトで停止。
 * 出す内容の優先度: Pro購入 → 応援（寄付） → note。どれも未設定なら null。
 */
export function summarySupportLine(): HTMLElement | null {
  const proAvailable = monetizationConfigured() && !proUnlocked() && MONETIZATION.purchaseUrl !== "";
  const target = proAvailable ? "pro" : BRIDGE.supportUrl !== "" ? "support" : BRIDGE.noteUrl !== "" ? "note" : null;
  if (target === null) return null;
  if (!canShowNudge(storage, "summary", { cooldownDays: 7 })) return null;
  markNudgeShown(storage, "summary");
  recordShown(storage, "summary", target);
  const url = target === "pro" ? MONETIZATION.purchaseUrl : target === "support" ? BRIDGE.supportUrl : BRIDGE.noteUrl;
  const label =
    target === "pro"
      ? "🔑 開発を応援する（Pro）→"
      : target === "support"
        ? "☕ 開発を応援する →"
        : "📖 今日の学びを深める（note）→";
  return h(
    "button",
    {
      class: "chip",
      type: "button",
      onclick: () => {
        recordClick(storage, "summary", target);
        window.open(url, "_blank", "noopener,noreferrer");
      },
    },
    label,
  );
}

/** 学習タブ先頭のマスコット/クエストを解答のたびに差し替える（全再描画せず入力を保つ）。 */
export function refreshPracticeCards(): void {
  if (view !== "practice") return;
  const root = $("view");
  root.querySelector(".mascot")?.replaceWith(mascotCard());
  root.querySelector(".quests")?.replaceWith(questsCard());
}

export function practicePool(): Problem[] {
  if (practice.pool) return practice.pool; // 復習/間違いノートからのドリル
  if (practice.subject === "all") return problems;
  return problems.filter((p) => p.subject === practice.subject);
}

const SUBJECTS: Subject[] = ["理論", "電力", "機械", "法規", "電力管理", "機械制御"];

/**
 * 直前モード（cram）バナー（#34/#35）。試験まで残りわずかのとき、分散学習から
 * 弱点の集中復習へ切り替えることを促す。store.cramMode() が真のときだけ出す。
 */
export function cramBanner(): HTMLElement | null {
  if (!progress.cramMode()) return null;
  return h(
    "div",
    { class: "card cram-banner" },
    h("strong", {}, "🔥 直前モード"),
    h("div", { class: "muted" }, "試験が近づいています。弱点・未習得の論点を集中的に復習しましょう。"),
  );
}

export function renderPractice(root: HTMLElement): void {
  // 未オンボーディングなら目標設定ウィザードを出す。設定タブの「もう一度見る」で
  // 既存ユーザー（ログあり）も再表示できるよう、ログ件数では絞らない（onboarded フラグのみで判定）。
  if (!isOnboarded(storage)) root.append(onboardingCard(root));
  const cram = cramBanner();
  if (cram) root.append(cram);
  if (getMascotEnabled(storage)) root.append(mascotCard());
  root.append(questsCard());
  const toolbar = h(
    "div",
    { class: "toolbar" },
    h("label", { for: "subj" }, "分野:"),
    (() => {
      const sel = h("select", {
        id: "subj",
        onchange: (e) => {
          practice.subject = (e.target as HTMLSelectElement).value as Subject | "all";
          practice.pool = null;
          nextQuestion(root);
        },
      }) as HTMLSelectElement;
      sel.append(h("option", { value: "all" }, "苦手優先（全分野）"));
      for (const s of SUBJECTS) sel.append(h("option", { value: s }, s));
      if (!practice.pool) sel.value = practice.subject;
      return sel;
    })(),
  );
  if (practice.pool) {
    toolbar.append(
      h("span", { class: "muted" }, "復習ドリル中"),
      h(
        "button",
        {
          class: "chip",
          type: "button",
          onclick: () => {
            practice.pool = null;
            nextQuestion(root);
          },
        },
        "解除",
      ),
    );
  }
  root.append(toolbar, h("div", { id: "q" }));
  nextQuestion(root);
  // スキルドリル起動カード（公式導出 / 電卓速算）。#q を題材ホストにする。
  // フリーミアム作動中はドリルを Pro ゲートに置き換える（既定=未設定では従来どおり）。
  // ただし #q に無料枠切れのペイウォールが出ているときは重ねない（同内容カード2枚の防止）。
  const qHost = root.querySelector("#q") as HTMLElement | null;
  if (qHost && qHost.querySelector(".paywall") === null) {
    root.append(
      featureLocked()
        ? paywallCard({
            icon: "🧠",
            title: "スキルドリル（公式導出・電卓速算）は Pro 機能です",
            description: "手順の並べ替えと速算トレーニングが解放されます。通常の演習は無料枠で続けられます。",
          })
        : drillLauncherCard(qHost),
    );
  }
}

export function nextQuestion(root: HTMLElement): void {
  const host = root.querySelector("#q") as HTMLElement | null;
  if (!host) return;
  const excludeId = practice.current?.id;
  // 出題の通し番号を進める（再出題タイミングの基準 #49）。
  practice.asked += 1;
  // まず再出題期限が来た「間違えた問題」を優先して出す（短期の想起練習 #49）。
  const pool = practicePool();
  const poolIds = new Set(pool.map((p) => p.id));
  let next = takeDueRequeue(practice.asked, excludeId);
  // 再出題対象が現在のプール（分野フィルタ）に無いならスキップして通常選択へ。
  if (next && !poolIds.has(next.id)) next = null;
  practice.currentFromRequeue = next !== null;
  // フリーミアム: 無料枠（1日 N 問）の対象は「学習タブの新しい問題」だけ。
  // 復習タブ発のドリル（practice.pool）と再出題（requeue＝解答済みの再想起）は
  // FSRS の継続ループを守るため無料のまま通す。既定（収益化未設定）では Infinity で常に許可。
  const freeLeft = remainingFreeToday(storage);
  if (next === null && !practice.pool && freeLeft <= 0) {
    practice.current = null;
    host.replaceChildren(
      paywallCard({
        icon: "✏️",
        title: "今日の無料枠を使い切りました",
        description:
          `無料プランで新しく解ける問題は1日${MONETIZATION.freeDailyLimit}問までです。明日また無料で続けられます。` +
          "Pro なら演習が無制限になり、模試・スキルドリルも解放されます。復習タブ（復習ドリル・間違いノート）は今日も無料で使えます。",
      }),
    );
    return;
  }
  // 通常選択: 弱点をインターリーブしつつ選ぶ（#50）。
  // 問題単位の弱点バイアス: 同じ topic 内では過去に間違えた問題を優先する（FSRS は topic 単位のまま）。
  next =
    next ??
    pickNextProblem(pool, {
      weakTopics: weakTopics(),
      recentTopics: practice.recentTopics,
      missedIds: missedProblemIds(progress.logs()),
      ...(excludeId !== undefined ? { excludeId } : {}),
    });
  practice.current = next;
  host.innerHTML = "";
  const p = practice.current;
  if (!p) {
    if (loadFailed && problems.length === 0) {
      // 読込失敗を行き止まりにしない（リトライ導線）。
      host.append(
        emptyState("📡", "問題データを読み込めませんでした", "通信状況を確認して、もう一度お試しください。"),
        h("button", { class: "primary", type: "button", onclick: () => void reloadProblems() }, "再読み込み"),
      );
    } else {
      host.append(emptyState("🔍", "この分野の問題がありません", "別の分野を選ぶか、復習ドリルを解除してください。"));
    }
    return;
  }
  practice.shownAt = Date.now();
  practice.hintsShown = 0;
  // インターリーブ用に直近 topic を記録する（次の選択で後回し判定に使う #50）。
  pushRecentTopic(p.topic);
  const stmt = h("div", { class: "stmt", tabindex: "-1", html: safeHtml(formatMath(p.statement)) });
  // 未監修（自動生成）の問題はバッジで明示する（#63）。
  const meta = h("div", { id: "meta" }, `${p.subject}・${p.topic}・難易度${difficultyStars(p.difficulty)}`);
  const badge = draftBadge(p);
  if (badge) meta.append(" ", badge);
  // フリーミアム作動中は無料枠の残数を出題メタに添える（残数の見える化＝納得感）。
  // freeLeft はゲート判定と同じ読み出しを再利用する（storage の二重 parse を避ける）。
  if (Number.isFinite(freeLeft)) {
    meta.append(" ", h("span", { class: "muted small" }, `🆓 今日あと${freeLeft}問`));
  }
  host.append(meta, stmt);
  if (p.figure) host.append(figureNode(p.figure));
  // ヒント段階開示: 解答前に解説の先頭ステップ（着眼点）だけ覗ける（最大2段）。
  const maxHints = Math.min(2, p.solution.length - 1);
  if (maxHints > 0) {
    const hintHost = h("div", { id: "hints" });
    const hintBtn = h(
      "button",
      {
        class: "chip hintbtn",
        type: "button",
        onclick: () => {
          if (practice.hintsShown >= maxHints) return;
          // hintsShown < maxHints ≤ p.solution.length - 1 を保証済みのため安全。
          const step = p.solution[practice.hintsShown] as string;
          practice.hintsShown += 1;
          hintHost.append(
            h("div", { class: "hint", html: safeHtml(`💡 ヒント${practice.hintsShown}: ${formatMath(step)}`) }),
          );
          if (practice.hintsShown >= maxHints) (hintBtn as HTMLButtonElement).disabled = true;
          hintBtn.textContent = `💡 ヒントを見る（${practice.hintsShown}/${maxHints}）`;
        },
      },
      `💡 ヒントを見る（0/${maxHints}）`,
    );
    host.append(hintBtn, hintHost);
  }
  host.append(h("div", { class: "answers", id: "answers" }), h("div", { id: "result" }));
  renderAnswerInputs(host, p);
  // 次の問題へ進んだことをスクリーンリーダー/キーボード利用者に伝える。
  stmt.focus({ preventScroll: true });
}

export function renderAnswerInputs(host: HTMLElement, p: Problem): void {
  const answers = host.querySelector("#answers") as HTMLElement;
  answers.innerHTML = "";
  if (p.choices && p.choices.length > 0) {
    p.choices.forEach((choice, i) => {
      // 番号バッジ: キーボード 1〜9 ショートカットとの対応を可視化する。
      const btn = h(
        "button",
        { class: "choice", type: "button", onclick: () => gradeObjective(host, p, choice, btn) },
        h("span", { class: "kbd", "aria-hidden": "true" }, String(i + 1)),
        choice,
      );
      answers.append(btn);
    });
  } else if (p.format === "descriptive") {
    // 解答前に自分の導出を書く/考えることを促す（後知恵バイアスで自己採点が甘くなるのを防ぐ #44）。
    // 模範解答は「解答を考えた」と明示的に確認してから開示する。
    const ta = h("textarea", {
      class: "derivation",
      rows: "4",
      placeholder: "ここに解答の方針・導出を書き出してから模範解答を見ましょう（任意・端末内のみ）",
      "aria-label": "自分の解答メモ",
    }) as HTMLTextAreaElement;
    const reveal = h(
      "button",
      { class: "choice", type: "button", onclick: () => revealDescriptive(host, p) },
      "📝 解答を考えた・模範解答を見て自己採点",
    );
    answers.append(
      h("p", { class: "muted small" }, "記述は本番でも『書けるか』が勝負。まず自分で導出してから照合します。"),
      ta,
      reveal,
    );
  } else {
    const input = h("input", {
      id: "num",
      class: "num",
      inputmode: "decimal",
      placeholder: "答えを入力",
      "aria-label": "数値の答え",
    }) as HTMLInputElement;
    input.addEventListener("keydown", (e) => {
      if ((e as KeyboardEvent).key === "Enter") gradeObjective(host, p, input.value, null);
    });
    answers.append(
      input,
      h(
        "button",
        // .choice を残すのはキーボード選択（keyboard.ts の `.answers .choice`）の対象に
        // 留めるため。submit は見た目だけ主アクションに寄せる修飾クラス。
        { class: "choice submit", type: "button", onclick: () => gradeObjective(host, p, input.value, null) },
        "回答",
      ),
    );
  }
}

// 採点処理（gradeObjective / revealDescriptive / ratingBar / finalize）は practice-grade.ts から re-export。
import { gradeObjective, revealDescriptive } from "./practice-grade.js";

export { finalize, gradeObjective, ratingBar, revealDescriptive } from "./practice-grade.js";
// 報酬計算は practice-rewards.ts から re-export。
export { processRewards } from "./practice-rewards.js";
