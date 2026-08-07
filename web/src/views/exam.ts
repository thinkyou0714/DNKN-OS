/**
 * views/exam.ts — 模試タブの描画・タイマー・開始/終了処理。
 * renderExam / startExam / timeoutExam / renderExamRunning / renderExamResult /
 * startTimer / endExam
 */

import type { Problem, Subject } from "../../../lib/engine/schema.js";
import {
  buildMockExam,
  buildPrimaryFullMock,
  examTimeLimitMs,
  primaryVerdict,
  scoreExam,
  scoreExamBySubject,
  scoreSecondary,
} from "../exam.js";
import { appendExamHistory, type ExamHistoryPreset, loadExamHistory, recentScores } from "../exam-history.js";
import { formatRemaining } from "../format.js";
import { confettiBurst, playTone } from "../fx.js";
import { isAnswerCorrect, normalizeNumericInput } from "../grade.js";
import { formatMath } from "../mathfmt.js";
import { allQuestsClear, allWeeklyQuestsClear, dayIndexOf, logsOfDay, logsOfWeek, weekIndexOf } from "../quests.js";
import { getDailyGoal, getSoundLevel } from "../settings.js";
import { problems, progress, storage } from "../state/app.js";
import { type ExamPreset, exam, secondarySelect, setExam, setSecondarySelect } from "../state/exam.js";
import { todayCount } from "../state/practice.js";
import { $, h, safeHtml } from "../ui/dom.js";
import { showToast } from "../ui/toast.js";
import { bar, difficultyStars, draftBadge, figureNode, solutionNode, sparklineNode } from "../ui/widgets.js";
import { buildYearMock } from "../year-mock.js";
import { examNoteCard } from "./bridge-cards.js";
import { processRewards } from "./practice-rewards.js";
import { startDrill } from "./review.js";
import { renderHeader, switchView } from "./router.js";

/** 二次「N問中M問選択」の候補数・選択数（#43）。 */
const SECONDARY_CHOICE: Readonly<Record<string, { candidates: number; choose: number }>> = {
  電力管理: { candidates: 6, choose: 4 },
  機械制御: { candidates: 4, choose: 2 },
};

/**
 * バックグラウンドタブ復帰時の保険（II-8）。
 * setInterval はタブ非表示中にスロットル/停止され、復帰時に残り時間が正しく
 * 反映されない（または期限超過に気づけない）。可視化時に残りを再計算し、
 * 期限切れなら即 timeoutExam する。startTimer で登録し clearExamTimer で解除する。
 */
let _examVisibilityHandler: (() => void) | null = null;

function attachExamVisibility(): void {
  if (_examVisibilityHandler) return; // 二重登録を防ぐ。
  _examVisibilityHandler = () => {
    if (document.visibilityState !== "visible" || !exam) return;
    const remaining = exam.limitMs - (Date.now() - exam.startedAt);
    if (remaining <= 0) {
      // 非表示中に期限超過していたら復帰時に確定で時間切れにする。
      timeoutExam();
      return;
    }
    // 表示の即時補正（次の tick を待たずに残り時間を反映）。
    const t = document.getElementById("timer");
    if (t) t.textContent = `残り ${formatRemaining(remaining)}`;
  };
  document.addEventListener("visibilitychange", _examVisibilityHandler);
}

function detachExamVisibility(): void {
  if (_examVisibilityHandler) {
    document.removeEventListener("visibilitychange", _examVisibilityHandler);
    _examVisibilityHandler = null;
  }
}

/** タイマーを安全に破棄するユーティリティ（II-156 タイマーリーク解消）。
 * setterで既存破棄+view離脱時の一元cleanup。visibility リスナも併せて解除する（II-8）。 */
export function clearExamTimer(): void {
  if (exam?.timerId != null) {
    clearInterval(exam.timerId);
    exam.timerId = null;
  }
  // 模試タイマーの終了に合わせて visibility リスナも外す（リーク・誤発火防止）。
  detachExamVisibility();
}

