/**
 * mascot.ts — マスコット「シンクウ」（純ロジック＋インラインSVG）。
 *
 * Duolingo のフクロウが果たす役割の電験版: アプリを「教材」から「相棒」に変える。
 *  - 感情のあるキャラが進捗に反応する（達成を一緒に喜ぶ／ストリークの危機を心配する）と、
 *    無機質な数字より行動が変わる（擬人化ナッジ）。
 *  - メッセージは日替わりで言い回しを変える（毎回同じだと脳が無視する＝慣れ防止）。
 *  - 画像アセットなしのインラインSVG（オフラインPWA・図解と同じ方式）。
 *
 * 意匠: デザインシステム v2 の「朱の線画」に揃える。彩色はせず currentColor で描き、
 * 色は index.html の `.mface`（= var(--accent)）が与える＝明暗テーマに自動追従する。
 * 成長段階のアクセサリーは電気工事の装備で表す（見習い → 電気工事士 → 主任技術者）。
 * DOM 非依存でテスト可能。
 */
import type { StreakState } from "./retention.js";

export const MASCOT_NAME = "シンクウ";

export type MascotMood = "happy" | "cheer" | "worried" | "sad" | "sleepy";

const MOOD_LABEL: Record<MascotMood, string> = {
  happy: "にこにこ",
  cheer: "大よろこび",
  worried: "しんぱい",
  sad: "しょんぼり",
  sleepy: "おやすみ",
};

/** レベル帯（成長段階）。0=ノーマル / 1=Lv10+ / 2=Lv20+ / 3=Lv40+。 */
export type MascotTier = 0 | 1 | 2 | 3;

/** レベル → 成長段階。レベルが上がるとシンクウの装備が変わる（収集・成長の楽しみ）。 */
export function tierForLevel(level: number): MascotTier {
  if (level >= 40) return 3;
  if (level >= 20) return 2;
  if (level >= 10) return 1;
  return 0;
}

/** 眉（自信のある角度 / 気弱な角度）。内側が下がると強気、上がると弱気に見える。 */
function brows(mood: MascotMood): string {
  const weak = mood === "worried" || mood === "sad";
  if (weak) {
    return (
      `<path class="ln" d="M23.8 29.8 L29.4 28"/>` + //
      `<path class="ln" d="M40.2 29.8 L34.6 28"/>`
    );
  }
  return (
    `<path class="ln" d="M23.8 27.8 L29.4 29.4"/>` + //
    `<path class="ln" d="M40.2 27.8 L34.6 29.4"/>`
  );
}

/** 目（開き / 弧 / 閉じ）。 */
function eyes(mood: MascotMood): string {
  if (mood === "cheer") {
    return (
      `<path class="ln" d="M24.9 33.6 C26.1 31.4 27.9 31.4 29.1 33.6"/>` +
      `<path class="ln" d="M34.9 33.6 C36.1 31.4 37.9 31.4 39.1 33.6"/>`
    );
  }
  if (mood === "sleepy") {
    return (
      `<path class="ln" d="M24.9 32.9 L29.1 32.9"/>` + //
      `<path class="ln" d="M34.9 32.9 L39.1 32.9"/>`
    );
  }
  return `<circle class="fill" cx="27" cy="32.9" r="1.9"/><circle class="fill" cx="37" cy="32.9" r="1.9"/>`;
}

/** 口（気分ごとに差し替え）。 */
function mouth(mood: MascotMood): string {
  switch (mood) {
    case "cheer":
      // 開いた口（歓声）。内側を淡く塗って厚みを出す。
      return (
        `<path class="soft" d="M27.6 38.6 C30 43.8 34 43.8 36.4 38.6 Z"/>` +
        `<path class="ln" d="M27.6 38.6 C30 43.8 34 43.8 36.4 38.6 Z"/>`
      );
    case "worried":
      return `<path class="ln" d="M28.4 40.6 C29.8 39.2 31.2 41.2 32.6 39.9 C33.8 38.9 34.8 40.2 35.6 40.6"/>`;
    case "sad":
      return `<path class="ln" d="M28.2 41.6 C30.2 38.9 33.8 38.9 35.8 41.6"/>`;
    case "sleepy":
      return `<path class="ln" d="M30.4 39.8 C31.6 38.8 32.4 38.8 33.6 39.8 C32.4 40.9 31.6 40.9 30.4 39.8 Z"/>`;
    default:
      // 自信のある笑み。
      return `<path class="ln" d="M28.2 39.3 C30.2 42.2 33.8 42.2 35.8 39.3"/>`;
  }
}

