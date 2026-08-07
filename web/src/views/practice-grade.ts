/**
 * views/practice-grade.ts — 学習タブの採点処理（gradeObjective / revealDescriptive / ratingBar / finalize）。
 * practice.ts から切り出して行数制限（600行以下）を守る（I-054）。
 */
import type { Problem } from "../../../lib/engine/schema.js";
import type { Rating } from "../../../lib/scheduler/types.js";
import { cardText } from "../../../lib/share-card/card-text.js";
import { affiliateActive } from "../bridge-config.js";
import { recordPracticeAnswer } from "../entitlements.js";
import { formatElapsed } from "../format.js";
import { confettiBurst, playTone, vibrate, xpFloat } from "../fx.js";
import { isAnswerCorrect, normalizeNumericInput, partialScore } from "../grade.js";
import { mascotCheer } from "../mascot.js";
import { formatMath } from "../mathfmt.js";
import {
  allQuestsClear,
  allWeeklyQuestsClear,
  dailyQuests,
  dayIndexOf,
  logsOfDay,
  logsOfWeek,
  questStatuses,
  weekIndexOf,
} from "../quests.js";
import { getDailyGoal, getSoundLevel } from "../settings.js";
import { installPrompt, progress, storage } from "../state/app.js";
import { enqueueRequeue, practice, setCombo, todayCount } from "../state/practice.js";
import { $, h, safeHtml } from "../ui/dom.js";
import { showToast } from "../ui/toast.js";
import { solutionNode, sourceText } from "../ui/widgets.js";
import { totalXp } from "../xp.js";
import { deepDiveBook } from "./bridge-cards.js";
import { freezeInfo, nextQuestion, refreshPracticeCards, runFreezeBridge, sessionSummaryCard } from "./practice.js";
import { processRewards } from "./practice-rewards.js";
import { renderHeader, renderNav } from "./router.js";

/** MC / numeric: 客観採点（正誤を自動判定）→ 解説 → FSRS評価。 */
export function gradeObjective(host: HTMLElement, p: Problem, given: string, clicked: HTMLElement | null): void {
  // 空入力は採点しない（誤タップ・キー操作ミスを「不正解」として FSRS に記録しない）。
  if (p.format === "numeric" && normalizeNumericInput(given) === "") {
    (host.querySelector("#num") as HTMLInputElement | null)?.focus();
    return;
  }
  const correct = isAnswerCorrect(p, given);
  setCombo(correct ? practice.combo + 1 : 0);
  playTone(correct ? "correct" : "wrong", getSoundLevel(storage));
  vibrate(correct ? 18 : [40, 50, 40]);
  const answers = host.querySelector("#answers") as HTMLElement;
  for (const b of Array.from(answers.querySelectorAll("button"))) (b as HTMLButtonElement).disabled = true;
  const input = answers.querySelector("#num") as HTMLInputElement | null;
  if (input) input.disabled = true;
  if (clicked) clicked.classList.add(correct ? "correct" : "wrong");

  const result = host.querySelector("#result") as HTMLElement;
  result.innerHTML = "";
  const elapsed = formatElapsed(Date.now() - practice.shownAt);
  const feedback = h(
    "div",
    { class: `feedback ${correct ? "ok" : "ng"}` },
    correct ? "⭕ 正解！" : `❌ 不正解（正解: ${p.answer}）`,
  );
  if (correct && practice.combo >= 2) {
    // コンボ5以上は発光して「ノっている」ことを体感させる。
    feedback.append(h("span", { class: practice.combo >= 5 ? "combo hot" : "combo" }, `⚡${practice.combo}連続`));
  }
  feedback.append(
    h("span", { class: "elapsed" }, `⏱ ${elapsed}${practice.hintsShown > 0 ? ` ・ ヒント${practice.hintsShown}` : ""}`),
    h("span", { class: "cheer" }, mascotCheer(correct, practice.combo, dayIndexOf(Date.now()))),
  );
  result.append(feedback);
  // 誤答フィードバック: 選んだ選択肢が「どの典型ミスで導かれる値か」を先に返す。
  // 問題データは distractors[{choice, reason}] を持っているが従来は未使用だった。
  // 正解を見る前に「自分がどこで間違えたか」が分かると、次の想起が変わる。
  if (!correct) {
    const why = p.distractors?.find((d) => d.choice === given);
    if (why) {
      result.append(h("div", { class: "whywrong" }, h("strong", {}, "この選択肢を選んだ理由: "), why.reason));
    }
  }
  result.append(solutionNode(p, "解説"));
  if (correct) {
    // 正解 → 想起の難易度を自己申告（FSRS）。
    result.append(
      ratingBar(host, p, [
        ["hard", "むずかしい"],
        ["good", "できた"],
        ["easy", "余裕"],
      ]),
    );
  } else {
    // 不正解 → again 記録して次へ。
    finalize(host, p, "again");
  }
}