/** 模試を終了（タイマー解除）して模試タブの初期画面へ戻る。 */
export function endExam(): void {
  clearExamTimer();
  setExam(null);
  setSecondarySelect(null);
  switchView("exam");
}

export function renderExam(root: HTMLElement): void {
  if (exam) {
    renderExamRunning(root);
    return;
  }
  if (secondarySelect) {
    renderSecondarySelect(root);
    return;
  }
  root.append(
    h("h2", {}, "模試（時間制限・合格ライン60%）"),
    h("p", { class: "muted" }, "本番の緊張感で実力を測り、弱点を炙り出します。記述は自己採点です。"),
  );
  examHistorySection(root);
  let count = 10;
  let preset: ExamPreset = "all";
  let yearSubject: Subject = "理論";
  // 年度別通し模試の科目セレクタ（preset=year のときだけ有効化）。
  const subjSel = h("select", {
    id: "eyearsubj",
    disabled: true,
    onchange: (e) => {
      yearSubject = (e.target as HTMLSelectElement).value as Subject;
    },
  }) as HTMLSelectElement;
  for (const s of ["理論", "電力", "機械", "法規", "電力管理", "機械制御"] as Subject[]) {
    subjSel.append(h("option", { value: s }, s));
  }
  const toolbar = h(
    "div",
    { class: "toolbar" },
    h("label", { for: "ecount" }, "問題数:"),
    (() => {
      const sel = h("select", {
        id: "ecount",
        onchange: (e) => {
          count = Number((e.target as HTMLSelectElement).value);
        },
      }) as HTMLSelectElement;
      for (const n of [5, 10, 20, 30]) sel.append(h("option", { value: n }, String(n)));
      sel.value = "10";
      return sel;
    })(),
    h("label", { for: "epreset" }, "範囲:"),
    (() => {
      const sel = h("select", {
        id: "epreset",
        onchange: (e) => {
          preset = (e.target as HTMLSelectElement).value as ExamPreset;
          // 年度別通し模試のときだけ科目セレクタを有効化する。
          subjSel.disabled = preset !== "year";
        },
      }) as HTMLSelectElement;
      sel.append(
        h("option", { value: "all" }, "全分野"),
        h("option", { value: "primary" }, "一次フル（4科目・合格判定）"),
        h("option", { value: "secondary" }, "二次（電力管理＋機械制御・合算判定）"),
        h("option", { value: "year" }, "年度別通し模試（1科目・頻出重み）"),
      );
      return sel;
    })(),
    h("label", { for: "eyearsubj" }, "科目:"),
    subjSel,
  );
  root.append(
    toolbar,
    h(
      "p",
      { class: "muted small" },
      "一次フルは4科目すべてを出題し、各科目60%で合格判定します。二次は問題を選んでから合算（108/180）で判定します。年度別通し模試は1科目を頻出度の重みで本番尺に組みます。",
    ),
    h(
      "button",
      { class: "primary", type: "button", onclick: () => startExam(count, preset, yearSubject) },
      "▶ 模試を開始",
    ),
  );
}

/** 模試結果のスコア推移（履歴）。直近の得点率をスパークライン＋直近リストで見せる（#13）。 */
function examHistorySection(root: HTMLElement): void {
  const history = loadExamHistory(storage);
  if (history.length === 0) return;
  const scores = recentScores(history, 10);
  // sparklineNode は 0..1 を取るので 0..100 → 0..1 に正規化する。
  const spark = sparklineNode(scores.map((s) => s / 100));
  const list = h("div", { class: "exam-trend" });
  for (const e of history.slice(-5).reverse()) {
    const d = new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", timeZone: "Asia/Tokyo" }).format(
      new Date(e.atMs),
    );
    const label =
      e.preset === "primary" ? "一次" : e.preset === "secondary" ? "二次" : e.subjects.join("/") || "全分野";
    list.append(
      h(
        "div",
        { class: "row" },
        h("span", { class: "muted" }, `${d} ${label}`),
        h(
          "span",
          { style: `color:${e.passed ? "var(--ok)" : "var(--ng)"}` },
          `${e.scorePct}点 ${e.passed ? "✅" : ""}`,
        ),
      ),
    );
  }
  root.append(h("h2", {}, "模試スコアの推移"));
  if (spark) root.append(spark);
  root.append(list);
}