/** 気分の添え物（汗・涙・zzz・歓喜の光）。表情だけに頼らず一目で伝える。 */
function moodExtra(mood: MascotMood): string {
  switch (mood) {
    case "worried":
      return `<path class="soft" d="M46.2 27.8 C47.8 30.6 48.2 32.4 46.6 33 C45.2 33.4 44.6 31.8 46.2 27.8 Z"/><path class="lnt" d="M46.2 27.8 C47.8 30.6 48.2 32.4 46.6 33 C45.2 33.4 44.6 31.8 46.2 27.8 Z"/>`;
    case "sad":
      return `<path class="soft" d="M25.6 35.8 C24.7 37.8 24.5 39 25.6 39.3 C26.7 39 26.5 37.8 25.6 35.8 Z"/><path class="lnt" d="M25.6 35.8 C24.7 37.8 24.5 39 25.6 39.3 C26.7 39 26.5 37.8 25.6 35.8 Z"/>`;
    case "sleepy":
      return (
        `<text class="fill" x="48" y="22.5" font-size="8.5" font-weight="700">z</text>` +
        `<text class="fill" x="53.5" y="14.5" font-size="6" font-weight="700">z</text>`
      );
    case "cheer":
      // 歓喜の輝き（4条の星。＋記号に見えないよう先を細らせる）。
      return (
        `<path class="fill" d="M11.8 13.8 L12.8 17 L16 18 L12.8 19 L11.8 22.2 L10.8 19 L7.6 18 L10.8 17 Z"/>` +
        `<path class="fill" d="M52 11.6 L52.7 14 L55.1 14.7 L52.7 15.4 L52 17.8 L51.3 15.4 L48.9 14.7 L51.3 14 Z"/>`
      );
    default:
      return "";
  }
}

/**
 * 髪（tier 0/1）またはヘルメット（tier 2/3）。
 * 髪は後ろへ流し、前髪の一房を額に垂らす＝シンクウの識別点。
 * 頭頂の跳ねはブランドの稲妻マークと同じ形にして、ロゴとキャラを一本の意匠でつなぐ。
 */
function headgear(tier: MascotTier): string {
  if (tier >= 2) {
    // 安全ヘルメット（電気工事の現場装備）。
    const emblem =
      tier === 3
        ? // 主任技術者: 前立てに金の稲妻。金は「達成」だけに使う色。
          `<path class="gold" d="M33.6 14.2 L29.4 20.4 L31.8 20.4 L30.6 24.4 L34.8 18 L32.4 18 Z"/>`
        : "";
    return (
      `<path class="soft" d="M16.4 28.4 C16.4 17.2 23.4 10.4 32 10.4 C40.6 10.4 47.6 17.2 47.6 28.4 Z"/>` +
      `<path class="ln" d="M16.4 28.4 C16.4 17.2 23.4 10.4 32 10.4 C40.6 10.4 47.6 17.2 47.6 28.4"/>` +
      `<path class="ln" d="M14.6 28.9 C21.6 26.6 42.4 26.6 49.4 28.9"/>` +
      `<path class="lnt" d="M22.8 13 C21.2 17.8 20.8 23.2 21 27.2"/>` +
      `<path class="lnt" d="M41.2 13 C42.8 17.8 43.2 23.2 43 27.2"/>` +
      emblem +
      // ヘルメットの下からのぞく揉み上げ。
      `<path class="lnt" d="M21.2 29.2 C20.8 31.6 21 33.6 21.6 35"/>` +
      `<path class="lnt" d="M42.8 29.2 C43.2 31.6 43 33.6 42.4 35"/>`
    );
  }
  return (
    // 後ろへ流した髪。輪郭と生え際の2本だけで描き、線を重ねない（小サイズで潰れないため）。
    // 生え際は左が下がり右が上がる非対称にして「流している」ことを示す。
    `<path class="soft" d="M20.2 30.5 C18.4 19.2 23.6 11.8 32 11.6 C40.4 11.4 45.6 18.4 43.8 30.5 C41.8 23.2 38 20.8 32.6 20.6 C27.2 20.4 23 22.8 21 28.4 Z"/>` +
    `<path class="ln" d="M20.2 30.5 C18.4 19.2 23.6 11.8 32 11.6 C40.4 11.4 45.6 18.4 43.8 30.5"/>` +
    `<path class="ln" d="M21 28.4 C23 22.8 27.2 20.4 32.6 20.6 C38 20.8 41.8 23.2 43.6 27.4"/>` +
    // 額に垂れる前髪の一房（識別点）。眉と重ならないよう1本だけ短く引く。
    `<path class="ln" d="M34.6 20.8 C31.8 22.4 29.6 24 28.6 26.2"/>` +
    // 頭頂の跳ね＝ブランドの稲妻。アプリアイコンと同じ形。
    `<path class="fill" d="M36.2 2.6 L29.2 11 L32.4 11 L31.2 14.4 L37.6 6.4 L34.2 6.4 Z"/>`
  );
}

