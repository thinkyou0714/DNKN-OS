/**
 * views/dashboard.ts — 進捗タブの描画。
 * renderDashboard をセクション関数へ分解（I-054）:
 * levelCard / todaySection / xpChartSection / masterySection / statsSection / badgesSection
 */

import { withUtm } from "../../../lib/analytics/utm.js";
import { foundationGaps } from "../../../lib/curriculum/gaps.js";
import { buildLearningPath, nextUp } from "../../../lib/curriculum/path.js";
import { getPrincipleCard } from "../../../lib/curriculum/principles.js";
import { hashSeed } from "../../../lib/shared/rng.js";
import { evaluateAchievements } from "../achievements.js";
import { recordClick } from "../bridge.js";
import { BRIDGE } from "../bridge-config.js";
import { masteredConceptAreas } from "../concept-graph.js";
import {
  accuracyTrend,
  allSubjectReadiness,
  bySubject,
  byTopic,
  dailyActivity,
  masteryLevel,
  overall,
  recentAccuracy,
  reviewForecast,
  type SubjectReadiness,
  topicSubjectMap,
} from "../dashboard.js";
import { dayIndex, JST_OFFSET_MS, sameJstDay } from "../dates.js";
import { buildDerivationDrill } from "../derivation.js";
import { loadFreezeState } from "../freeze.js";
import { buildStudyPlan } from "../plan.js";
import { areaProblemPool, foundationGapHint, roadmapChipModel } from "../roadmap.js";
import { getDailyGoal, getExamDate, isOnboarded } from "../settings.js";
import { problems, progress, storage } from "../state/app.js";
import { practice as practiceState } from "../state/practice.js";
import { ghostRace, masteredTopics, myStats } from "../stats.js";
import { h } from "../ui/dom.js";
import { showToast } from "../ui/toast.js";
import { bar, emptyState, masteryChip, ringNode, sparklineNode } from "../ui/widgets.js";
import { type levelInfo, xpByDay, xpBySubject } from "../xp.js";
import { subjectNoteChip } from "./bridge-cards.js";
import { renderOrderingDrillBody } from "./drills.js";
import { currentLevel, freezeInfo, questsCard, weeklyQuestsCard } from "./practice.js";
import { startDrill } from "./review.js";
import { switchView } from "./router.js";

/** レベルカード（XP・称号・次レベルへの進捗）— 成長の実感を最上段に。 */
function levelCard(root: HTMLElement, lv: ReturnType<typeof levelInfo>): void {
  root.append(
    h(
      "div",
      { class: "card lvlcard" },
      h(
        "div",
        { class: "lvlrow" },
        h("span", { class: "lvlbadge" }, `Lv.${lv.level}`),
        h(
          "div",
          {},
          h("div", { class: "lvltitle" }, lv.title),
          h(
            "div",
            { class: "muted small" },
            `次のレベルまで ${lv.xpNeed - lv.xpInto} XP ・ 累計 ${lv.totalXp.toLocaleString("ja-JP")} XP` +
              (lv.nextTitle ? ` ・ Lv.${lv.nextTitle.level}で「${lv.nextTitle.title}」` : ""),
          ),
        ),
      ),
      bar(Math.round(lv.progress * 100), "次のレベルへの進捗"),
    ),
  );
}

