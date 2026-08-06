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

export type MascotMood = "happy" | "cheer" | "teach" | "worried" | "sad" | "sleepy";

const MOOD_LABEL: Record<MascotMood, string> = {
  happy: "にこにこ",
  cheer: "大よろこび",
  teach: "せつめい",
  worried: "しんぱい",
  sad: "しょんぼり",
  sleepy: "おやすみ",
};

/** 強気の表情グループ（眉が内側に下がる）。しんぱい・しょんぼりだけが逆になる。 */
const CONFIDENT: ReadonlySet<MascotMood> = new Set<MascotMood>(["happy", "cheer", "teach", "sleepy"]);

/** レベル帯（成長段階）。0=ノーマル / 1=Lv10+ / 2=Lv20+ / 3=Lv40+。 */
export type MascotTier = 0 | 1 | 2 | 3;

/** レベル → 成長段階。レベルが上がるとシンクウの装備が変わる（収集・成長の楽しみ）。 */
export function tierForLevel(level: number): MascotTier {
  if (level >= 40) return 3;
  if (level >= 20) return 2;
  if (level >= 10) return 1;
  return 0;
}

/** 眉（強気=内側が下がる / 弱気=内側が上がる）。太めの直線で意志の強さを出す。 */
function brows(mood: MascotMood): string {
  if (CONFIDENT.has(mood)) {
    return `<path class="ln" d="M23.6 27.6 L29.6 29.4"/><path class="ln" d="M40.4 27.6 L34.4 29.4"/>`;
  }
  return `<path class="ln" d="M23.6 29.8 L29.6 28"/><path class="ln" d="M40.4 29.8 L34.4 28"/>`;
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
    return `<path class="ln" d="M24.9 32.9 L29.1 32.9"/><path class="ln" d="M34.9 32.9 L39.1 32.9"/>`;
  }
  return `<circle class="fill" cx="27" cy="32.9" r="1.9"/><circle class="fill" cx="37" cy="32.9" r="1.9"/>`;
}

/** 口（気分ごとに差し替え）。 */
function mouth(mood: MascotMood): string {
  switch (mood) {
    case "cheer":
      // 歯を見せた大口。内側を淡く塗って厚みを出す。
      return (
        `<path class="soft" d="M27.6 38.6 C30 43.8 34 43.8 36.4 38.6 Z"/>` +
        `<path class="ln" d="M27.6 38.6 C30 43.8 34 43.8 36.4 38.6 Z"/>`
      );
    case "teach":
      // 説明中のにやり顔（片側を上げる）。
      return `<path class="ln" d="M28 39.6 C30.4 42.4 34 42 35.8 39"/>`;
    case "worried":
      return `<path class="ln" d="M28.4 40.6 C29.8 39.2 31.2 41.2 32.6 39.9 C33.8 38.9 34.8 40.2 35.6 40.6"/>`;
    case "sad":
      return `<path class="ln" d="M28.2 41.6 C30.2 38.9 33.8 38.9 35.8 41.6"/>`;
    case "sleepy":
      return `<path class="ln" d="M30.4 39.8 C31.6 38.8 32.4 38.8 33.6 39.8 C32.4 40.9 31.6 40.9 30.4 39.8 Z"/>`;
    default:
      // 自信のある笑み。
      return `<path class="ln" d="M28.4 39.4 C30.4 41.9 33.6 41.9 35.6 39.4"/>`;
  }
}

/**
 * ひらめきの電球（せつめい顔の記号）。
 * 参考画では人差し指を立てているが、64px の線画では指も手も塊に潰れて読めないため、
 * 意味だけを電球に託す（記号のほうが小サイズでは強い）。カール毛と干渉しない左上に置く。
 */
function bulb(mood: MascotMood): string {
  if (mood !== "teach") return "";
  return (
    `<circle class="ln" cx="12.8" cy="16.2" r="3.6"/>` +
    `<path class="lnt" d="M11 20.1 L14.6 20.1 M11.5 21.6 L14.1 21.6"/>` +
    `<path class="lnt" d="M12.8 10 L12.8 8.1 M17.3 11.9 L18.7 10.6 M8.3 11.9 L6.9 10.6"/>`
  );
}