/** 上半身（作業着の襟・胸ポケット）と、成長段階の記章。 */
function bust(tier: MascotTier): string {
  // Lv10+: 胸の認定バッジ（見習い）。
  const badge =
    tier === 1
      ? `<path class="ln" d="M22.4 52.8 h5.2 v6 h-5.2 Z"/><path class="fill" d="M25.8 53.8 L23.4 57 L24.8 57 L24.2 58.6 L26.6 55.6 L25.2 55.6 Z"/>`
      : "";
  // Lv40+: 襟の階級章（主任技術者）。
  const rank =
    tier === 3
      ? `<path class="lnt" d="M23.4 53 L26.6 51.4 M24.2 55 L27.4 53.4"/><path class="lnt" d="M40.6 53 L37.4 51.4 M39.8 55 L36.6 53.4"/>`
      : "";
  return (
    `<path class="lnt" d="M28.4 45.2 L28.4 48.6"/>` +
    `<path class="lnt" d="M35.6 45.2 L35.6 48.6"/>` +
    `<path class="ln" d="M13.4 62 C13.4 53.2 20.4 48.9 27.6 48.3 L32 53.6 L36.4 48.3 C43.6 48.9 50.6 53.2 50.6 62"/>` +
    `<path class="ln" d="M27.6 48.3 L32 53.6 L36.4 48.3"/>` +
    `<path class="lnt" d="M32 53.6 L32 62"/>` +
    `<path class="lnt" d="M38.4 54.6 h5.6 v4.4 h-5.6 Z"/>` +
    badge +
    rank
  );
}

/**
 * シンクウのSVG（電気工事の装備をまとった相棒。朱の線画）。
 * 文字列を `figure`/`div` の innerHTML として使う（自前生成・信頼済み・ビルド時固定）。
 * 注意: この SVG はコード内でのみ生成され、ユーザー入力・外部データを含まない。
 * 外部由来 SVG を innerHTML に使う場合は sanitize.ts の sanitizeSvg を経由すること。
 * @param tier 成長段階（レベル帯で装備が変わる）
 */
export function mascotSvg(mood: MascotMood, size = 72, tier: MascotTier = 0): string {
  // 耳はヘルメット装着時（tier2/3）には隠れる。
  const ears =
    tier <= 1
      ? `<path class="lnt" d="M20.6 30.6 C18.7 30.1 18.4 33.5 20.9 34.3"/>` +
        `<path class="lnt" d="M43.4 30.6 C45.3 30.1 45.6 33.5 43.1 34.3"/>`
      : "";
  return (
    `<svg viewBox="0 0 64 64" width="${size}" height="${size}" role="img" ` +
    `aria-label="${MASCOT_NAME}（${MOOD_LABEL[mood]}）">` +
    bust(tier) +
    ears +
    // 顔の輪郭（あご）。
    `<path class="soft" d="M20.6 28.8 C20.6 38.4 25.6 45.4 32 45.4 C38.4 45.4 43.4 38.4 43.4 28.8 Z"/>` +
    `<path class="ln" d="M20.6 28.8 C20.6 38.4 25.6 45.4 32 45.4 C38.4 45.4 43.4 38.4 43.4 28.8"/>` +
    headgear(tier) +
    brows(mood) +
    eyes(mood) +
    mouth(mood) +
    moodExtra(mood) +
    `</svg>`
  );
}