/** 記述(二次): 模範解答の各ステップを採点観点とし、書けた項目にチェック→部分点で自己採点。 */
export function revealDescriptive(host: HTMLElement, p: Problem): void {
  const answers = host.querySelector("#answers") as HTMLElement;
  answers.innerHTML = "";
  const result = host.querySelector("#result") as HTMLElement;
  result.innerHTML = "";
  const steps = p.solution;
  const checks: HTMLInputElement[] = [];
  const list = h("div", { class: "rubric" });
  steps.forEach((s, i) => {
    const cb = h("input", { type: "checkbox", id: `rb${i}` }) as HTMLInputElement;
    checks.push(cb);
    list.append(h("label", { class: "rubric-item", for: `rb${i}` }, cb, h("span", { html: safeHtml(formatMath(s)) })));
  });
  const grade = h(
    "button",
    {
      class: "primary",
      type: "button",
      onclick: () => {
        const checked = checks.filter((c) => c.checked).length;
        const { pct, rating } = partialScore(checked, steps.length);
        finalize(host, p, rating, { checked, total: steps.length, pct });
      },
    },
    "採点する",
  );
  result.append(
    h(
      "div",
      { class: "gradeui solution" },
      h("strong", {}, "模範解答（採点観点）"),
      h("p", { class: "muted" }, "各ステップを自分の解答と照合し、書けた項目にチェック → 採点する（部分点で評価）"),
      list,
      h("p", { class: "src" }, sourceText(p)),
      grade,
    ),
  );
}

export function ratingBar(host: HTMLElement, p: Problem, opts: ReadonlyArray<readonly [Rating, string]>): HTMLElement {
  const el = h("div", { class: "rate" });
  opts.forEach(([rating, label], i) => {
    // 番号バッジ: 解答と同じくキーボード 1〜3 で評価できる（手をマウスに戻させない）。
    el.append(
      h(
        "button",
        { type: "button", onclick: () => finalize(host, p, rating) },
        h("span", { class: "kbd", "aria-hidden": "true" }, String(i + 1)),
        label,
      ),
    );
  });
  return el;
}