/** 気分の添え物（汗・涙・zzz・歓喜の輝き）。表情だけに頼らず一目で伝える。 */
function moodExtra(mood: MascotMood): string {
  switch (mood) {
    case "worried":
      return (
        `<path class="soft" d="M15.6 27.8 C17.2 30.6 17.6 32.4 16 33 C14.6 33.4 14 31.8 15.6 27.8 Z"/>` +
        `<path class="lnt" d="M15.6 27.8 C17.2 30.6 17.6 32.4 16 33 C14.6 33.4 14 31.8 15.6 27.8 Z"/>`
      );
    case "sad":
      return (
        `<path class="soft" d="M25.6 35.8 C24.7 37.8 24.5 39 25.6 39.3 C26.7 39 26.5 37.8 25.6 35.8 Z"/>` +
        `<path class="lnt" d="M25.6 35.8 C24.7 37.8 24.5 39 25.6 39.3 C26.7 39 26.5 37.8 25.6 35.8 Z"/>`
      );
    case "sleepy":
      return (
        `<text class="fill" x="51" y="20.5" font-size="8.5" font-weight="700">z</text>` +
        `<text class="fill" x="56.5" y="12.5" font-size="6" font-weight="700">z</text>`
      );
    case "cheer":
      // 歓喜の輝き（4条の星。＋記号に見えないよう先を細らせる）。
      return (
        `<path class="fill" d="M53.6 12.2 L54.6 15.4 L57.8 16.4 L54.6 17.4 L53.6 20.6 L52.6 17.4 L49.4 16.4 L52.6 15.4 Z"/>` +
        `<path class="fill" d="M8.4 21.6 L9.1 24 L11.5 24.7 L9.1 25.4 L8.4 27.8 L7.7 25.4 L5.3 24.7 L7.7 24 Z"/>`
      );
    default:
      return "";
  }
}

/** ブランドの記章（六角形に稲妻＋開いた本）。胸章とヘルメット前立てで共用する。 */
function emblem(cx: number, cy: number, s: number, cls = "ln"): string {
  const p = (x: number, y: number) => `${(cx + x * s).toFixed(2)} ${(cy + y * s).toFixed(2)}`;
  return (
    `<path class="${cls}" d="M${p(-1, -0.5)} L${p(0, -1)} L${p(1, -0.5)} L${p(1, 0.5)} L${p(0, 1)} L${p(-1, 0.5)} Z"/>` +
    `<path class="fill" d="M${p(0.28, -0.62)} L${p(-0.42, 0.1)} L${p(0.02, 0.1)} L${p(-0.2, 0.6)} L${p(0.5, -0.14)} L${p(0.06, -0.14)} Z"/>` +
    `<path class="lnt" d="M${p(-0.62, 0.62)} L${p(0, 0.36)} L${p(0.62, 0.62)}"/>`
  );
}

/**
 * 髪（tier 0/1）またはヘルメット（tier 2/3）。
 * 髪は後ろへ流した尖りで、向かって右に長いカール毛が一房垂れる＝シンクウの識別点。
 * ヘルメットは参考画と同じ白（地色）で、前立てにブランドの記章を入れる。
 */
function headgear(tier: MascotTier): string {
  if (tier >= 2) {
    // 安全ヘルメット（電気工事の現場装備）。白地に記章。
    const rank =
      tier === 3
        ? // 主任技術者: 庇に金の一文字を入れる。金は「達成」だけに使う色。
          `<path class="goldline" d="M16.4 30.4 C22.6 28.4 41.4 28.4 47.6 30.4"/>`
        : "";
    return (
      `<path class="plate" d="M16.4 28.4 C16.4 17.2 23.4 10.4 32 10.4 C40.6 10.4 47.6 17.2 47.6 28.4 Z"/>` +
      `<path class="ln" d="M16.4 28.4 C16.4 17.2 23.4 10.4 32 10.4 C40.6 10.4 47.6 17.2 47.6 28.4"/>` +
      `<path class="ln" d="M14.6 28.9 C21.6 26.6 42.4 26.6 49.4 28.9"/>` +
      `<path class="lnt" d="M22.8 13 C21.2 17.8 20.8 23.2 21 27.2"/>` +
      `<path class="lnt" d="M41.2 13 C42.8 17.8 43.2 23.2 43 27.2"/>` +
      emblem(32, 19.6, 4.6) +
      rank +
      // ヘルメットの下からのぞく揉み上げ。
      `<path class="lnt" d="M21.2 29.2 C20.8 31.6 21 33.6 21.6 35"/>` +
      `<path class="lnt" d="M42.8 29.2 C43.2 31.6 43 33.6 42.4 35"/>`
    );
  }
  // 後ろへ流した髪。64px の線画では輪郭を尖らせると道化帽のギザギザに見えるため、
  // シルエットは「流れのあるひと塊」にして、毛の勢いは内側の筋で示す。
  const mass =
    "M20.2 30.4 C17.4 24 17.4 16.6 21.4 11.8 C22.6 14.6 23.8 16.4 25.2 17.4 " +
    "C26.2 12.6 29.2 8.6 33.6 6.8 C34.2 10.4 35.2 13 36.8 14.6 " +
    "C38.6 11.6 41 10.4 43 10.8 C44.2 15.6 44.2 23.6 43.4 29.4";
  return (
    `<path class="soft" d="${mass} C41.8 23.2 38 20.8 32.6 20.6 C27.2 20.4 23 22.8 21 28.4 Z"/>` +
    `<path class="ln" d="${mass}"/>` +
    // 生え際（額の上）。
    `<path class="ln" d="M21 28.4 C23 22.8 27.2 20.4 32.6 20.6 C38 20.8 41.8 23.2 43.4 27.4"/>` +
    // 毛流れの筋（内側に2本だけ。後ろへ流していることを示す）。
    `<path class="lnt" d="M24.8 24 C26.6 18.6 29.4 14.4 33 11.8"/>` +
    `<path class="lnt" d="M31.6 20.8 C33.8 17.4 36.4 14.8 39.2 13.4"/>` +
    // 向かって右に垂れる一房（識別点）。先は小さく跳ねるだけに留める
    // （戻りを大きく取ると閉じた輪になってヘッドホンに見えてしまう）。
    `<path class="curl" d="M42.8 15.4 C46.4 18.4 47.6 23.4 46.6 28.2 C46.2 30.4 45.4 32 44.4 33.2 C43.8 33.9 44 34.9 45 34.7"/>`
  );
}