/** 今日の学習進捗と試験カウントダウンのカード群。 */
function todaySection(
  root: HTMLElement,
  logs: ReturnType<typeof progress.logs>,
  plan: ReturnType<typeof buildStudyPlan>,
  o: ReturnType<typeof overall>,
): void {
  root.append(
    h(
      "div",
      { class: "grid2" },
      h(
        "div",
        { class: "card" },
        h("div", { class: "muted" }, "試験まで"),
        h("div", { class: "big" }, `${plan.daysLeft}日`),
      ),
      h(
        "div",
        { class: "card" },
        h("div", { class: "muted" }, "総合正答率"),
        h("div", { class: "big" }, `${Math.round(o.accuracy * 100)}%`),
      ),
    ),
    h(
      "div",
      { class: "grid2" },
      h(
        "div",
        { class: "card today" },
        ringNode(plan.todayCount, plan.dailyGoal),
        h(
          "div",
          {},
          h("div", { class: "muted" }, "今日の学習"),
          h("div", {}, `${plan.todayCount} / ${plan.dailyGoal} 問 ${plan.metToday ? "✅" : ""}`),
        ),
      ),
      h(
        "div",
        { class: "card" },
        h("div", { class: "muted" }, "推奨ペース"),
        h("div", {}, `1日 ${plan.recommendedPerDay} 問（2巡）`),
      ),
    ),
    h(
      "p",
      { class: "muted" },
      `総解答 ${o.attempts} 問 ・ 学習論点 ${o.topicsStudied} ・ 直近20問 ${Math.round(recentAccuracy(logs) * 100)}%`,
    ),
    questsCard(),
    weeklyQuestsCard(),
  );
}

/** 週間XPチャートとスパークラインのセクション。 */
function xpChartSection(root: HTMLElement, logs: ReturnType<typeof progress.logs>): void {
  // 週間XPチャート（「昨日の自分」との比較は他人比較より健全な競争心を生む）。
  const weekly = xpByDay(logs, 7, Date.now());
  if (weekly.some((v) => v > 0)) {
    const max = Math.max(1, ...weekly);
    const fmt = new Intl.DateTimeFormat("ja-JP", { weekday: "narrow", timeZone: "Asia/Tokyo" });
    const chart = h("div", { class: "xpweek" });
    weekly.forEach((v, i) => {
      const dayLabel = i === 6 ? "今日" : fmt.format(new Date(Date.now() - (6 - i) * 86_400_000));
      chart.append(
        h(
          "div",
          { class: "xpcol" },
          h("div", { class: "xpval" }, v > 0 ? String(v) : ""),
          h("div", { class: "xpbar", style: `height:${Math.max(4, Math.round((v / max) * 64))}px` }),
          h("div", { class: "xplabel" }, dayLabel),
        ),
      );
    });
    root.append(h("h2", {}, "今週の獲得XP"), chart);
  }

  const spark = sparklineNode(accuracyTrend(logs));
  if (spark) root.append(h("h2", {}, "正答率の推移"), spark);
}

/** 科目別到達度・XPのセクション。 */
function masterySection(root: HTMLElement, logs: ReturnType<typeof progress.logs>): void {
  root.append(h("h2", {}, "科目別 到達度"));
  const subjectXp = xpBySubject(logs, topicSubjectMap(problems));
  const maxSubjectXp = Math.max(1, ...subjectXp.values());
  for (const r of bySubject(logs, problems)) {
    const level = masteryLevel(r);
    root.append(
      h("div", { class: "row" }, h("span", {}, r.subject), bar(Math.round(r.accuracy * 100)), masteryChip(level)),
    );
  }

  // 科目別XP（学習量バランスの可視化。到達度=質、XP=量の両輪で偏りに気づける）。
  root.append(h("h2", {}, "科目別 獲得XP"));
  for (const [subject, xp] of [...subjectXp.entries()].sort((a, b) => b[1] - a[1])) {
    root.append(
      h(
        "div",
        { class: "row" },
        h("span", {}, subject),
        bar(Math.round((xp / maxSubjectXp) * 100)),
        h("span", {}, `${xp.toLocaleString("ja-JP")}`),
      ),
    );
  }
}

