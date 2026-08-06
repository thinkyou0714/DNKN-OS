/**
 * first-party ファネル計測（UTM 取得）の最小実装。
 * 収益化の計測基盤。third-party script を使わず same-origin `/api/track` のみで完結（CSP clean）。
 *
 * 注: UTM ロジックの正典は `lib/analytics/utm.ts`（framework 非依存・@denken/core 予定）。
 *     web-next は現状 standalone のため当面ここに最小版を置き、T02/T04 の workspace 化で統合する。
 */

export const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
export type UtmKey = (typeof UTM_KEYS)[number];
export type Utm = Partial<Record<UtmKey, string>>;

/** URL の query 文字列から UTM パラメータを抽出する（存在するキーのみ）。 */
export function parseUtm(search: string): Utm {
  const params = new URLSearchParams(search);
  const out: Utm = {};
  for (const key of UTM_KEYS) {
    const value = params.get(key);
    if (value) out[key] = value;
  }
  return out;
}

/** /api/track に送る計測イベント。PII は載せない（event 名 / path / UTM のみ）。 */
export interface TrackEvent {
  event: string;
  path: string;
  utm?: Utm;
}