export function startExam(count: number, preset: ExamPreset, yearSubject?: Subject): void {
  // 二次は「N問中M問選択」の選択フェーズを挟む（#43）。
  if (preset === "secondary") {
    startSecondarySelection(count);
    return;
  }
  // 出題セットを preset 別に組む。
  // - primary: 4科目すべてを代表させる（#48）。
  // - year:    1科目を頻出度の重みで組む（年度別通し模試）。
  // - all:     全分野からバランスよく。
  const set =
    preset === "primary"
      ? buildPrimaryFullMock(problems, count)
      : preset === "year" && yearSubject
        ? buildYearMock(problems, { subject: yearSubject, count })
        : buildMockExam(problems, { count });
  if (set.length === 0) {
    switchView("exam");
    return;
  }
  launchExam(set, preset);
}

/** 出題セットから時間制限つき模試を開始する（preset 共通の点火処理）。 */
function launchExam(set: Problem[], preset: ExamPreset): void {
  const todayIdx = dayIndexOf(Date.now());
  const weekIdx = weekIndexOf(Date.now());
  setExam({
    set,
    idx: 0,
    results: [],
    startedAt: Date.now(),
    timerId: null,
    preset,
    limitMs: examTimeLimitMs(set),
    timedOut: false,
    questsClearAtStart: allQuestsClear(logsOfDay(progress.logs(), todayIdx), todayIdx),
    weeklyClearAtStart: allWeeklyQuestsClear(logsOfWeek(progress.logs(), weekIdx), weekIdx),
    todayCountAtStart: todayCount(),
    celebrated: false,
  });
  switchView("exam");
}

/** 二次の選択フェーズを開始する（電力管理6→4, 機械制御4→2 の候補を用意）（#43）。 */
function startSecondarySelection(count: number): void {
  const groups: NonNullable<typeof secondarySelect>["groups"] = [];
  for (const subject of ["電力管理", "機械制御"] as Subject[]) {
    const spec = SECONDARY_CHOICE[subject];
    if (!spec) continue;
    const candidates = buildMockExam(problems, { count: spec.candidates, subjects: [subject] });
    if (candidates.length === 0) continue;
    // 候補が選択数に満たないときは選択数を候補数に丸める（出題不能を避ける）。
    groups.push({ subject, candidates, choose: Math.min(spec.choose, candidates.length) });
  }
  if (groups.length === 0) {
    switchView("exam");
    return;
  }
  setSecondarySelect({ groups, count });
  switchView("exam");
}

/** 二次の選択画面（#43）。各科目で必要数を選んだら本番開始。 */
function renderSecondarySelect(root: HTMLElement): void {
  if (!secondarySelect) return;
  const sel = secondarySelect;
  const chosen = new Map<Subject, Set<string>>();
  for (const g of sel.groups) chosen.set(g.subject, new Set());

  root.append(
    h("h2", {}, "二次模試: 問題を選択"),
    h(
      "p",
      { class: "muted" },
      "本番同様、出題から解く問題を選びます。電力・管理は6問中4問、機械・制御は4問中2問を選択してください。",
    ),
  );

  const startBtn = h(
    "button",
    { class: "primary", type: "button", disabled: true },
    "▶ 選んだ問題で開始",
  ) as HTMLButtonElement;
  const refreshStartState = () => {
    const ok = sel.groups.every((g) => (chosen.get(g.subject)?.size ?? 0) === g.choose);
    startBtn.disabled = !ok;
  };

  for (const g of sel.groups) {
    root.append(h("h2", {}, `${g.subject}（${g.choose}問を選択）`));
    const list = h("div", { class: "exam-pick" });
    g.candidates.forEach((p, i) => {
      const cb = h("input", { type: "checkbox", id: `pick-${g.subject}-${i}` }) as HTMLInputElement;
      cb.addEventListener("change", () => {
        const set = chosen.get(g.subject);
        if (!set) return;
        if (cb.checked) {
          if (set.size >= g.choose) {
            // 上限に達していたら選択を弾く（本番の選択数を厳守）。
            cb.checked = false;
            showToast(`${g.subject}は${g.choose}問までです`, "OK", () => {});
            return;
          }
          set.add(p.id);
        } else {
          set.delete(p.id);
        }
        refreshStartState();
      });
      list.append(
        h(
          "label",
          { class: "card pick-item", for: `pick-${g.subject}-${i}` },
          cb,
          h("span", { class: "muted" }, `${p.topic}・難易度${difficultyStars(p.difficulty)}`),
          h("div", { class: "stmt-sm", html: safeHtml(formatMath(p.statement)) }),
        ),
      );
    });
    root.append(list);
  }

  startBtn.addEventListener("click", () => {
    const set: Problem[] = [];
    for (const g of sel.groups) {
      const picks = chosen.get(g.subject) ?? new Set();
      for (const p of g.candidates) if (picks.has(p.id)) set.push(p);
    }
    if (set.length === 0) return;
    setSecondarySelect(null);
    launchExam(set, "secondary");
  });
  root.append(
    startBtn,
    h(
      "button",
      {
        class: "chip",
        type: "button",
        onclick: () => {
          setSecondarySelect(null);
          switchView("exam");
        },
      },
      "やめる",
    ),
  );
}