/** 科目別 合格見込み（推定）のセクション（#52）。正答率＋カバレッジ＋残り日数で判定。 */
function readinessSection(root: HTMLElement, logs: ReturnType<typeof progress.logs>, daysLeft: number): void {
  const rows = allSubjectReadiness(logs, problems, daysLeft);
  // 全科目とも未着手なら出さない（空のセクションを避ける）。
  if (rows.every((r) => r.attempts === 0)) return;
  const verdictStyle = (v: SubjectReadiness["verdict"]): string =>
    v === "順調" ? "color:var(--ok)" : v === "もう少し" ? "color:var(--accent)" : "color:var(--ng)";
  const verdictIcon = (v: SubjectReadiness["verdict"]): string =>
    v === "順調" ? "🟢" : v === "もう少し" ? "🟡" : "🔴";
  root.append(
    h("h2", {}, "科目別 合格見込み（推定）"),
    h(
      "p",
      { class: "muted small" },
      "直近の正答率・論点カバレッジ・残り日数からの推定です（合否を保証するものではありません）。",
    ),
  );
  for (const r of rows) {
    root.append(
      h(
        "div",
        { class: "row" },
        h("span", {}, r.subject),
        bar(Math.round(r.readiness * 100)),
        h(
          "span",
          { style: verdictStyle(r.verdict) },
          `${verdictIcon(r.verdict)} ${r.verdict} ${Math.round(r.readiness * 100)}%`,
        ),
      ),
    );
  }
  // 最初の「要強化」科目にだけ、建設的な次アクションを添える（17-C7/B19。乱発しない）。
  const worst = rows.find((r) => r.verdict === "遅れ");
  if (worst) {
    const actions = h(
      "div",
      { class: "drill-actions" },
      h(
        "button",
        {
          class: "chip",
          type: "button",
          onclick: () => {
            practiceState.subject = worst.subject;
            practiceState.pool = null;
            switchView("practice");
          },
        },
        `▶ ${worst.subject} を強化する`,
      ),
    );
    // 科目別の攻略 note（設定済み科目のみ。未設定なら内部導線だけ）。
    const chip = subjectNoteChip(worst.subject, "dashboard");
    if (chip) actions.append(chip);
    root.append(actions);
  }
}

/**
 * 体系学習ロードマップのセクション（旧「学習順のおすすめ」を拡張）。
 * 前提グラフのトポロジカル順に全領域を段階表示し、到達状態（🎓/▶/🔒）を付ける。
 * 「次はここから」の領域には原理カード（なぜ成り立つか・導出の筋道・納得チェック）を
 * 開けるようにし、全領域ぶんのカードも体系順で閲覧できる。
 * 「公式をそういうものだと受け入れて終わる」読み上げ学習に、原理→納得→演習の順序を与える。
 * 表示モデルの分岐は roadmap.ts の純ロジック（テスト対象）に委譲する。
 */
function learningOrderSection(root: HTMLElement, logs: ReturnType<typeof progress.logs>): void {
  const masteredAreas = masteredConceptAreas(masteredTopics(logs));
  const path = buildLearningPath(masteredAreas);
  if (path.total === 0) return;
  root.append(
    h("h2", {}, "体系学習ロードマップ"),
    h(
      "p",
      { class: "muted small" },
      `基礎→応用の前提順で全${path.total}領域（到達 ${path.masteredCount}/${path.total}・習得済みの論点からの推定）。` +
        "「なぜ？」を開いて原理から納得してから演習に進むのがおすすめです。",
    ),
  );
  // 段階（体系深さ）ごとのチップ表示。🎓=到達（推定） ▶=着手可 🔒=前提不足。
  path.stages.forEach((stage, i) => {
    const chips = h("div", { class: "concept-chips" });
    for (const s of stage) {
      const m = roadmapChipModel(s);
      chips.append(h("span", { class: m.className, ...(m.title !== undefined ? { title: m.title } : {}) }, m.label));
    }
    root.append(h("div", { class: "muted small" }, `第${i + 1}段階`), chips);
  });
  // 「次はここから」の領域に原理カードを添える（多すぎると読まれないので2件まで）。
  for (const step of nextUp(path, 2)) {
    const node = principleCardDetails(step.area);
    if (node) root.append(node);
  }
  // 全領域の原理カードを体系順で閲覧できるブラウザ（折りたたみ。到達状態のアイコンつき）。
  const browser = h(
    "details",
    { class: "card" },
    h("summary", {}, `📚 全${path.total}領域の原理カード（体系順）`),
    h("p", { class: "muted small" }, "基礎から順に「なぜそうなるのか」をまとめています。復習の目次としても使えます。"),
  );
  for (const s of path.steps) {
    const icon = s.status === "mastered" ? "🎓" : s.status === "ready" ? "▶" : "🔒";
    const node = principleCardDetails(s.area, icon);
    if (node) browser.append(node);
  }
  root.append(browser);
}

