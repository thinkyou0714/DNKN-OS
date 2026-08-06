import { NextResponse } from "next/server";
import { UTM_KEYS } from "@/lib/analytics";

/**
 * first-party 計測 sink（same-origin・CSP clean）。
 *
 * 受理して 204 を返すのみ（best-effort）。永続化は認証・DB 接続後に集計テーブルへ（T13/T16）。
 * PII は保存対象にしない: event 名 / path / UTM のみを対象に、長さも制限する。
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  if (body) {
    const event = typeof body.event === "string" ? body.event.slice(0, 64) : "unknown";
    const path = typeof body.path === "string" ? body.path.slice(0, 256) : "";
    const utm: Record<string, string> = {};
    const rawUtm = body.utm;
    if (rawUtm && typeof rawUtm === "object") {
      for (const key of UTM_KEYS) {
        const value = (rawUtm as Record<string, unknown>)[key];
        if (typeof value === "string") utm[key] = value.slice(0, 128);
      }
    }
    // TODO(T13/T16): 認証後、集計用テーブル（answer_logs 隣接）へ永続化。現状は受理のみ。
    void event;
    void path;
    void utm;
  }

  return new NextResponse(null, { status: 204 });
}