/** 時間切れ: 未解答の残り問題は本番同様 0 点（不正解）として結果へ。
 *  ただし出題されていない問題なので FSRS 記録は付けない（記憶状態を汚さない）。 */
export function timeoutExam(): void {
  if (!exam) return;
  // タイマーを明示的に停止してから状態を変更する（II-156 タイマーリーク解消）。
  clearExamTimer();
  while (exam.results.length < exam.set.length) exam.results.push(false);
  exam.idx = exam.set.length;
  exam.timedOut = true;
  switchView("exam");
}

export function renderExamRunning(root: HTMLElement): void {
  if (!exam) return;
  if (exam.idx >= exam.set.length) {
    renderExamResult(root);
    return;
  }
  // .at() で境界安全化（II-171）。exam.idx < exam.set.length を直前でチェック済みのため undefined にならない。
  const p = exam.set.at(exam.idx);
  if (!p) return; // 空セットの別フロー（型安全）
  const header = h(
    "div",
    { class: "toolbar" },
    h("strong", {}, `第 ${exam.idx + 1} / ${exam.set.length} 問`),
    h(
      "span",
      { class: "muted", id: "timer", "aria-label": "残り時間" },
      `残り ${formatRemaining(exam.limitMs - (Date.now() - exam.startedAt))}`,
    ),
    h(
      "button",
      {
        class: "chip",
        type: "button",
        onclick: () => {
          // 誤タップで途中経過が消えるのを防ぐ（取り返しのつかない操作には確認を挟む）。
          if (!window.confirm("模試を中断して最初に戻りますか？（途中経過は破棄されます）")) return;
          endExam();
        },
      },
      "中断",
    ),
  );
  // 見直しフラグ（本試CBT相当）。迷った問題に印を付けて先へ進み、結果画面で拾い直す。
  // 逐次進行のため「戻る」は提供しないが、どこで迷ったかは記録され振り返りに使える。
  const flagBtn = h("button", { class: "chip flagbtn", type: "button" }) as HTMLButtonElement;
  const paintFlag = (): void => {
    // この関数は renderExamRunning 内（冒頭で exam の null チェック済み）でのみ呼ばれるが、
    // クロージャなので型は再度絞る必要がある。
    const e = exam;
    const on = e ? (e.flagged?.includes(e.idx) ?? false) : false;
    flagBtn.textContent = on ? "🚩 見直す" : "🏳 見直しに入れる";
    flagBtn.classList.toggle("is-on", on);
    flagBtn.setAttribute("aria-pressed", on ? "true" : "false");
  };
  flagBtn.addEventListener("click", () => {
    // exam は再代入されうる module binding なので、ローカルに束ねてから触る。
    const e = exam;
    if (!e) return;
    const list = e.flagged ?? [];
    const i = list.indexOf(e.idx);
    e.flagged = i >= 0 ? list.filter((x) => x !== e.idx) : [...list, e.idx];
    paintFlag();
  });
  paintFlag();
  header.append(flagBtn);
  const host = h("div", {});
  // 未監修（自動生成）の問題はバッジで明示する（#63）。
  const meta = h("div", { id: "meta" }, `${p.subject}・難易度${difficultyStars(p.difficulty)}`);
  const badge = draftBadge(p);
  if (badge) meta.append(" ", badge);
  host.append(meta, h("div", { class: "stmt", html: safeHtml(formatMath(p.statement)) }));
  if (p.figure) host.append(figureNode(p.figure));
  host.append(h("div", { class: "answers", id: "eanswers" }));
  // aria-live region: タイマー警告をスクリーンリーダーへ通知（II-159）。visually-hiddenで画面には見えない。
  const timerLive = h("div", {
    id: "timer-live",
    role: "alert",
    "aria-live": "assertive",
    "aria-atomic": "true",
    class: "sr-only",
  });
  root.append(header, host, timerLive);
  startTimer();

  const answers = host.querySelector("#eanswers") as HTMLElement;
  const advance = (correct: boolean) => {
    if (!exam) return;
    exam.results.push(correct);
    progress.record(p.topic, correct ? "good" : "again", Date.now(), undefined, p.id);
    exam.idx += 1;
    switchView("exam");
  };
  if (p.choices && p.choices.length > 0) {
    for (const c of p.choices)
      answers.append(
        h("button", { class: "choice", type: "button", onclick: () => advance(isAnswerCorrect(p, c)) }, c),
      );
  } else if (p.format === "descriptive") {
    // 解答前に導出を書く/考えてから模範解答を開示する（後知恵バイアス対策 #44）。
    const ta = h("textarea", {
      class: "derivation",
      rows: "4",
      placeholder: "解答の方針・導出をここに書いてから模範解答を見ましょう（任意）",
      "aria-label": "自分の解答メモ",
    }) as HTMLTextAreaElement;
    answers.append(
      h("div", { class: "muted" }, "記述: まず自分で解答を書き、それから模範解答と照合して自己採点します。"),
      ta,
      h(
        "button",
        {
          class: "choice",
          type: "button",
          onclick: () => {
            answers.innerHTML = "";
            answers.append(
              solutionNode(p, "模範解答"),
              h(
                "div",
                { class: "rate" },
                h("button", { type: "button", onclick: () => advance(true) }, "✅ できた"),
                h("button", { type: "button", onclick: () => advance(false) }, "❌ できなかった"),
              ),
            );
          },
        },
        "📝 解答を考えた・模範解答を表示",
      ),
    );
  } else {
    const input = h("input", {
      class: "num",
      inputmode: "decimal",
      placeholder: "答えを入力",
      "aria-label": "数値の答え",
    }) as HTMLInputElement;
    // 空入力は受け付けない（誤タップを0点扱いにしない。スキップは中断/時間切れで明示的に）。
    const submit = () => {
      if (normalizeNumericInput(input.value) === "") {
        input.focus();
        return;
      }
      advance(isAnswerCorrect(p, input.value));
    };
    input.addEventListener("keydown", (e) => {
      if ((e as KeyboardEvent).key === "Enter") submit();
    });
    answers.append(input, h("button", { class: "choice", type: "button", onclick: submit }, "回答"));
  }
}