/**
 * 原理カード1枚の <details> 要素を作る。導出の並べ替えドリル（原理の手続き記憶の確認）と、
 * その領域の問題プールで演習を始める導線を付ける。カードが無い領域は null。
 */
function principleCardDetails(area: string, statusIcon = "💡"): HTMLElement | null {
  const card = getPrincipleCard(area);
  if (!card) return null;
  const pool = areaProblemPool(area, problems);
  const body = h(
    "details",
    { class: "card" },
    h("summary", {}, `${statusIcon} ${card.area} — なぜそうなるのか？`),
    h("p", {}, card.coreIdea),
    h("p", { class: "muted" }, card.why),
    h("div", { class: "muted small" }, "導出の筋道:"),
    h("ol", {}, ...card.derivation.map((d) => h("li", {}, d))),
    h("div", { class: "muted small" }, "「そういうもの」で流しがちな点:"),
    h("ul", {}, ...card.pitfalls.map((p) => h("li", {}, p))),
  );
  if (card.checks.length > 0) {
    body.append(h("div", { class: "muted small" }, "納得チェック（自分の言葉で答えてから開く）:"));
    for (const c of card.checks) {
      body.append(h("details", {}, h("summary", {}, `Q. ${c.question}`), h("p", { class: "muted" }, `A. ${c.answer}`)));
    }
  }
  // 原理導出ドリル（導出ステップの並べ替え）と演習導線。ドリルはボタンを押したときだけ描画する。
  const drillHost = h("div", {});
  const actions = h(
    "div",
    { class: "drill-actions" },
    h(
      "button",
      {
        class: "chip",
        type: "button",
        onclick: () => {
          // seed は領域名から決定論的に作る（同じ領域なら毎回同じ提示順）。
          const drill = buildDerivationDrill(card.derivation, hashSeed(card.area));
          if (drill) renderOrderingDrillBody(drillHost, drill);
        },
      },
      "🧩 導出を並べ替えで確認",
    ),
  );
  if (pool.length > 0) {
    actions.append(
      h(
        "button",
        { class: "chip", type: "button", onclick: () => startDrill(pool) },
        `▶ この領域を演習（${pool.length}問）`,
      ),
    );
  }
  body.append(actions, drillHost);
  return body;
}