export interface MascotContext {
  streakState: StreakState;
  streakDays: number;
  todayCount: number;
  dailyGoal: number;
  /** 今日出す復習の件数（0なら言及しない）。 */
  dueCount: number;
  /** メッセージの言い回しローテーション用（JST 日番号など）。 */
  dayIndex: number;
}

export interface MascotView {
  mood: MascotMood;
  message: string;
}

/** 配列から日替わりで1つ選ぶ（同じ日は同じ文言＝安定、翌日は変わる＝慣れ防止）。 */
function pick(variants: readonly string[], seed: number): string {
  // モジュロ演算で [0, variants.length) の範囲内のため安全。
  return variants[Math.abs(seed) % variants.length] as string;
}

// ---- II-146: 表情選択を 1D ルックアップ表に ----
// streakState × todayGoalMet × dueCount の組み合わせを文字列キーにマップする。
// ネストした if-else（5×3×4 相当）を排除し、追加・テストを容易にする。

type HomeConditionKey = "none" | "broken" | "at-risk" | "goal-met" | "has-due" | "default";

function homeConditionKey(ctx: MascotContext): HomeConditionKey {
  if (ctx.streakState === "none") return "none";
  if (ctx.streakState === "broken") return "broken";
  if (ctx.streakState === "at-risk") return "at-risk";
  if (ctx.todayCount >= ctx.dailyGoal) return "goal-met";
  if (ctx.dueCount > 0) return "has-due";
  return "default";
}

const HOME_MOOD_TABLE: Record<HomeConditionKey, MascotMood> = {
  none: "happy",
  broken: "sad",
  "at-risk": "worried",
  "goal-met": "cheer",
  "has-due": "happy",
  default: "happy",
};

/** ホーム（学習タブ）でのシンクウの一言。状況に応じて表情と台詞が変わる。 */
export function mascotHome(ctx: MascotContext): MascotView {
  const { streakDays, todayCount, dailyGoal, dueCount, dayIndex } = ctx;
  const key = homeConditionKey(ctx);
  const mood = HOME_MOOD_TABLE[key];
  switch (key) {
    case "none":
      return {
        mood,
        message: `はじめまして、${MASCOT_NAME}だ！⚡ まずは1問、いっしょにやってみよう。`,
      };
    case "broken":
      return {
        mood,
        message: pick(
          [
            "おかえり！待ってたぞ。軽い1問から再開しよう⚡",
            "また会えてうれしい！今日から新しい炎を育てよう🔥",
            "ブランクは気にしない。戻ってきたキミがえらい！",
          ],
          dayIndex,
        ),
      };
    case "at-risk":
      return {
        mood,
        message: pick(
          [
            `🔥${streakDays}日の炎が消えちまう…！1問だけでもやろう。`,
            `今日まだ0問だぞ…3分だけ、な？ ${streakDays}日連続を守ろう！`,
            `ストリークがピンチだ！キミの${streakDays}日を無駄にしたくない。`,
          ],
          dayIndex,
        ),
      };
    case "goal-met":
      return {
        mood,
        message: pick(
          [
            "今日の目標達成！キミ、ほんとにすごいよ🎉",
            "やりきったな！明日もオレと続けよう⚡",
            "目標クリア！この積み重ねが合格をつくるんだ✨",
          ],
          dayIndex,
        ),
      };
    case "has-due": {
      const remain = Math.max(1, dailyGoal - todayCount);
      return {
        mood,
        message: pick(
          [
            `復習が ${dueCount} 件待ってる。忘れる前が勝負だ！`,
            `今日あと ${remain} 問！まず復習 ${dueCount} 件から片付けよう。`,
            `復習 ${dueCount} 件→新しい問題、の順がオススメだ⚡`,
          ],
          dayIndex,
        ),
      };
    }
    default: {
      const remain = Math.max(1, dailyGoal - todayCount);
      return {
        mood,
        message: pick(
          [
            `今日あと ${remain} 問で目標達成！いいペースだ⚡`,
            `あと ${remain} 問！コツコツが合格への最短ルートだぞ。`,
            `調子いいな！あと ${remain} 問、いってみよう！`,
          ],
          dayIndex,
        ),
      };
    }
  }
}