/** 残り時間のカウントダウン（時間制限の本実装）。0 で自動終了し本番を再現する。
 * II-156: setter経由で既存タイマーを破棄してから新規設定（タイマーリーク解消）。
 * II-159: 残60秒でaria-label更新＋aria-live通知（スクリーンリーダーへ警告）。
 */
export function startTimer(): void {
  if (!exam) return;
  // 既存タイマーを必ず破棄してから新規設定（II-156）。clearExamTimer は visibility も外すため、
  // この後に attachExamVisibility で登録し直す。
  clearExamTimer();
  // バックグラウンド復帰時の残り時間補正・期限切れ確定（II-8）。
  attachExamVisibility();
  /** ラスト1分の警告をaria-liveで1回だけ通知するフラグ。 */
  let warnAnnounced = false;
  exam.timerId = window.setInterval(() => {
    const t = $("timer");
    if (!t || !exam) return;
    const remaining = exam.limitMs - (Date.now() - exam.startedAt);
    if (remaining <= 0) {
      timeoutExam();
      return;
    }
    const formatted = formatRemaining(remaining);
    t.textContent = `残り ${formatted}`;
    const isWarn = remaining <= 60_000;
    t.classList.toggle("timer-warn", isWarn);
    // 残60秒に入ったとき: aria-label更新＋aria-liveで1回だけ通知（II-159）。
    if (isWarn) {
      t.setAttribute("aria-label", `残り時間 ${formatted} 警告：残り1分`);
      if (!warnAnnounced) {
        warnAnnounced = true;
        // aria-live="assertive"のregionに書き込んで読み上げを発火させる。
        const liveEl = document.getElementById("timer-live");
        if (liveEl) liveEl.textContent = `残り1分を切りました。残り ${formatted}`;
      }
    } else {
      t.setAttribute("aria-label", `残り時間 ${formatted}`);
    }
  }, 1000);
}