/** 自分の記録・ゴーストレース・弱点論点・マスター済み論点のセクション。 */
function statsSection(
  root: HTMLElement,
  logs: ReturnType<typeof progress.logs>,
  lv: ReturnType<typeof levelInfo>,
): void {
  // 自分の記録（他人とのランキングではなく自己ベスト＝オフラインで成立する健全な競争）。
  const fzStat = loadFreezeState(storage);
  const st = myStats(logs, fzStat.usedDays, fzStat.restDays);
  const xpPerDay = st.studyDays > 0 ? Math.round(lv.totalXp / st.studyDays) : 0;
  const o = overall(logs);
  root.append(
    h("h2", {}, "自分の記録"),
    // これまでのあゆみ（累計の一行サマリー。続けてきた事実そのものを称える）。
    h(
      "p",
      { class: "muted" },
      `📖 これまでに ${o.attempts.toLocaleString("ja-JP")} 問・${lv.totalXp.toLocaleString("ja-JP")} XP・` +
        `${st.studyDays} 日間 学習してきました`,
    ),
    h(
      "div",
      { class: "mystats" },
      ...(
        [
          [String(st.studyDays), "学習日数"],
          [`${st.bestStreakEver}日`, "歴代最長🔥"],
          [String(xpPerDay), "XP/学習日"],
          [String(st.bestCombo), "最高コンボ"],
          [String(st.bestDayCount), "1日最多解答"],
          [String(st.questClearDays), "クエスト全達成日"],
          [String(st.perfectDays), "パーフェクトデー"],
          [String(st.freezeSaves), "お守りの救援"],
          [String(masteredTopics(logs).length), "マスター論点"],
        ] as const
      ).map(([num, label]) =>
        h("div", { class: "stat" }, h("div", { class: "sn" }, num), h("div", { class: "sl" }, label)),
      ),
    ),
  );

  // ゴーストレース: 「過去7日の自分」と今日のXPで競う（オフラインで成立する健全な競争）。
  const race = ghostRace(xpByDay(logs, 8, Date.now()));
  if (race.today > 0 || race.avg > 0) {
    root.append(
      h(
        "div",
        { class: "card race" },
        h(
          "span",
          {},
          race.beat
            ? "🏁 今日は「過去7日の自分」を超えています！"
            : `🏃 7日平均の自分まで あと ${Math.max(1, race.avg - race.today + 1)} XP`,
        ),
        h("span", { class: "muted small" }, `今日 ${race.today} XP ／ 7日平均 ${race.avg} XP`),
      ),
    );
  }

  const weak = byTopic(logs)
    .filter((t) => t.attempts > 0)
    .slice(0, 5);
  if (weak.length > 0) {
    root.append(h("h2", {}, "弱点 論点 TOP5"));
    for (const t of weak) {
      root.append(
        h(
          "div",
          { class: "row" },
          h("span", { style: "white-space:nowrap;overflow:hidden;text-overflow:ellipsis" }, t.topic),
          bar(Math.round(t.accuracy * 100)),
          h("span", {}, `${Math.round(t.accuracy * 100)}%`),
        ),
      );
    }
    // 弱点の根っこ診断: 前提領域の不足が疑われるときだけ1件添える（乱発しない）。
    // 「弱点＝その論点の演習不足」と決めつけず、体系の穴（前提の欠け）の可能性を示す。
    const gap = foundationGaps(
      weak.map((t) => t.topic),
      masteredConceptAreas(masteredTopics(logs)),
    )[0];
    if (gap) {
      root.append(
        h(
          "div",
          { class: "card" },
          h("strong", {}, "🧭 弱点の根っこ診断"),
          h("div", { class: "muted" }, foundationGapHint(gap)),
        ),
      );
    }
    // 課題認識→解決策の順で内部導線を1つだけ（17-C6。学習タブは苦手優先出題が既定）。
    // 旧ドリルプールが残っていると「弱点優先」にならないため、遷移前に通常モードへ正規化する。
    root.append(
      h(
        "button",
        {
          class: "chip",
          type: "button",
          onclick: () => {
            practiceState.pool = null;
            practiceState.subject = "all";
            switchView("practice");
          },
        },
        "⚡ 弱点を演習で潰す →",
      ),
    );
  }

  // マスター済み論点（「余裕」評価×3。弱点の隣に「できるようになったこと」も見せる）。
  const mastered = masteredTopics(logs);
  if (mastered.length > 0) {
    const chips = h("div", { class: "mchips" });
    for (const t of mastered.slice(0, 12)) chips.append(h("span", { class: "mchip" }, `🎓 ${t}`));
    if (mastered.length > 12) chips.append(h("span", { class: "mchip more" }, `ほか ${mastered.length - 12} 論点`));
    root.append(h("h2", {}, `マスター済み論点（${mastered.length}）`), chips);
  }

  const fc = reviewForecast(progress.allCardViews().values(), Date.now(), 7);
  root.append(
    h("h2", {}, "今後7日の復習見込み"),
    h(
      "div",
      { class: "toolbar" },
      ...fc.map((n, i) =>
        h(
          "div",
          { class: "card", style: "flex:1;text-align:center;min-width:2.4rem" },
          h("div", { class: "muted" }, i === 0 ? "今日" : `+${i}`),
          h("div", {}, String(n)),
        ),
      ),
    ),
  );

  // 学習ヒートマップ（直近14日の解答数。GitHub風の強度セル）
  const activity = dailyActivity(logs, 14, Date.now());
  const maxCount = Math.max(1, ...activity.map((a) => a.count));
  root.append(
    h("h2", {}, "学習ヒートマップ（直近14日）"),
    h(
      "div",
      { class: "heat" },
      ...activity.map((a) => {
        const lv = a.count === 0 ? 0 : Math.min(4, 1 + Math.floor((a.count / maxCount) * 3.99));
        return h("div", {
          class: `cell lv${lv}`,
          title: `${a.offset === 0 ? "今日" : `${a.offset}日前`}: ${a.count}問`,
        });
      }),
    ),
    h("p", { class: "muted" }, "毎日少しずつが最強。分散学習が忘却に勝ちます。"),
  );
}

