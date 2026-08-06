import { NextResponse } from "next/server";
import { supabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/**
 * magic-link のコールバック。`?code=` を session に交換して `next`（既定 /account）へリダイレクトする。
 * 最も抜けやすい部品（研究ブリーフ #13）。未接続（休眠）時は sign-in へ戻す。
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/account";

  if (code && supabaseConfigured()) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/sign-in?error=1`);
}