// ---- 結果画面（renderExamResult を3セクション関数へ分解 I-054）----

function examScoreSection(root: HTMLElement, score: ReturnType<typeof scoreExam>, mins: number): void {
  root.append(
    h("h2", {}, "模試結果"),
    h(
      "div",
      { class: "big", style: `color:${score.passed ? "var(--ok)" : "var(--ng)"}` },
      `${score.scorePct}点 ${score.passed ? "🎉 合格ライン突破" : "✊ あと一歩"}`,
    ),
    h(
      "p",
      { class: "muted" },
      // biome-ignore lint/style/noNonNullAssertion: renderExamResult の `if (!exam) return` 後に呼ばれるため exam は非 null。
      `${score.correct} / ${score.total} 問正解 ・ 所要 ${mins} 分（制限 ${Math.round(exam!.limitMs / 60_000)} 分）`,
    ),
  );
  // biome-ignore lint/style/noNonNullAssertion: 同上 — renderExamResult でガード済み。
  if (exam!.timedOut) {
    root.append(
      h(
        "div",
        { class: "card", style: "border-color:var(--ng)" },
        h("strong", {}, "⏰ 時間切れ"),
        h("div", { class: "muted" }, "未解答の問題は本番同様 0 点で採点しました。時間配分も実力のうちです。"),
      ),
    );
  }
}

function examSubjectSection(root: HTMLElement, subjectScores: ReturnType<typeof scoreExamBySubject>): void {
  // 一次プリセットは「4科目すべて60%以上」で本番合格判定。4科目揃わなければ部分模試（#48）。
  // biome-ignore lint/style/noNonNullAssertion: renderExamResult の `if (!exam) return` 後に呼ばれるため exam は非 null。
  if (exam!.preset === "primary") {
    const verdict = primaryVerdict(subjectScores);
    const card =
      verdict === "pass"
        ? { color: "var(--ok)", title: "✅ 一次 合格判定（4科目すべて60%以上）" }
        : verdict === "fail"
          ? { color: "var(--ng)", title: "✗ 一次 不合格（足切り科目あり）" }
          : { color: "var(--accent)", title: "ℹ️ 部分模試（4科目が揃っていないため合否判定なし）" };
    root.append(
      h(
        "div",
        { class: "card", style: `border-color:${card.color}` },
        h("strong", {}, card.title),
        h(
          "div",
          { class: "muted" },
          verdict === "partial"
            ? "本番は理論/電力/機械/法規の4科目すべてが各60%以上で合格。出題に全科目を含めると合否判定できます。"
            : "本番は科目ごとに60%以上が必要。1科目でも下回ると不合格です。",
        ),
      ),
    );
  }
  const breakdown = h("div", {});
  for (const v of subjectScores) {
    breakdown.append(
      h(
        "div",
        { class: "row" },
        h("span", {}, `${v.subject}${v.passed ? " ✅" : " ✗"}`),
        bar(v.scorePct),
        h("span", {}, `${v.correct}/${v.total}`),
      ),
    );
  }
  root.append(breakdown);
}

