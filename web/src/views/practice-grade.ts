/**
 * views/practice-grade.ts — 学習タブの採点処理（gradeObjective / revealDescriptive / ratingBar / finalize）。
 * practice.ts から切り出して行数制限（600行以下）を守る（I-054）。
 */
import {
  buildRubric,
  missingUnits,
  ROLE_HINTS,
  ROLE_LABELS,
  type RubricItem,
  scoreRubric,
  suggestedCheckedIndices,
} from "../../../lib/curriculum/rubric.js";
import type { Problem } from "../../../lib/engine/schema.js";
import type { Rating } from "../../../lib/scheduler/types.js";
import { cardText } from "../../../lib/share-card/card-text.js";
import { affiliateActive } from "../bridge-config.js";
import { recordPracticeAnswer } from "../entitlements.js";
import { formatElapsed } from "../format.js";
import { confettiBurst, playTone, vibrate, xpFloat } from "../fx.js";
import { isAnswerCorrect, normalizeNumericInput } from "../grade.js";
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
    // 不正解 → again 記録して次へ。選んだ答えも残す（誤概念分析の素材）。
    finalize(host, p, "again", undefined, given);
  }
}

/**
 * 記述(二次): 模範解答の各ステップを採点観点とし、書けた項目にチェック→**配点重み付き**の部分点で自己採点。
 *
 * 旧実装との違い（lib/curriculum/rubric.ts が担当）:
 *   - 「ポイント:」「（補足: …）」の行は採点対象外（重み0）。満点の答案が満点になる。
 *   - 方針1点 / 公式・代入・計算2点 / 最終値と単位3点の重み付け（本番の採点感覚に寄せる）。
 *   - 答案を書き写すと、数値・単位・量記号の照合でチェック候補を提案する（自己採点の補助）。
 */
export function revealDescriptive(host: HTMLElement, p: Problem): void {
  const answers = host.querySelector("#answers") as HTMLElement;
  answers.innerHTML = "";
  const result = host.querySelector("#result") as HTMLElement;
  result.innerHTML = "";
  const items = buildRubric(p.solution);
  const checks = new Map<number, HTMLInputElement>();
  const list = h("div", { class: "rubric" });
  for (const item of items) {
    const cb = h("input", { type: "checkbox", id: `rb${item.index}` }) as HTMLInputElement;
    checks.set(item.index, cb);
    const badge = h(
      "span",
      { class: `rubric-role role-${item.role}`, title: ROLE_HINTS[item.role] },
      item.weight > 0 ? `${ROLE_LABELS[item.role]} ${item.weight}点` : `${ROLE_LABELS[item.role]}（採点対象外）`,
    );
    list.append(
      h(
        "label",
        { class: `rubric-item${item.weight > 0 ? "" : " rubric-note"}`, for: `rb${item.index}` },
        cb,
        h("span", { class: "rubric-body" }, badge, h("span", { html: safeHtml(formatMath(item.text)) })),
      ),
    );
  }

  // 答案の照合（任意）: 書いた答案を貼ると、キーワード一致からチェック候補を提案する。
  const answerBox = h("textarea", {
    class: "rubric-answer",
    rows: "3",
    placeholder: "（任意）自分の答案を書き写すと、数値・単位の照合でチェック候補を提案します",
    "aria-label": "自分の答案",
  }) as HTMLTextAreaElement;
  const matchNote = h("div", { class: "muted small" });
  const suggest = h(
    "button",
    {
      class: "chip",
      type: "button",
      onclick: () => {
        const text = answerBox.value;
        if (text.trim() === "") {
          matchNote.textContent = "答案を入力すると照合できます。";
          return;
        }
        const suggested = suggestedCheckedIndices(items, text);
        for (const i of suggested) {
          const cb = checks.get(i);
          if (cb) cb.checked = true;
        }
        const lacking = missingUnits(items, text);
        matchNote.textContent =
          `${suggested.length} 項目にチェックを提案しました（最終判断はご自身で）。` +
          (lacking.length > 0 ? ` ⚠️ 答案に見当たらない単位: ${lacking.join("・")}` : " 単位の書き漏れはなさそうです。");
      },
    },
    "🔎 答案と照合してチェック候補を出す",
  );

  const grade = h(
    "button",
    {
      class: "primary",
      type: "button",
      onclick: () => {
        const checkedIdx = [...checks.entries()].filter(([, cb]) => cb.checked).map(([i]) => i);
        const s = scoreRubric(items, checkedIdx);
        finalize(host, p, s.rating, {
          checked: s.checkedCount,
          total: s.scoringCount,
          pct: s.pct,
          earned: s.earned,
          possible: s.possible,
          missed: s.missed,
        });
      },
    },
    "採点する",
  );
  const scoring = items.filter((i) => i.weight > 0);
  const possible = scoring.reduce((a, i) => a + i.weight, 0);
  result.append(
    h(
      "div",
      { class: "gradeui solution" },
      h("strong", {}, "模範解答（採点観点）"),
      h(
        "p",
        { class: "muted" },
        `各ステップを自分の解答と照合し、書けた項目にチェック → 採点する。` +
          `配点は全 ${possible} 点（${scoring.length} 項目）で、最終値と単位がいちばん重い配点です。`,
      ),
      list,
      h("div", { class: "rubric-selfcheck" }, answerBox, h("div", { class: "drill-actions" }, suggest), matchNote),
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

/** 記述の採点結果（配点重み付き）。客観式では undefined。 */
export interface DescriptiveScore {
  /** チェックした採点対象の項目数。 */
  checked: number;
  /** 採点対象の項目数。 */
  total: number;
  /** 達成率 0..1（重み付き）。 */
  pct: number;
  /** 獲得点。 */
  earned: number;
  /** 満点。 */
  possible: number;
  /** 取りこぼした項目（重みの大きい順）。 */
  missed: RubricItem[];
}

export function finalize(
  host: HTMLElement,
  p: Problem,
  rating: Rating,
  score?: DescriptiveScore,
  chosen?: string,
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

  progress.record(p.topic, rating, Date.now(), timeMs, p.id, chosen);
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
    const fb = h(
      "div",
      { class: `feedback ${ok ? "ok" : "ng"}` },
      `📝 部分点 ${score.earned}/${score.possible} 点（${Math.round(score.pct * 100)}%・観点 ${score.checked}/${score.total}）` +
        `${ok ? " — 合格圏" : " — 要強化"}`,
    );
    // 取りこぼしのうち最も配点の重い1つだけを示す（全部並べても読まれない）。
    const worst = score.missed[0];
    if (worst) {
      fb.append(
        h(
          "span",
          { class: "rubric-advice" },
          `いちばん大きい取りこぼしは「${ROLE_LABELS[worst.role]}」（${worst.weight}点）です`,
        ),
      );
    }
    result.insertBefore(fb, result.firstChild);
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