/** 上半身（開襟の作業ジャケット・胸章・工具ポケット）と、成長段階の記章。 */
function bust(tier: MascotTier): string {
  // Lv40+: 襟の階級章（主任技術者）。
  const rank =
    tier === 3
      ? `<path class="lnt" d="M25.4 50.6 L28.2 49.2 M26.4 52.4 L29.2 51"/>` +
        `<path class="lnt" d="M38.6 50.6 L35.8 49.2 M37.6 52.4 L34.8 51"/>`
      : "";
  return (
    `<path class="lnt" d="M28.6 45.2 L28.4 48.8"/>` +
    `<path class="lnt" d="M35.4 45.2 L35.6 48.8"/>` +
    // 肩と、先の尖った作業ジャケットの襟。
    `<path class="ln" d="M12.6 62 C12.6 53 19.6 48.8 27.6 48.4"/>` +
    `<path class="ln" d="M36.4 48.4 C44.4 48.8 51.4 53 51.4 62"/>` +
    `<path class="ln" d="M27.6 48.4 L23.6 53.8 L29.6 51.4"/>` +
    `<path class="ln" d="M36.4 48.4 L40.4 53.8 L34.4 51.4"/>` +
    `<path class="ln" d="M29.6 51.4 L32 55.2 L34.4 51.4"/>` +
    // 前立て（ファスナー）。
    `<path class="lnt" d="M32 55.2 L32 62"/>` +
    // 胸章（ブランドの記章）。tier1 で初めて付く＝見習いの認定。
    (tier >= 1 ? emblem(22.6, 56.6, 3.7, "lnt") : "") +
    // 工具ポケットと検電ドライバー。
    `<path class="lnt" d="M37.8 55.6 L44.6 55.6 L44.6 61 L37.8 61 Z"/>` +
    `<path class="ln" d="M41 55.6 L41 51.4"/>` +
    `<circle class="fill" cx="41" cy="50.6" r="1"/>` +
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
  // 耳は向かって左のみ（右はカール毛が覆う）。ヘルメット装着時は隠れる。
  const ear = tier <= 1 ? `<path class="lnt" d="M20.6 30.6 C18.7 30.1 18.4 33.5 20.9 34.3"/>` : "";
  return (
    `<svg viewBox="0 0 64 64" width="${size}" height="${size}" role="img" ` +
    `aria-label="${MASCOT_NAME}（${MOOD_LABEL[mood]}）">` +
    bust(tier) +
    ear +
    // 顔の輪郭（あご）。
    `<path class="soft" d="M20.6 28.8 C20.6 38.4 25.6 45.4 32 45.4 C38.4 45.4 43.4 38.4 43.4 28.8 Z"/>` +
    `<path class="ln" d="M20.6 28.8 C20.6 38.4 25.6 45.4 32 45.4 C38.4 45.4 43.4 38.4 43.4 28.8"/>` +
    headgear(tier) +
    brows(mood) +
    eyes(mood) +
    mouth(mood) +
    bulb(mood) +
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