/** 二次の合算判定セクション（#48）。電力管理(120)＋機械制御(60) の合算で 108/180(60%) を判定。 */
function examSecondarySection(root: HTMLElement, set: Problem[], results: boolean[]): void {
  const sec = scoreSecondary(set, results);
  root.append(
    h(
      "div",
      { class: "card", style: `border-color:${sec.passed ? "var(--ok)" : "var(--ng)"}` },
      h(
        "strong",
        {},
        sec.passed
          ? `✅ 二次 合格判定（合算 ${sec.totalPoints}/${sec.totalMax}点）`
          : `✗ 二次 不合格（合算 ${sec.totalPoints}/${sec.totalMax}点）`,
      ),
      h(
        "div",
        { class: "muted" },
        "二次は電力・管理(120点)と機械・制御(60点)の合算で60%（108/180）以上が合格。科目別ではありません。",
      ),
    ),
  );
  const breakdown = h("div", {});
  for (const s of sec.perSubject) {
    const pct = s.max > 0 ? Math.round((s.points / s.max) * 100) : 0;
    breakdown.append(
      h(
        "div",
        { class: "row" },
        h("span", {}, s.subject),
        bar(pct),
        h("span", {}, `${Math.round(s.points)}/${s.max}点`),
      ),
    );
  }
  root.append(breakdown);
}

function examReviewSection(root: HTMLElement): void {
  // 見直し: 模試をスコアで終わらせず学習に繋げる（テスト効果の回収）。
  // biome-ignore lint/style/noNonNullAssertion: renderExamResult の `if (!exam) return` 後に呼ばれるため exam は非 null。
  const wrong = exam!.set.filter((_, i) => !exam!.results[i]);
  root.append(h("h2", {}, "見直し（問題別の結果）"));
  // 試験中に「見直す」と印を付けた問題。正誤に関わらず、迷った箇所は本人が一番よく分かっている。
  // biome-ignore lint/style/noNonNullAssertion: 同上 — renderExamResult でガード済み。
  const flaggedIdx = exam!.flagged ?? [];
  if (flaggedIdx.length > 0) {
    // biome-ignore lint/style/noNonNullAssertion: 同上。
    const flaggedProblems = flaggedIdx.map((i) => exam!.set[i]).filter((p): p is NonNullable<typeof p> => !!p);
    root.append(
      h("p", { class: "muted" }, `🚩 試験中に見直しフラグを付けた問題が ${flaggedProblems.length} 問あります。`),
      h(
        "button",
        { class: "primary", type: "button", onclick: () => startDrill(flaggedProblems) },
        `▶ 見直しフラグだけ再演習（${flaggedProblems.length}問）`,
      ),
    );
  }
  if (wrong.length > 0) {
    root.append(
      h(
        "button",
        { class: "primary", type: "button", onclick: () => startDrill(wrong) },
        `▶ 間違いだけ再演習（${wrong.length}問）`,
      ),
    );
  }
  const reviewList = h("div", { class: "exam-review" });
  // biome-ignore lint/style/noNonNullAssertion: 同上 — renderExamResult でガード済み。
  exam!.set.forEach((p, i) => {
    // biome-ignore lint/style/noNonNullAssertion: 同上 — renderExamResult でガード済み。
    const ok = exam!.results[i] === true;
    const details = h(
      "details",
      {},
      h(
        "summary",
        {},
        h("span", { class: ok ? "ok" : "ng" }, ok ? "⭕" : "❌"),
        h("span", { class: "qtitle" }, ` 第${i + 1}問 ${p.subject}・${p.topic}`),
      ),
      h("div", { class: "stmt-sm", html: safeHtml(formatMath(p.statement)) }),
      solutionNode(p, "解説"),
    );
    reviewList.append(details);
  });

  // 見直し一括展開/畳むボタン（II-168）: 30件超の見直しで全開/全閉ができる。
  const detailsAll = Array.from(reviewList.querySelectorAll("details")) as HTMLDetailsElement[];
  if (detailsAll.length > 0) {
    const expandBtn = h(
      "button",
      {
        class: "chip",
        type: "button",
        onclick: () => {
          const anyOpen = detailsAll.some((d) => d.open);
          for (const d of detailsAll) d.open = !anyOpen;
          expandBtn.textContent = anyOpen ? "▼ すべて展開" : "▲ すべて畳む";
        },
      },
      "▼ すべて展開",
    );
    root.append(expandBtn);
  }

  root.append(
    reviewList,
    h(
      "button",
      {
        class: "primary",
        type: "button",
        onclick: () => endExam(),
      },
      "もう一度",
    ),
  );
}

