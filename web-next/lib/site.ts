/** LP / pricing の表示コンテンツ（単一情報源）。価格は調査（Studyplus 帯）に基づく暫定値。 */

export const SITE = {
  name: "DENKEN-OS",
  tagline: "電験合格を「再現性のある学習プロセス」に。",
  description:
    "電験（電気主任技術者試験）を独学で合格するための学習 OS。今日の一問・弱点適応出題・学習記録を、AI に答えを書かせない検証済みの問題で。",
  repoUrl: "https://github.com/thinkyou0714/denken-os",
  // 現行のオフライン学習アプリ（GitHub Pages 配信の PWA）。無料 CTA の着地点。
  appUrl: "https://thinkyou0714.github.io/denken-os/",
  status: "pre-alpha（開発中）",
} as const;

export interface Feature {
  title: string;
  body: string;
}

export const FEATURES: Feature[] = [
  {
    title: "今日の一問",
    body: "毎日1問から。忘却曲線（SM-2 / FSRS）で「次に解くべき一問」を出す。オフラインでも動く PWA。",
  },
  {
    title: "弱点に最短で当てる",
    body: "解答ログから弱点論点を診断し、克服すべき問題を優先出題。得意は間隔を空け、苦手を厚く。",
  },
  {
    title: "答えは AI に書かせない",
    body: "正解はコードで決定論的に算出し、解説の数値と照合。一致しないものは破棄する反ハルシネーション設計。",
  },
  {
    title: "記録が積み上がる",
    body: "連続日数・学習時間・正答率を記録。端末を替えても続きから（Pro で複数端末同期）。",
  },
];

export interface Plan {
  id: "free" | "pro";
  name: string;
  price: string;
  period: string;
  tagline: string;
  features: string[];
  highlighted?: boolean;
}

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "無料",
    price: "¥0",
    period: "",
    tagline: "まず1問から。オフラインでも動く。",
    features: [
      "今日の一問（1日1問）",
      "答え＋要点解説",
      "固定問題セット",
      "学習記録のシェア画像",
      "完全オフライン（PWA・バックエンド不要）",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "¥980",
    period: "／月（年額は約2ヶ月分お得）",
    tagline: "無限に解いて、弱点に最短で当てる。",
    highlighted: true,
    features: [
      "類題を無限に演習",
      "弱点適応出題（弱点を優先）",
      "深い解説・解法の導出",
      "学習記録・進捗の蓄積",
      "複数端末で同期",
    ],
  },
];