/** 実績バッジのセクション。 */
function badgesSection(
  root: HTMLElement,
  logs: ReturnType<typeof progress.logs>,
  lv: ReturnType<typeof levelInfo>,
): void {
  // 実績バッジ（節目の大きな報酬。ロック中も見せて「次の目標」を提示する）。
  const fiBadge = freezeInfo();
  const badges = evaluateAchievements({
    logs,
    streakDays: fiBadge.streak,
    level: lv.level,
    subjectOf: topicSubjectMap(problems),
    usedFreezeDays: fiBadge.state.usedDays,
  });
  const unlockedCount = badges.filter((b) => b.unlocked).length;
  const grid = h("div", { class: "badges" });
  for (const b of badges) {
    const node = h(
      b.unlocked ? "button" : "div",
      {
        class: b.unlocked ? "badge on" : "badge off",
        title: b.unlocked ? `${b.desc}（タップでシェア）` : b.desc,
        ...(b.unlocked ? { type: "button", onclick: () => shareBadge(b.title, b.icon, b.desc) } : {}),
      },
      h("span", { class: "bi", "aria-hidden": "true" }, b.unlocked ? b.icon : "🔒"),
      h("span", { class: "bt" }, b.title),
      h("span", { class: "bd" }, b.desc),
    );
    grid.append(node);
  }
  root.append(h("h2", {}, `実績バッジ（${unlockedCount}/${badges.length}・タップでシェア）`), grid);
}

/** 実績のシェア（Web Share API、無ければクリップボード）。学習の誇りを外へ＝自然な口コミ。 */
function shareBadge(title: string, icon: string, desc: string): void {
  const text = `🏅 電験学習アプリ DENKEN-OS で実績「${icon}${title}」を解除！（${desc}） #電験 #デンタマ`;
  shareWithAppUrl(text, "badge");
}

/**
 * シェア共通処理（17-C9/C10）: 本文は従来どおり・appUrl 設定時のみ url フィールドに
 * UTM 付きリンクを添えて流入元を計測可能にする。クリックは台帳に記録。
 */
function shareWithAppUrl(text: string, campaign: string): void {
  recordClick(storage, "share", campaign);
  let url = "";
  if (BRIDGE.appUrl !== "") {
    try {
      url = withUtm(BRIDGE.appUrl, { source: "share", medium: "social", campaign });
    } catch {
      url = BRIDGE.appUrl; // スキーム無し等の設定ミスでもシェア自体は生かす
    }
  }
  try {
    if (typeof navigator.share === "function") {
      void navigator.share(url !== "" ? { text, url } : { text }).catch(() => {});
      return;
    }
    const full = url !== "" ? `${text}\n${url}` : text;
    void navigator.clipboard?.writeText(full).then(() => showToast("📋 シェア文をコピーしました", "OK", () => {}));
  } catch {
    // シェア不能でも学習は続行。
  }
}

// ---- 橋渡し収益: 節目カード・月次リキャップ・記録書き出し（17-C8/C23/C24/B22） ----

const SEEN_CD_MILESTONE_KEY = "denken:seenCdMilestone";
const SEEN_EXAM_DONE_KEY = "denken:seenExamDone";
const SEEN_MONTHLY_RECAP_KEY = "denken:seenMonthlyRecap";

/**
 * 試験カウントダウンの節目カード（100/60/30日を跨いだ初回だけ・各1回）。
 * 既読は「試験日:節目」の組で保存する — 試験日を翌年に更新した多年度戦ユーザー（C23）にも
 * 新しいサイクルで節目ナッジが再び働くようにする。
 */