export function renderExamResult(root: HTMLElement): void {
  if (!exam) return;
  // 結果画面遷移時にタイマーを確実に停止（II-156 タイマーリーク解消）。
  clearExamTimer();
  const isSecondary = exam.preset === "secondary";
  // 単一パスで集計（II-163）: score/subjectScores をここで1回計算してセクション関数へ渡す。
  const rawScore = scoreExam(exam.results);
  // 二次は合算判定（108/180）。見出しの得点率・合否は合算ベースに差し替える（#48）。
  const sec = isSecondary ? scoreSecondary(exam.set, exam.results) : null;
  const score = sec ? { ...rawScore, scorePct: sec.scorePct, passed: sec.passed } : rawScore;
  const mins = Math.floor((Date.now() - exam.startedAt) / 60000);
  // 科目別内訳（電験一次は科目ごとに合否＝各60%）
  const subjectScores = scoreExamBySubject(exam.set, exam.results);

  // 祝賀は初回表示の1回だけ（タブ往復での再発火を防ぐ）。
  if (!exam.celebrated) {
    exam.celebrated = true;
    const reward = processRewards({
      questsClear: exam.questsClearAtStart,
      weeklyClear: exam.weeklyClearAtStart,
    });
    const goal = getDailyGoal(storage);
    if (exam.todayCountAtStart < goal && todayCount() >= goal) {
      reward.celebrations.push(`🎉 模試で今日の目標 ${goal} 問を達成！`);
      reward.fanfare = reward.fanfare ?? "clear";
    }
    if (score.passed || reward.celebrations.length > 0) {
      confettiBurst(reward.bigConfetti ? 64 : 32);
      playTone(reward.fanfare ?? "clear", getSoundLevel(storage));
    }
    if (reward.celebrations.length > 0) {
      // celebrations.length > 0 を直前でチェック済みのため安全。
      showToast(reward.celebrations[0] as string, "OK", () => {});
    }
    renderHeader();
  }

  // 結果を履歴に保存（初回のみ。タブ往復での二重保存を防ぐ）（#13）。
  if (!exam.historySaved) {
    exam.historySaved = true;
    const subjects = [...new Set(exam.set.map((p) => p.subject))];
    const passed = exam.preset === "primary" ? primaryVerdict(subjectScores) === "pass" : score.passed;
    // 年度別通し模試(year)は履歴上は単一科目の通常模試として "all" に丸める（合否はスコア60%判定）。
    const historyPreset: ExamHistoryPreset = exam.preset === "year" ? "all" : exam.preset;
    appendExamHistory(storage, {
      atMs: Date.now(),
      preset: historyPreset,
      subjects,
      scorePct: score.scorePct,
      total: exam.set.length,
      passed,
    });
  }

  examScoreSection(root, score, mins);
  if (sec) examSecondarySection(root, exam.set, exam.results);
  else examSubjectSection(root, subjectScores);
  // 攻略記事カード（17-B18）: noteUrl 設定時のみ。判定直後は作戦情報の需要が最大。
  // （間違いの再演習は examReviewSection 既存の「間違いだけ再演習」が担う＝重複導線を作らない）
  const noteCard = examNoteCard();
  if (noteCard) root.append(noteCard);
  examReviewSection(root);
}