export function finalize(
  host: HTMLElement,
  p: Problem,
  rating: Rating,
  score?: { checked: number; total: number; pct: number },
): void {
  const timeMs = Date.now() - practice.shownAt;
  // 開きっぱなしのタブで日をまたいでいた場合、記録前に欠席日をカバーしておく。
  runFreezeBridge();
  const before = todayCount();
  const xpBefore = totalXp(progress.logs());
  const todayIdx = dayIndexOf(Date.now());
  const weekIdx = weekIndexOf(Date.now());
  const questsBefore = allQuestsClear(logsOfDay(progress.logs(), todayIdx), todayIdx);
  const weeklyBefore = allWeeklyQuestsClear(logsOfWeek(progress.logs(), weekIdx), weekIdx);

  progress.record(p.topic, rating, Date.now(), timeMs, p.id);
  // フリーミアム: 無料枠カウンタは「学習タブの新しい問題」だけを数える。
  // 復習タブ発のドリル（pool）と再出題（requeue）は対象外（nextQuestion のゲートと対）。
  // 収益化未設定・Pro 解錠中は何も書かない。
  if (!practice.pool && !practice.currentFromRequeue) recordPracticeAnswer(storage);

  // 間違えた問題はセッション後半で再出題する（短期の想起練習 #49）。
  // 客観式: rating="again"（不正解）。記述: 部分点が合格圏未満。
  const missed = score ? score.pct < 2 / 3 : rating === "again";
  if (missed) enqueueRequeue(p);

  // 保存失敗チェック（I-035）
  const persistErr = progress.lastPersistError;
  if (persistErr) {
    showToast("⚠️ 保存に失敗しました。端末の空き容量を確認してください", "OK", () => {});
  }

  // 記述(二次)はここで初めて正誤相当が確定する（客観式は gradeObjective で演出済み）。
  if (score) {
    const ok = score.pct >= 2 / 3;
    setCombo(ok ? practice.combo + 1 : 0);
    playTone(ok ? "correct" : "wrong", getSoundLevel(storage));
    vibrate(ok ? 18 : [40, 50, 40]);
  }

  const xpGained = Math.max(0, totalXp(progress.logs()) - xpBefore);

  // 祝賀は重要度順に1つだけトーストし、紙吹雪は1回（乱発すると報酬価値が下がる）。
  const { celebrations, fanfare, bigConfetti } = processRewards({
    questsClear: questsBefore,
    weeklyClear: weeklyBefore,
  });

  // 日次目標の達成瞬間（達成に気づけないと目標の駆動力が出ない）。
  const goal = getDailyGoal(storage);
  const goalJustMet = before < goal && todayCount() >= goal;
  const toneKind = fanfare ?? (goalJustMet ? "clear" : null);
  if (goalJustMet) {
    celebrations.push(`🎉 今日の目標 ${goal} 問を達成！この調子！`);
  }

  if (celebrations.length > 0) {
    // celebrations.length > 0 を直前でチェック済みのため安全。
    showToast(celebrations[0] as string, "OK", () => {});
    confettiBurst(bigConfetti ? 64 : 28);
    if (toneKind) playTone(toneKind, getSoundLevel(storage));
  } else if (installPrompt && freezeInfo().streak >= 3 && storage.getItem("denken:a2hsNudged") !== "1") {
    // A2HS は3日続いた頃＝価値を実感したタイミングで一度だけ提案する（初回に出すと断られる）。
    try {
      storage.setItem("denken:a2hsNudged", "1");
    } catch {
      // 保存不能でも続行。
    }
    const prompt = installPrompt;
    showToast("📲 毎日開くなら、ホーム画面に追加すると1タップで起動できます", "追加", () => void prompt.prompt());
  }

  const result = host.querySelector("#result") as HTMLElement;
  // 既存の評価バー・採点UIを除去し、結果＋シェア文＋次へを出す。
  for (const r of Array.from(result.querySelectorAll(".rate, .gradeui"))) r.remove();
  if (score) {
    // 記述: 採点UIを消した後に模範解答を残し、先頭に部分点フィードバックを置く。
    result.append(solutionNode(p, "模範解答"));
    const ok = score.pct >= 2 / 3;
    result.insertBefore(
      h(
        "div",
        { class: `feedback ${ok ? "ok" : "ng"}` },
        `📝 部分点 ${score.checked}/${score.total}（${Math.round(score.pct * 100)}%）${ok ? "— 合格圏" : "— 要強化"}`,
      ),
      result.firstChild,
    );
  }
  // 深掘り一冊（17-A17）: アフィリエイト設定時のみ、閉じた details を1つだけ添える。
  if (affiliateActive()) {
    const dd = deepDiveBook(p.subject);
    if (dd) result.append(dd);
  }
  result.append(
    h(
      "div",
      { class: "share" },
      cardText("daily", {
        streakDays: freezeInfo().streak,
        todayMinutes: progress.todayMinutes(),
        weeklyMinutes: 0,
      }),
    ),
    h("button", { class: "primary", id: "next", type: "button", onclick: () => nextQuestion($("view")) }, "次の問題 →"),
  );
  // 「あと1問」の文脈ナッジ: ゴール目前だけ背中を押す（目標勾配効果。常時表示はしない）。
  const almost = questStatuses(dailyQuests(todayIdx), logsOfDay(progress.logs(), todayIdx)).find(
    (s) => !s.done && s.quest.target - s.value === 1,
  );
  if (almost) {
    result.append(h("p", { class: "muted almost" }, `✨ あと1問で「${almost.quest.label}」を達成！`));
  }
  // 目標達成の瞬間は「今日のまとめ」で気持ちよく締める（明日のクエスト予告つき）。
  if (goalJustMet) result.append(sessionSummaryCard());
  if (xpGained > 0) xpFloat(result, `+${xpGained} XP`);
  refreshPracticeCards();
  renderHeader();
  renderNav();
}