/** 電験まめ知識（タップで聞ける小ネタ。教科書レベルの定番事実のみ＝検証可能）。 */
export const MASCOT_TRIVIA: readonly string[] = [
  "「電験」の正式名称は電気主任技術者試験。経済産業省所管の国家資格だぞ⚡",
  "オームの法則 V=RI は1827年発表。当時はなかなか認められなかったんだ",
  "単位のボルトはイタリアのボルタ、アンペアはフランスのアンペールが由来だ",
  "日本の商用周波数は東日本50Hz・西日本60Hz。明治期に輸入した発電機の違いの名残なんだ",
  "電験二種があれば17万V未満の事業用電気工作物の主任技術者になれるぞ",
  "キルヒホッフの法則は電流則(KCL)と電圧則(KVL)。回路解析の二本柱だな",
  "変圧器の原理は電磁誘導。ファラデーが1831年に発見した現象だ",
  "送電線が3本セットなのは三相交流だから。少ない導体で大きな電力を送れるんだ",
  "%Z（パーセントインピーダンス）は基準容量を揃えれば足し算できる優れものだ",
  "同期機の回転速度は N=120f/p。周波数と極数で決まるんだ",
  "電験は三種→二種→一種の順に扱える電圧が広がる。一種は無制限だ！",
  "力率を改善すると同じ有効電力でも電流が減って、線路損失が下がるんだ",
];

/** まめ知識を順繰りに返す（インデックスは呼び出し側が保持。範囲外は巡回）。 */
export function mascotTip(index: number): string {
  // モジュロ演算で [0, MASCOT_TRIVIA.length) の範囲内のため安全。
  return MASCOT_TRIVIA[((index % MASCOT_TRIVIA.length) + MASCOT_TRIVIA.length) % MASCOT_TRIVIA.length] as string;
}

// ---- II-147: tipIndex メモ化（日決定論的なインデックスをキャッシュ） ----

interface TipIndexCache {
  dayIndex: number;
  tipCount: number;
  index: number;
}

let _tipIndexCache: TipIndexCache | null = null;

/**
 * 日番号から決定論的な tipIndex を計算し、メモ化して返す。
 * 同一日 (dayIndex) では同じインデックスを返す（毎描画の再計算を回避）。
 * 翌日になると新しいインデックスを計算する。
 */
export function tipIndexForDay(dayIndex: number): number {
  const tipCount = MASCOT_TRIVIA.length;
  if (_tipIndexCache !== null && _tipIndexCache.dayIndex === dayIndex && _tipIndexCache.tipCount === tipCount) {
    return _tipIndexCache.index;
  }
  // dayIndex をシードにして決定論的に選ぶ（日替わり・巡回）。
  const index = ((dayIndex % tipCount) + tipCount) % tipCount;
  _tipIndexCache = { dayIndex, tipCount, index };
  return index;
}

/** tipIndex キャッシュを強制クリアする（テスト・リセット用）。 */
export function clearTipIndexCache(): void {
  _tipIndexCache = null;
}

/** 解答直後のリアクション（正誤とコンボで変わる短い一言）。 */
export function mascotCheer(correct: boolean, combo: number, seed = 0): string {
  if (!correct) {
    return pick(
      ["ドンマイ！間違いは伸びしろだ", "ここで覚えれば本番で勝てる！", "解説を読んだら、もう一歩前進だ！"],
      seed,
    );
  }
  if (combo >= 5) return `⚡${combo}コンボ！神がかってる！`;
  if (combo >= 3) return `⚡${combo}コンボ！ノってきたな！`;
  return pick(["やったな！", "その調子！", "ナイス！⚡"], seed + combo);
}