function countdownMilestoneCard(root: HTMLElement, daysLeft: number): void {
  if (daysLeft <= 0) return;
  const milestone = [30, 60, 100].find((m) => daysLeft <= m);
  if (milestone === undefined) return;
  const examDate = getExamDate(storage);
  const raw = storage.getItem(SEEN_CD_MILESTONE_KEY) ?? "";
  const [seenDate, seenStr] = raw.split(":");
  const seen = Number(seenStr);
  if (seenDate === examDate && Number.isFinite(seen) && seen > 0 && seen <= milestone) return; // 表示済み
  try {
    storage.setItem(SEEN_CD_MILESTONE_KEY, `${examDate}:${milestone}`);
  } catch {
    // 保存不能でも表示は続行。
  }
  root.append(
    h(
      "div",
      { class: "card" },
      h("strong", {}, `⏳ 試験まで ${daysLeft} 日`),
      h(
        "div",
        { class: "muted" },
        milestone <= 30
          ? "直前期です。新しい範囲より弱点の集中復習と模試での実戦感覚を。残り日数で挽回できます。"
          : "計画の見直しどき。1日の目標問題数と復習上限を設定タブで調整できます。",
      ),
    ),
  );
}

/** 試験日経過後の労いカード（合否に触れない。多年度戦の離脱防止 17-C23）。 */
function examDoneCard(root: HTMLElement, logs: ReturnType<typeof progress.logs>): void {
  // daysUntil は 0 でクランプされ「当日」と「経過後」を区別できないため、JST 日付を直接比較する。
  // 当日は受験前の朝に出てしまうため翌日以降のみ。試験日を一度も設定していない
  // （オンボーディング未完了で既定日のままの）ユーザーにも出さない。
  const examDate = getExamDate(storage);
  const todayJst = new Date(Date.now() + JST_OFFSET_MS).toISOString().slice(0, 10);
  if (todayJst <= examDate || !isOnboarded(storage)) return;
  if (storage.getItem(SEEN_EXAM_DONE_KEY) === examDate) return;
  try {
    storage.setItem(SEEN_EXAM_DONE_KEY, examDate);
  } catch {
    // 保存不能でも表示は続行。
  }
  const days = new Set(logs.map((l) => dayIndex(l.atMs, JST_OFFSET_MS))).size;
  const text = `⚡ 電験の試験勉強、${days}日間で${logs.length}問を積み上げました。おつかれさま自分！ #電験 #デンタマ`;
  root.append(
    h(
      "div",
      { class: "card" },
      h("strong", {}, "🌸 試験おつかれさまでした"),
      h(
        "div",
        { class: "muted" },
        `あなたはここまで ${days} 日間・${logs.length.toLocaleString("ja-JP")} 問を積み上げました。` +
          "結果がどうであれ、この積み重ねは消えません。次の試験日は設定タブから更新できます。",
      ),
      h(
        "div",
        { class: "drill-actions" },
        h("button", { class: "chip", type: "button", onclick: () => shareWithAppUrl(text, "exam-done") }, "📣 シェア"),
        h("button", { class: "chip", type: "button", onclick: () => switchView("settings") }, "試験日を更新 →"),
      ),
    ),
  );
}

/** 月次リキャップ（月替わり初回のみ。前月の学習日数・解答数・正答率＋シェア 17-C24）。 */
function monthlyRecapCard(root: HTMLElement, logs: ReturnType<typeof progress.logs>): void {
  const now = new Date(Date.now() + JST_OFFSET_MS);
  const thisMonth = now.toISOString().slice(0, 7); // YYYY-MM (JST)
  if (storage.getItem(SEEN_MONTHLY_RECAP_KEY) === thisMonth) return;
  const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const prevMonth = prev.toISOString().slice(0, 7);
  const monthLogs = logs.filter((l) => new Date(l.atMs + JST_OFFSET_MS).toISOString().slice(0, 7) === prevMonth);
  if (monthLogs.length === 0) return; // 前月の記録がなければ出さない（既読にもしない）
  try {
    storage.setItem(SEEN_MONTHLY_RECAP_KEY, thisMonth);
  } catch {
    // 保存不能でも表示は続行。
  }
  const days = new Set(monthLogs.map((l) => dayIndex(l.atMs, JST_OFFSET_MS))).size;
  const correct = monthLogs.filter((l) => l.correct).length;
  const acc = Math.round((correct / monthLogs.length) * 100);
  const label = `${Number(prevMonth.slice(5, 7))}月`;
  const text = `📊 ${label}の電験学習: ${days}日・${monthLogs.length}問・正答率${acc}%（DENKEN-OS） #電験 #デンタマ`;
  root.append(
    h(
      "div",
      { class: "card" },
      h("strong", {}, `📊 ${label}のあゆみ`),
      h(
        "div",
        { class: "muted" },
        `学習 ${days} 日 ・ ${monthLogs.length.toLocaleString("ja-JP")} 問 ・ 正答率 ${acc}%`,
      ),
      h(
        "div",
        { class: "drill-actions" },
        h("button", { class: "chip", type: "button", onclick: () => shareWithAppUrl(text, "monthly") }, "📣 シェア"),
      ),
    ),
  );
}

/** 学習記録の Markdown 書き出し（17-B22）。note/X にそのまま貼れる素材＝UGC 相互送客。 */
function recordExportButton(root: HTMLElement, logs: ReturnType<typeof progress.logs>): void {
  root.append(
    h(
      "button",
      {
        class: "chip",
        type: "button",
        onclick: () => {
          const o = overall(logs);
          const days = new Set(logs.map((l) => dayIndex(l.atMs, JST_OFFSET_MS))).size;
          const weak = byTopic(logs)
            .filter((t) => t.attempts > 0)
            .slice(0, 3)
            .map((t) => `- ${t.topic}（正答率 ${Math.round(t.accuracy * 100)}%）`)
            .join("\n");
          const md =
            `## 電験二種 学習記録\n\n- 学習日数: ${days} 日\n- 解答数: ${logs.length} 問\n` +
            `- 正答率: ${Math.round(o.accuracy * 100)}%\n\n### いまの弱点\n${weak || "-"}\n\n` +
            `（DENKEN-OS${BRIDGE.appUrl !== "" ? ` ${BRIDGE.appUrl}` : ""} で記録）\n`;
          void navigator.clipboard?.writeText(md).then(
            () => showToast("📋 Markdownをコピーしました（note/Xにどうぞ）", "OK", () => {}),
            () => showToast("⚠️ コピーできませんでした", "OK", () => {}),
          );
        },
      },
      "📝 記録を書き出す（Markdown）",
    ),
  );
}

export function renderDashboard(root: HTMLElement): void {
  const logs = progress.logs();
  if (logs.length === 0) {
    root.append(
      emptyState(
        "📊",
        "まだ学習記録がありません",
        "学習タブで問題を解くと、ここに到達度や正答率の推移が表示されます。",
      ),
      h("button", { class: "primary", type: "button", onclick: () => switchView("practice") }, "学習を始める →"),
    );
    return;
  }
  const o = overall(logs);
  const plan = buildStudyPlan({
    examDateIso: getExamDate(storage),
    totalProblems: problems.length,
    todayCount: progress.logs().filter((l) => sameJstDay(l.atMs, Date.now())).length,
    dailyGoal: getDailyGoal(storage),
  });

  const lv = currentLevel();

  levelCard(root, lv);
  // 節目・労い・月次のカード（各1回だけ。17-C8/C23/C24）。
  examDoneCard(root, logs);
  countdownMilestoneCard(root, plan.daysLeft);
  monthlyRecapCard(root, logs);
  todaySection(root, logs, plan, o);
  xpChartSection(root, logs);
  masterySection(root, logs);
  readinessSection(root, logs, plan.daysLeft);
  learningOrderSection(root, logs);
  statsSection(root, logs, lv);
  badgesSection(root, logs, lv);
  recordExportButton(root, logs);
}
